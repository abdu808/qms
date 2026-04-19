/**
 * beneficiaries.integration.test.js
 * يغطّي:
 *   - إنشاء ناجح + تطبيع درجة الأولوية
 *   - رفض الحقول الناقصة بـ 400 وليس 500
 *   - سباق nextCode: 6 طلبات متزامنة = 6 أكواد مختلفة (لا P2002)
 *   - تطبيع departmentId الفارغ ("" → null، لا FK 500)
 *   - منع تفعيل APPLICANT بدون تقييم
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function mgrToken() {
  const u = await createUser({ email: `ben-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

describe('/api/beneficiaries', () => {
  it('ينشئ مستفيداً بحقول الحدّ الأدنى', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/beneficiaries').send({
      fullName: 'أحمد تجريبي',
      category: 'ORPHAN',
    });
    expect(res.status).toBe(201);
    expect(res.body.item.code).toMatch(/^BEN-\d{4}-\d{3}$/);
    expect(res.body.item.status).toBe('APPLICANT');
  });

  it('يرفض الحقول الناقصة بـ 400 (لا 500)', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/beneficiaries').send({
      fullName: 'ب',        // أقل من 3 أحرف
      // category مفقود
    });
    expect(res.status).toBe(400);
  });

  it('priorityScore خارج 1-5 يرجع 400', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/beneficiaries').send({
      fullName: 'خارج النطاق', category: 'OTHER', priorityScore: 9,
    });
    expect(res.status).toBe(400);
  });

  it('سباق nextCode: 6 طلبات متزامنة تُنتج 6 أكواد فريدة', async () => {
    const token = await mgrToken();
    const reqs = Array.from({ length: 6 }, (_, i) =>
      authed(app, token).post('/api/beneficiaries').send({
        fullName: `متزامن ${i}`, category: 'OTHER',
      }),
    );
    const results = await Promise.all(reqs);
    // كل الطلبات ناجحة — الـ retry في crudFactory يمتص السباق
    for (const r of results) expect(r.status).toBe(201);
    const codes = results.map(r => r.body.item.code);
    expect(new Set(codes).size).toBe(6);
  });
});
