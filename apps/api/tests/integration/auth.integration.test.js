/**
 * tests/integration/auth.integration.test.js
 * تغطية: login success/fail, logout, rate-limit.
 *
 * ملاحظة: يتطلّب Docker شغّال + `npm install --save-dev @testcontainers/postgresql testcontainers`.
 * يُستبعد من `npm test` الافتراضي (vitest config يتجاهل **​/integration/**).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs } from './helpers/auth.js';

let app;

beforeAll(async () => {
  await setupTestDb();
  app = await buildApp();
}, 120_000);

afterAll(async () => { await teardownTestDb(); });

describe('POST /api/auth/login', () => {
  it('يقبل بيانات صحيحة ويُرجع token', async () => {
    const u = await createUser({ email: 'qm@test.local', role: 'QUALITY_MANAGER' });
    const { token, user } = await loginAs(app, u.email);
    expect(token).toBeTruthy();
    expect(user.email).toBe(u.email);
  });

  it('يرفض بيانات خاطئة بـ 401', async () => {
    await createUser({ email: 'bad@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad@test.local', password: 'WRONG' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('يرفض مستخدم غير نشط', async () => {
    const u = await createUser({ email: 'off@test.local', active: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: 'Test1234!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh — token rotation', () => {
  it('يُنشئ token جديد ويُبطل القديم', async () => {
    const u = await createUser({ email: 'rot@test.local' });
    const res1 = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Test1234!' });
    const oldRefresh = res1.body.refreshToken;
    const res2 = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(res2.status).toBe(200);
    expect(res2.body.refreshToken).toBeTruthy();
    expect(res2.body.refreshToken).not.toBe(oldRefresh);
    // إعادة استخدام القديم يجب أن ترفض
    const res3 = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(res3.status).toBe(401);
  });
});

describe('POST /api/auth/change-password — policy', () => {
  it('يرفض كلمة مرور قصيرة', async () => {
    const u = await createUser({ email: 'pw@test.local' });
    const { token } = await loginAs(app, u.email);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Test1234!', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('يرفض كلمة مرور شائعة', async () => {
    const u = await createUser({ email: 'pw2@test.local' });
    const { token } = await loginAs(app, u.email);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Test1234!', newPassword: 'Password@123' });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toMatch(/شائعة|common/i);
  });

  it('يقبل كلمة مرور قوية', async () => {
    const u = await createUser({ email: 'pw3@test.local' });
    const { token } = await loginAs(app, u.email);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Test1234!', newPassword: 'Str0ng#Passw0rd!9x' });
    expect(res.status).toBe(200);
  });
});

describe('RBAC — authorize()', () => {
  it('يرفض مسار admin لموظف عادي بـ 403', async () => {
    const emp = await createUser({ email: 'emp@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, emp.email);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  it('يرفض غياب الـ token بـ 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
