/**
 * webhookEmitter.js — إرسال HTTP webhooks إلى n8n
 * الإعدادات مُخزَّنة في Setting model بالـ keys:
 *   n8n_webhook_url, n8n_webhook_secret, n8n_webhook_enabled
 */
import { createHmac } from 'crypto';
import { prisma } from '../db.js';
import { decrypt } from './ai/crypto.js';

// Cache الإعدادات 5 دقائق
let _cfg = null, _cfgAt = 0;
const TIMEOUT_MS = 5000;

async function getConfig() {
  if (_cfg && Date.now() - _cfgAt < 300_000) return _cfg;
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['n8n_webhook_url', 'n8n_webhook_secret', 'n8n_webhook_enabled'] } },
    });
    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
    // السر مُخزَّن مُشفَّراً (AES-256-GCM) — فك التشفير هنا؛ الصيغ القديمة غير المُشفَّرة تُترك كما هي
    const rawSecret = m.n8n_webhook_secret || '';
    const secret = rawSecret.startsWith('v1:') ? decrypt(rawSecret) : rawSecret;
    _cfg = { url: m.n8n_webhook_url || '', secret, enabled: m.n8n_webhook_enabled === 'true' };
  } catch { _cfg = { url: '', secret: '', enabled: false }; }
  _cfgAt = Date.now();
  return _cfg;
}

export function invalidateWebhookCache() { _cfg = null; }

/**
 * Defense-in-depth: يتحقق أن URL ليس عنواناً داخلياً حتى لو سرّبته حالة سباق في إعدادات الـ DB.
 * نفس قائمة الحظر في webhookSettings.js.
 */
function isSafeOutboundUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    const blocked = [
      /^localhost$/, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
      /^10\./, /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[0-1])\./,
      /^169\.254\./,
      /^fc00:/i, /^fd00:/i, /^fe80:/i,
    ];
    return !blocked.some(re => re.test(host));
  } catch { return false; }
}

/** fetch مع AbortController بدل Promise.race — يمنع تسرّب الـ sockets */
async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildRequest(event, data, cfg) {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ event, timestamp, data });
  const sig = createHmac('sha256', cfg.secret || '').update(payload).digest('hex');
  return {
    body: payload,
    headers: { 'Content-Type': 'application/json', 'X-QMS-Signature': `sha256=${sig}`, 'X-QMS-Event': event },
  };
}

/**
 * يُرسل webhook إلى n8n — fire-and-forget (لا يُكسر الـ flow عند الفشل)
 */
export async function emitWebhook(event, data) {
  try {
    const cfg = await getConfig();
    if (!cfg.enabled || !cfg.url) return;
    if (!isSafeOutboundUrl(cfg.url)) {
      console.warn(`[webhook] blocked unsafe url: ${cfg.url}`);
      return;
    }
    const { body, headers } = buildRequest(event, data, cfg);
    await fetchWithTimeout(cfg.url, { method: 'POST', headers, body }, TIMEOUT_MS);
  } catch (e) {
    console.warn(`[webhook] emitWebhook(${event}) failed:`, e.message);
  }
}

/** نسخة للاختبار — ترمي الخطأ بدل بلعه (للاستخدام في /test endpoint) */
export async function emitWebhookStrict(event, data) {
  const cfg = await getConfig();
  if (!cfg.url) throw new Error('webhook URL غير مُعيَّن');
  if (!isSafeOutboundUrl(cfg.url)) throw new Error('عنوان غير آمن (SSRF protection)');
  const { body, headers } = buildRequest(event, data, cfg);
  const res = await fetchWithTimeout(cfg.url, { method: 'POST', headers, body }, TIMEOUT_MS);
  return { status: res.status, ok: res.ok };
}
