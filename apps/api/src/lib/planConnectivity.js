import { prisma } from '../db.js';

const active = { deletedAt: null };

function uniqById(items) {
  const map = new Map();
  for (const item of items || []) {
    if (item?.id) map.set(item.id, item);
  }
  return [...map.values()];
}

function userDept(user) {
  return user?.department ? {
    id: user.department.id,
    code: user.department.code,
    name: user.department.name,
  } : null;
}

function severityRank(severity) {
  return { ERROR: 0, WARNING: 1, INFO: 2 }[severity] ?? 9;
}

function issue(severity, area, message, ref = null) {
  return { severity, area, message, ref };
}

function indicatorBrief(indicator) {
  return {
    id: indicator.id,
    code: indicator.code,
    nameAr: indicator.nameAr,
    unit: indicator.unit,
    frequency: indicator.frequency,
    kpiType: indicator.kpiType,
    axis: indicator.axis ? { id: indicator.axis.id, code: indicator.axis.code, nameAr: indicator.axis.nameAr } : null,
    objective: indicator.objective ? {
      id: indicator.objective.id,
      code: indicator.objective.code,
      title: indicator.objective.title,
      strategicGoalId: indicator.objective.strategicGoalId,
    } : null,
    owner: indicator.owner ? { id: indicator.owner.id, name: indicator.owner.name } : null,
    dataEntryUser: indicator.dataEntryUser ? { id: indicator.dataEntryUser.id, name: indicator.dataEntryUser.name } : null,
    approver: indicator.approver ? { id: indicator.approver.id, name: indicator.approver.name } : null,
    ownerDept: userDept(indicator.owner),
    dataEntryDept: userDept(indicator.dataEntryUser),
    targetYears: (indicator.annualTargets || []).map(t => t.year).sort((a, b) => a - b),
  };
}

function activityBrief(activity) {
  return {
    id: activity.id,
    code: activity.code,
    title: activity.title,
    status: activity.status,
    progress: activity.progress,
    year: activity.year,
    dept: activity.dept ? { id: activity.dept.id, code: activity.dept.code, name: activity.dept.name } : null,
    owner: activity.owner ? { id: activity.owner.id, name: activity.owner.name } : null,
    indicator: activity.indicator ? {
      id: activity.indicator.id,
      code: activity.indicator.code,
      nameAr: activity.indicator.nameAr,
    } : null,
  };
}

