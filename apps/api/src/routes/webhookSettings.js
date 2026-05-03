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
    where: {
      key: {
        in: [
          'n8n_webhook_url',
          'n8n_webhook_secret',
          'n8n_webhook_enabled',
          'n8n_allowed_hosts',
          'n8n_last_test_at',
          'n8n_last_test_result',
        ],
      },
    },
  });
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));

  // إحصائيات حالة الإرسال من سجل IntegrationDelivery
  const [lastSuccess, lastFailure, totals] = await Promise.all([
    prisma.integrationDelivery.findFirst({
      where: { status: { in: ['DISPATCHED', 'DELIVERED'] } },
      orderBy: { dispatchedAt: 'desc' },
      select: { dispatchedAt: true, deliveredAt: true, event: true },
    }),
    prisma.integrationDelivery.findFirst({
      where: { status: 'FAILED' },
      orderBy: { failedAt: 'desc' },
      select: { failedAt: true, error: true, event: true },
    }),
    prisma.integrationDelivery.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  // حساب حالة الاتصال
  const enabled = m.n8n_webhook_enabled === 'true';
  const hasUrl = !!m.n8n_webhook_url;
  let connectionStatus = 'DISABLED';
  if (enabled && hasUrl) {
    const lastTest = m.n8n_last_test_result;
    if (lastTest === 'success') connectionStatus = 'CONNECTED';
    else if (lastTest === 'failed') connectionStatus = 'TEST_FAILED';
    else connectionStatus = 'NOT_TESTED';
  } else if (!hasUrl) {
    connectionStatus = 'NO_URL';
  }

  res.json({
    ok: true,
    item: {
      url:     m.n8n_webhook_url    || '',
      secret:  maskSecret(m.n8n_webhook_secret),
      enabled,
      allowedHosts: m.n8n_allowed_hosts || '',
      // معلومات الحالة المُحسَّنة
      connectionStatus, // CONNECTED | DISABLED | TEST_FAILED | NOT_TESTED | NO_URL
      lastTest: {
        at: m.n8n_last_test_at || null,
        result: m.n8n_last_test_result || null, // 'success' | 'failed' | null
      },
      lastSuccess: lastSuccess ? {
        at: lastSuccess.dispatchedAt || lastSuccess.deliveredAt,
        event: lastSuccess.event,
      } : null,
      lastFailure: lastFailure ? {
        at: lastFailure.failedAt,
        event: lastFailure.event,
        error: lastFailure.error,
      } : null,
      stats: Object.fromEntries(totals.map(t => [t.status, t._count?._all || t._count || 0])),
    },
  });
}));

/**
 * يتحقق أن URL آمن للإرسال إليه:
 * - https فقط في الإنتاج
 * - ليس loopback/RFC1918/link-local/metadata endpoint (منع SSRF)
 * - يتطابق مع WEBHOOK_ALLOWED_HOSTS إن وُجد (قائمة بيضاء اختيارية)
 */
function parseAllowedHosts(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

async function getEffectiveAllowedHosts(overrideValue) {
  const envHosts = parseAllowedHosts(process.env.WEBHOOK_ALLOWED_HOSTS || '');
  let dbValue = overrideValue;

  if (dbValue === undefined) {
    const row = await prisma.setting.findUnique({ where: { key: 'n8n_allowed_hosts' } });
    dbValue = row?.value || '';
  }

  const dbHosts = parseAllowedHosts(dbValue);
  return Array.from(new Set([...envHosts, ...dbHosts]));
}

async function validateWebhookUrl(rawUrl, allowedHostsOverride) {
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
  const allowList = await getEffectiveAllowedHosts(allowedHostsOverride);
  if (allowList.length && !allowList.includes(host)) {
    throw BadRequest(`الوجهة ${host} خارج القائمة البيضاء`);
  }
  return u.toString();
}

router.put('/', authorize(SA), asyncHandler(async (req, res) => {
  const { url, secret, enabled, allowedHosts } = req.body;
  if (url !== undefined && typeof url !== 'string') throw BadRequest('url يجب أن يكون نصاً');
  if (allowedHosts !== undefined && typeof allowedHosts !== 'string') throw BadRequest('allowedHosts must be a string');
  if (url) await validateWebhookUrl(url, allowedHosts);

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
    allowedHosts !== undefined ? upsert('n8n_allowed_hosts', allowedHosts) : Promise.resolve(),
  ]);

  invalidateWebhookCache();
  res.json({ ok: true, message: 'تم حفظ إعدادات الـ webhook' });
}));

router.post('/test', authorize(SA), asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  let outcome;
  try {
    const result = await emitWebhookStrict('QMS_TEST_CONNECTION', {
      message: 'اختبار الاتصال من نظام إدارة الجودة',
      timestamp: now,
    });
    outcome = {
      ok: result.ok,
      status: result.status,
      message: result.ok ? 'تم الاتصال بنجاح ✓' : `استجاب n8n بـ status ${result.status}`,
    };
  } catch (e) {
    outcome = { ok: false, status: 0, message: `فشل الاتصال: ${e.message}` };
  }

  // حفظ نتيجة آخر اختبار في الإعدادات
  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'n8n_last_test_at' },
      create: { key: 'n8n_last_test_at', value: now },
      update: { value: now },
    }),
    prisma.setting.upsert({
      where: { key: 'n8n_last_test_result' },
      create: { key: 'n8n_last_test_result', value: outcome.ok ? 'success' : 'failed' },
      update: { value: outcome.ok ? 'success' : 'failed' },
    }),
  ]);

  res.json(outcome);
}));

export default router;
