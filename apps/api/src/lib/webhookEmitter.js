/**
 * webhookEmitter.js — إرسال HTTP webhooks إلى n8n
 * الإعدادات مُخزَّنة في Setting model بالـ keys:
 *   n8n_webhook_url, n8n_webhook_secret, n8n_webhook_enabled
 */
import { createHmac } from 'crypto';
import { prisma } from '../db.js';

// Cache الإعدادات 5 دقائق
let _cfg = null, _cfgAt = 0;

async function getConfig() {
  if (_cfg && Date.now() - _cfgAt < 300_000) return _cfg;
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['n8n_webhook_url', 'n8n_webhook_secret', 'n8n_webhook_enabled'] } },
    });
    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
    _cfg = { url: m.n8n_webhook_url || '', secret: m.n8n_webhook_secret || '', enabled: m.n8n_webhook_enabled === 'true' };
  } catch { _cfg = { url: '', secret: '', enabled: false }; }
  _cfgAt = Date.now();
  return _cfg;
}

export function invalidateWebhookCache() { _cfg = null; }

/**
 * يُرسل webhook إلى n8n — fire-and-forget (لا يُكسر الـ flow عند الفشل)
 * @param {string} event — مثل 'NCR_OVERDUE'
 * @param {object} data  — البيانات المرفقة
 */
export async function emitWebhook(event, data) {
  try {
    const cfg = await getConfig();
    if (!cfg.enabled || !cfg.url) return;
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({ event, timestamp, data });
    const sig = createHmac('sha256', cfg.secret).update(payload).digest('hex');
    await Promise.race([
      fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-QMS-Signature': `sha256=${sig}`, 'X-QMS-Event': event },
        body: payload,
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('webhook timeout')), 5000)),
    ]);
  } catch (e) {
    console.warn(`[webhook] emitWebhook(${event}) failed:`, e.message);
  }
}

/**
 * نسخة للاختبار — ترمي الخطأ بدل بلعه (للاستخدام في /test endpoint)
 */
export async function emitWebhookStrict(event, data) {
  const cfg = await getConfig();
  if (!cfg.url) throw new Error('webhook URL غير مُعيَّن');
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ event, timestamp, data });
  const sig = createHmac('sha256', cfg.secret).update(payload).digest('hex');
  const res = await Promise.race([
    fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-QMS-Signature': `sha256=${sig}`, 'X-QMS-Event': event },
      body: payload,
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout بعد 5 ثوانٍ')), 5000)),
  ]);
  return { status: res.status, ok: res.ok };
}
