/**
 * rollup-cascade.integration.test.js — ROLLUP-001
 *
 * يختبر الـ cascade التلقائي من تعديل Objective/Activity مباشرةً
 * (عبر PATCH، بدون KpiEntry) إلى StrategicGoal.progress.
 *
 * المسارات المُختبَرة:
 *   PATCH /api/objectives/:id    { progress }   → StrategicGoal.progress
 *   PATCH /api/operational-activities/:id { progress } → StrategicGoal.progress
 *   DELETE /api/objectives/:id              → StrategicGoal.progress يُعاد حسابه
 *   DELETE /api/operational-activities/:id  → StrategicGoal.progress يُعاد حسابه
 *   PATCH /api/strategic-goals/:id/recompute → لا يتغير شيء غريب
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { prisma } from '../../src/db.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

/** ينشئ شجرة: StrategicGoal ← Objective + OperationalActivity */
async function makeTree(prefix) {
  const sg = await prisma.strategicGoal.create({
    data: { code: `${prefix}-SG-${Date.now()}`, title: 'هدف استراتيجي', progress: 0 },
  });
  const creator = await createUser({ email: `${prefix}-cr@cascade.local`, role: 'QUALITY_MANAGER' });
  const obj = await prisma.objective.create({
    data: {
      code: `${prefix}-OBJ-${Date.now()}`, title: 'هدف تشغيلي',
      kpi: 'مؤشر اختبار', target: 100, startDate: new Date(),
      dueDate: new Date(Date.now() + 365 * 24 * 3600_000),
      createdById: creator.id, strategicGoalId: sg.id,
      kpiType: 'SNAPSHOT', direction: 'HIGHER_BETTER',
    },
  });
  const act = await prisma.operationalActivity.create({
    data: {
      code: `${prefix}-ACT-${Date.now()}`, title: 'نشاط اختبار',
      targetValue: 200, kpiType: 'SNAPSHOT', direction: 'HIGHER_BETTER',
      strategicGoalId: sg.id,
    },
  });
  const qm = await createUser({ email: `${prefix}-qm@cascade.local`, role: 'QUALITY_MANAGER' });
  const { token } = await loginAs(app, qm.email);
  return { sg, obj, act, token };
}

