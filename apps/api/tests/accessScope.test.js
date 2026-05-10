import { describe, expect, it } from 'vitest';
import {
  annualTargetScopeWhere,
  beneficiaryScopeWhere,
  complaintScopeWhere,
  donationScopeWhere,
  indicatorScopeWhere,
  mergeScope,
  ncrScopeWhere,
} from '../src/lib/accessScope.js';

describe('accessScope', () => {
  it('limits department managers to indicators related to their department', () => {
    const where = indicatorScopeWhere({
      role: 'DEPT_MANAGER',
      departmentId: 'dept-a',
      sub: 'user-a',
    });

    expect(where).toEqual({
      OR: [
        { objective: { departmentId: 'dept-a' } },
        { owner: { departmentId: 'dept-a' } },
        { dataEntryUser: { departmentId: 'dept-a' } },
        { approver: { departmentId: 'dept-a' } },
      ],
    });
  });

  it('limits employees to indicators assigned to them', () => {
    const where = indicatorScopeWhere({
      role: 'EMPLOYEE',
      departmentId: 'dept-a',
      sub: 'user-a',
    });

    expect(where).toEqual({
      OR: [
        { ownerId: 'user-a' },
        { dataEntryUserId: 'user-a' },
        { approverUserId: 'user-a' },
      ],
    });
  });

  it('wraps annual target scope through the parent indicator', () => {
    const where = annualTargetScopeWhere({
      role: 'EMPLOYEE',
      sub: 'user-a',
    });

    expect(where).toEqual({
      indicator: {
        OR: [
          { ownerId: 'user-a' },
          { dataEntryUserId: 'user-a' },
          { approverUserId: 'user-a' },
        ],
      },
    });
  });

  it('merges base filters and scopes without overwriting OR clauses', () => {
    const where = mergeScope(
      { deletedAt: null, OR: [{ nameAr: { contains: 'رضا' } }] },
      { OR: [{ ownerId: 'user-a' }] },
    );

    expect(where).toEqual({
      AND: [
        { deletedAt: null, OR: [{ nameAr: { contains: 'رضا' } }] },
        { OR: [{ ownerId: 'user-a' }] },
      ],
    });
  });

  it('limits beneficiaries to manager department or employee case load', () => {
    expect(beneficiaryScopeWhere({
      role: 'DEPT_MANAGER',
      departmentId: 'dept-a',
      sub: 'manager-a',
    })).toEqual({ departmentId: 'dept-a' });

    expect(beneficiaryScopeWhere({
      role: 'EMPLOYEE',
      departmentId: 'dept-a',
      sub: 'user-a',
    })).toEqual({ caseManagerId: 'user-a' });
  });

  it('limits donations through the recipient scope', () => {
    expect(donationScopeWhere({
      role: 'DEPT_MANAGER',
      departmentId: 'dept-a',
      sub: 'manager-a',
    })).toEqual({ recipient: { departmentId: 'dept-a' } });

    expect(donationScopeWhere({
      role: 'EMPLOYEE',
      sub: 'user-a',
      name: 'User A',
    })).toEqual({
      OR: [
        { recipient: { caseManagerId: 'user-a' } },
        { receivedBy: 'user-a' },
      ],
    });
  });

  it('limits complaints to assigned users and manager departments', () => {
    expect(complaintScopeWhere({
      role: 'DEPT_MANAGER',
      departmentId: 'dept-a',
      sub: 'manager-a',
    })).toEqual({ assignee: { departmentId: 'dept-a' } });

    expect(complaintScopeWhere({
      role: 'EMPLOYEE',
      sub: 'user-a',
    })).toEqual({ assigneeId: 'user-a' });
  });

  it('limits NCR records by department, reporter, or assignee', () => {
    expect(ncrScopeWhere({
      role: 'DEPT_MANAGER',
      departmentId: 'dept-a',
      sub: 'manager-a',
    })).toEqual({
      OR: [
        { reporterId: 'manager-a' },
        { assigneeId: 'manager-a' },
        { departmentId: 'dept-a' },
      ],
    });

    expect(ncrScopeWhere({
      role: 'EMPLOYEE',
      sub: 'user-a',
    })).toEqual({
      OR: [
        { reporterId: 'user-a' },
        { assigneeId: 'user-a' },
      ],
    });
  });

  it('keeps quality manager and super admin unscoped for sensitive records', () => {
    expect(beneficiaryScopeWhere({ role: 'QUALITY_MANAGER' })).toEqual({});
    expect(complaintScopeWhere({ role: 'SUPER_ADMIN' })).toEqual({});
  });
});
