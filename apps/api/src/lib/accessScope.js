const FULL_READ_ROLES = new Set([
  'SUPER_ADMIN',
  'QUALITY_MANAGER',
  'COMMITTEE_MEMBER',
  'GUEST_AUDITOR',
]);

const FULL_RECORD_ACCESS_ROLES = new Set([
  'SUPER_ADMIN',
  'QUALITY_MANAGER',
]);

function empty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

export function hasFullReadScope(user) {
  return FULL_READ_ROLES.has(user?.role);
}

export function hasFullRecordAccess(user) {
  return FULL_RECORD_ACCESS_ROLES.has(user?.role);
}

export function mergeScope(baseWhere = {}, scopeWhere = {}) {
  if (empty(scopeWhere)) return baseWhere;
  if (empty(baseWhere)) return scopeWhere;
  return { AND: [baseWhere, scopeWhere] };
}

export function objectiveScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullReadScope(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return {
      OR: [
        { departmentId: user.departmentId },
        { owner: { departmentId: user.departmentId } },
      ],
    };
  }
  if (user.role === 'EMPLOYEE') {
    return {
      OR: [
        { ownerId: user.sub },
        { createdById: user.sub },
      ],
    };
  }
  return { id: '___never___' };
}

export function activityScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullReadScope(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return {
      OR: [
        { deptId: user.departmentId },
        { owner: { departmentId: user.departmentId } },
      ],
    };
  }
  if (user.role === 'EMPLOYEE') {
    return {
      OR: [
        { ownerId: user.sub },
        { deptId: user.departmentId || '___no_department___' },
      ],
    };
  }
  return { id: '___never___' };
}

export function indicatorScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullReadScope(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return {
      OR: [
        { objective: { departmentId: user.departmentId } },
        { owner: { departmentId: user.departmentId } },
        { dataEntryUser: { departmentId: user.departmentId } },
        { approver: { departmentId: user.departmentId } },
      ],
    };
  }
  if (user.role === 'EMPLOYEE') {
    return {
      OR: [
        { ownerId: user.sub },
        { dataEntryUserId: user.sub },
        { approverUserId: user.sub },
      ],
    };
  }
  return { id: '___never___' };
}

export function annualTargetScopeWhere(user) {
  const scope = indicatorScopeWhere(user);
  if (empty(scope)) return {};
  return { indicator: scope };
}

export function initiativeScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullReadScope(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return {
      OR: [
        { departmentId: user.departmentId },
        { owner: { departmentId: user.departmentId } },
      ],
    };
  }
  if (user.role === 'EMPLOYEE') return { ownerId: user.sub };
  return { id: '___never___' };
}

export function beneficiaryScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullRecordAccess(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return { departmentId: user.departmentId };
  }
  if (user.role === 'EMPLOYEE') return { caseManagerId: user.sub };
  return { id: '___never___' };
}

export function donationScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullRecordAccess(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return { recipient: { departmentId: user.departmentId } };
  }
  if (user.role === 'EMPLOYEE') {
    return {
      OR: [
        { recipient: { caseManagerId: user.sub } },
        { receivedBy: user.sub },
      ],
    };
  }
  return { id: '___never___' };
}

export function complaintScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullRecordAccess(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return { assignee: { departmentId: user.departmentId } };
  }
  if (user.role === 'EMPLOYEE') return { assigneeId: user.sub };
  return { id: '___never___' };
}

export function ncrScopeWhere(user) {
  if (!user?.role) return { id: '___never___' };
  if (hasFullRecordAccess(user)) return {};
  if (user.role === 'DEPT_MANAGER') {
    const conditions = [
      { reporterId: user.sub },
      { assigneeId: user.sub },
    ];
    if (user.departmentId) conditions.push({ departmentId: user.departmentId });
    return { OR: conditions };
  }
  if (user.role === 'EMPLOYEE') {
    return {
      OR: [
        { reporterId: user.sub },
        { assigneeId: user.sub },
      ],
    };
  }
  return { id: '___never___' };
}
