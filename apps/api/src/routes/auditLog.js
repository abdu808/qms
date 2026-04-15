import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authorize('SUPER_ADMIN', 'QUALITY_MANAGER', 'GUEST_AUDITOR'), asyncHandler(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const where = {};
  if (req.query.userId)     where.userId = req.query.userId;
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.action)     where.action = req.query.action;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { at: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
  ]);
  res.json({ ok: true, total, page, limit, items });
}));

export default router;
