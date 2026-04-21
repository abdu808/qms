/**
 * routes/webhookSettings.js — إعدادات n8n Webhook
 * GET /api/webhook-settings     — قراءة الإعدادات
 * PUT /api/webhook-settings     — حفظ الإعدادات
 * POST /api/webhook-settings/test — اختبار الاتصال
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest } from '../utils/errors.js';
import { invalidateWebhookCache, emitWebhookStrict } from '../lib/webhookEmitter.js';

const router = Router();
const SA = 'SUPER_ADMIN';

// helper: إخفاء جزء من الـ secret
const maskSecret = (s) => s ? '****' + String(s).slice(-4) : '';

router.get('/', authorize(SA), asyncHandler(async (_req, res) => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['n8n_webhook_url', 'n8n_webhook_secret', 'n8n_webhook_enabled'] } },
  });
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    ok: true,
    item: {
      url:     m.n8n_webhook_url    || '',
      secret:  maskSecret(m.n8n_webhook_secret),
      enabled: m.n8n_webhook_enabled === 'true',
    },
  });
}));

router.put('/', authorize(SA), asyncHandler(async (req, res) => {
  const { url, secret, enabled } = req.body;
  if (url !== undefined && typeof url !== 'string') throw BadRequest('url يجب أن يكون نصاً');
  if (url && !/^https?:\/\//.test(url)) throw BadRequest('url يجب أن يبدأ بـ http:// أو https://');

  const upsert = async (key, value) => {
    if (value === undefined) return;
    await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  };

  await Promise.all([
    upsert('n8n_webhook_url',     url),
    // لا تُحدِّث الـ secret إن أرسل المستخدم القيمة المُخفَّاة (****xxxx)
    secret !== undefined && !secret.startsWith('****') ? upsert('n8n_webhook_secret', secret) : Promise.resolve(),
    enabled !== undefined ? upsert('n8n_webhook_enabled', String(!!enabled)) : Promise.resolve(),
  ]);

  invalidateWebhookCache();
  res.json({ ok: true, message: 'تم حفظ إعدادات الـ webhook' });
}));

router.post('/test', authorize(SA), asyncHandler(async (req, res) => {
  try {
    const result = await emitWebhookStrict('QMS_TEST_CONNECTION', {
      message: 'اختبار الاتصال من نظام إدارة الجودة',
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: result.ok, status: result.status, message: result.ok ? 'تم الاتصال بنجاح ✓' : `استجاب n8n بـ status ${result.status}` });
  } catch (e) {
    res.json({ ok: false, status: 0, message: `فشل الاتصال: ${e.message}` });
  }
}));

export default router;
