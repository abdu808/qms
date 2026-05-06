import { describe, expect, it } from 'vitest';
import {
  annualTargetScopeWhere,
  indicatorScopeWhere,
  mergeScope,
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
});

