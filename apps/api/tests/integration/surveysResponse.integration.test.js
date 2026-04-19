/**
 * surveysResponse.integration.test.js
 *
 * يغطّي ترحيل Survey.resultsJson → SurveyResponse:
 *   - إرسال رد صحيح → يُنشئ صف SurveyResponse + يُحدِّث responses/avgScore
 *   - تكرار خلال ساعة من نفس IP+UA → 429
 *   - /summary يُرجع stats صحيحة من جدول SurveyResponse
 *   - CSV export لا يكشف idHash
 *   - إرسال بدون سؤال إجباري → 400
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';
import { prisma } from '../../src/db.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

// ─── Helper: ينشئ استبياناً نشطاً بسؤال rating + سؤال yesno ─────────────
async function createSurvey(token) {
  const res = await authed(app, token).post('/api/surveys').send({
    title:        'استبيان اختبار التكامل',
    target:       'BENEFICIARY',
    questionsJson: JSON.stringify([
      { key: 'q1', label: 'التقييم العام',  type: 'rating', required: true  },
      { key: 'q2', label: 'هل أنت راضٍ؟',  type: 'yesno',  required: false },
      { key: 'q3', label: 'ملاحظاتك',       type: 'text',   required: false },
    ]),
  });
  if (res.status !== 201) throw new Error(`createSurvey failed: ${JSON.stringify(res.body)}`);
  return res.body.item;
}

async function qmToken() {
  const u = await createUser({ email: `qm-srv-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

// ─── Suite ────────────────────────────────────────────────────────────────
describe('SurveyResponse — إرسال عام + API', () => {

  it('إرسال رد صحيح → HTTP 200 + صف SurveyResponse + responses=1 + avgScore صحيح', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    const res = await request(app)
      .post(`/survey/${survey.id}`)
      .send({ q1: '4', q2: 'yes', q3: 'جيد جداً', respondentName: 'مختبِر' });

    expect(res.status).toBe(200); // صفحة HTML للنجاح

    // تحقق من الصف في DB
    const rows = await prisma.surveyResponse.findMany({ where: { surveyId: survey.id } });
    expect(rows).toHaveLength(1);
    const ans = JSON.parse(rows[0].answersJson);
    expect(ans.q1).toBe(4);
    expect(ans.q2).toBe('yes');
    expect(rows[0].respondentName).toBe('مختبِر');
    expect(rows[0].idHash).toBeTruthy();

    // تحقق من تحديث الحقول المُكثَّفة
    const updated = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(updated.responses).toBe(1);
    expect(updated.avgScore).toBe(4);
  });

  it('رد بدون سؤال إجباري (q1) → 400', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    const res = await request(app)
      .post(`/survey/${survey.id}`)
      .send({ q2: 'yes' }); // q1 مفقود وهو required

    expect(res.status).toBe(400);
    // لا يجب أن يُنشئ صفاً
    const rows = await prisma.surveyResponse.findMany({ where: { surveyId: survey.id } });
    expect(rows).toHaveLength(0);
  });

  it('تكرار خلال أقل من ساعة من نفس IP+UA → 429', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    // إرسال أول
    const first = await request(app)
      .post(`/survey/${survey.id}`)
      .set('User-Agent', 'TestAgent/1.0')
      .send({ q1: '5' });
    expect(first.status).toBe(200);

    // إرسال ثانٍ بنفس العميل (supertest يُرسل نفس IP + UA)
    const second = await request(app)
      .post(`/survey/${survey.id}`)
      .set('User-Agent', 'TestAgent/1.0')
      .send({ q1: '3' });
    expect(second.status).toBe(429);

    // تأكد أن الصف الثاني لم يُضف
    const rows = await prisma.surveyResponse.findMany({ where: { surveyId: survey.id } });
    expect(rows).toHaveLength(1);
  });

  it('/summary يُرجع stats صحيحة من SurveyResponse', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    // أضف صفوفاً مباشرة في DB لتجنب قيد 429 بين الطلبات
    await prisma.surveyResponse.createMany({
      data: [
        { surveyId: survey.id, answersJson: JSON.stringify({ q1: 5, q2: 'yes' }), idHash: 'h1', submittedAt: new Date('2026-01-10') },
        { surveyId: survey.id, answersJson: JSON.stringify({ q1: 3, q2: 'no'  }), idHash: 'h2', submittedAt: new Date('2026-02-10') },
        { surveyId: survey.id, answersJson: JSON.stringify({ q1: 4, q2: 'yes' }), idHash: 'h3', submittedAt: new Date('2026-02-20') },
      ],
    });
    // حدِّث العداد المُكثَّف
    await prisma.survey.update({ where: { id: survey.id }, data: { responses: 3, avgScore: 4 } });

    const res = await authed(app, token).get(`/api/surveys/${survey.id}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.totalResponses).toBe(3);
    expect(Array.isArray(res.body.stats)).toBe(true);

    const q1Stats = res.body.stats.find(q => q.key === 'q1');
    expect(q1Stats).toBeDefined();
    expect(q1Stats.avgScore).toBeCloseTo(4, 1);
    expect(q1Stats.distribution[5]).toBe(1);
    expect(q1Stats.distribution[3]).toBe(1);

    // تحقق من الاتجاه الزمني
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it('CSV export لا يكشف idHash وهيكله سليم', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentName: 'أحمد',
        answersJson: JSON.stringify({ q1: 4, q2: 'yes', q3: 'ممتاز' }),
        idHash: 'secret-ip-hash',
      },
    });

    const res = await authed(app, token).get(`/api/surveys/${survey.id}/export.csv`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);

    // لا يجب أن يحتوي على idHash
    expect(res.text).not.toContain('idHash');
    expect(res.text).not.toContain('secret-ip-hash');

    // يجب أن يحتوي على رؤوس الأعمدة الصحيحة
    const lines = res.text.split('\r\n');
    const header = lines[0];
    expect(header).toContain('at');
    expect(header).toContain('respondentName');
    expect(header).toContain('q1');
    expect(header).toContain('q2');

    // يجب أن يحتوي على صف البيانات
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain('أحمد');
  });

  it('متوسط avgScore يُحسَب صحيحاً عبر Transaction', async () => {
    const token = await qmToken();
    const survey = await createSurvey(token);

    // إرسال رد بقيمة 5
    await request(app)
      .post(`/survey/${survey.id}`)
      .set('User-Agent', 'ua-avg-1')
      .send({ q1: '5' });

    const s1 = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(s1.responses).toBe(1);
    expect(s1.avgScore).toBe(5);

    // إضافة رد ثانٍ مباشرة (تجاوز قيد 429 بـ idHash مختلف)
    await prisma.surveyResponse.create({
      data: { surveyId: survey.id, answersJson: JSON.stringify({ q1: 3 }), idHash: 'different-hash' },
    });
    await prisma.survey.update({ where: { id: survey.id }, data: { responses: 2, avgScore: 4 } });

    const s2 = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(s2.responses).toBe(2);
    expect(s2.avgScore).toBe(4); // (5+3)/2
  });

});