// ─────────────────────────────────────────────────────────────────────
describe('ROLLUP-001: تعديل مباشر لـ Objective.progress → cascade StrategicGoal', () => {
  it('PATCH /objectives/:id { progress:60 } يُحدّث StrategicGoal.progress', async () => {
    const { sg, obj, token } = await makeTree('C1');

    const res = await authed(app, token)
      .patch(`/api/objectives/${obj.id}`)
      .send({ progress: 60 });
    expect(res.status).toBe(200);
    expect(res.body.item.progress).toBe(60);

    // الهدف الاستراتيجي: avg(obj=60, act=0) = 30
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(30);
  });

  it('PATCH /objectives/:id { progress:100 } يُحدّث StrategicGoal.progress إلى 100 إذا كان النشاط 100', async () => {
    const { sg, obj, act, token } = await makeTree('C2');

    // رفع progress النشاط أيضاً
    await authed(app, token)
      .patch(`/api/operational-activities/${act.id}`)
      .send({ progress: 100 });

    const res = await authed(app, token)
      .patch(`/api/objectives/${obj.id}`)
      .send({ progress: 100 });
    expect(res.status).toBe(200);

    // avg(100, 100) = 100
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(100);
  });

  it('PUT /objectives/:id { progress:75 } (full update) يُحدّث StrategicGoal.progress', async () => {
    const { sg, obj, token } = await makeTree('C3');

    const res = await authed(app, token)
      .put(`/api/objectives/${obj.id}`)
      .send({ title: 'هدف تشغيلي', kpi: 'مؤشر اختبار', target: 100, progress: 75 });
    expect(res.status).toBe(200);

    // avg(obj=75, act=0) = 37
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(37);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('ROLLUP-001: تعديل مباشر لـ OperationalActivity.progress → cascade StrategicGoal', () => {
  it('PATCH /operational-activities/:id { progress:80 } يُحدّث StrategicGoal.progress', async () => {
    const { sg, act, token } = await makeTree('C4');

    const res = await authed(app, token)
      .patch(`/api/operational-activities/${act.id}`)
      .send({ progress: 80 });
    expect(res.status).toBe(200);

    // avg(obj=0, act=80) = 40
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(40);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('ROLLUP-001: حذف ناعم Objective/Activity → cascade StrategicGoal', () => {
  it('DELETE /objectives/:id يُعيد حساب StrategicGoal بعد الحذف', async () => {
    const { sg, obj, token } = await makeTree('C5');

    // ارفع progress الهدف التشغيلي أولاً
    await authed(app, token)
      .patch(`/api/objectives/${obj.id}`)
      .send({ progress: 60 });

    // تحقق أن StrategicGoal تحدث
    let sgMid = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgMid.progress).toBe(30); // avg(60, 0)

    // احذف الهدف التشغيلي
    const del = await authed(app, token).delete(`/api/objectives/${obj.id}`);
    expect(del.status).toBe(200);

    // بعد الحذف: يتبقى فقط النشاط (progress=0) → avg(0) = 0
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(0);
  });

  it('DELETE /operational-activities/:id يُعيد حساب StrategicGoal بعد الحذف', async () => {
    const { sg, act, token } = await makeTree('C6');

    await authed(app, token)
      .patch(`/api/operational-activities/${act.id}`)
      .send({ progress: 80 });

    let sgMid = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgMid.progress).toBe(40); // avg(0, 80)

    const del = await authed(app, token).delete(`/api/operational-activities/${act.id}`);
    expect(del.status).toBe(200);

    // يتبقى فقط الهدف التشغيلي (progress=0) → avg(0) = 0
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('ROLLUP-001: /recompute لا يُخرج نتائج خاطئة', () => {
  it('recompute على هدف بدون أطفال يحافظ على القيمة الحالية (لا تعديل)', async () => {
    const sg = await prisma.strategicGoal.create({
      data: { code: `C7-SG-${Date.now()}`, title: 'هدف بدون أطفال', progress: 42 },
    });
    const qm = await createUser({ email: `c7-qm@cascade.local`, role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, qm.email);

    const res = await authed(app, token).patch(`/api/strategic-goals/${sg.id}/recompute`);
    expect(res.status).toBe(200);

    // لا أطفال → recomputeStrategicGoal تُرجع null ولا تُعدّل
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgAfter.progress).toBe(42); // لم يتغير
  });

  it('recompute يعطي نفس النتيجة عند التشغيل مرتين (idempotent)', async () => {
    const { sg, obj, act, token } = await makeTree('C8');

    await authed(app, token).patch(`/api/objectives/${obj.id}`).send({ progress: 50 });
    await authed(app, token).patch(`/api/operational-activities/${act.id}`).send({ progress: 50 });

    const first = await authed(app, token).patch(`/api/strategic-goals/${sg.id}/recompute`);
    const second = await authed(app, token).patch(`/api/strategic-goals/${sg.id}/recompute`);

    expect(first.body.item?.progress).toBe(second.body.item?.progress);
    expect(first.body.item?.progress).toBe(50); // avg(50,50)=50
  });

  it('سلسلة كاملة: KpiEntry → Objective → StrategicGoal (لا تراجع)', async () => {
    const { sg, obj, token } = await makeTree('C9');

    // مرحلة 1: قراءة KPI → progress=40
    await authed(app, token).post('/api/kpi/entries').send({
      objectiveId: obj.id, year: 2026, month: 1, actualValue: 40,
    });
    let sgSnap = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgSnap.progress).toBe(20); // avg(40,0)

    // مرحلة 2: تعديل مباشر → progress=80
    await authed(app, token).patch(`/api/objectives/${obj.id}`).send({ progress: 80 });
    sgSnap = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    expect(sgSnap.progress).toBe(40); // avg(80,0)
  });
});
