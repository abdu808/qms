import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';

const base = crudRouter({
  model: 'managementReview',
  codePrefix: 'MR',
  searchFields: ['title', 'attendees', 'decisions', 'improvementActions'],
  allowedSortFields: ['createdAt', 'meetingDate', 'status'],
  allowedFilters: ['status'],
  beforeUpdate: async (data) => {
    // ISO 9.3.1: لا يمكن إكمال المراجعة دون تأكيد حضور الإدارة العليا
    if (data.status === 'COMPLETED') {
      if (data.topManagementPresent !== true && data.topManagementPresent !== 'true') {
        throw BadRequest('لا يمكن إكمال المراجعة الإدارية دون تأكيد حضور الإدارة العليا (ISO 9.3.1)');
      }
    }
    return data;
  },
});

const router = Router();

/**
 * GET /api/management-review/:id/inputs
 * ISO 9.3.2 — auto-gather inputs scoped to the review's period
 * (from the previous review's meeting date up to this review's meeting date)
 */
router.get('/:id/inputs', asyncHandler(async (req, res) => {
  const review = await prisma.managementReview.findUnique({ where: { id: req.params.id } });
  if (!review) throw NotFound('المراجعة غير موجودة');

  // Determine period: from previous review (if any) to this review's meetingDate
  const previous = await prisma.managementReview.findFirst({
    where: { meetingDate: { lt: review.meetingDate } },
    orderBy: { meetingDate: 'desc' },
    select: { meetingDate: true },
  });
  const from = previous?.meetingDate || new Date('2000-01-01');
  const to   = review.meetingDate;

  const dateRange = { gte: from, lte: to };

  const [
    objStats, riskStats, ncrStats, complaintStats, auditStats, supplierStats,
    newComplaints, resolvedComplaints, avgSatisfaction,
    openNcrs, closedNcrs, effectiveNcrs,
    surveyResponses,
  ] = await Promise.all([
    prisma.objective.groupBy({ by: ['status'], _count: true }),
    prisma.risk.groupBy({ by: ['level'], _count: true }),
    prisma.nCR.groupBy({ by: ['status'], _count: true, where: { createdAt: dateRange } }),
    prisma.complaint.groupBy({ by: ['status'], _count: true, where: { receivedAt: dateRange } }),
    prisma.audit.groupBy({ by: ['status'], _count: true, where: { plannedDate: dateRange } }),
    prisma.supplier.groupBy({ by: ['status'], _count: true }),
    prisma.complaint.count({ where: { receivedAt: dateRange } }),
    prisma.complaint.count({ where: { receivedAt: dateRange, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.complaint.aggregate({
      where: { receivedAt: dateRange, satisfaction: { not: null } },
      _avg: { satisfaction: true },
      _count: { satisfaction: true },
    }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: { not: 'CLOSED' } } }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: 'CLOSED' } }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: 'CLOSED', effective: true } }),
    prisma.survey.aggregate({
      where: { updatedAt: dateRange },
      _sum: { responses: true },
      _avg: { avgScore: true },
    }),
  ]);

  res.json({
    ok: true,
    period: { from, to, label: review.period || null },
    inputs: {
      objectives: objStats,
      risks: riskStats,
      ncr: {
        byStatus: ncrStats,
        open: openNcrs,
        closed: closedNcrs,
        effective: effectiveNcrs,
        effectivenessRate: closedNcrs > 0 ? Math.round((effectiveNcrs / closedNcrs) * 100) : null,
      },
      complaints: {
        byStatus: complaintStats,
        received: newComplaints,
        resolved: resolvedComplaints,
        resolutionRate: newComplaints > 0 ? Math.round((resolvedComplaints / newComplaints) * 100) : null,
        avgSatisfaction: avgSatisfaction._avg.satisfaction,
        satisfactionResponseCount: avgSatisfaction._count.satisfaction,
      },
      audits: auditStats,
      suppliers: supplierStats,
      surveys: {
        totalResponses: surveyResponses._sum.responses || 0,
        avgScore: surveyResponses._avg.avgScore,
      },
    },
  });
}));

router.use('/', base);

export default router;
