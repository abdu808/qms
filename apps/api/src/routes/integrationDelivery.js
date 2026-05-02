/**
 * routes/integrationDelivery.js
 *
 * Endpoints إدارية فقط — تتطلب JWT.
 * الـ callback من n8n موجود في routes/integrationCallback.js
 * (مُسجَّل قبل JWT middleware في server.js).
 *
 * GET /api/integrations/deliveries          — سجل محاولات الإرسال
 * GET /api/integrations/deliveries/stats    — إحصائيات السجل
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /deliveries — سجل الإرسال (SUPER_ADMIN + QUALITY_MANAGER)
// ──────────────────────────────────────────────────────────────

router.get('/deliveries', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const { status, event, recipientUserId, page = '1', limit = '50' } = req.query;

  const where = {};
  if (status) where.status = status;
  if (event) where.event = event;
  if (recipientUserId) where.recipientUserId = recipientUserId;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    prisma.integrationDelivery.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip,
      take: limitNum,
      // ملاحظة: payloadJson و responseJson قد تكون كبيرة، نضمنها لكنها مقتطعة في الواجهة
    }),
    prisma.integrationDelivery.count({ where }),
  ]);

  res.json({
    ok: true,
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}));

// ──────────────────────────────────────────────────────────────
// GET /deliveries/stats — إحصائيات السجل
// ──────────────────────────────────────────────────────────────

router.get('/deliveries/stats', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // آخر 30 يوم

  const [byStatus, byEvent, recentTotal] = await Promise.all([
    prisma.integrationDelivery.groupBy({
      by: ['status'],
      where: { requestedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.integrationDelivery.groupBy({
      by: ['event'],
      where: { requestedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.integrationDelivery.count({ where: { requestedAt: { gte: since } } }),
  ]);

  const flatten = (arr) => arr.map(x => ({ ...x, _count: x._count?._all || x._count || 0 }));

  res.json({
    ok: true,
    period: { since: since.toISOString(), days: 30 },
    recentTotal,
    byStatus: flatten(byStatus),
    byEvent: flatten(byEvent),
  });
}));

export default router;
