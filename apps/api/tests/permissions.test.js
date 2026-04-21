/**
 * tests/permissions.test.js — اختبارات وحدة لـ RBAC matrix.
 *
 * نختبر:
 *   1. can() — دالة التحقق من الصلاحية
 *   2. MATRIX — التحقق من سلامة هيكل السياسات
 *
 * لا تحتاج قاعدة بيانات — pure functions فقط.
 */
import { describe, it, expect } from 'vitest';
import { can } from '../src/lib/permissions.js';
import { MATRIX, ROLE_TIERS, rolesFor, DEFAULT_POLICY } from '../src/lib/permissions-matrix.js';

// مساعد: يبني كائن user من role (كما تتوقع can())
const user = (role) => ({ role });

// ═══════════════════════════════════════════════════════════════
//  SUPER_ADMIN
// ═══════════════════════════════════════════════════════════════

describe('SUPER_ADMIN', () => {
  it('يملك صلاحية read على جميع الموارد المُعرَّفة', () => {
    for (const resource of Object.keys(MATRIX)) {
      expect(can(user('SUPER_ADMIN'), resource, 'read'),
        `expected SUPER_ADMIN to read '${resource}'`).toBe(true);
    }
  });

  it('يملك صلاحية create على كل مورد يدعم create', () => {
    for (const [resource, policy] of Object.entries(MATRIX)) {
      if (!policy.create) continue;
      expect(can(user('SUPER_ADMIN'), resource, 'create'),
        `expected SUPER_ADMIN to create '${resource}'`).toBe(true);
    }
  });

  it('يملك صلاحية update على كل مورد يدعم update', () => {
    for (const [resource, policy] of Object.entries(MATRIX)) {
      if (!policy.update) continue;
      expect(can(user('SUPER_ADMIN'), resource, 'update'),
        `expected SUPER_ADMIN to update '${resource}'`).toBe(true);
    }
  });

  it('يملك صلاحية delete على كل مورد يدعم delete', () => {
    for (const [resource, policy] of Object.entries(MATRIX)) {
      if (!policy.delete) continue;
      expect(can(user('SUPER_ADMIN'), resource, 'delete'),
        `expected SUPER_ADMIN to delete '${resource}'`).toBe(true);
    }
  });

  it('يملك صلاحية approve على الوثائق', () => {
    expect(can(user('SUPER_ADMIN'), 'documents', 'approve')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  QUALITY_MANAGER
// ═══════════════════════════════════════════════════════════════

describe('QUALITY_MANAGER', () => {
  it('يستطيع اعتماد الوثائق (approve)', () => {
    expect(can(user('QUALITY_MANAGER'), 'documents', 'approve')).toBe(true);
  });

  it('يستطيع نشر الوثائق (publish)', () => {
    expect(can(user('QUALITY_MANAGER'), 'documents', 'publish')).toBe(true);
  });

  it('يستطيع إغلاق NCR (close)', () => {
    expect(can(user('QUALITY_MANAGER'), 'ncr', 'close')).toBe(true);
  });

  it('يستطيع إغلاق الشكاوى (close)', () => {
    expect(can(user('QUALITY_MANAGER'), 'complaints', 'close')).toBe(true);
  });

  it('يستطيع حذف الوثائق (delete)', () => {
    expect(can(user('QUALITY_MANAGER'), 'documents', 'delete')).toBe(true);
  });

  it('يستطيع قراءة سجل التدقيق (audit-log)', () => {
    expect(can(user('QUALITY_MANAGER'), 'audit-log', 'read')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEE
// ═══════════════════════════════════════════════════════════════

describe('EMPLOYEE', () => {
  it('لا يمكنه اعتماد الوثائق (approve)', () => {
    expect(can(user('EMPLOYEE'), 'documents', 'approve')).toBe(false);
  });

  it('لا يمكنه حذف الوثائق', () => {
    expect(can(user('EMPLOYEE'), 'documents', 'delete')).toBe(false);
  });

  it('لا يمكنه إغلاق NCR', () => {
    expect(can(user('EMPLOYEE'), 'ncr', 'close')).toBe(false);
  });

  it('يستطيع إنشاء وثيقة (create)', () => {
    expect(can(user('EMPLOYEE'), 'documents', 'create')).toBe(true);
  });

  it('يستطيع قراءة الوثائق (read)', () => {
    expect(can(user('EMPLOYEE'), 'documents', 'read')).toBe(true);
  });

  it('يستطيع إنشاء NCR', () => {
    expect(can(user('EMPLOYEE'), 'ncr', 'create')).toBe(true);
  });

  it('لا يمكنه تعديل NCR (update — MANAGER_UP)', () => {
    expect(can(user('EMPLOYEE'), 'ncr', 'update')).toBe(false);
  });

  it('لا يمكنه قراءة سجل التدقيق (audit-log — QM_UP)', () => {
    expect(can(user('EMPLOYEE'), 'audit-log', 'read')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  GUEST_AUDITOR — قراءة فقط
// ═══════════════════════════════════════════════════════════════

describe('GUEST_AUDITOR (read-only)', () => {
  // جمع كل الموارد التي تدعم create/update/delete في السياسة
  const writeActions = ['create', 'update', 'delete', 'approve', 'publish', 'close', 'activate'];

  it('لا يستطيع تنفيذ أي عملية كتابة على أي مورد', () => {
    for (const [resource, policy] of Object.entries(MATRIX)) {
      for (const action of writeActions) {
        if (!policy[action]) continue; // المورد لا يُعرِّف هذا الإجراء — تُقيَّم بالـ DEFAULT
        const result = can(user('GUEST_AUDITOR'), resource, action);
        expect(result, `GUEST_AUDITOR should NOT ${action} '${resource}'`).toBe(false);
      }
    }
  });

  it('يستطيع قراءة الوثائق (read)', () => {
    expect(can(user('GUEST_AUDITOR'), 'documents', 'read')).toBe(true);
  });

  it('يستطيع قراءة الأهداف (read)', () => {
    expect(can(user('GUEST_AUDITOR'), 'objectives', 'read')).toBe(true);
  });

  it('يستطيع قراءة الشكاوى (read)', () => {
    expect(can(user('GUEST_AUDITOR'), 'complaints', 'read')).toBe(true);
  });

  it('لا يستطيع قراءة users (MANAGER_UP فقط)', () => {
    expect(can(user('GUEST_AUDITOR'), 'users', 'read')).toBe(false);
  });

  it('لا يستطيع قراءة performance-reviews (MANAGER_UP فقط)', () => {
    expect(can(user('GUEST_AUDITOR'), 'performance-reviews', 'read')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DEPT_MANAGER
// ═══════════════════════════════════════════════════════════════

describe('DEPT_MANAGER', () => {
  it('يستطيع تعديل NCR (update)', () => {
    expect(can(user('DEPT_MANAGER'), 'ncr', 'update')).toBe(true);
  });

  it('لا يمكنه اعتماد الوثائق (approve)', () => {
    expect(can(user('DEPT_MANAGER'), 'documents', 'approve')).toBe(false);
  });

  it('لا يمكنه حذف users', () => {
    expect(can(user('DEPT_MANAGER'), 'users', 'delete')).toBe(false);
  });

  it('يستطيع إنشاء تقارير الأداء (performance-reviews)', () => {
    expect(can(user('DEPT_MANAGER'), 'performance-reviews', 'create')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  can() edge cases
// ═══════════════════════════════════════════════════════════════

describe('can() — حالات حدية', () => {
  it('يُرجع false عند user = null', () => {
    expect(can(null, 'documents', 'read')).toBe(false);
  });

  it('يُرجع false عند user = undefined', () => {
    expect(can(undefined, 'documents', 'read')).toBe(false);
  });

  it('يُرجع false عند role غير موجود في user', () => {
    expect(can({}, 'documents', 'read')).toBe(false);
  });

  it('يُرجع false لدور وهمي غير معرَّف', () => {
    expect(can(user('HACKER'), 'documents', 'read')).toBe(false);
  });

  it('يُرجع false لـ action غير معرَّف لا في resource ولا في DEFAULT_POLICY', () => {
    // 'fly' ليس في أي سياسة
    expect(can(user('SUPER_ADMIN'), 'documents', 'fly')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  MATRIX integrity — التحقق من سلامة الهيكل
// ═══════════════════════════════════════════════════════════════

describe('MATRIX integrity', () => {
  it('كل دور في ROLE_TIERS معرَّف ويُقيَّم بشكل صحيح', () => {
    // نتحقق من أن ROLE_TIERS نفسه سليم
    expect(ROLE_TIERS).toContain('GUEST_AUDITOR');
    expect(ROLE_TIERS).toContain('SUPER_ADMIN');
    expect(ROLE_TIERS.length).toBeGreaterThanOrEqual(6);
  });

  it('كل مورد في MATRIX له read policy صريحة أو ضمنية', () => {
    for (const resource of Object.keys(MATRIX)) {
      const roles = rolesFor(resource, 'read');
      expect(roles, `'${resource}' should have a read policy`).not.toBeNull();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
    }
  });

  it('كل role في أي policy هو role معرَّف في ROLE_TIERS', () => {
    for (const [resource, policy] of Object.entries(MATRIX)) {
      for (const [action, roles] of Object.entries(policy)) {
        if (!Array.isArray(roles)) continue;
        for (const role of roles) {
          expect(ROLE_TIERS, `Unknown role '${role}' in MATRIX['${resource}']['${action}']`).toContain(role);
        }
      }
    }
  });

  it('DEFAULT_POLICY يغطي الإجراءات الأساسية الأربع', () => {
    expect(DEFAULT_POLICY).toHaveProperty('read');
    expect(DEFAULT_POLICY).toHaveProperty('create');
    expect(DEFAULT_POLICY).toHaveProperty('update');
    expect(DEFAULT_POLICY).toHaveProperty('delete');
  });

  it('documents resource يحتوي على approve و publish policy', () => {
    expect(MATRIX.documents).toHaveProperty('approve');
    expect(MATRIX.documents).toHaveProperty('publish');
  });

  it('ncr و complaints لديهما close policy', () => {
    expect(MATRIX.ncr).toHaveProperty('close');
    expect(MATRIX.complaints).toHaveProperty('close');
  });
});
