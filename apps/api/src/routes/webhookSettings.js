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
import { encrypt, decrypt } from '../lib/ai/crypto.js';

const router = Router();
const SA = 'SUPER_ADMIN';

// helper: إخفاء جزء من الـ secret (يفك التشفير أولاً لعرض آخر 4 من النص الأصلي)
const maskSecret = (s) => {
  if (!s) return '';
  const plain = s.startsWith('v1:') ? decrypt(s) : s;
  return plain ? '****' + String(plain).slice(-4) : '****';
};

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

/**
 * يتحقق أن URL آمن للإرسال إليه:
 * - https فقط في الإنتاج
 * - ليس loopback/RFC1918/link-local/metadata endpoint (منع SSRF)
 * - يتطابق مع WEBHOOK_ALLOWED_HOSTS إن وُجد (قائمة بيضاء اختيارية)
 */
function validateWebhookUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw BadRequest('url غير صالح'); }
  if (!/^https?:$/.test(u.protocol)) throw BadRequest('البروتوكول يجب أن يكون http أو https');
  if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
    throw BadRequest('في الإنتاج يجب أن يكون https');
  }
  const host = u.hostname.toLowerCase();
  // حظر loopback / private / link-local / cloud metadata
  const blocked = [
    /^localhost$/, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
    /^10\./, /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,          // 172.16.0.0/12
    /^169\.254\./,                            // link-local + AWS metadata
    /^fc00:/i, /^fd00:/i, /^fe80:/i,          // IPv6 private/link-local
  ];
  if (blocked.some(re => re.test(host))) {
    throw BadRequest('عنوان شبكي داخلي غير مسموح (منع SSRF)');
  }
  // قائمة بيضاء اختيارية من env
  const allowList = (process.env.WEBHOOK_ALLOWED_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowList.length && !allowList.includes(host)) {
    throw BadRequest(`الوجهة ${host} خارج القائمة البيضاء`);
  }
  return u.toString();
}

router.put('/', authorize(SA), asyncHandler(async (req, res) => {
  const { url, secret, enabled } = req.body;
  if (url !== undefined && typeof url !== 'string') throw BadRequest('url يجب أن يكون نصاً');
  if (url) validateWebhookUrl(url);

  const upsert = async (key, value) => {
    if (value === undefined) return;
    await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  };

  await Promise.all([
    upsert('n8n_webhook_url',     url),
    // لا تُحدِّث الـ secret إن أرسل المستخدم القيمة المُخفَّاة (****xxxx)
    // نُشفِّر السر قبل التخزين (AES-256-GCM) — صيغة "v1:iv:tag:ct"
    secret !== undefined && !secret.startsWith('****') ? upsert('n8n_webhook_secret', encrypt(secret)) : Promise.resolve(),
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
