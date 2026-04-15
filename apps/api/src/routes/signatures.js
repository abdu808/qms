import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest } from '../utils/errors.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const where = {};
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId = entityId;
  const items = await prisma.signature.findMany({
    where, include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { signedAt: 'desc' },
  });
  res.json({ ok: true, items });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { entityType, entityId, purpose, signatureData } = req.body;
  if (!entityType || !entityId || !signatureData) throw BadRequest('بيانات التوقيع ناقصة');
  const sig = await prisma.signature.create({
    data: {
      userId: req.user.sub, entityType, entityId,
      purpose: purpose || 'approve', signatureData,
      ipAddress: req.ip,
    },
  });
  res.status(201).json({ ok: true, item: sig });
}));

export default router;
