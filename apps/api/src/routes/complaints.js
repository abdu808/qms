import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest } from '../utils/errors.js';

const RESOLVED_STATES = ['RESOLVED', 'CLOSED'];
const OPEN_STATES     = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];
const OVERDUE_DAYS    = 14; // الحد الأقصى المقبول للمعالجة (ISO 9.1.2)

function normalize(data) {
  // Coerce satisfaction to Int or null
  if (data.satisfaction === '' || data.satisfaction === null || data.satisfaction === undefined) {
    data.satisfaction = null;
  } else {
    const s = Number(data.satisfaction);
    if (!Number.isFinite(s) || s < 1 || s > 5) {
      throw BadRequest('درجة الرضا يجب أن تكون بين 1 و 5');
    }
    data.satisfaction = s;
  }

  // Auto-stamp resolvedAt when moving to a resolved state
  if (RESOLVED_STATES.includes(data.status) && !data.resolvedAt) {
    data.resolvedAt = new Date();
  }
  return data;
}

const base = crudRouter({
  model: 'complaint',
  codePrefix: 'CMP',
  searchFields: ['subject', 'description', 'complainantName'],
  include: { assignee: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'receivedAt', 'status', 'severity'],
  allowedFilters: ['status', 'severity', 'assigneeId'],
  beforeCreate: async (data) => normalize(data),
  beforeUpdate: async (data) => normalize(data),
});

const router = Router();

/**
 * GET /api/complaints/overdue
 * ISO 9.1.2 — الشكاوى المتأخرة (مفتوحة أكثر من 14 يوماً)
 */
router.get('/overdue', asyncHandler(async (req, res) => {
  const cutoff = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000);

  const items = await prisma.complaint.findMany({
    where: {
      status: { in: OPEN_STATES },
      receivedAt: { lte: cutoff },
    },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { receivedAt: 'asc' },
  });

  // احسب عمر الشكوى بالأيام لكل سجل
  const enriched = items.map(c => ({
    ...c,
    ageDays: Math.floor((Date.now() - new Date(c.receivedAt).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  res.json({
    ok: true,
    overdueDays: OVERDUE_DAYS,
    count: enriched.length,
    items: enriched,
  });
}));

router.use('/', base);

export default router;
