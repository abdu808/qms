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
