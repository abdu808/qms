/**
 * routes/charts.js — بيانات الرسوم البيانية للوحة التنفيذية
 * GET /api/charts — يُرجع كل البيانات في طلب واحد
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { buildPlanConnectivity } from '../lib/planConnectivity.js';

const router = Router();

router.get('/', requireAction('dashboard', 'read'), asyncHandler(async (_req, res) => {
  // آخر 6 أشهر للـ KPI trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0); start.setMonth(start.getMonth() - i);
    const end   = new Date(start); end.setMonth(end.getMonth() + 1);
    months.push({ start, end, label: start.toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' }) });
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // جمع كل البيانات بالتوازي
  const [
    ncrByStatus,
    complaintsByStatus,
    riskDistribution,
    objectivesAll,
    futPending,
    futOverdue,
    afOpen,
    afCritical,
    ...monthData
  ] = await Promise.all([
    // NCR by status
    prisma.nCR.groupBy({ by: ['status'], _count: { id: true }, where: activeWhere() }),
    // Complaints by status
    prisma.complaint.groupBy({ by: ['status'], _count: { id: true }, where: activeWhere() }),
    // Risk distribution by level
    prisma.risk.groupBy({ by: ['level'], _count: { id: true }, where: activeWhere({ status: { not: 'CLOSED' } }) }),
    // Objectives
    prisma.objective.groupBy({ by: ['status'], _count: { id: true }, where: activeWhere() }),
    // FollowUpTask — pending (OPEN | IN_PROGRESS)
    prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    // FollowUpTask — overdue (pending + dueDate passed)
    prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: now } } }),
    // AuditFinding — open (OPEN | IN_REVIEW)
    prisma.auditFinding.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_REVIEW'] } } }),
    // AuditFinding — critical (MAJOR_NC not CLOSED)
    prisma.auditFinding.count({ where: { deletedAt: null, type: 'MAJOR_NC', status: { not: 'CLOSED' } } }),
    // Month data (6 أشهر × 3 استعلامات = 18 استعلام بالتوازي)
    ...months.flatMap(m => [
      prisma.objective.count({ where: activeWhere({ status: 'ACHIEVED', updatedAt: { gte: m.start, lt: m.end } }) }),
      prisma.nCR.count({ where: activeWhere({ status: 'CLOSED', updatedAt: { gte: m.start, lt: m.end } }) }),
      prisma.complaint.count({ where: activeWhere({ status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: m.start, lt: m.end } }) }),
    ]),
  ]);

  // بناء KPI Trend
  const [objTotal, ncrTotal, cmpTotal] = await Promise.all([
    prisma.objective.count({ where: activeWhere() }),
    prisma.nCR.count({ where: activeWhere() }),
    prisma.complaint.count({ where: activeWhere() }),
  ]);
  const kpiTrend = months.map((m, i) => ({
    label: m.label,
    objectivesAchieved:  monthData[i * 3],
    ncrClosed:           monthData[i * 3 + 1],
    complaintsClosed:    monthData[i * 3 + 2],
    objectivesRate:  objTotal ? Math.round((monthData[i * 3]     / objTotal) * 100) : 0,
    ncrClosureRate:  ncrTotal ? Math.round((monthData[i * 3 + 1] / ncrTotal) * 100) : 0,
    complaintsRate:  cmpTotal ? Math.round((monthData[i * 3 + 2] / cmpTotal) * 100) : 0,
  }));

  // Objectives achievement summary
  const objMap = Object.fromEntries(objectivesAll.map(r => [r.status, r._count.id]));
  const objectivesAchievement = {
    achieved:   objMap['ACHIEVED']   || 0,
    inProgress: objMap['IN_PROGRESS'] || 0,
    delayed:    objMap['DELAYED']    || 0,
    planned:    objMap['PLANNED']    || 0,
    cancelled:  objMap['CANCELLED']  || 0,
  };

  let planReadiness = null;
  try {
    const planMap = await buildPlanConnectivity({ year: currentYear });
    planReadiness = {
      year: currentYear,
      score: planMap.summary?.score ?? null,
      definitionScore: planMap.summary?.definitionScore ?? null,
      executionScore: planMap.summary?.executionScore ?? null,
      readiness: planMap.summary?.readiness ?? null,
      acceptancePassed: planMap.summary?.acceptancePassed ?? 0,
      acceptanceTotal: planMap.summary?.acceptanceTotal ?? 0,
      errors: planMap.summary?.errors ?? 0,
      warnings: planMap.summary?.warnings ?? 0,
      nextActions: (planMap.nextActions || []).slice(0, 5),
      topIssues: (planMap.issues || []).slice(0, 5),
    };
  } catch (err) {
    console.warn('[charts] plan readiness unavailable', err?.code || err?.message || err);
    planReadiness = {
      year: currentYear,
      unavailable: true,
      message: 'تعذر حساب جاهزية الخطة حالياً؛ لا يؤثر ذلك على بقية اللوحة التنفيذية.',
    };
  }

  const executiveInsights = [];
  if (planReadiness?.readiness && planReadiness.readiness.level !== 'READY') {
    executiveInsights.push({
      type: planReadiness.readiness.level === 'NOT_READY' ? 'danger' : 'warn',
      title: 'جاهزية الخطة',
      message: planReadiness.readiness.note,
      action: planReadiness.nextActions?.[0]?.recommendation || 'راجع خريطة ترابط الخطة.',
    });
  }
  if (futOverdue > 0) {
    executiveInsights.push({
      type: 'danger',
      title: 'مهام متابعة متأخرة',
      message: `${futOverdue} مهمة متابعة تجاوزت تاريخ الاستحقاق.`,
      action: 'راجع لوحة المتابعة وحدد مالك الإغلاق.',
    });
  }
  if (afCritical > 0) {
    executiveInsights.push({
      type: 'danger',
      title: 'ملاحظات تدقيق حرجة',
      message: `${afCritical} ملاحظة تدقيق كبرى ما زالت مفتوحة.`,
      action: 'اربطها بإجراء تصحيحي ومراجعة موعد الإغلاق.',
    });
  }
  if (planReadiness?.unavailable) {
    executiveInsights.push({
      type: 'warn',
      title: 'خريطة الخطة',
      message: planReadiness.message,
      action: 'تحقق من آخر migrations أو من سلامة ارتباطات الخطة.',
    });
  }

  res.json({
    ok: true,
    kpiTrend,
    ncrByStatus:        ncrByStatus.map(r => ({ status: r.status, count: r._count.id })),
    complaintsByStatus: complaintsByStatus.map(r => ({ status: r.status, count: r._count.id })),
    riskDistribution:   riskDistribution.map(r => ({ level: r.level || 'غير محدد', count: r._count.id })),
    objectivesAchievement,
    totals: { objectives: objTotal, ncrs: ncrTotal, complaints: cmpTotal },
    followUpTasks: { pending: futPending, overdue: futOverdue },
    auditFindings: { open: afOpen, critical: afCritical },
    planReadiness,
    executiveInsights,
  });
}));

export default router;
