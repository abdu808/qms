import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';

const base = crudRouter({
  model: 'managementReview',
  codePrefix: 'MR',
  searchFields: ['title', 'attendees', 'decisions', 'improvementActions'],
  allowedSortFields: ['createdAt', 'meetingDate', 'status'],
});

const router = Router();

/**
 * GET /api/management-review/:id/inputs
 * Auto-gather inputs from other modules for a review
 */
router.get('/:id/inputs', asyncHandler(async (req, res) => {
  const [objStats, riskStats, ncrStats, complaintStats, auditStats, supplierStats] = await Promise.all([
    prisma.objective.groupBy({ by: ['status'], _count: true }),
    prisma.risk.groupBy({ by: ['level'], _count: true }),
    prisma.nCR.groupBy({ by: ['status'], _count: true }),
    prisma.complaint.groupBy({ by: ['status'], _count: true }),
    prisma.audit.groupBy({ by: ['status'], _count: true }),
    prisma.supplier.groupBy({ by: ['status'], _count: true }),
  ]);
  res.json({
    ok: true,
    inputs: {
      objectives: objStats,
      risks: riskStats,
      ncr: ncrStats,
      complaints: complaintStats,
      audits: auditStats,
      suppliers: supplierStats,
    },
  });
}));

router.use('/', base);

export default router;
