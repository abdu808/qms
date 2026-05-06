/**
 * services/notificationDispatcher.js
 *
 * نقطة موحَّدة لإرسال التنبيهات:
 *   1. تجلب القالب من DB (إن وُجد للـ eventKey)
 *   2. تُعالج المتغيرات {{var}}
 *   3. تُنشئ Notification داخل النظام (idempotent عبر eventKey)
 *   4. تُرسل إلى n8n عبر dispatchIntegrationEvent (إن كان n8n مفعّلاً والقالب يسمح بقنوات خارجية)
 *
 * الفائدة: مكان واحد للتعديل، قوالب قابلة للتحرير، سجل إرسال موحَّد.
 */

import { prisma } from '../db.js';
import { dispatchIntegrationEvent } from './integrationDelivery.js';
import { getNotificationRule, ruleChannelsCsv } from './notificationRules.js';

const TEMPLATE_CACHE_MS = 60 * 1000; // ذاكرة مؤقتة للقوالب لمدة دقيقة
const _cache = new Map(); // eventKey → { template, expiresAt }

function _renderVars(text, vars = {}) {
  if (!text) return '';
  return String(text).replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (m, name) => {
    const v = vars[name];
    return (v === undefined || v === null) ? m : String(v);
  });
}

async function _getTemplate(eventKey) {
  const cached = _cache.get(eventKey);
  if (cached && cached.expiresAt > Date.now()) return cached.template;

  const tpl = await prisma.notificationTemplate.findUnique({ where: { eventKey } });
  _cache.set(eventKey, { template: tpl, expiresAt: Date.now() + TEMPLATE_CACHE_MS });
  return tpl;
}

export function invalidateTemplateCache(eventKey) {
  if (eventKey) _cache.delete(eventKey);
  else _cache.clear();
}

/**
 * يُرسل تنبيهاً لمستلم واحد.
 *
 * @param {Object} params
 * @param {string} params.eventKey      — معرّف القالب/الحدث (مثل KPI_FIRST_NOTICE)
 * @param {string} params.dedupeKey     — مفتاح فريد لمنع التكرار (مثل KFU_FIRST_NOTICE:abc:2026-05-02)
 * @param {Object} params.recipient     — { id, name, email, phone, role }
 * @param {Object} params.variables     — متغيرات للـ render
 * @param {string} params.entityType    — نوع الكيان (مثل KpiFollowUp)
 * @param {string} params.entityId      — id الكيان
 * @param {string} params.link          — رابط داخلي
 * @param {string} [params.fallbackTitle]   — عنوان احتياطي إن لم يوجد قالب
 * @param {string} [params.fallbackMessage] — متن احتياطي إن لم يوجد قالب
 * @param {Object} [params.payloadExtra]    — بيانات إضافية تُرسل إلى n8n
 *
 * @returns {Promise<{inApp: boolean, dispatched: boolean, skipped: string[]}>}
 */
export async function sendNotification({
  eventKey,
  dedupeKey,
  recipient,
  variables = {},
  entityType,
  entityId,
  link,
  fallbackTitle,
  fallbackMessage,
  payloadExtra = {},
}) {
  if (!eventKey || !dedupeKey || !recipient?.id) {
    throw new Error('eventKey, dedupeKey, recipient.id are required');
  }

  const result = { inApp: false, dispatched: false, skipped: [] };

  const tpl = await _getTemplate(eventKey);
  const rule = await getNotificationRule(eventKey);

  // إن كانت القاعدة أو القالب مُعطَّلين صراحةً، نتخطى
  if (rule && rule.enabled === false) {
    result.skipped.push('rule-disabled');
    return result;
  }
  if (tpl && tpl.enabled === false) {
    result.skipped.push('template-disabled');
    return result;
  }

  const title = tpl ? _renderVars(tpl.subject, variables) : (fallbackTitle || eventKey);
  const message = tpl ? _renderVars(tpl.body, variables) : (fallbackMessage || '');
  const channelsCsv = rule
    ? ruleChannelsCsv(rule, tpl?.channels || 'IN_APP')
    : (tpl?.channels || 'IN_APP');
  const channels = channelsCsv.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  // 1) Notification داخل النظام (إن كان IN_APP ضمن القنوات)
  if (channels.includes('IN_APP')) {
    try {
      const r = await prisma.notification.createMany({
        data: [{
          userId: recipient.id,
          type: eventKey,
          title,
          message,
          link: link || null,
          entityType: entityType || null,
          entityId: entityId || null,
          eventKey: dedupeKey,
        }],
        skipDuplicates: true,
      });
      result.inApp = (r?.count || 0) > 0;
    } catch (e) {
      console.warn(`[notify] in-app failed (${eventKey}):`, e.message);
    }
  } else {
    result.skipped.push('in-app-not-in-channels');
  }

  // 2) إرسال خارجي إن كان أي channel خارجي مطلوباً
  const externalChannels = channels.filter(c => c !== 'IN_APP');
  if (externalChannels.length > 0) {
    try {
      const dispatch = await dispatchIntegrationEvent({
        event: eventKey,
        eventKey: `${dedupeKey}:N8N`,
        title,
        message,
        recipient,
        entityType,
        entityId,
        link,
        data: {
          requestedChannels: externalChannels,
          variables,
          ...payloadExtra,
        },
      });
      result.dispatched = !!dispatch?.ok && !dispatch?.skipped;
      if (dispatch?.skipped) result.skipped.push('integration-disabled-or-duplicate');
    } catch (e) {
      console.warn(`[notify] dispatch failed (${eventKey}):`, e.message);
      result.skipped.push('dispatch-error');
    }
  }

  return result;
}
