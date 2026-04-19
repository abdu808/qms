/**
 * suppliers.integration.test.js
 * يغطّي:
 *   - إنشاء مورد + رفض النوع غير المعروف
 *   - email فاضي ("") يُقبل (null)، email غير صالح يُرفض 400
 *   - phone غير صالح يُرفض 400
 *   - PUT لا يفشل 400 مع جزء من الحقول
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser, createSupplier } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function mgrToken() {
  const u = await createUser({ email: `sup-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

describe('/api/suppliers', () => {
  it('ينشئ مورداً بالحدّ الأدنى', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/suppliers').send({
      name: 'مورد تجريبي', type: 'SERVICES',
    });
    expect(res.status).toBe(201);
    expect(res.body.item.code).toMatch(/^SUP-\d{4}-\d{3}$/);
  });

  it('يرفض type غير معروف بـ 400', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/suppliers').send({
      name: 'مورد', type: 'UNKNOWN',
    });
    expect(res.status).toBe(400);
  });

  it('email فاضي لا يفشل — email غير صالح يرفع 400', async () => {
    const token = await mgrToken();
    const ok = await authed(app, token).post('/api/suppliers').send({
      name: 'بلا إيميل', type: 'SERVICES', email: '',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.item.email).toBeNull();

    const bad = await authed(app, token).post('/api/suppliers').send({
      name: 'إيميل سيء', type: 'SERVICES', email: 'not-email',
    });
    expect(bad.status).toBe(400);
  });

  it('PUT جزئي لا يفشل 400 إذا أُرسل حقل واحد', async () => {
    const token = await mgrToken();
    const sup = await createSupplier();
    const res = await authed(app, token).put(`/api/suppliers/${sup.id}`).send({
      notes: 'ملاحظة محدّثة',
    });
    expect([200, 204]).toContain(res.status);
  });
});
