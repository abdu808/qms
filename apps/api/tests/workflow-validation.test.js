/**
 * tests/workflow-validation.test.js
 * ───────────────────────────────────────────────────────────────
 * اختبارات guard على state machine لـ NCR و CAPA close logic.
 * Pure — لا يتطلب DB. يستخدم mock لـ prisma حيث لزم.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
});

// ─── NCR — guardStateTransition ────────────────────────────────
describe('NCR — guardStateTransition (Audit task 4)', () => {
  it('ROOT_CAUSE يتطلب assignee', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = { status: 'OPEN', assigneeId: null };
    expect(() => guardStateTransition({ status: 'ROOT_CAUSE' }, current)).toThrow(/المسؤول/);
  });

  it('ROOT_CAUSE ينجح مع assignee', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = { status: 'OPEN', assigneeId: 'u1' };
    expect(() => guardStateTransition({ status: 'ROOT_CAUSE' }, current)).not.toThrow();
  });

  it('ACTION_PLANNED يتطلب rootCause', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = { status: 'ROOT_CAUSE', assigneeId: 'u1', rootCause: null };
    expect(() => guardStateTransition({ status: 'ACTION_PLANNED' }, current)).toThrow(/السبب الجذري/);
  });

  it('IN_PROGRESS يتطلب correctiveAction + dueDate', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = { status: 'ACTION_PLANNED', assigneeId: 'u1', rootCause: 'cause', correctiveAction: null, dueDate: null };
    expect(() => guardStateTransition({ status: 'IN_PROGRESS' }, current)).toThrow(/الإجراء التصحيحي|تاريخ الاستحقاق/);
  });

  it('CLOSED يرفض بدون verifiedAt/verifiedNote', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = {
      status: 'VERIFICATION', assigneeId: 'u1', rootCause: 'c',
      correctiveAction: 'a', dueDate: new Date(), verifiedAt: null,
    };
    expect(() => guardStateTransition({ status: 'CLOSED', effective: true }, current))
      .toThrow(/تاريخ التحقق|ملاحظة التحقق/);
  });

  it('CLOSED يرفض إذا effective !== true', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = {
      status: 'VERIFICATION', assigneeId: 'u1', rootCause: 'c',
      correctiveAction: 'a', dueDate: new Date(),
      verifiedAt: new Date(), verifiedNote: 'ok',
    };
    expect(() => guardStateTransition({ status: 'CLOSED', effective: false }, current))
      .toThrow(/فعالية/);
  });

  it('CLOSED يقبل عند اكتمال كل الحقول وeffective=true', async () => {
    const { guardStateTransition } = await import('../src/services/ncrClosure.js');
    const current = {
      status: 'VERIFICATION', assigneeId: 'u1', rootCause: 'c',
      correctiveAction: 'a', dueDate: new Date(),
      verifiedAt: new Date(), verifiedNote: 'تم التحقق',
    };
    expect(() => guardStateTransition({ status: 'CLOSED', effective: true }, current)).not.toThrow();
  });
});

// ─── Task 8: Management Review decisions JSON validation ───────
// نختبر منطق الـ JSON parsing فقط (الـ route يحتاج DB، نختبره وحدوياً).
describe('Mgmt Review — decisions/improvementActions validation (Task 8)', () => {
  function validateMgmtReviewDecisions(field, raw) {
    if (!raw) return;
    let items;
    try { items = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(items)) return;
    items.forEach((it, idx) => {
      if (!it || typeof it !== 'object') return;
      const missing = [];
      if (!it.ownerId) missing.push('ownerId');
      if (!it.dueDate) missing.push('dueDate');
      if (missing.length) {
        throw new Error(`${field} #${idx + 1} ناقص: ${missing.join('، ')}`);
      }
    });
  }

  it('يقبل النص الحر (قراءة قديمة)', () => {
    expect(() => validateMgmtReviewDecisions('decisions', 'قرار حر بدون JSON')).not.toThrow();
  });

  it('يقبل JSON بقرارات مكتملة', () => {
    const raw = JSON.stringify([{ title: 'x', ownerId: 'u1', dueDate: '2026-06-01' }]);
    expect(() => validateMgmtReviewDecisions('decisions', raw)).not.toThrow();
  });

  it('يرفض JSON بقرار بدون ownerId', () => {
    const raw = JSON.stringify([{ title: 'x', dueDate: '2026-06-01' }]);
    expect(() => validateMgmtReviewDecisions('decisions', raw)).toThrow(/ownerId/);
  });

  it('يرفض JSON بقرار بدون dueDate', () => {
    const raw = JSON.stringify([{ title: 'x', ownerId: 'u1' }]);
    expect(() => validateMgmtReviewDecisions('decisions', raw)).toThrow(/dueDate/);
  });
});

// ─── Task 9: Audit findings → NCR link ─────────────────────────
describe('Audit findings — NONCONFORMITY detection (Task 9)', () => {
  // Re-implement detector locally to test the regex (audits.js doesn't export it)
  const PATTERNS = [/NON[\s_-]?CONFORMIT/i, /NONCONF/i, /عدم\s*مطابقة/, /عدم\s*المطابقة/];
  const detect = (s) => !!s && PATTERNS.some(re => re.test(s));

  it('يكتشف NONCONFORMITY بالإنجليزية', () => {
    expect(detect('Found nonconformity in process')).toBe(true);
    expect(detect('NON-CONFORMITY observed')).toBe(true);
  });
  it('يكتشف "عدم مطابقة" بالعربية', () => {
    expect(detect('وُجِدت عدم مطابقة في الإجراء')).toBe(true);
    expect(detect('عدم المطابقة')).toBe(true);
  });
  it('لا يطابق نصاً عادياً', () => {
    expect(detect('كل شيء سليم')).toBe(false);
    expect(detect('observation only')).toBe(false);
  });
  it('يتعامل مع null/undefined', () => {
    expect(detect(null)).toBe(false);
    expect(detect(undefined)).toBe(false);
    expect(detect('')).toBe(false);
  });
});

// ─── NCR — guardClosure (legacy create-path) ───────────────────
describe('NCR — guardClosure', () => {
  it('يرفض CLOSED بدون verifiedNote', async () => {
    const { guardClosure } = await import('../src/services/ncrClosure.js');
    expect(() => guardClosure({
      status: 'CLOSED', effective: true, verifiedAt: new Date(), verifiedNote: '',
    })).toThrow(/ملاحظة تحقق/);
  });

  it('يرفض CLOSED بدون effective=true', async () => {
    const { guardClosure } = await import('../src/services/ncrClosure.js');
    expect(() => guardClosure({ status: 'CLOSED', effective: false }))
      .toThrow(/فعالية/);
  });
});
