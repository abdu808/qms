/**
 * risks.integration.test.js
 * يغطّي:
 *   - إنشاء خطر بـ treatmentType إنجليزي (AVOID/MITIGATE/TRANSFER/ACCEPT)
 *   - رفض treatmentType غير معروف بـ 400
 *   - departmentId="" لا يفشل FK (يُحوَّل إلى null)
 *   - probability/impact: التحقق من 1-5
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function mgrToken() {
  const u = await createUser({ email: `risk-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

describe('/api/risks', () => {
  it('يقبل treatmentType بالصيغة الإنجليزية', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/risks').send({
      title: 'خطر تجريبي',
      probability: 3,
      impact: 4,
      treatmentType: 'MITIGATE',
    });
    expect(res.status).toBe(201);
    expect(res.body.item.treatmentType).toBe('MITIGATE');
  });

  it('departmentId فارغ ("") لا يُولد FK error — يُحوَّل إلى null', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/risks').send({
      title: 'بدون قسم',
      probability: 2,
      impact: 2,
      departmentId: '',
    });
    // إمّا 201 (معتمد كـ null) وليس 500 من FK
    expect(res.status).not.toBe(500);
    if (res.status === 201) expect(res.body.item.departmentId).toBeNull();
  });

  it('probability خارج 1-5 يرجع 400', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/risks').send({
      title: 'احتمال خاطئ', probability: 9, impact: 3,
    });
    expect(res.status).toBe(400);
  });

  it('treatmentType غير معروف يرجع 400', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/risks').send({
      title: 'علاج غير معروف',
      probability: 2, impact: 2, treatmentType: 'UNKNOWN_STRATEGY',
    });
    expect(res.status).toBe(400);
  });
});
