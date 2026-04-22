/**
 * routes/aiSettings.js — إدارة إعدادات الذكاء الاصطناعي
 *
 *  GET    /api/ai-settings             — قراءة الإعدادات (مع مفاتيح مُخفَّاة)
 *  PUT    /api/ai-settings             — حفظ الإعدادات العامة
 *  PUT    /api/ai-settings/keys        — حفظ مفاتيح API (مُشفَّرة)
 *  POST   /api/ai-settings/test        — اختبار اتصال مع مزود + مفتاح
 *  GET    /api/ai-settings/usage       — ملخص الاستخدام والتكلفة
 *  GET    /api/ai-settings/models      — قائمة الموديلات المدعومة
 *  POST   /api/ai-settings/complete    — استدعاء AI تجريبي (للاختبار من UI)
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest } from '../utils/errors.js';
import {
  getAiSettings, setSetting, setApiKey,
  aiTestConnection, aiComplete,
  getUsageSummary, MODEL_CATALOG, DEFAULT_MODELS,
} from '../lib/ai/index.js';
import { maskKey, isMasked } from '../lib/ai/crypto.js';

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN'];
const USER_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

const VALID_PROVIDERS = ['anthropic', 'openai', 'google'];
const VALID_REDACTION = ['always', 'never', 'optional'];

/**
 * GET /api/ai-settings — قراءة الإعدادات (مُخفَّاة)
 */
router.get('/', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  const s = await getAiSettings();
  res.json({
    ok: true,
    item: {
      enabled: s.enabled,
      defaultProvider: s.defaultProvider,
      defaultModel: s.defaultModel,
      monthlyBudgetUsd: s.monthlyBudgetUsd,
      piiRedaction: s.piiRedaction,
      logRequests: s.logRequests,
      keys: {
        anthropic: s.hasKeys.anthropic ? maskKey(s.keys.anthropic) : '',
        openai:    s.hasKeys.openai    ? maskKey(s.keys.openai)    : '',
        google:    s.hasKeys.google    ? maskKey(s.keys.google)    : '',
      },
      hasKeys: s.hasKeys,
    },
  });
}));

/**
 * PUT /api/ai-settings — حفظ الإعدادات العامة
 */
router.put('/', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const b = req.body || {};

  if (b.enabled !== undefined) {
    await setSetting('ai_enabled', String(!!b.enabled));
  }

  if (b.defaultProvider !== undefined) {
    if (!VALID_PROVIDERS.includes(b.defaultProvider)) {
      throw BadRequest(`مزود غير صالح. القيم المسموحة: ${VALID_PROVIDERS.join(', ')}`);
    }
    await setSetting('ai_default_provider', b.defaultProvider);
  }

  if (b.defaultModel !== undefined) {
    if (typeof b.defaultModel !== 'string' || b.defaultModel.length < 3) {
      throw BadRequest('الموديل غير صالح');
    }
    await setSetting('ai_default_model', b.defaultModel);
  }

  if (b.monthlyBudgetUsd !== undefined) {
    const v = Number(b.monthlyBudgetUsd);
    if (!Number.isFinite(v) || v < 0) throw BadRequest('الميزانية يجب أن تكون رقماً موجباً');
    await setSetting('ai_monthly_budget_usd', String(v));
  }

  if (b.piiRedaction !== undefined) {
    if (!VALID_REDACTION.includes(b.piiRedaction)) {
      throw BadRequest(`قيمة PII غير صالحة. المسموح: ${VALID_REDACTION.join(', ')}`);
    }
    await setSetting('ai_pii_redaction', b.piiRedaction);
  }

  if (b.logRequests !== undefined) {
    await setSetting('ai_log_requests', String(!!b.logRequests));
  }

  res.json({ ok: true, message: 'تم حفظ الإعدادات' });
}));

/**
 * PUT /api/ai-settings/keys — حفظ مفاتيح API (مُشفَّرة)
 * body: { anthropic?, openai?, google? }
 *  - إرسال '' أو null → حذف المفتاح
 *  - إرسال قيمة تبدأ بـ **** → تجاهل (لا تعديل)
 *  - إرسال قيمة جديدة → تشفير + حفظ
 */
