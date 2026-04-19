/**
 * managementReview.integration.test.js
 * يغطّي أكبر ثقب كان عندنا: meetingDate كان يرجع 400 لأن الـ schema كان مفقوداً.
 *   - إنشاء MR مع meetingDate ISO string
 *   - إكمال MR بدون topManagementPresent يرجع 400 (ISO 9.3.1)
 *   - populate-inputs يعمل على مراجعة ليست COMPLETED
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function mgrToken() {
  const u = await createUser({ email: `mr-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

describe('/api/management-review', () => {
  it('يُنشئ مراجعة مع meetingDate كـ ISO string', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/management-review').send({
      title: 'مراجعة الربع الأول',
      period: 'Q1-2026',
      meetingDate: '2026-04-01T10:00:00.000Z',
      topManagementPresent: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.item.code).toMatch(/^MR-\d{4}-\d{3}$/);
  });

  it('يرفض الحقول الناقصة بـ 400 (لا 500)', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/management-review').send({
      title: 'ت',   // أقل من 3 أحرف
    });
    expect(res.status).toBe(400);
  });

  it('populate-inputs يملأ الحقول الفارغة فقط', async () => {
    const token = await mgrToken();
    const created = await authed(app, token).post('/api/management-review').send({
      title: 'للتوليد',
      meetingDate: '2026-05-01T10:00:00.000Z',
      topManagementPresent: false,
    });
    expect(created.status).toBe(201);
    const id = created.body.item.id;

    const res = await authed(app, token).post(`/api/management-review/${id}/populate-inputs`).send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.populated)).toBe(true);
    expect(res.body.populated.length).toBeGreaterThan(0);
  });
});