export async function buildPlanConnectivity({ year = null } = {}) {
  const targetYear = Number(year) || null;
  const [goals, indicators, activities, departments, axes, activeUsers] = await Promise.all([
    prisma.strategicGoal.findMany({
      where: active,
      orderBy: { code: 'asc' },
      include: {
        axis: { select: { id: true, code: true, nameAr: true, color: true, weight: true } },
        ownerUser: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        activities: {
          where: active,
          orderBy: { code: 'asc' },
          include: {
            dept: { select: { id: true, code: true, name: true } },
            owner: { select: { id: true, name: true } },
            indicator: { select: { id: true, code: true, nameAr: true } },
          },
        },
        initiatives: {
          where: active,
          select: { id: true, code: true, name: true, status: true, progress: true },
          orderBy: { code: 'asc' },
        },
        objectives: {
          where: active,
          include: {
            indicators: {
              where: active,
              select: { id: true, code: true, nameAr: true },
            },
          },
        },
      },
    }),
    prisma.indicator.findMany({
      where: active,
      orderBy: { code: 'asc' },
      include: {
        axis: { select: { id: true, code: true, nameAr: true } },
        objective: { select: { id: true, code: true, title: true, strategicGoalId: true } },
        owner: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        dataEntryUser: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        approver: { select: { id: true, name: true } },
        annualTargets: {
          where: targetYear ? { year: targetYear } : {},
          select: { year: true, targetValue: true },
        },
      },
    }),
    prisma.operationalActivity.findMany({
      where: active,
      include: {
        dept: { select: { id: true, code: true, name: true } },
        owner: { select: { id: true, name: true } },
        indicator: { select: { id: true, code: true, nameAr: true } },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    prisma.axis.findMany({ where: active, orderBy: { order: 'asc' }, select: { id: true, code: true, nameAr: true, weight: true } }),
    prisma.user.findMany({
      where: { active: true, departmentId: { not: null } },
      select: { departmentId: true },
    }),
  ]);

  const indicatorsByGoal = new Map();
  const indicatorsByAxis = new Map();
  const linkedIndicatorIds = new Set();

  for (const indicator of indicators) {
    if (indicator.objective?.strategicGoalId) {
      const arr = indicatorsByGoal.get(indicator.objective.strategicGoalId) || [];
      arr.push(indicator);
      indicatorsByGoal.set(indicator.objective.strategicGoalId, arr);
      linkedIndicatorIds.add(indicator.id);
    }
    if (indicator.axisId) {
      const arr = indicatorsByAxis.get(indicator.axisId) || [];
      arr.push(indicator);
      indicatorsByAxis.set(indicator.axisId, arr);
    }
  }

  for (const activity of activities) {
    if (!activity.strategicGoalId || !activity.indicatorId) continue;
    const indicator = indicators.find(i => i.id === activity.indicatorId);
    if (!indicator) continue;
    const arr = indicatorsByGoal.get(activity.strategicGoalId) || [];
    arr.push(indicator);
    indicatorsByGoal.set(activity.strategicGoalId, arr);
    linkedIndicatorIds.add(indicator.id);
  }

  const allIssues = [];
  const deptRoleIds = new Set();
  const goalsMap = goals.map(goal => {
    const directIndicators = uniqById(indicatorsByGoal.get(goal.id) || []).map(indicatorBrief);
    const axisIndicators = uniqById(indicatorsByAxis.get(goal.axisId) || [])
      .filter(ind => !directIndicators.some(x => x.id === ind.id))
      .map(indicatorBrief);
    const goalActivities = (goal.activities || []).map(activityBrief);
    const departmentsForGoal = new Map();

    if (goal.ownerUser?.department) departmentsForGoal.set(goal.ownerUser.department.id, userDept(goal.ownerUser));
    for (const activity of goal.activities || []) {
      if (activity.dept) departmentsForGoal.set(activity.dept.id, activityBrief(activity).dept);
    }
    for (const indicator of directIndicators) {
      if (indicator.ownerDept) departmentsForGoal.set(indicator.ownerDept.id, indicator.ownerDept);
      if (indicator.dataEntryDept) departmentsForGoal.set(indicator.dataEntryDept.id, indicator.dataEntryDept);
    }
    for (const dept of departmentsForGoal.values()) deptRoleIds.add(dept.id);

    const issues = [];
    if (directIndicators.length === 0 && axisIndicators.length === 0) {
      issues.push(issue('ERROR', 'المؤشرات', 'الهدف لا يملك مؤشراً مباشراً أو مؤشراً داعماً على نفس المحور.', goal.code));
    } else if (directIndicators.length === 0) {
      issues.push(issue('WARNING', 'المؤشرات', 'يوجد مؤشر على المحور، لكن لم يثبت الربط المباشر مع الهدف أو نشاطه.', goal.code));
    }
    if (goalActivities.length === 0) {
      issues.push(issue('WARNING', 'التنفيذ', 'لا توجد أنشطة تشغيلية مرتبطة؛ هذا تنبيه وليس فشلاً إذا كان الهدف يقاس بمؤشرات مباشرة.', goal.code));
    }
    if (!goal.ownerUserId && !goal.responsible?.trim()) {
      issues.push(issue('WARNING', 'الملكية', 'لا يوجد مالك أو جهة مسؤولة واضحة للهدف.', goal.code));
    }
    if (directIndicators.length > 0 && goalActivities.length > 0) {
      issues.push(issue('INFO', 'النموذج', 'الهدف مرتبط بقياس وتنفيذ عملي.', goal.code));
    }
    allIssues.push(...issues);

    return {
      id: goal.id,
      code: goal.code,
      title: goal.title,
      status: goal.status,
      progress: goal.progress,
      axis: goal.axis,
      owner: goal.ownerUser ? { id: goal.ownerUser.id, name: goal.ownerUser.name } : null,
      responsible: goal.responsible,
      indicators: directIndicators,
      supportingAxisIndicators: axisIndicators,
      activities: goalActivities,
      initiatives: goal.initiatives || [],
      legacyObjectivesCount: (goal.objectives || []).length,
      departments: [...departmentsForGoal.values()],
      issues: issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    };
  });

  const indicatorIssues = [];
  for (const indicator of indicators) {
    const brief = indicatorBrief(indicator);
    if (!indicator.ownerId) indicatorIssues.push(issue('ERROR', 'مالك المؤشر', `${indicator.code} - لا يوجد مالك أداء.`, indicator.code));
    if (!indicator.dataEntryUserId) indicatorIssues.push(issue('ERROR', 'مالك البيانات', `${indicator.code} - لا يوجد مدخل بيانات.`, indicator.code));
    if (!indicator.frequency) indicatorIssues.push(issue('ERROR', 'تردد القياس', `${indicator.code} - لا يوجد تردد قياس.`, indicator.code));
    if (!indicator.annualTargets?.length) indicatorIssues.push(issue('ERROR', 'المستهدفات', `${indicator.code} - لا يوجد مستهدف سنوي${targetYear ? ` لعام ${targetYear}` : ''}.`, indicator.code));
    if (!linkedIndicatorIds.has(indicator.id) && !indicator.axisId) {
      indicatorIssues.push(issue('WARNING', 'الربط', `${indicator.code} - مؤشر مستقل غير مربوط بمحور أو نشاط؛ راجع حاجته.`, indicator.code));
    }
    if (brief.ownerDept) deptRoleIds.add(brief.ownerDept.id);
    if (brief.dataEntryDept) deptRoleIds.add(brief.dataEntryDept.id);
  }
  allIssues.push(...indicatorIssues);

  const staffedDepartmentIds = new Set((activeUsers || []).map(u => u.departmentId).filter(Boolean));
  const departmentsWithoutPlanRole = departments
    // لا نحاسب الخطة على سجلات أقسام تاريخية/فرعية لا يوجد عليها موظفون نشطون.
    // التغطية العملية تُقاس على الأقسام التي لها مستخدمون فعليون في النظام.
    .filter(d => staffedDepartmentIds.has(d.id))
    .filter(d => !deptRoleIds.has(d.id))
    .map(d => issue('WARNING', 'تغطية الأقسام', `${d.name} - لا يظهر كمالك أو مدخل بيانات أو منفذ في الخطة الحالية.`, d.code || d.id));
  allIssues.push(...departmentsWithoutPlanRole);

  const errors = allIssues.filter(i => i.severity === 'ERROR').length;
  const warnings = allIssues.filter(i => i.severity === 'WARNING').length;
  const infos = allIssues.filter(i => i.severity === 'INFO').length;
  const score = Math.max(0, Math.min(100, 100 - (errors * 6) - (warnings * 2)));

  return {
    ok: true,
    operatingModel: {
      name: 'النموذج الخفيف المعتمد',
      chain: ['المحور', 'الهدف الاستراتيجي', 'المؤشرات والأنشطة', 'القراءات والمتابعة'],
      objectiveLayer: 'اختيارية/قديمة وليست شرطاً للحكم على الخطة',
      bscNote: 'المحاور المخصصة للجمعية مقبولة إذا غطت الأثر، المال، العمليات، والتعلم والنمو بصورة عملية.',
    },
    summary: {
      score,
      goals: goals.length,
      axes: axes.length,
      indicators: indicators.length,
      activities: activities.length,
      departments: departments.length,
      goalsWithoutIndicators: goalsMap.filter(g => g.indicators.length === 0 && g.supportingAxisIndicators.length === 0).length,
      goalsWithoutActivities: goalsMap.filter(g => g.activities.length === 0).length,
      indicatorErrors: indicatorIssues.filter(i => i.severity === 'ERROR').length,
      departmentsWithoutPlanRole: departmentsWithoutPlanRole.length,
      errors,
      warnings,
      infos,
    },
    axes,
    goals: goalsMap,
    indicators: indicators.map(indicatorBrief),
    issues: allIssues
      .filter(i => i.severity !== 'INFO')
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
      .slice(0, 120),
  };
}
