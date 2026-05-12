/**
 * tests/consultantToolsPermissions.test.js
 *
 * اختبارات وحدة لصلاحيات أدوات AI الاستراتيجية:
 *   1. gateToolForCaller — رفض/قبول حسب الدور
 *   2. ALWAYS_REVIEW_TOOLS — الأدوات الحساسة تستلزم موافقة بشرية دائماً
 *   3. assertPlanNotFrozen — منع التعديل الحاكم عند تجميد الخطة
 *
 * لا اتصال بقاعدة البيانات — Prisma مُحاكى بالكامل.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock src/db.js قبل أي import يستخدمه ────────────────────────────────────
// vi.mock مُرفوع (hoisted) إلى أعلى الملف — نستخدم vi.hoisted لتجنب
// "Cannot access before initialization" في ESM.
const mockPrisma = vi.hoisted(() => ({
  strategicPlan: { findUnique: vi.fn() },
  annualTarget:  { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  initiative:    { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  indicator:     { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('../src/db.js', () => ({ prisma: mockPrisma }));

import {
  gateToolForCaller,
  ALWAYS_REVIEW_TOOLS,
  TOOL_PERMISSIONS,
  assertPlanNotFrozen,
} from '../src/services/aiAgent/tools.js';

// ── مساعدات بناء callerUser ──────────────────────────────────────────────────
const user = (role, opts = {}) => ({ sub: 'user-1', role, departmentId: opts.departmentId ?? null });

// ─────────────────────────────────────────────────────────────────────────────
//  1. gateToolForCaller — صلاحيات حسب الدور
// ─────────────────────────────────────────────────────────────────────────────
describe('gateToolForCaller', () => {

  // annual-targets → QM_UP فقط (QUALITY_MANAGER + SUPER_ADMIN)
  describe('create_annual_target — QM_UP فقط', () => {
    it('EMPLOYEE يُرفض (AI_TOOL_FORBIDDEN)', () => {
      expect(() => gateToolForCaller(user('EMPLOYEE'), 'create_annual_target'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('DEPT_MANAGER يُرفض (annual-targets:create يتطلب QM_UP)', () => {
      expect(() => gateToolForCaller(user('DEPT_MANAGER'), 'create_annual_target'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('COMMITTEE_MEMBER يُرفض', () => {
      expect(() => gateToolForCaller(user('COMMITTEE_MEMBER'), 'create_annual_target'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('QUALITY_MANAGER يُقبل', () => {
      expect(() => gateToolForCaller(user('QUALITY_MANAGER'), 'create_annual_target'))
        .not.toThrow();
    });

    it('SUPER_ADMIN يُقبل', () => {
      expect(() => gateToolForCaller(user('SUPER_ADMIN'), 'create_annual_target'))
        .not.toThrow();
    });
  });

  describe('update_annual_target — QM_UP فقط', () => {
    it('EMPLOYEE يُرفض', () => {
      expect(() => gateToolForCaller(user('EMPLOYEE'), 'update_annual_target'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('DEPT_MANAGER يُرفض (annual-targets:update يتطلب QM_UP)', () => {
      expect(() => gateToolForCaller(user('DEPT_MANAGER'), 'update_annual_target'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('QUALITY_MANAGER يُقبل', () => {
      expect(() => gateToolForCaller(user('QUALITY_MANAGER'), 'update_annual_target'))
        .not.toThrow();
    });
  });

  // initiatives → update: MANAGER_UP (DEPT_MANAGER مسموح)
  describe('update_initiative — MANAGER_UP فأعلى', () => {
    it('EMPLOYEE يُرفض', () => {
      expect(() => gateToolForCaller(user('EMPLOYEE'), 'update_initiative'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('DEPT_MANAGER يُقبل (initiatives:update يسمح MANAGER_UP)', () => {
      expect(() => gateToolForCaller(user('DEPT_MANAGER'), 'update_initiative'))
        .not.toThrow();
    });

    it('QUALITY_MANAGER يُقبل', () => {
      expect(() => gateToolForCaller(user('QUALITY_MANAGER'), 'update_initiative'))
        .not.toThrow();
    });
  });

  // get_system_state → MANAGER_UP (system-state:read)
  describe('get_system_state — MANAGER_UP فأعلى', () => {
    it('EMPLOYEE يُرفض', () => {
      expect(() => gateToolForCaller(user('EMPLOYEE'), 'get_system_state'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('GUEST_AUDITOR يُرفض', () => {
      expect(() => gateToolForCaller(user('GUEST_AUDITOR'), 'get_system_state'))
        .toThrow(expect.objectContaining({ code: 'AI_TOOL_FORBIDDEN' }));
    });

    it('DEPT_MANAGER يُقبل', () => {
      expect(() => gateToolForCaller(user('DEPT_MANAGER'), 'get_system_state'))
        .not.toThrow();
    });
  });

  // أداة غير مسجَّلة → deny-by-default
  it('أداة غير مسجَّلة تُرفض بـ AI_TOOL_UNREGISTERED', () => {
    expect(() => gateToolForCaller(user('SUPER_ADMIN'), 'nonexistent_tool'))
      .toThrow(expect.objectContaining({ code: 'AI_TOOL_UNREGISTERED' }));
  });

  // callerUser = null
  it('بدون callerUser يُرفض بـ AI_TOOL_NO_CALLER', () => {
    expect(() => gateToolForCaller(null, 'get_system_state'))
      .toThrow(expect.objectContaining({ code: 'AI_TOOL_NO_CALLER' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. ALWAYS_REVIEW_TOOLS — الأدوات الحساسة يجب أن تكون في المجموعة
// ─────────────────────────────────────────────────────────────────────────────
describe('ALWAYS_REVIEW_TOOLS', () => {
  const mustInclude = [
    'create_annual_target',
    'update_annual_target',
    'update_initiative',
    'create_initiative',
    'create_indicator',
    'update_indicator',
    'create_strategic_plan',
    'update_strategic_plan',
    'create_strategic_goal',
    'update_strategic_goal',
    'create_objective',
    'update_objective',
  ];

  for (const tool of mustInclude) {
    it(`"${tool}" موجودة في ALWAYS_REVIEW_TOOLS`, () => {
      expect(ALWAYS_REVIEW_TOOLS.has(tool)).toBe(true);
    });
  }

  // أدوات القراءة يجب ألا تكون في ALWAYS_REVIEW (لا جدوى من حجب القراءة)
  it('"get_system_state" ليست في ALWAYS_REVIEW_TOOLS', () => {
    expect(ALWAYS_REVIEW_TOOLS.has('get_system_state')).toBe(false);
  });

  it('"scan_overdue" ليست في ALWAYS_REVIEW_TOOLS', () => {
    expect(ALWAYS_REVIEW_TOOLS.has('scan_overdue')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. TOOL_PERMISSIONS — تحقق القيم المحددة لكل أداة
// ─────────────────────────────────────────────────────────────────────────────
describe('TOOL_PERMISSIONS mappings', () => {
  it('create_annual_target → annual-targets:create', () => {
    expect(TOOL_PERMISSIONS.create_annual_target).toEqual({ resource: 'annual-targets', action: 'create' });
  });

  it('update_annual_target → annual-targets:update', () => {
    expect(TOOL_PERMISSIONS.update_annual_target).toEqual({ resource: 'annual-targets', action: 'update' });
  });

  it('create_initiative → initiatives:create', () => {
    expect(TOOL_PERMISSIONS.create_initiative).toEqual({ resource: 'initiatives', action: 'create' });
  });

  it('update_initiative → initiatives:update', () => {
    expect(TOOL_PERMISSIONS.update_initiative).toEqual({ resource: 'initiatives', action: 'update' });
  });

  it('get_system_state → system-state:read', () => {
    expect(TOOL_PERMISSIONS.get_system_state).toEqual({ resource: 'system-state', action: 'read' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. assertPlanNotFrozen — منع التعديل الحاكم عند تجميد الخطة
// ─────────────────────────────────────────────────────────────────────────────
describe('assertPlanNotFrozen', () => {
  const qm   = user('QUALITY_MANAGER');
  const sa   = user('SUPER_ADMIN');

  beforeEach(() => { vi.clearAllMocks(); });

  it('planId=null → تُرجع data دون استعلام', async () => {
    const data = { targetValue: 100 };
    const result = await assertPlanNotFrozen(null, qm, null, data);
    expect(result).toBe(data);
    expect(mockPrisma.strategicPlan.findUnique).not.toHaveBeenCalled();
  });

  it('خطة غير مُجمَّدة (frozenAt=null) → تُرجع data كما هي', async () => {
    mockPrisma.strategicPlan.findUnique.mockResolvedValue({ frozenAt: null, code: 'SP-2026-001' });
    const data = { targetValue: 200 };
    const result = await assertPlanNotFrozen('plan-1', qm, null, data);
    expect(result).toEqual(data);
  });

  it('خطة مُجمَّدة بدون transactionFields → ترمي PLAN_FROZEN (403)', async () => {
    mockPrisma.strategicPlan.findUnique.mockResolvedValue({ frozenAt: new Date(), code: 'SP-2026-001' });
    await expect(assertPlanNotFrozen('plan-1', qm))
      .rejects.toMatchObject({ code: 'PLAN_FROZEN', statusCode: 403 });
  });

  it('خطة مُجمَّدة + transactionFields → تُصفِّي data وتحتفظ بالحقول المسموحة فقط', async () => {
    mockPrisma.strategicPlan.findUnique.mockResolvedValue({ frozenAt: new Date(), code: 'SP-2026-001' });
    const data = {
      targetValue: 999,      // حقل حاكم — محجوب عند التجميد
      q1Target: 50,          // مسموح (transactionField)
      q2Target: 60,          // مسموح
      modificationReason: 'تصحيح', // مسموح
    };
    const txFields = ['q1Target', 'q2Target', 'q3Target', 'q4Target', 'modificationReason'];
    const result = await assertPlanNotFrozen('plan-1', qm, txFields, data);
    expect(result).toEqual({ q1Target: 50, q2Target: 60, modificationReason: 'تصحيح' });
    expect(result.targetValue).toBeUndefined();
  });

  it('SUPER_ADMIN يتجاوز التجميد — تُرجع data كاملة بدون استعلام إضافي', async () => {
    // findUnique لا يُستدعى للـ SUPER_ADMIN
    const data = { targetValue: 100, q1Target: 25 };
    const result = await assertPlanNotFrozen('plan-1', sa, null, data);
    expect(result).toBe(data);
    expect(mockPrisma.strategicPlan.findUnique).not.toHaveBeenCalled();
  });

  it('خطة مُجمَّدة + SUPER_ADMIN + transactionFields → تُرجع data كاملة', async () => {
    const data = { targetValue: 100, q1Target: 25 };
    const result = await assertPlanNotFrozen('plan-1', sa, ['q1Target'], data);
    expect(result).toBe(data); // SUPER_ADMIN لا تُصفَّى بياناته
    expect(mockPrisma.strategicPlan.findUnique).not.toHaveBeenCalled();
  });

  it('خطة مُجمَّدة + transactionFields + data فارغة → تُرجع كائناً فارغاً', async () => {
    mockPrisma.strategicPlan.findUnique.mockResolvedValue({ frozenAt: new Date(), code: 'SP-2026-001' });
    const result = await assertPlanNotFrozen('plan-1', qm, ['q1Target'], {});
    expect(result).toEqual({});
  });
});
