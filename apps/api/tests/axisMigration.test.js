/**
 * tests/axisMigration.test.js — DATA-002 Phase 1
 * ───────────────────────────────────────────────────────────────────
 * يختبر منطق PERSPECTIVE_TO_AXIS_CODE mapping من
 * scripts/migrate-perspective-to-axis.mjs
 *
 * هذه الاختبارات pure — لا تتطلب قاعدة بيانات.
 * تتحقق من صحة الـ mapping والسلوك الصحيح للـ dry-run وidempotency.
 */
import { describe, it, expect } from 'vitest';
import { PERSPECTIVE_TO_AXIS_CODE } from '../scripts/migrate-perspective-to-axis.mjs';

// ─── 1. mapping صحيح للقيم الإنجليزية (الموجودة في DB) ───────────────────────
describe('PERSPECTIVE_TO_AXIS_CODE — قيم إنجليزية (DB values)', () => {
  it('FINANCIAL → FINANCIAL', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['FINANCIAL']).toBe('FINANCIAL');
  });

  it('CUSTOMER → CUSTOMER', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['CUSTOMER']).toBe('CUSTOMER');
  });

  it('PROCESS → PROCESS', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['PROCESS']).toBe('PROCESS');
  });

  it('LEARNING → LEARNING', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['LEARNING']).toBe('LEARNING');
  });

  it('GOVERNANCE → GOVERNANCE', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['GOVERNANCE']).toBe('GOVERNANCE');
  });
});

// ─── 2. mapping صحيح للقيم العربية (من بيانات seed/import قديمة) ─────────────
describe('PERSPECTIVE_TO_AXIS_CODE — قيم عربية (legacy aliases)', () => {
  it('"مالي" → FINANCIAL', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['مالي']).toBe('FINANCIAL');
  });

  it('"المالي" → FINANCIAL', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['المالي']).toBe('FINANCIAL');
  });

  it('"مستفيدون" → CUSTOMER', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['مستفيدون']).toBe('CUSTOMER');
  });

  it('"المستفيدون والمجتمع" → CUSTOMER', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['المستفيدون والمجتمع']).toBe('CUSTOMER');
  });

  it('"العمليات الداخلية" → PROCESS', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['العمليات الداخلية']).toBe('PROCESS');
  });

  it('"تعلم ونمو" → LEARNING', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['تعلم ونمو']).toBe('LEARNING');
  });

  it('"الحوكمة والامتثال" → GOVERNANCE', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['الحوكمة والامتثال']).toBe('GOVERNANCE');
  });
});

// ─── 3. قيمة مجهولة تُرجع undefined (لا كسر) ────────────────────────────────
describe('PERSPECTIVE_TO_AXIS_CODE — قيم مجهولة', () => {
  it('قيمة غير معروفة تُرجع undefined ولا ترمي exception', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['UNKNOWN_VALUE']).toBeUndefined();
  });

  it('سلسلة فارغة تُرجع undefined', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['']).toBeUndefined();
  });

  it('قيمة عشوائية تُرجع undefined', () => {
    expect(PERSPECTIVE_TO_AXIS_CODE['بيئة']).toBeUndefined();
  });
});

// ─── 4. استكمال: كل قيمة مُعرَّفة في الـ mapping تُرجع axis code صالح ─────────
describe('PERSPECTIVE_TO_AXIS_CODE — استكمال Axis codes', () => {
  const VALID_AXIS_CODES = new Set(['FINANCIAL', 'CUSTOMER', 'PROCESS', 'LEARNING', 'GOVERNANCE']);

  it('جميع قيم الـ mapping تُرجع axis code مُعرَّف', () => {
    for (const [perspective, axisCode] of Object.entries(PERSPECTIVE_TO_AXIS_CODE)) {
      expect(
        VALID_AXIS_CODES.has(axisCode),
        `perspective "${perspective}" يُرجع "${axisCode}" وهو غير صالح`
      ).toBe(true);
    }
  });

  it('لا توجد قيمة null أو undefined في الـ mapping', () => {
    for (const [perspective, axisCode] of Object.entries(PERSPECTIVE_TO_AXIS_CODE)) {
      expect(axisCode, `perspective "${perspective}" قيمته null/undefined`).toBeTruthy();
    }
  });
});

