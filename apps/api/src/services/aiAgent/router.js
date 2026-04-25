/**
 * aiAgent/router.js — موجِّه النموذج الذكي (v2)
 *
 * ثلاثة مستويات بدل واحد:
 *
 *  QUICK    → claude-haiku-4-5   (أسئلة بسيطة / عرض بيانات)        ~$0.001
 *  STANDARD → claude-sonnet-4-5  (اقتراح / إنشاء / تحديث)           ~$0.01
 *  DEEP     → claude-opus-4-5    (تقييم شامل / مراجعة إدارية / خطة) ~$0.075
 *
 * التوفير المتوقع: 50-70% من تكلفة الـ AI الشهرية.
 */

export const DEFAULT_MODEL    = 'claude-sonnet-4-5';
export const QUICK_MODEL      = 'claude-haiku-4-5';
export const DEEP_MODEL       = 'claude-opus-4-5';
export const DEFAULT_PROVIDER = 'anthropic';

// ── أنماط DEEP — تحليل معمّق يستحق Opus ────────────────────────────────────
const DEEP_PATTERNS = /
  قيِّم الخطة|قيم الخطة|تقييم الخطة|
  تحليل شامل|تحليل عميق|مراجعة شاملة|
  مراجعة الإدارة|مراجعة إدارية|
  فحص التناقض|فحص تناقض|
  خطة كاملة|خطة استراتيجية كاملة|
  تقرير سنوي|تقرير نصف سنوي|
  نضج ISO|iso maturity|
  evaluate|comprehensive|full review
/xi;

// ── أنماط QUICK — قراءة / عرض / سؤال واحد → Haiku ─────────────────────────
const QUICK_PATTERNS = /
  ^(كم|ما هو|ما هي|ما عدد|أخبرني|اعرض|اقرأ|أظهر|هل يوجد|هل هناك|
     show|list|count|how many|what is|tell me|display|is there)
/xi;

/**
 * يُحدِّد الموديل المناسب بناءً على آخر رسالة للمستخدم
 * @param {Array} messages — تاريخ المحادثة
 * @param {boolean} [hasFiles] — هل هناك ملفات (يرفع التعقيد لـ STANDARD)
 * @returns {{ provider, model, tier, fallback }}
 */
export async function routeRequest(messages, hasFiles = false) {
  const lastMsg = messages[messages.length - 1]?.content;
  const text = (typeof lastMsg === 'string' ? lastMsg : '').trim();

  // ملفات مرفقة → على الأقل STANDARD
  if (hasFiles) return { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, tier: 'STANDARD', fallback: false };

  // DEEP — تحليل معمّق
  if (DEEP_PATTERNS.test(text)) {
    return { provider: DEFAULT_PROVIDER, model: DEEP_MODEL, tier: 'DEEP', fallback: false };
  }

  // QUICK — سؤال بسيط أو طلب عرض
  if (QUICK_PATTERNS.test(text) && text.length < 120) {
    return { provider: DEFAULT_PROVIDER, model: QUICK_MODEL, tier: 'QUICK', fallback: false };
  }

  // STANDARD — الافتراضي لكل شيء آخر
  return { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, tier: 'STANDARD', fallback: false };
}

/**
 * تقييم مستوى الطلب كنص — للـ logging
 */
export function classifyRequest(messages) {
  const lastMsg = messages[messages.length - 1]?.content;
  const text = (typeof lastMsg === 'string' ? lastMsg : '').trim();
  if (DEEP_PATTERNS.test(text))                        return 'DEEP';
  if (QUICK_PATTERNS.test(text) && text.length < 120)  return 'QUICK';
  return 'STANDARD';
}

/**
 * resolveModel — متوافق مع الكود القديم
 */
export function resolveModel({ quick = false } = {}) {
  return {
    provider: DEFAULT_PROVIDER,
    model:    quick ? QUICK_MODEL : DEFAULT_MODEL,
    tier:     quick ? 'QUICK' : 'STANDARD',
    fallback: false,
  };
}
