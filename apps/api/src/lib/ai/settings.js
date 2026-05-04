/**
 * settings.js — إدارة إعدادات AI في Setting table
 *
 * Keys المُستخدَمة:
 *   ai_enabled                      — "true" | "false"
 *   ai_default_provider             — "anthropic" (الوحيد المُفعَّل)
 *   ai_default_model                — اسم الموديل (افتراضي: claude-haiku-4-5)
 *   ai_anthropic_api_key            — مُشفَّر (v1:...)
 *   ai_openai_api_key               — محفوظ للمستقبل (غير مُستخدَم)
 *   ai_google_api_key               — محفوظ للمستقبل (غير مُستخدَم)
 *   ai_monthly_budget_usd           — رقم (مثال: "30")
 *   ai_pii_redaction                — "always" | "never" | "optional"
 *   ai_log_requests                 — "true" | "false"
 */
import { prisma } from '../../db.js';
import { encrypt, decrypt } from './crypto.js';
import { DEFAULT_MODELS, PRICING } from './pricing.js';

const KEYS = [
  'ai_enabled',
  'ai_default_provider',
  'ai_default_model',
  'ai_anthropic_api_key',
  'ai_openai_api_key',    // محفوظ للمستقبل
  'ai_google_api_key',    // محفوظ للمستقبل
  'ai_monthly_budget_usd',
  'ai_pii_redaction',
  'ai_log_requests',
  'ai_feature_models',
];

/** كتالوج الميزات — يُعرَّف في الكود، التعيينات تُحفَظ في DB */
export const FEATURE_CATALOG = [
  { id: 'consultant',         label: 'المستشار الذكي (محادثة)',   icon: '💬', defaultModel: 'claude-haiku-4-5' },
  { id: 'file_processor',     label: 'تحليل الملفات',              icon: '📄', defaultModel: 'claude-sonnet-4-5'  },
  { id: 'weekly_report',      label: 'التقرير الأسبوعي',           icon: '📊', defaultModel: 'claude-haiku-4-5' },
  { id: 'investigator',       label: 'المحقق الشهري',              icon: '🔍', defaultModel: 'claude-haiku-4-5' },
  { id: 'investigator-cross', label: 'التحليل المقارن',            icon: '📈', defaultModel: 'claude-haiku-4-5' },
  { id: 'playground',         label: 'الملعب التجريبي',            icon: '🧪', defaultModel: 'claude-haiku-4-5' },
];

// cache قصير لتخفيف ضغط DB (30 ثانية)
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

export function invalidateAiSettingsCache() {
  _cache = null;
}

/**
 * يقرأ كل الإعدادات — مفاتيح API مفكوكة التشفير (للاستخدام الداخلي فقط)
 * لا تُرسَل هذه القيم للـ UI — استخدم getMaskedSettings للعرض.
 */
export async function getAiSettings() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;

  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const rawFeatureModels = m.ai_feature_models ? (() => { try { return JSON.parse(m.ai_feature_models); } catch { return {}; } })() : {};
    // دمج الافتراضيات مع المحفوظ
    const featureModels = {};
    for (const f of FEATURE_CATALOG) {
      featureModels[f.id] = rawFeatureModels[f.id] || f.defaultModel;
    }

    _cache = {
      enabled:          m.ai_enabled === 'true',
      defaultProvider:  'anthropic',    // Anthropic فقط
      defaultModel:     m.ai_default_model || DEFAULT_MODELS.anthropic,
      monthlyBudgetUsd: Number(m.ai_monthly_budget_usd || 20),
      piiRedaction:     m.ai_pii_redaction || 'optional',
      logRequests:      m.ai_log_requests !== 'false',
      featureModels,
      keys: {
        anthropic: decrypt(m.ai_anthropic_api_key || ''),
        openai:    decrypt(m.ai_openai_api_key    || ''), // محفوظ — غير مُستخدَم
        google:    decrypt(m.ai_google_api_key    || ''), // محفوظ — غير مُستخدَم
      },
      hasKeys: {
        anthropic: !!m.ai_anthropic_api_key,
        openai:    !!m.ai_openai_api_key,
        google:    !!m.ai_google_api_key,
      },
    };
    _cacheAt = now;
    return _cache;
  } catch (e) {
    console.warn('[ai/settings] failed to load settings:', e.message);
    const fallbackFeatureModels = Object.fromEntries(FEATURE_CATALOG.map(f => [f.id, f.defaultModel]));
    return {
      enabled: false,
      defaultProvider: 'anthropic',
      defaultModel: DEFAULT_MODELS.anthropic,
      monthlyBudgetUsd: 20,
      piiRedaction: 'optional',
      logRequests: true,
      featureModels: fallbackFeatureModels,
      keys: { anthropic: '', openai: '', google: '' },
      hasKeys: { anthropic: false, openai: false, google: false },
    };
  }
}

/** يحفظ حقلاً واحداً — يُستخدم من الـ route */
export async function setSetting(key, value) {
  if (!KEYS.includes(key)) throw new Error(`مفتاح غير معروف: ${key}`);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
  invalidateAiSettingsCache();
}

/** يحفظ تعيينات الموديلات للميزات */
export async function setFeatureModels(assignments) {
  const KNOWN_MODELS = new Set(Object.keys(PRICING));
  const safe = {};
  for (const f of FEATURE_CATALOG) {
    const val = assignments[f.id];
    if (!val) continue;
    const name = String(val).trim();
    if (!KNOWN_MODELS.has(name)) {
      throw new Error(`اسم الموديل غير معروف: "${name}" — تحقق من الكتالوج المدعوم في pricing.js`);
    }
    safe[f.id] = name;
  }
  await prisma.setting.upsert({
    where: { key: 'ai_feature_models' },
    create: { key: 'ai_feature_models', value: JSON.stringify(safe) },
    update: { value: JSON.stringify(safe) },
  });
  invalidateAiSettingsCache();
}

/** يحفظ مفتاح API مُشفَّراً */
export async function setApiKey(provider, plainKey) {
  const keyName = `ai_${provider}_api_key`;
  if (!KEYS.includes(keyName)) throw new Error(`مزود غير معروف: ${provider}`);
  if (!plainKey) {
    // حذف المفتاح
    await prisma.setting.deleteMany({ where: { key: keyName } });
  } else {
    await prisma.setting.upsert({
      where: { key: keyName },
      create: { key: keyName, value: encrypt(plainKey) },
      update: { value: encrypt(plainKey) },
    });
  }
  invalidateAiSettingsCache();
}
