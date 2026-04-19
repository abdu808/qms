/**
 * auditChecklists.integration.test.js
 * يغطّي UX اللي كان بيفشل: itemsJson تقبل أشكالاً متعددة.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function mgrToken() {
  const u = await createUser({ email: `chk-${Date.now()}@t.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, u.email);
  return token;
}

describe('/api/audit-checklists — itemsJson يقبل أشكالاً متعدّدة', () => {
  it('نص حر متعدد الأسطر: كل سطر = سؤال', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/audit-checklists').send({
      title: 'قائمة نصّ حر',
      itemsJson: 'سؤال أول\nسؤال ثانٍ\nسؤال ثالث',
    });
    expect(res.status).toBe(201);
    const parsed = JSON.parse(res.body.item.itemsJson);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ q: 'سؤال أول' });
  });

  it('مصفوفة JSON صالحة تمرّ كما هي', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/audit-checklists').send({
      title: 'قائمة JSON',
      itemsJson: JSON.stringify([
        { q: 'س1', clause: '8.2', evidenceType: 'DOC', critical: true },
      ]),
    });
    expect(res.status).toBe(201);
    const parsed = JSON.parse(res.body.item.itemsJson);
    expect(parsed[0].q).toBe('س1');
    expect(parsed[0].critical).toBe(true);
  });

  it('JSON مشوه يرجع 400 وليس 500', async () => {
    const token = await mgrToken();
    const res = await authed(app, token).post('/api/audit-checklists').send({
      title: 'جيسون سيء',
      itemsJson: '[{broken',
    });
    expect(res.status).toBe(400);
  });
});
