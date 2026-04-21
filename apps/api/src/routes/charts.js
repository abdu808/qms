/**
 * routes/charts.js — بيانات الرسوم البيانية للوحة التنفيذية
 * GET /api/charts — يُرجع كل البيانات في طلب واحد
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';

const router = Router();

router.get('/', requireAction('dashboard', 'read'), asyncHandler(async (_req, res) => {
  // آخر 6 أشهر للـ KPI trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0); start.setMonth(start.getMonth() - i);
    const end   = new Date(start); end.setMonth(end.getMonth() + 1);
    months.push({ start, end, label: start.toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' }) });
  }

  // جمع كل البيانات بالتوازي
  const [
    ncrByStatus,
    complaintsByStatus,
    riskDistribution,
    objectivesAll,
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

  res.json({
    ok: true,
    kpiTrend,
    ncrByStatus:        ncrByStatus.map(r => ({ status: r.status, count: r._count.id })),
    complaintsByStatus: complaintsByStatus.map(r => ({ status: r.status, count: r._count.id })),
    riskDistribution:   riskDistribution.map(r => ({ level: r.level || 'غير محدد', count: r._count.id })),
    objectivesAchievement,
    totals: { objectives: objTotal, ncrs: ncrTotal, complaints: cmpTotal },
  });
}));

export default router;
