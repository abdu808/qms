import { prisma } from '../db.js';
import { isDueMonth } from './kpiFrequency.js';

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

function criterion(id, label, passed, { severity = 'ERROR', current = null, target = null, recommendation = null } = {}) {
  return {
    id,
    label,
    status: passed ? 'PASSED' : 'FAILED',
    severity,
    current,
    target,
    recommendation,
  };
}

function near(value, target, tolerance = 0.5) {
  return Math.abs(Number(value || 0) - target) <= tolerance;
}

function readinessFrom({ errors, warnings, failedCriticalCriteria }) {
  if (errors > 0 || failedCriticalCriteria > 0) {
    return {
      level: 'NOT_READY',
      label: 'غير جاهزة للاعتماد',
      canFreeze: false,
      note: 'توجد مشكلات حاكمة تمنع إقفال الخطة أو توزيعها كنسخة عمل مستقرة.',
    };
  }
  if (warnings > 0) {
    return {
      level: 'NEEDS_REVIEW',
      label: 'جاهزة مشروطة بالمراجعة',
      canFreeze: true,
      note: 'يمكن العمل بالخطة مع إغلاق التنبيهات ضمن دورة المتابعة الأولى.',
    };
  }
  return {
    level: 'READY',
    label: 'جاهزة للعمل',
    canFreeze: true,
    note: 'الترابط الأساسي مكتمل ولا توجد مشكلات ظاهرة في نموذج الخطة.',
  };
}

