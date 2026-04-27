/**
 * tests/workflow-validation-ext.test.js — Audit task 17
 * ───────────────────────────────────────────────────────────────────────────
 * اختبارات workflow إضافية تُغطّي:
 *   1. KPI — deviationReason / actionNote عند الانحراف
 *   2. CAPA — guardCapaClose (دالة pure مُستخرجة)
 *   3. ManagementReview — parseDecisionsField (قرارات + إجراءات)
 *   4. AuditFinding — AUDIT_FINDING_STATUS + scopeFilter
 *   5. CSRF — verifyCsrf middleware
 *
 * Pure — لا يتطلب DB. كل استدعاءات Prisma مُستبدَلة بـ mocks.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── مرحلة الإعداد البيئي ──────────────────────────────────────────────────
beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
});

// ── Mocks على مستوى الوحدة (يجب رفعها قبل الـ imports الديناميكية) ────────

// كي يعمل vi.mock بشكل صحيح مع Vitest، نضعه في أعلى الملف.
// الـ factory function يُعيد mock ثابتاً؛ نُغيّر القيمة داخل كل اختبار عبر
// vi.mocked(...).mockReturnValue().

vi.mock('../src/lib/kpi-engine.js', () => ({
  evaluateKpi: vi.fn(),
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    managementReview: { findFirst: vi.fn().mockResolvedValue(null) },
    setting:          { findMany:  vi.fn().mockResolvedValue([]) },
    kpiEntry:         { findMany:  vi.fn().mockResolvedValue([]) },
    objective:        { findUnique: vi.fn() },
  },
}));

vi.mock('../src/services/rollup.js', () => ({
  recomputeAfterEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── مساعد: mock transaction (tx) ─────────────────────────────────────────
function makeTx({
  objective       = { kpiType: 'SNAPSHOT', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER', target: 100, unit: '%' },
  kpiEntries      = [],
  upsertResult    = { id: 'entry-1', actualValue: 0, year: 2026, month: 4 },
} = {}) {
  return {
    objective:        { findUnique: vi.fn().mockResolvedValue(objective) },
    operationalActivity: { findUnique: vi.fn().mockResolvedValue(null) },
    kpiEntry: {
      findMany: vi.fn().mockResolvedValue(kpiEntries),
      upsert:   vi.fn().mockResolvedValue(upsertResult),
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  1. KPI — deviationReason / actionNote
// ════════════════════════════════════════════════════════════════════════════
describe('KPI — deviationReason / actionNote (Audit task 17)', () => {
  it('ratio < 80% يرفض بدون deviationReason', async () => {
    const { evaluateKpi } = await import('../src/lib/kpi-engine.js');
    vi.mocked(evaluateKpi).mockReturnValue({ ratio: 0.70, expected: 100, actual: 70, rag: 'YELLOW', alerts: [] });

    const { upsertKpiEntry } = await import('../src/services/kpi.js');
    const tx = makeTx();
    await expect(
      upsertKpiEntry({
        objectiveId: 'obj-1', year: 2025, month: 3,
        actualValue: 70, userId: 'u1', userRole: 'EMPLOYEE',
        skipRollup: true, tx,
      }),
    ).rejects.toThrow(/deviationReason/);
  });

  it('ratio < 80% يقبل مع deviationReason', async () => {
    const { evaluateKpi } = await import('../src/lib/kpi-engine.js');
    vi.mocked(evaluateKpi).mockReturnValue({ ratio: 0.75, expected: 100, actual: 75, rag: 'YELLOW', alerts: [] });

    const { upsertKpiEntry } = await import('../src/services/kpi.js');
    const tx = makeTx({ upsertResult: { id: 'e1', actualValue: 75, year: 2025, month: 3 } });
    await expect(
      upsertKpiEntry({
        objectiveId: 'obj-1', year: 2025, month: 3,
        actualValue: 75, deviationReason: 'نقص موارد',
        userId: 'u1', userRole: 'EMPLOYEE',
        skipRollup: true, tx,
      }),
    ).resolves.toMatchObject({ entry: expect.objectContaining({ id: 'e1' }) });
  });

  it('ratio < 60% يرفض بدون actionNote (حتى مع deviationReason)', async () => {
    const { evaluateKpi } = await import('../src/lib/kpi-engine.js');
    vi.mocked(evaluateKpi).mockReturnValue({ ratio: 0.55, expected: 100, actual: 55, rag: 'RED', alerts: [] });

    const { upsertKpiEntry } = await import('../src/services/kpi.js');
    const tx = makeTx();
    await expect(
      upsertKpiEntry({
        objectiveId: 'obj-1', year: 2025, month: 3,
        actualValue: 55, deviationReason: 'انخفاض حاد',
        userId: 'u1', userRole: 'EMPLOYEE',
        skipRollup: true, tx,
      }),
    ).rejects.toThrow(/actionNote/);
  });

  it('ratio < 60% يقبل مع deviationReason + actionNote', async () => {
    const { evaluateKpi } = await import('../src/lib/kpi-engine.js');
    vi.mocked(evaluateKpi).mockReturnValue({ ratio: 0.50, expected: 100, actual: 50, rag: 'RED', alerts: [] });

    const { upsertKpiEntry } = await import('../src/services/kpi.js');
    const tx = makeTx({ upsertResult: { id: 'e2', actualValue: 50, year: 2025, month: 3 } });
    await expect(
      upsertKpiEntry({
        objectiveId: 'obj-1', year: 2025, month: 3,
        actualValue: 50, deviationReason: 'توقف تشغيلي',
        actionNote: 'إصلاح مجدول الأسبوع القادم',
        userId: 'u1', userRole: 'EMPLOYEE',
        skipRollup: true, tx,
      }),
    ).resolves.toMatchObject({ entry: expect.objectContaining({ id: 'e2' }) });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  2. CAPA — guardCapaClose
// ════════════════════════════════════════════════════════════════════════════
describe('CAPA — guardCapaClose (Audit task 17)', () => {
  it('يرفض عند نقص أحد الحقول الإلزامية (implementedAction)', async () => {
    const { guardCapaClose } = await import('../src/routes/capa.js');
    expect(() =>
      guardCapaClose({
        effective: true,
        implementedAction: '',
        verificationNote: 'تم التحقق',
        verifiedById: 'u1',
      }),
    ).toThrow(/الإجراء المُنفَّذ/);
  });

  it('يرفض عند effective=false', async () => {
    const { guardCapaClose } = await import('../src/routes/capa.js');
    expect(() =>
      guardCapaClose({
        effective: false,
        implementedAction: 'تم تطبيق الإجراء',
        verificationNote: 'فحص ميداني',
        verifiedById: 'u1',
      }),
    ).toThrow(/غير فعالة/);
  });

  it('يقبل عند اكتمال كل الحقول وeffective=true', async () => {
    const { guardCapaClose } = await import('../src/routes/capa.js');
    expect(() =>
      guardCapaClose({
        effective: true,
        implementedAction: 'تم تطبيق الإجراء التصحيحي',
        verificationNote: 'تحقق ميداني بتاريخ 2026-04-28',
        verifiedById: 'u1',
      }),
    ).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  3. ManagementReview — parseDecisionsField
// ════════════════════════════════════════════════════════════════════════════
describe('ManagementReview — parseDecisionsField (Audit task 17)', () => {
  it('null / فارغ يُرجع []', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    expect(parseDecisionsField('decisions', null)).toEqual([]);
    expect(parseDecisionsField('decisions', '')).toEqual([]);
  });

  it('نص حر (غير JSON) يُلقي BadRequest', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    expect(() => parseDecisionsField('decisions', 'اتخاذ قرار بتعيين موظف'))
      .toThrow(/JSON/);
  });

  it('عنصر بدون title يُلقي BadRequest', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ ownerId: 'u1', dueDate: '2026-06-01' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/title/);
  });

  it('عنصر بدون ownerId يُلقي BadRequest', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ title: 'قرار مهم', dueDate: '2026-06-01' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/ownerId/);
  });

  it('عنصر صالح كامل يُرجع المصفوفة', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const items = [{ title: 'تطوير العمليات', ownerId: 'u1', dueDate: '2026-06-01', priority: 'HIGH' }];
    expect(parseDecisionsField('decisions', JSON.stringify(items))).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  4. AuditFinding — AUDIT_FINDING_STATUS + scopeFilter
// ════════════════════════════════════════════════════════════════════════════
describe('AuditFinding — state machine (AUDIT_FINDING_STATUS)', () => {
  it('OPEN → ESCALATED مسموح', async () => {
    const { assertTransition, AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(() =>
      assertTransition(AUDIT_FINDING_STATUS, 'OPEN', 'ESCALATED', { label: 'ملاحظة التدقيق' }),
    ).not.toThrow();
  });

  it('ESCALATED → CLOSED مسموح', async () => {
    const { assertTransition, AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(() =>
      assertTransition(AUDIT_FINDING_STATUS, 'ESCALATED', 'CLOSED', { label: 'ملاحظة التدقيق' }),
    ).not.toThrow();
  });

  it('CLOSED → أي حالة يُلقي BadRequest (terminal)', async () => {
    const { assertTransition, AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(() =>
      assertTransition(AUDIT_FINDING_STATUS, 'CLOSED', 'OPEN', { label: 'ملاحظة التدقيق' }),
    ).toThrow();
  });

  it('OPEN → CLOSED مسموح (قفز مباشر)', async () => {
    const { assertTransition, AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(() =>
      assertTransition(AUDIT_FINDING_STATUS, 'OPEN', 'CLOSED', { label: 'ملاحظة التدقيق' }),
    ).not.toThrow();
  });
});

describe('AuditFinding — scopeFilter', () => {
  it('EMPLOYEE: يرى فقط ما أنشأه أو يملكه', async () => {
    const { scopeFilter } = await import('../src/routes/audit-findings.js');
    const req = { user: { role: 'EMPLOYEE', sub: 'u42', departmentId: 'dept-1' } };
    const filter = scopeFilter(req);
    expect(filter).toEqual({ OR: [{ ownerId: 'u42' }, { createdById: 'u42' }] });
  });

  it('QUALITY_MANAGER: وصول كامل ({})', async () => {
    const { scopeFilter } = await import('../src/routes/audit-findings.js');
    const req = { user: { role: 'QUALITY_MANAGER', sub: 'u1', departmentId: 'dept-1' } };
    expect(scopeFilter(req)).toEqual({});
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  5. CSRF — verifyCsrf
// ════════════════════════════════════════════════════════════════════════════
describe('CSRF — verifyCsrf middleware (Audit task 17)', () => {
  async function runMiddleware(req) {
    const { verifyCsrf } = await import('../src/middleware/csrf.js');
    const res = {
      _status: 200, _body: null,
      status(code) { this._status = code; return this; },
      json(body)   { this._body   = body; return this; },
    };
    let nextCalled = false;
    verifyCsrf(req, res, () => { nextCalled = true; });
    return { res, nextCalled };
  }

  it('GET يتجاوز التحقق دائماً', async () => {
    const { nextCalled } = await runMiddleware({ method: 'GET', path: '/api/ncr', cookies: {}, headers: {} });
    expect(nextCalled).toBe(true);
  });

  it('POST بدون token يُرجع 403', async () => {
    const { res, nextCalled } = await runMiddleware({
      method: 'POST', path: '/api/ncr', cookies: {}, headers: {},
    });
    expect(res._status).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('POST بـ tokens غير متطابقة يُرجع 403', async () => {
    const { res, nextCalled } = await runMiddleware({
      method: 'POST', path: '/api/ncr',
      cookies: { csrf: 'abc' },
      headers: { 'x-csrf-token': 'xyz' },
    });
    expect(res._status).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('POST بـ tokens متطابقة يمر', async () => {
    const { nextCalled } = await runMiddleware({
      method: 'POST', path: '/api/ncr',
      cookies: { csrf: 'my-token' },
      headers: { 'x-csrf-token': 'my-token' },
    });
    expect(nextCalled).toBe(true);
  });

  it('مسار /api/auth/login مُستثنى', async () => {
    const { nextCalled } = await runMiddleware({
      method: 'POST', path: '/api/auth/login',
      cookies: {}, headers: {},
    });
    expect(nextCalled).toBe(true);
  });
});
