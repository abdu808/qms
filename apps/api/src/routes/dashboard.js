import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const [
    objTotal, objAchieved, objDelayed,
    riskTotal, riskCritical,
    cmpOpen, cmpTotal,
    ncrOpen, ncrClosed,
    auditsPlanned, auditsDone,
    suppliers, supplierApproved,
    donations, beneficiaries, docs, usersCount,
  ] = await Promise.all([
    prisma.objective.count(),
    prisma.objective.count({ where: { status: 'ACHIEVED' } }),
    prisma.objective.count({ where: { status: 'DELAYED' } }),
    prisma.risk.count(),
    prisma.risk.count({ where: { level: 'حرج' } }),
    prisma.complaint.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] } } }),
    prisma.complaint.count(),
    prisma.nCR.count({ where: { status: { in: ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] } } }),
    prisma.nCR.count({ where: { status: 'CLOSED' } }),
    prisma.audit.count({ where: { status: 'PLANNED' } }),
    prisma.audit.count({ where: { status: 'COMPLETED' } }),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { status: 'APPROVED' } }),
    prisma.donation.count(),
    prisma.beneficiary.count({ where: { status: 'ACTIVE' } }),
    prisma.document.count({ where: { status: 'PUBLISHED' } }),
    prisma.user.count({ where: { active: true } }),
  ]);

  res.json({
    ok: true,
    kpis: {
      objectives: { total: objTotal, achieved: objAchieved, delayed: objDelayed,
        achievementRate: objTotal ? Math.round((objAchieved / objTotal) * 100) : 0 },
      risks: { total: riskTotal, critical: riskCritical },
      complaints: { open: cmpOpen, total: cmpTotal,
        resolutionRate: cmpTotal ? Math.round(((cmpTotal - cmpOpen) / cmpTotal) * 100) : 0 },
      ncr: { open: ncrOpen, closed: ncrClosed },
      audits: { planned: auditsPlanned, completed: auditsDone },
      suppliers: { total: suppliers, approved: supplierApproved },
      donations: { total: donations },
      beneficiaries: { active: beneficiaries },
      documents: { published: docs },
      users: { active: usersCount },
    },
    generatedAt: new Date().toISOString(),
  });
}));

export default router;
