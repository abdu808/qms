/**
 * pricing.js — أسعار نماذج AI + دوال الحساب
 *
 * الأسعار بالدولار لكل مليون توكن (input / output) — محدَّثة 2026-01.
 * عند إضافة نموذج جديد: أضفه هنا مع السعر الصحيح من الموقع الرسمي.
 *
 * ملاحظة: الأسعار قابلة للتغيير من المزود — راجعها دورياً.
 */

// USD per 1M tokens — { in, out }
export const PRICING = {
  // ──────── Anthropic ────────
  'claude-haiku-4-5':          { in: 1.00,  out: 5.00  },
  'claude-sonnet-4-5':         { in: 3.00,  out: 15.00 },
  'claude-opus-4-5':           { in: 15.00, out: 75.00 },
  // أسماء مستعارة شائعة
  'claude-3-5-haiku-latest':   { in: 0.80,  out: 4.00  },
  'claude-3-5-sonnet-latest':  { in: 3.00,  out: 15.00 },

  // ──────── OpenAI ────────
  'gpt-4o-mini':               { in: 0.15,  out: 0.60  },
  'gpt-4o':                    { in: 2.50,  out: 10.00 },
  'gpt-4-turbo':               { in: 10.00, out: 30.00 },
  'o1-mini':                   { in: 3.00,  out: 12.00 },

  // ──────── Google Gemini ────────
  'gemini-2.5-flash':          { in: 0.30,  out: 2.50  },
  'gemini-2.5-flash-lite':     { in: 0.10,  out: 0.40  },
  'gemini-2.5-pro':            { in: 1.25,  out: 10.00 },
  'gemini-2.0-flash':          { in: 0.10,  out: 0.40  },
  'gemini-2.0-flash-lite':     { in: 0.075, out: 0.30  },
  'gemini-1.5-flash':          { in: 0.075, out: 0.30  },
  'gemini-1.5-pro':            { in: 1.25,  out: 5.00  },
};

// الافتراضي — Sonnet دائماً (التحليل والمتابعة يتطلبان جودة عالية)
export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5',
  openai:    'gpt-4o-mini',    // محفوظ للمستقبل
  google:    'gemini-2.5-flash', // محفوظ للمستقبل
};

// قائمة الموديلات المُفعَّلة — Anthropic فقط (3 مستويات)
export const MODEL_CATALOG = [
  { provider: 'anthropic', model: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5',  tier: 'quick',   good: 'أسئلة سريعة، متابعة يومية — اقتصادي جداً ($1/1M)' },
  { provider: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', tier: 'standard', good: 'الافتراضي — تحليل استراتيجي وتقارير شاملة ($3/1M)' },
  { provider: 'anthropic', model: 'claude-opus-4-5',   label: 'Claude Opus 4.5',   tier: 'premium',  good: 'التقييم الربع سنوي العميق — أعلى جودة ($15/1M)' },
  { provider: 'openai',    model: 'gpt-4o-mini',       label: 'GPT-4o mini',       tier: 'quick',    good: 'Fast low-cost checks and summaries ($0.15/1M input)' },
  { provider: 'openai',    model: 'gpt-4o',            label: 'GPT-4o',            tier: 'standard', good: 'General analysis and report drafting ($2.50/1M input)' },
  { provider: 'google',    model: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  tier: 'quick',    good: 'Fast multilingual review and extraction ($0.30/1M input)' },
  { provider: 'google',    model: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',    tier: 'standard', good: 'Deeper reasoning and long-context review ($1.25/1M input)' },
];

/**
 * يحسب التكلفة بالدولار
 * @returns رقم دولار (مثال: 0.000435)
 */
/** يجد سعر نموذج مع تجاهل لاحقة التاريخ (مثل -20251001) */
function findPricing(model) {
  if (!model) return null;
  if (PRICING[model]) return PRICING[model];
  // جرِّب حذف لاحقة التاريخ: claude-haiku-4-5-20251001 → claude-haiku-4-5
  const stripped = String(model).replace(/-\d{8}$/, '').replace(/-latest$/, '');
  if (PRICING[stripped]) return PRICING[stripped];
  // جرِّب مطابقة البادئة (أطول مفتاح موافق)
  const keys = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model.startsWith(k)) return PRICING[k];
  }
  return null;
}

export function computeCost(model, inputTokens, outputTokens) {
  const p = findPricing(model);
  if (!p) return 0; // نموذج غير معروف — لا نخفق، نكتفي بالصفر
  const inCost  = (Number(inputTokens)  || 0) * p.in  / 1_000_000;
  const outCost = (Number(outputTokens) || 0) * p.out / 1_000_000;
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000; // تقريب لـ 6 خانات
}

/** تقدير تكلفة قبل الاستدعاء (approx — يفترض نسبة output/input = 0.5) */
export function estimateCost(model, estInputTokens, estOutputTokens = null) {
  const outTok = estOutputTokens ?? Math.round(estInputTokens * 0.5);
  return computeCost(model, estInputTokens, outTok);
}

/** عدّ تقريبي للـ tokens — يعمل للعربية والإنجليزية */
export function estimateTokens(text) {
  if (!text) return 0;
  // التقدير: 1 token ≈ 4 حروف للإنجليزية، 2-3 للعربية. نستخدم 3.5 كوسط.
  return Math.ceil(String(text).length / 3.5);
}
