/**
 * tests/audit-finding.test.js
 * ─────────────────────────────────────────────────────────────
 * Audit task 9 (architectural) — AuditFinding
 *
 * يختبر:
 *   1. AUDIT_FINDING_STATUS state machine (valid + invalid transitions)
 *   2. route module يُستورد بدون أخطاء
 *   3. schema validation (create/update)
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
});

// ── 1. State Machine ─────────────────────────────────────────────
describe('AUDIT_FINDING_STATUS state machine', () => {
  it('يُصدَّر من stateMachines.js', async () => {
    const { AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(AUDIT_FINDING_STATUS).toBeDefined();
    expect(typeof AUDIT_FINDING_STATUS).toBe('object');
  });

  it('OPEN يسمح بـ IN_REVIEW و ESCALATED و CLOSED', async () => {
    const { AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(AUDIT_FINDING_STATUS.OPEN).toContain('IN_REVIEW');
    expect(AUDIT_FINDING_STATUS.OPEN).toContain('ESCALATED');
    expect(AUDIT_FINDING_STATUS.OPEN).toContain('CLOSED');
  });

  it('CLOSED هو حالة نهائية (بدون انتقالات)', async () => {
    const { AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(AUDIT_FINDING_STATUS.CLOSED).toEqual([]);
  });

  it('ESCALATED → CLOSED فقط', async () => {
    const { AUDIT_FINDING_STATUS } = await import('../src/lib/stateMachines.js');
    expect(AUDIT_FINDING_STATUS.ESCALATED).toEqual(['CLOSED']);
  });

  it('assertTransition يقبل OPEN → IN_REVIEW', async () => {
    const { AUDIT_FINDING_STATUS, assertTransition } = await import('../src/lib/stateMachines.js');
    expect(() => assertTransition(AUDIT_FINDING_STATUS, 'OPEN', 'IN_REVIEW', { label: 'ملاحظة' })).not.toThrow();
  });

  it('assertTransition يرفض CLOSED → OPEN', async () => {
    const { AUDIT_FINDING_STATUS, assertTransition } = await import('../src/lib/stateMachines.js');
    expect(() => assertTransition(AUDIT_FINDING_STATUS, 'CLOSED', 'OPEN', { label: 'ملاحظة' })).toThrow();
  });

  it('assertTransition يرفض RESOLVED → ESCALATED', async () => {
    const { AUDIT_FINDING_STATUS, assertTransition } = await import('../src/lib/stateMachines.js');
    expect(() => assertTransition(AUDIT_FINDING_STATUS, 'RESOLVED', 'ESCALATED', { label: 'ملاحظة' })).toThrow();
  });
});

// ── 2. Route module import ───────────────────────────────────────
describe('audit-findings route يُستورد بدون أخطاء', () => {
  it('import audit-findings.js', async () => {
    const mod = await import('../src/routes/audit-findings.js');
    expect(mod.default).toBeDefined();
  });
});

// ── 3. Zod Schema ────────────────────────────────────────────────
describe('auditFinding.schema.js — createSchema', () => {
  it('يقبل بيانات صحيحة كاملة', async () => {
    const { createSchema } = await import('../src/schemas/auditFinding.schema.js');
    const payload = {
      auditId:     'aud-001',
      type:        'MINOR_NC',
      clauseRef:   '8.4.1',
      title:       'عدم توثيق معايير قبول الموردين',
      description: 'لم يُسجَّل معيار قبول الموردين بشكل رسمي',
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('يرفض type غير معروف', async () => {
    const { createSchema } = await import('../src/schemas/auditFinding.schema.js');
    const result = createSchema.safeParse({
      auditId: 'aud-001',
      type: 'CRITICAL',
      title: 'عنوان',
      description: 'وصف',
    });
    expect(result.success).toBe(false);
  });

  it('يرفض title فارغ', async () => {
    const { createSchema } = await import('../src/schemas/auditFinding.schema.js');
    const result = createSchema.safeParse({
      auditId:     'aud-001',
      title:       '',
      description: 'وصف صحيح',
    });
    expect(result.success).toBe(false);
  });

  it('يقبل POSITIVE_FINDING بدون dueDate', async () => {
    const { createSchema } = await import('../src/schemas/auditFinding.schema.js');
    const result = createSchema.safeParse({
      auditId:     'aud-001',
      type:        'POSITIVE_FINDING',
      title:       'التزام ممتاز بالإجراءات',
      description: 'الفريق يُطبّق إجراءات المطابقة بدقة عالية',
    });
    expect(result.success).toBe(true);
  });
});

describe('auditFinding.schema.js — updateSchema', () => {
  it('يقبل تحديث جزئي', async () => {
    const { updateSchema } = await import('../src/schemas/auditFinding.schema.js');
    const result = updateSchema.safeParse({ response: 'تم إعداد خطة التصحيح' });
    expect(result.success).toBe(true);
  });

  it('يقبل إضافة closureNote', async () => {
    const { updateSchema } = await import('../src/schemas/auditFinding.schema.js');
    const result = updateSchema.safeParse({ status: 'RESOLVED', closureNote: 'تم التحقق من التصحيح' });
    expect(result.success).toBe(true);
  });
});
