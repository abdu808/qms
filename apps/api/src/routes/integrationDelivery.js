/**
 * routes/integrationDelivery.js
 *
 * GET  /api/integrations/deliveries          — سجل محاولات الإرسال (للمشرف)
 * POST /api/integrations/delivery-status     — callback من n8n لتحديث حالة الإرسال
 *
 * الـ callback يستخدم HMAC signature (ليس JWT) لأن n8n يستدعيه كنظام خارجي.
 * يجب أن يحتوي header: X-Webhook-Signature = hex(hmacSha256(rawBody, secret))
 */
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { decrypt } from '../lib/ai/crypto.js';
import { markIntegrationDeliveryStatus } from '../services/integrationDelivery.js';

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
      orderBy: { createdAt: 'desc' },
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
// POST /delivery-status — callback من n8n
// ──────────────────────────────────────────────────────────────
// لا يستخدم JWT — يتحقق عبر HMAC signature
// مثال body من n8n:
//   { deliveryId: "abc", status: "DELIVERED", channel: "WHATSAPP",
//     provider: "twilio", providerMessageId: "SM...", response: {...} }

router.post('/delivery-status', asyncHandler(async (req, res) => {
  // 1) قراءة الـ secret الحالي للتحقق من التوقيع
  const secretRow = await prisma.setting.findUnique({ where: { key: 'n8n_webhook_secret' } });
  const enabledRow = await prisma.setting.findUnique({ where: { key: 'n8n_webhook_enabled' } });

  if (!enabledRow || enabledRow.value !== 'true') {
    return res.status(503).json({ ok: false, error: 'callback غير مفعّل' });
  }
  if (!secretRow?.value) {
    return res.status(403).json({ ok: false, error: 'لا يوجد secret مُعدّ' });
  }

  // 2) فك تشفير الـ secret المخزَّن
  const secret = secretRow.value.startsWith('v1:') ? decrypt(secretRow.value) : secretRow.value;
  if (!secret) return res.status(403).json({ ok: false, error: 'فشل قراءة secret' });

  // 3) التحقق من signature
  const provided = req.header('x-webhook-signature') || req.header('X-Webhook-Signature') || '';
  const rawBody = JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // مقارنة آمنة بـ timing-attack
  let valid = false;
  try {
    valid = provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch { valid = false; }

  if (!valid) {
    return res.status(401).json({ ok: false, error: 'توقيع غير صحيح' });
  }

  // 4) تحديث حالة الإرسال
  const { deliveryId, eventKey, status, channel, provider, providerMessageId, response, error } = req.body;

  if (!deliveryId && !eventKey) {
    return res.status(400).json({ ok: false, error: 'deliveryId أو eventKey مطلوب' });
  }
  if (!status) {
    return res.status(400).json({ ok: false, error: 'status مطلوب' });
  }

  try {
    const updated = await markIntegrationDeliveryStatus({
      deliveryId, eventKey, status, channel, provider, providerMessageId, response, error,
    });
    res.json({ ok: true, delivery: { id: updated.id, status: updated.status } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}));

// ──────────────────────────────────────────────────────────────
// GET /deliveries/stats — إحصائيات السجل
// ──────────────────────────────────────────────────────────────

router.get('/deliveries/stats', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // آخر 30 يوم

  const [byStatus, byEvent, recentTotal] = await Promise.all([
    prisma.integrationDelivery.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.integrationDelivery.groupBy({
      by: ['event'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.integrationDelivery.count({ where: { createdAt: { gte: since } } }),
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
