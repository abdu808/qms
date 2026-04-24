/**
 * aiAgent/router.js — موجِّه النموذج المبسَّط
 *
 * المزوّد الثابت: Anthropic
 * نموذجان فقط:
 *   STANDARD → claude-sonnet-4-5  (كل شيء — تحليل، متابعة، كتابة)
 *   QUICK    → claude-haiku-4-5   (إن طلب المستخدم صراحةً وضع الاقتصاد)
 *
 * حُذف التوجيه 4-tier (SIMPLE/TOOLS/DEEP/FILES) لتبسيط الكود
 * وتقليل أخطاء التبديل بين المزودين.
 */

export const DEFAULT_MODEL    = 'claude-sonnet-4-5';
export const QUICK_MODEL      = 'claude-haiku-4-5';
export const DEFAULT_PROVIDER = 'anthropic';

/**
 * يُحدِّد الموديل المناسب — Sonnet دائماً ما لم يُطلَب QUICK
 * @param {object} [opts]
 * @param {boolean} [opts.quick] — وضع الاقتصاد (Haiku)
 * @returns {{ provider, model, tier }}
 */
export function resolveModel({ quick = false } = {}) {
  return {
    provider: DEFAULT_PROVIDER,
    model:    quick ? QUICK_MODEL : DEFAULT_MODEL,
    tier:     quick ? 'QUICK' : 'STANDARD',
    fallback: false,
  };
}

/**
 * التوافق مع الكود القديم الذي يستدعي routeRequest
 * يُعيد Sonnet دائماً (بغض النظر عن messages أو hasFiles)
 */
export async function routeRequest(messages, hasFiles = false) {
  return resolveModel({ quick: false });
}

/**
 * التوافق مع classifyRequest القديم — أُبقي لعدم كسر imports
 */
export function classifyRequest() {
  return 'STANDARD';
}