function indicatorBrief(indicator) {
  return {
    id: indicator.id,
    code: indicator.code,
    nameAr: indicator.nameAr,
    definition: indicator.definition,
    formula: indicator.formula,
    unit: indicator.unit,
    frequency: indicator.frequency,
    kpiType: indicator.kpiType,
    indicatorType: indicator.indicatorType,
    dataSource: indicator.dataSource,
    baseline: indicator.baseline,
    weight: indicator.weight,
    greenThreshold: indicator.greenThreshold,
    yellowThreshold: indicator.yellowThreshold,
    isoClause: indicator.isoClause,
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
    approverDept: userDept(indicator.approver),
    targetYears: (indicator.annualTargets || []).map(t => t.year).sort((a, b) => a - b),
    targets: (indicator.annualTargets || [])
      .map(t => ({ year: t.year, targetValue: t.targetValue }))
      .sort((a, b) => a.year - b.year),
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

function initiativeBrief(initiative) {
  return {
    id: initiative.id,
    code: initiative.code,
    name: initiative.name,
    status: initiative.status,
    progress: initiative.progress,
    startDate: initiative.startDate,
    endDate: initiative.endDate,
    budget: initiative.budget,
    owner: initiative.owner ? { id: initiative.owner.id, name: initiative.owner.name } : null,
    department: initiative.department ? {
      id: initiative.department.id,
      code: initiative.department.code,
      name: initiative.department.name,
    } : null,
  };
}

export async function buildPlanConnectivity({ year = null } = {}) {
  const targetYear = Number(year) || null;
  let plan = await prisma.strategicPlan.findFirst({
    where: { deletedAt: null, status: 'ACTIVE' },
    orderBy: [{ startYear: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, code: true, title: true, status: true, startYear: true, endYear: true },
  });
  if (!plan) {
    plan = await prisma.strategicPlan.findFirst({
      where: { deletedAt: null },
      orderBy: [{ startYear: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true, code: true, title: true, status: true, startYear: true, endYear: true },
    });
  }
  const goalWhere = plan?.id ? { ...active, planId: plan.id } : active;
  const activityWhere = plan?.id
    ? { ...active, strategicGoal: { planId: plan.id } }
    : active;
  const [goals, indicators, activities, departments, axes, activeUsers] = await Promise.all([
    prisma.strategicGoal.findMany({
      where: goalWhere,
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
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            progress: true,
            ownerId: true,
            departmentId: true,
            startDate: true,
            endDate: true,
            budget: true,
            owner: { select: { id: true, name: true } },
            department: { select: { id: true, code: true, name: true } },
          },
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
        approver: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        annualTargets: {
          where: targetYear ? { year: targetYear } : {},
          select: { year: true, targetValue: true },
        },
      },
    }),
    prisma.operationalActivity.findMany({
      where: activityWhere,
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
  const axisWeightTotal = axes.reduce((sum, axis) => sum + Number(axis.weight || 0), 0);
  if (!axes.length) {
    allIssues.push(issue('ERROR', 'المحاور', 'لا توجد محاور استراتيجية نشطة؛ لا يمكن قراءة توازن الخطة.', 'AXES'));
  } else if (axisWeightTotal > 0 && !near(axisWeightTotal, 100)) {
    allIssues.push(issue('WARNING', 'أوزان المحاور', `مجموع أوزان المحاور ${axisWeightTotal}% وليس 100%.`, 'AXES'));
  }
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
    for (const initiative of goal.initiatives || []) {
      if (initiative.department) {
        departmentsForGoal.set(initiative.department.id, {
          id: initiative.department.id,
          code: initiative.department.code,
          name: initiative.department.name,
        });
      }
    }
    for (const indicator of directIndicators) {
      if (indicator.ownerDept) departmentsForGoal.set(indicator.ownerDept.id, indicator.ownerDept);
      if (indicator.dataEntryDept) departmentsForGoal.set(indicator.dataEntryDept.id, indicator.dataEntryDept);
    }
    for (const dept of departmentsForGoal.values()) deptRoleIds.add(dept.id);

    const issues = [];
    if (!goal.axisId) {
      issues.push(issue('ERROR', 'المحور', 'الهدف غير مربوط بمحور استراتيجي؛ هذا يكسر التسلسل الهرمي للخطة.', goal.code));
    }
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
    for (const activity of goal.activities || []) {
      if (!activity.deptId && !activity.department?.trim()) {
        issues.push(issue('WARNING', 'حوكمة الأنشطة', `${activity.code || activity.title} - النشاط لا يملك إدارة منفذة مرتبطة.`, activity.code || goal.code));
      }
      if (!activity.ownerId && !activity.responsible?.trim()) {
        issues.push(issue('WARNING', 'حوكمة الأنشطة', `${activity.code || activity.title} - النشاط لا يملك مسؤولا واضحا.`, activity.code || goal.code));
      }
    }
    for (const initiative of goal.initiatives || []) {
      if (!initiative.ownerId) {
        issues.push(issue('WARNING', 'حوكمة المبادرات', `${initiative.code || initiative.name} - المبادرة لا تملك مالك تنفيذ.`, initiative.code || goal.code));
      }
      if (!initiative.departmentId) {
        issues.push(issue('WARNING', 'حوكمة المبادرات', `${initiative.code || initiative.name} - المبادرة لا تملك إدارة مسؤولة.`, initiative.code || goal.code));
      }
      if (!initiative.startDate || !initiative.endDate) {
        issues.push(issue('WARNING', 'حوكمة المبادرات', `${initiative.code || initiative.name} - المبادرة تحتاج تاريخ بداية ونهاية.`, initiative.code || goal.code));
      }
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
      initiatives: (goal.initiatives || []).map(initiativeBrief),
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
    if (!indicator.approverUserId) indicatorIssues.push(issue('WARNING', 'اعتماد المؤشر', `${indicator.code} - لا توجد جهة اعتماد واضحة للمؤشر.`, indicator.code));
    if (!indicator.definition?.trim()) indicatorIssues.push(issue('WARNING', 'تعريف المؤشر', `${indicator.code} - يحتاج تعريفا مختصرا حتى لا تختلف طريقة القياس بين الموظفين.`, indicator.code));
    if (!indicator.dataSource?.trim()) indicatorIssues.push(issue('WARNING', 'مصدر البيانات', `${indicator.code} - يحتاج مصدر بيانات واضحا.`, indicator.code));
    if (!indicator.unit?.trim()) indicatorIssues.push(issue('WARNING', 'وحدة القياس', `${indicator.code} - يحتاج وحدة قياس واضحة.`, indicator.code));
    if (!linkedIndicatorIds.has(indicator.id) && !indicator.axisId) {
      indicatorIssues.push(issue('WARNING', 'الربط', `${indicator.code} - مؤشر مستقل غير مربوط بمحور أو نشاط؛ راجع حاجته.`, indicator.code));
    }
    if (brief.ownerDept) deptRoleIds.add(brief.ownerDept.id);
    if (brief.dataEntryDept) deptRoleIds.add(brief.dataEntryDept.id);
    if (brief.approverDept) deptRoleIds.add(brief.approverDept.id);
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

  let executionHealth = null;
  if (targetYear) {
    const now = new Date();
    const latestDueMonth = targetYear < now.getFullYear()
      ? 12
      : targetYear === now.getFullYear()
        ? now.getMonth() + 1
        : 0;
    const dueSlots = [];
    if (latestDueMonth > 0) {
      for (const indicator of indicators) {
        if (!indicator.annualTargets?.length) continue;
        for (let month = 1; month <= latestDueMonth; month += 1) {
          if (isDueMonth(indicator.frequency, month, indicator.seasonality)) {
            dueSlots.push({ indicatorId: indicator.id, code: indicator.code, month });
          }
        }
      }
    }
    const dueIndicatorIds = [...new Set(dueSlots.map(s => s.indicatorId))];
    const entries = dueIndicatorIds.length
      ? await prisma.kpiEntry.findMany({
        where: { indicatorId: { in: dueIndicatorIds }, year: targetYear, month: { lte: latestDueMonth || 0 } },
        select: { indicatorId: true, month: true, entryStatus: true },
      })
      : [];
    const entryBySlot = new Map(entries.map(e => [`${e.indicatorId}:${e.month}`, e]));
    const missing = dueSlots.filter(s => !entryBySlot.has(`${s.indicatorId}:${s.month}`));
    const pendingApproval = entries.filter(e => e.entryStatus && e.entryStatus !== 'APPROVED');
    executionHealth = {
      year: targetYear,
      latestDueMonth,
      dueReadings: dueSlots.length,
      enteredReadings: dueSlots.length - missing.length,
      missingReadings: missing.length,
      pendingApproval: pendingApproval.length,
      score: dueSlots.length ? Math.round(((dueSlots.length - missing.length) / dueSlots.length) * 100) : 100,
      sampleMissing: missing.slice(0, 20),
    };
    if (missing.length > 0) {
      allIssues.push(issue('WARNING', 'قراءات الأداء', `يوجد ${missing.length} قراءة أداء مستحقة وغير مدخلة لعام ${targetYear}.`, String(targetYear)));
    }
    if (pendingApproval.length > 0) {
      allIssues.push(issue('WARNING', 'اعتماد القراءات', `يوجد ${pendingApproval.length} قراءة مدخلة لكنها لم تعتمد بعد.`, String(targetYear)));
    }
  }

  const goalsWithoutAxis = goals.filter(g => !g.axisId).length;
  const goalsWithoutOwner = goals.filter(g => !g.ownerUserId && !g.responsible?.trim()).length;
  const goalsWithoutMeasurement = goalsMap.filter(g => g.indicators.length === 0 && g.supportingAxisIndicators.length === 0).length;
  const indicatorsMissingGovernance = indicators.filter(indicator => (
    !indicator.ownerId
    || !indicator.dataEntryUserId
    || !indicator.frequency
    || !indicator.annualTargets?.length
  )).length;
  const indicatorsMissingDefinition = indicators.filter(indicator => (
    !indicator.definition?.trim()
    || !indicator.dataSource?.trim()
    || !indicator.unit?.trim()
    || !indicator.approverUserId
  )).length;
  const activitiesMissingGovernance = activities.filter(activity => (
    (!activity.deptId && !activity.department?.trim())
    || (!activity.ownerId && !activity.responsible?.trim())
  )).length;
  const initiatives = goals.flatMap(g => g.initiatives || []);
  const initiativesMissingGovernance = initiatives.filter(initiative => (
    !initiative.ownerId || !initiative.departmentId || !initiative.startDate || !initiative.endDate
  )).length;

  const acceptanceCriteria = [
    criterion('AXES_DEFINED', 'وجود محاور استراتيجية نشطة', axes.length > 0, {
      current: axes.length,
      target: '1+',
      recommendation: 'اعتماد محاور الخطة قبل توزيعها على الأقسام.',
    }),
    criterion('AXES_WEIGHT_100', 'أوزان المحاور تساوي 100%', axisWeightTotal === 0 || near(axisWeightTotal, 100), {
      severity: 'WARNING',
      current: `${axisWeightTotal}%`,
      target: '100%',
      recommendation: 'ضبط أوزان المحاور حتى تعطي لوحة الأداء قراءة عادلة.',
    }),
    criterion('GOALS_HAVE_AXIS', 'كل هدف استراتيجي مرتبط بمحور', goalsWithoutAxis === 0, {
      current: goalsWithoutAxis,
      target: 0,
      recommendation: 'ربط الأهداف بالمحاور هو أساس الخريطة الاستراتيجية.',
    }),
    criterion('GOALS_HAVE_OWNER', 'كل هدف له مالك أو جهة مسؤولة', goalsWithoutOwner === 0, {
      severity: 'WARNING',
      current: goalsWithoutOwner,
      target: 0,
      recommendation: 'تسمية مالك الهدف تمنع ضياع المسؤولية عند المتابعة.',
    }),
    criterion('GOALS_HAVE_MEASUREMENT', 'كل هدف له مؤشر مباشر أو داعم', goalsWithoutMeasurement === 0, {
      current: goalsWithoutMeasurement,
      target: 0,
      recommendation: 'لا يعتمد هدف بلا قياس واضح أو مؤشر داعم على نفس المحور.',
    }),
    criterion('INDICATORS_GOVERNED', 'كل مؤشر له مالك ومالك بيانات وتردد ومستهدف سنوي', indicatorsMissingGovernance === 0, {
      current: indicatorsMissingGovernance,
      target: 0,
      recommendation: 'استكمال حوكمة المؤشرات قبل طلب الإدخالات من الموظفين.',
    }),
    criterion('INDICATORS_DEFINED', 'تعريف ومصدر ووحدة واعتماد المؤشرات مكتملة', indicatorsMissingDefinition === 0, {
      severity: 'WARNING',
      current: indicatorsMissingDefinition,
      target: 0,
      recommendation: 'هذه ليست مانعا للتشغيل، لكنها تمنع اختلاف فهم القياس لاحقا.',
    }),
    criterion('ACTIVITIES_GOVERNED', 'كل نشاط له إدارة منفذة ومسؤول واضح', activitiesMissingGovernance === 0, {
      severity: 'WARNING',
      current: activitiesMissingGovernance,
      target: 0,
      recommendation: 'الأنشطة هي لغة الفريق اليومية؛ لا تترك بلا مالك.',
    }),
    criterion('INITIATIVES_GOVERNED', 'كل مبادرة لها مالك وإدارة وتاريخ بداية ونهاية', initiativesMissingGovernance === 0, {
      severity: 'WARNING',
      current: initiativesMissingGovernance,
      target: 0,
      recommendation: 'المبادرات الكبيرة تحتاج إطارا زمنيا حتى لا تتحول إلى عنوان فقط.',
    }),
    criterion('STAFFED_DEPTS_COVERED', 'كل قسم نشط له دور ظاهر في الخطة', departmentsWithoutPlanRole.length === 0, {
      severity: 'WARNING',
      current: departmentsWithoutPlanRole.length,
      target: 0,
      recommendation: 'إن كان القسم إجرائيا فقط فيكفي ربطه بنشاط أو مؤشر مستقل.',
    }),
    criterion('READINGS_CURRENT', 'قراءات الأداء المستحقة مدخلة أو تحت الاعتماد', !executionHealth || executionHealth.missingReadings === 0, {
      severity: 'WARNING',
      current: executionHealth?.missingReadings ?? 0,
      target: 0,
      recommendation: 'هذا معيار تشغيل شهري، وليس عيبا في تصميم الخطة نفسها.',
    }),
  ];

  const failedCriticalCriteria = acceptanceCriteria
    .filter(c => c.status === 'FAILED' && c.severity === 'ERROR')
    .length;
  const passedCriteria = acceptanceCriteria.filter(c => c.status === 'PASSED').length;

  const errors = allIssues.filter(i => i.severity === 'ERROR').length;
  const warnings = allIssues.filter(i => i.severity === 'WARNING').length;
  const infos = allIssues.filter(i => i.severity === 'INFO').length;
  const definitionScore = Math.max(0, Math.min(100, 100 - (errors * 6) - (warnings * 2)));
  const score = executionHealth ? Math.min(definitionScore, executionHealth.score) : definitionScore;
  const readiness = readinessFrom({ errors, warnings, failedCriticalCriteria });
  const nextActions = acceptanceCriteria
    .filter(c => c.status === 'FAILED')
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      label: c.label,
      severity: c.severity,
      recommendation: c.recommendation,
    }));

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
      definitionScore,
      executionScore: executionHealth?.score ?? null,
      readiness,
      acceptancePassed: passedCriteria,
      acceptanceTotal: acceptanceCriteria.length,
      axisWeightTotal,
      goals: goals.length,
      axes: axes.length,
      indicators: indicators.length,
      activities: activities.length,
      departments: departments.length,
      goalsWithoutIndicators: goalsMap.filter(g => g.indicators.length === 0 && g.supportingAxisIndicators.length === 0).length,
      goalsWithoutActivities: goalsMap.filter(g => g.activities.length === 0).length,
      goalsWithoutAxis,
      goalsWithoutOwner,
      indicatorsMissingGovernance,
      indicatorsMissingDefinition,
      activitiesMissingGovernance,
      initiativesMissingGovernance,
      indicatorErrors: indicatorIssues.filter(i => i.severity === 'ERROR').length,
      departmentsWithoutPlanRole: departmentsWithoutPlanRole.length,
      errors,
      warnings,
      infos,
    },
    plan,
    executionHealth,
    axes,
    goals: goalsMap,
    indicators: indicators.map(indicatorBrief),
    acceptanceCriteria,
    nextActions,
    issues: allIssues
      .filter(i => i.severity !== 'INFO')
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
      .slice(0, 120),
  };
}
