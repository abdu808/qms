/**
 * routes/integrationCallback.js
 *
 * يحتوي فقط على endpoints يستدعيها n8n من الخارج.
 * يُسجَّل قبل JWT middleware في server.js — لا يحتاج لجلسة مستخدم.
 *
 * المصادقة: X-Webhook-Secret header (نفس نمط /api/automation)
 *           — لا HMAC على JSON body (لأن n8n قد يُغيّر ترتيب/مسافات JSON
 *           فيكسر التوقيع رغم صحة الطلب).
 *
 * Endpoints:
 *   POST /api/integrations/callback/delivery-status
 *
 * أي endpoint إداري آخر (سجل، إحصائيات) يبقى في integrationDelivery.js
 * خلف JWT.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decrypt } from '../lib/ai/crypto.js';
import { markIntegrationDeliveryStatus } from '../services/integrationDelivery.js';

const router = Router();

// ─── X-Webhook-Secret middleware (نمط /api/automation) ──────────
async function getWebhookSecret() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'n8n_webhook_secret' } });
    if (!row?.value) return null;
    return row.value.startsWith('v1:') ? decrypt(row.value) : row.value;
  } catch { return null; }
}

async function requireWebhookAuth(req, res, next) {
  const provided = req.headers['x-webhook-secret'] || req.query.secret;
  const expected = await getWebhookSecret();

  if (!expected) {
    return res.status(503).json({ ok: false, error: 'Webhook secret غير مُعدّ — اضبطه في إعدادات n8n' });
  }

  // فحص التفعيل
  const enabledRow = await prisma.setting.findUnique({ where: { key: 'n8n_webhook_enabled' } });
  if (!enabledRow || enabledRow.value !== 'true') {
    return res.status(503).json({ ok: false, error: 'n8n callback غير مفعّل' });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing X-Webhook-Secret header' });
  }
  next();
}

// ──────────────────────────────────────────────────────────────
// POST /callback/delivery-status — يُستدعى من n8n بعد محاولة الإرسال
// ──────────────────────────────────────────────────────────────
// مثال body:
//   { deliveryId: "abc", status: "DELIVERED", channel: "WHATSAPP",
//     provider: "twilio", providerMessageId: "SM...", response: {...} }

router.post('/callback/delivery-status', requireWebhookAuth, asyncHandler(async (req, res) => {
  const { deliveryId, eventKey, status, channel, provider, providerMessageId, response, error } = req.body || {};

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

export default router;