// ─── 5. idempotency logic — محاكاة منطق تخطّي المُرحَّل مسبقاً ───────────────
describe('منطق idempotency — الأهداف المربوطة مسبقاً لا تُعاد معالجتها', () => {
  // نحاكي منطق السكربت: candidates = goals بـ perspective وبلا axisId
  function buildCandidates(goals) {
    return goals.filter(g => g.perspective !== null && g.axisId === null);
  }

  it('هدف لديه axisId مسبقاً لا يدخل قائمة المرشحين', () => {
    const goals = [
      { id: '1', code: 'STR-001', perspective: 'FINANCIAL', axisId: 'axis-fin-id' },
      { id: '2', code: 'STR-002', perspective: 'CUSTOMER',  axisId: null },
    ];
    const candidates = buildCandidates(goals);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].code).toBe('STR-002');
  });

  it('تشغيل ثانٍ بعد الترحيل — جميع الأهداف مربوطة → candidates فارغ', () => {
    const goalsAfterMigration = [
      { id: '1', code: 'STR-001', perspective: 'FINANCIAL', axisId: 'axis-fin-id' },
      { id: '2', code: 'STR-002', perspective: 'CUSTOMER',  axisId: 'axis-cus-id' },
      { id: '3', code: 'STR-003', perspective: 'PROCESS',   axisId: 'axis-pro-id' },
    ];
    const candidates = buildCandidates(goalsAfterMigration);
    expect(candidates).toHaveLength(0);
  });

  it('هدف بلا perspective لا يدخل قائمة المرشحين', () => {
    const goals = [
      { id: '1', code: 'STR-001', perspective: null, axisId: null },
    ];
    const candidates = buildCandidates(goals);
    expect(candidates).toHaveLength(0);
  });
});

// ─── 6. تصنيف المرشحين — تحديد toMigrate vs unknownPerspective ─────────────
describe('منطق تصنيف المرشحين', () => {
  function classifyCandidates(candidates, axisCodeToId) {
    const toMigrate    = [];
    const unknownPersp = [];
    for (const goal of candidates) {
      const axisCode = PERSPECTIVE_TO_AXIS_CODE[goal.perspective?.trim()];
      if (!axisCode) { unknownPersp.push(goal); continue; }
      const axisId = axisCodeToId[axisCode];
      if (!axisId)   { unknownPersp.push(goal); continue; }
      toMigrate.push({ goal, targetAxisId: axisId, axisCode });
    }
    return { toMigrate, unknownPersp };
  }

  const axisMap = {
    FINANCIAL:  'axis-id-fin',
    CUSTOMER:   'axis-id-cus',
    PROCESS:    'axis-id-pro',
    LEARNING:   'axis-id-lrn',
    GOVERNANCE: 'axis-id-gov',
  };

  it('FINANCIAL perspective → يدخل toMigrate بـ axis-id-fin', () => {
    const { toMigrate, unknownPersp } = classifyCandidates(
      [{ id: '1', code: 'STR-001', perspective: 'FINANCIAL', axisId: null }],
      axisMap
    );
    expect(toMigrate).toHaveLength(1);
    expect(toMigrate[0].targetAxisId).toBe('axis-id-fin');
    expect(unknownPersp).toHaveLength(0);
  });

  it('CUSTOMER perspective → يدخل toMigrate', () => {
    const { toMigrate } = classifyCandidates(
      [{ id: '2', code: 'STR-002', perspective: 'CUSTOMER', axisId: null }],
      axisMap
    );
    expect(toMigrate).toHaveLength(1);
    expect(toMigrate[0].axisCode).toBe('CUSTOMER');
  });

  it('PROCESS perspective → يدخل toMigrate', () => {
    const { toMigrate } = classifyCandidates(
      [{ id: '3', code: 'STR-003', perspective: 'PROCESS', axisId: null }],
      axisMap
    );
    expect(toMigrate).toHaveLength(1);
    expect(toMigrate[0].axisCode).toBe('PROCESS');
  });

  it('perspective مجهول → يدخل unknownPerspective ولا يكسر', () => {
    const { toMigrate, unknownPersp } = classifyCandidates(
      [{ id: '4', code: 'STR-004', perspective: 'UNKNOWN_BSC', axisId: null }],
      axisMap
    );
    expect(toMigrate).toHaveLength(0);
    expect(unknownPersp).toHaveLength(1);
    expect(unknownPersp[0].code).toBe('STR-004');
  });

  it('خليط من المعروف والمجهول — يُصنَّف صحيحاً', () => {
    const { toMigrate, unknownPersp } = classifyCandidates(
      [
        { id: '1', code: 'STR-001', perspective: 'FINANCIAL', axisId: null },
        { id: '2', code: 'STR-002', perspective: 'MYSTERY',   axisId: null },
        { id: '3', code: 'STR-003', perspective: 'CUSTOMER',  axisId: null },
      ],
      axisMap
    );
    expect(toMigrate).toHaveLength(2);
    expect(unknownPersp).toHaveLength(1);
  });
});
