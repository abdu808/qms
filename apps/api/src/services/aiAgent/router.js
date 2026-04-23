/**
 * aiAgent/router.js — الموجِّه الذكي للموديلات
 *
 * يصنّف الطلب إلى 4 مستويات ويختار الموديل المناسب من الإعدادات:
 *   SIMPLE  → gemini-2.5-flash (أسئلة بسيطة)
 *   TOOLS   → haiku-4-5 (إنشاء/تعديل/حذف)
 *   DEEP    → sonnet-4-5 (تحليل استراتيجي)
 *   FILES   → opus-4-7 (تحليل ملفات)
 */
import { getAiSettings } from '../../lib/ai/settings.js';

/** الإعدادات الافتراضية لكل مستوى */
export const TIER_DEFAULTS = {
  SIMPLE: 'google/gemini-2.5-flash',
  TOOLS:  'anthropic/claude-haiku-4-5',
  DEEP:   'anthropic/claude-sonnet-4-5',
  FILES:  'anthropic/claude-opus-4-7',
};

/** كلمات مفتاحية لكل مستوى */
const DEEP_KEYWORDS  = /حلل|راجع|تقرير|تقييم|استراتيجي|شامل|نضج|ISO|مقارن|خلاص|ملخص تنفيذي|اقترح خطة|فحص التناقض|تدقيق/i;
const TOOLS_KEYWORDS = /أضف|انشئ|أنشئ|إنشاء|عدّل|تعديل|احذف|حذف|سجّل|خطط|جدول|ربط|تعيين|تحديث|أكمل/i;

/**
 * يصنّف الطلب بناءً على الكلمات المفتاحية (بدون API call)
 * @param {Array} messages — [{role, content}]
 * @param {boolean} hasFiles — هل يوجد ملفات مرفوعة؟
 * @returns {'SIMPLE'|'TOOLS'|'DEEP'|'FILES'}
 */
export function classifyRequest(messages, hasFiles = false) {
  if (hasFiles) return 'FILES';

  // ابحث عن أول رسالة مستخدم تحتوي نصاً حقيقياً (ليست tool_result فقط)
  // هذا يحافظ على التصنيف المبني على رسالة المستخدم الأصلية
  // حتى لو كانت آخر رسالة "user" هي tool_results داخل الحلقة الوكيلة
  let text = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string' && m.content.trim()) {
      text = m.content;
      break;
    }
    if (Array.isArray(m.content)) {
      // استخرج النص من أول text block — تجاهل tool_result blocks
      const textBlock = m.content.find(b => b?.type === 'text' && b.text);
      if (textBlock) { text = textBlock.text; break; }
    }
  }

  if (DEEP_KEYWORDS.test(text))  return 'DEEP';
  if (TOOLS_KEYWORDS.test(text)) return 'TOOLS';
  return 'SIMPLE';
}

/**
 * يحل الموديل المناسب للمستوى من الإعدادات
 * @param {'SIMPLE'|'TOOLS'|'DEEP'|'FILES'} tier
 * @returns {{ provider: string, model: string, tier: string }}
 */
export async function resolveModel(tier) {
  const settings = await getAiSettings();
  const routing  = settings.routing || {};

  // قراءة الإعداد أو الافتراضي
  const raw = routing[tier] || TIER_DEFAULTS[tier];
  const [provider, ...modelParts] = raw.split('/');
  const model = modelParts.join('/');

  // تحقق من وجود مفتاح API للمزود المختار
  if (!settings.keys[provider]) {
    // fallback للمزود الافتراضي إن لم يكن المفتاح موجوداً
    console.warn(`[router] No key for provider "${provider}" (tier ${tier}), falling back to default`);
    return {
      provider: settings.defaultProvider,
      model:    settings.defaultModel,
      tier,
      fallback: true,
    };
  }

  return { provider, model, tier, fallback: false };
}

/**
 * الدالة الرئيسية: صنّف ثم حل
 */
export async function routeRequest(messages, hasFiles = false) {
  const settings = await getAiSettings();

  // إذا كان الـ routing مُعطَّلاً → استخدم الإعداد الافتراضي
  if (!settings.routing?.enabled) {
    return {
      provider: settings.defaultProvider,
      model:    settings.defaultModel,
      tier:     'DEFAULT',
      fallback: false,
    };
  }

  const tier = classifyRequest(messages, hasFiles);
  return resolveModel(tier);
}