router.put('/keys', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const updated = [];

  for (const provider of VALID_PROVIDERS) {
    if (!(provider in b)) continue;
    const v = b[provider];
    if (isMasked(v)) continue; // المستخدم لم يُعدِّل الحقل
    if (typeof v !== 'string') throw BadRequest(`قيمة ${provider} غير صالحة`);
    await setApiKey(provider, v.trim());
    updated.push(provider);
  }

  res.json({
    ok: true,
    message: updated.length ? `تم تحديث مفاتيح: ${updated.join(', ')}` : 'لا تغيير',
    updated,
  });
}));

/**
 * POST /api/ai-settings/test — اختبار مفتاح + مزود
 * body: { provider, model?, apiKey? (optional — يستخدم المحفوظ إن لم يُرسَل) }
 */
router.post('/test', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { provider, model } = req.body || {};
  let { apiKey } = req.body || {};

  if (!VALID_PROVIDERS.includes(provider)) {
    throw BadRequest(`مزود غير صالح: ${provider}`);
  }

  // لو لم يُرسَل مفتاح أو كان mask — استخدم المحفوظ
  if (!apiKey || isMasked(apiKey)) {
    const s = await getAiSettings();
    apiKey = s.keys[provider];
    if (!apiKey) throw BadRequest(`لا يوجد مفتاح محفوظ لـ ${provider}`);
  }

  try {
    const result = await aiTestConnection({
      provider,
      model: model || DEFAULT_MODELS[provider],
      apiKey,
    });
    res.json({ ok: true, message: 'الاتصال ناجح ✓', ...result });
  } catch (e) {
    res.json({ ok: false, message: `فشل الاتصال: ${e.message}` });
  }
}));

/**
 * GET /api/ai-settings/usage — ملخص الاستخدام والتكلفة
 */
router.get('/usage', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  const settings = await getAiSettings();
  const summary = await getUsageSummary();
  res.json({
    ok: true,
    item: {
      ...summary,
      budgetUsd: settings.monthlyBudgetUsd,
      budgetUsedPercent: settings.monthlyBudgetUsd > 0
        ? Math.round((summary.monthly.costUSD / settings.monthlyBudgetUsd) * 100)
        : 0,
    },
  });
}));

/**
 * GET /api/ai-settings/models — قائمة الموديلات (الكتالوج الثابت)
 */
router.get('/models', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  res.json({ ok: true, items: MODEL_CATALOG, defaults: DEFAULT_MODELS });
}));

/**
 * GET /api/ai-settings/models/live?provider=anthropic
 * جلب الموديلات المتاحة فعلاً من API المزود (يستخدم المفتاح المحفوظ)
 */
router.get('/models/live', authorize(...USER_ROLES), asyncHandler(async (req, res) => {
  const { provider } = req.query;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw BadRequest(`مزود غير صالح. القيم المسموحة: ${VALID_PROVIDERS.join(', ')}`);
  }

  const s = await getAiSettings();
  const apiKey = s.keys[provider];
  if (!apiKey) throw BadRequest(`لا يوجد مفتاح API محفوظ لـ ${provider} — أضف المفتاح أولاً`);

  // dynamic import حتى لا نُحمِّل كل المزودين دفعة واحدة
  const providerModule = await import(`../lib/ai/providers/${provider}.js`);
  if (typeof providerModule.listModels !== 'function') {
    throw BadRequest(`المزود ${provider} لا يدعم جلب الموديلات`);
  }

  const models = await providerModule.listModels({ apiKey });
  res.json({ ok: true, provider, models });
}));

/**
 * POST /api/ai-settings/complete — استدعاء AI تجريبي (chat playground)
 * body: { prompt, provider?, model?, piiRedact? }
 */
router.post('/complete', authorize(...USER_ROLES), asyncHandler(async (req, res) => {
  const { prompt, system, provider, model, piiRedact } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length < 1) {
    throw BadRequest('prompt مطلوب');
  }
  if (prompt.length > 10000) throw BadRequest('prompt طويل جداً (الحد 10000 حرف)');

  try {
    const result = await aiComplete({
      system: system || 'أنت مساعد خبير بنظام إدارة الجودة. أجب بالعربية بوضوح وإيجاز.',
      messages: [{ role: 'user', content: prompt }],
      feature: 'playground',
      provider, model, piiRedact,
      userId: req.user?.id,
      maxTokens: 1500,
    });
    res.json({
      ok: true,
      content: result.content,
      usage: result.usage,
      provider: result.provider,
      model: result.model,
      durationMs: result.durationMs,
      piiRedacted: result.piiRedacted,
    });
  } catch (e) {
    res.status(e.status || 500).json({
      ok: false,
      error: e.message,
      code: e.code,
    });
  }
}));

export default router;
