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
  computeCost,
} from '../lib/ai/index.js';
import { FEATURE_CATALOG, setFeatureModels } from '../lib/ai/settings.js';
import { listTaskPrompts } from '../lib/ai/taskPrompts.js';
import { listAiGovernancePolicies } from '../lib/ai/governance.js';
import { listKnowledgeEntries } from '../lib/ai/knowledgeRouter.js';
import { rateUsage, getUsageByFeature } from '../lib/ai/usage.js';
import { maskKey, isMasked } from '../lib/ai/crypto.js';
import { prisma } from '../db.js';

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN'];
const USER_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

// Anthropic هو المزود التشغيلي. OpenAI/Gemini احتياطي يدوي للاختبار والـ Playground.
const VALID_PROVIDERS = ['anthropic', 'openai', 'google'];
const VALID_DEFAULT_PROVIDERS = ['anthropic'];
const VALID_REDACTION = ['always', 'never', 'optional'];

router.get('/governance', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  res.json({ ok: true, policies: listAiGovernancePolicies() });
}));

router.get('/knowledge', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  const custom = await prisma.setting.findUnique({ where: { key: 'ai_knowledge_entries' } })
    .then(r => r?.value ? JSON.parse(r.value) : [])
    .catch(() => []);
  res.json({
    ok: true,
    builtin: listKnowledgeEntries(),
    custom: Array.isArray(custom) ? custom : [],
  });
}));

router.put('/knowledge', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  if (!entries) throw BadRequest('entries must be an array');
  if (entries.length > 100) throw BadRequest('الحد الأقصى 100 عنصر معرفة مخصص');

  const safe = entries.map((e, idx) => ({
    id: String(e.id || `kb-${Date.now()}-${idx}`).slice(0, 80),
    title: String(e.title || '').trim().slice(0, 120),
    keywords: Array.isArray(e.keywords)
      ? e.keywords.map(k => String(k).trim()).filter(Boolean).slice(0, 12)
      : [],
    answer: String(e.answer || '').trim().slice(0, 2000),
    enabled: e.enabled !== false,
  })).filter(e => e.title && e.answer && e.keywords.length);

  await prisma.setting.upsert({
    where: { key: 'ai_knowledge_entries' },
    create: { key: 'ai_knowledge_entries', value: JSON.stringify(safe) },
    update: { value: JSON.stringify(safe) },
  });

  res.json({ ok: true, entries: safe });
}));

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
    if (!VALID_DEFAULT_PROVIDERS.includes(b.defaultProvider)) {
      throw BadRequest('مزود التشغيل غير صالح. OpenAI/Gemini للاختبار اليدوي فقط.');
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
    // حد زمني 20 ثانية — يمنع Cloudflare من إرجاع 504 على اختبار الاتصال
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('انتهت مهلة الاختبار (20s) — تحقق من المفتاح والشبكة')), 20_000)
    );
    const result = await Promise.race([
      aiTestConnection({ provider, model: model || DEFAULT_MODELS[provider], apiKey }),
      timeout,
    ]);
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
 * POST /api/ai-settings/usage/backfill-costs
 * إعادة حساب التكلفة للسجلات القديمة (costUSD=0 ولديها tokens)
 * يُستخدم بعد تصحيح جدول الأسعار أو تطابق أسماء النماذج.
 */
router.post('/usage/backfill-costs', authorize(...ADMIN_ROLES), asyncHandler(async (_req, res) => {
  const rows = await prisma.aiUsageLog.findMany({
    where: {
      costUSD: 0,
      OR: [{ inputTokens: { gt: 0 } }, { outputTokens: { gt: 0 } }],
    },
    select: { id: true, model: true, inputTokens: true, outputTokens: true },
  });

  let updated = 0;
  let skipped = 0;
  let totalRecovered = 0;
  for (const r of rows) {
    const cost = computeCost(r.model, r.inputTokens, r.outputTokens);
    if (cost > 0) {
      await prisma.aiUsageLog.update({ where: { id: r.id }, data: { costUSD: cost } });
      updated++;
      totalRecovered += cost;
    } else {
      skipped++;
    }
  }

  res.json({
    ok: true,
    scanned: rows.length,
    updated,
    skipped,
    totalRecovered: Math.round(totalRecovered * 10000) / 10000,
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

  try {
    const models = await providerModule.listModels({ apiKey });
    res.json({ ok: true, provider, models });
  } catch (e) {
    // لا نجعل فشل مزود خارجي يكسر واجهة الإعدادات. الواجهة تستطيع
    // الرجوع للكتالوج الثابت مع إظهار تنبيه لطيف للمستخدم.
    res.json({
      ok: false,
      provider,
      models: [],
      error: e?.message || 'تعذر جلب الموديلات من المزود',
    });
  }
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
    // حد زمني 90 ثانية — Cloudflare يقطع عند 100s
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(Object.assign(new Error('انتهت مهلة الاستدعاء — حاول سؤالاً أقصر'), { status: 504 })), 90_000)
    );
    const result = await Promise.race([
      aiComplete({
        system: system || 'أنت مساعد خبير بنظام إدارة الجودة. أجب بالعربية بوضوح وإيجاز.',
        messages: [{ role: 'user', content: prompt }],
        feature: 'playground',
        provider, model, piiRedact,
        userId: req.user?.sub || req.user?.id,
        maxTokens: 800,
      }),
      timeout,
    ]);
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

/**
 * GET /api/ai-settings/feature-models — كتالوج الميزات + التعيينات الحالية
 */
router.get('/feature-models', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  const s = await getAiSettings();
  const catalog = FEATURE_CATALOG.map(f => ({
    ...f,
    assignedModel: s.featureModels[f.id] || f.defaultModel,
  }));
  res.json({ ok: true, catalog, assignments: s.featureModels });
}));

/**
 * GET /api/ai-settings/task-prompts
 * قوالب التوجيه القصيرة التي تستخدمها المهام التشغيلية.
 */
router.get('/task-prompts', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  res.json({ ok: true, items: listTaskPrompts() });
}));

/**
 * PUT /api/ai-settings/feature-models — حفظ تعيينات الموديلات
 * body: { consultant: "claude-haiku-4-5", file_processor: "claude-opus-4-5", ... }
 */
router.put('/feature-models', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const assignments = req.body || {};
  if (typeof assignments !== 'object') throw BadRequest('body يجب أن يكون كائناً');
  await setFeatureModels(assignments);
  res.json({ ok: true, message: 'تم حفظ تعيينات الموديلات' });
}));

/**
 * POST /api/ai-settings/usage/:id/rate — تقييم رد AI
 * body: { rating: 1 | -1, note?: string }
 */
router.post('/usage/:id/rate', authorize(...USER_ROLES), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, note } = req.body || {};
  if (![1, -1].includes(Number(rating))) throw BadRequest('rating يجب أن يكون 1 أو -1');
  const ok = await rateUsage(id, Number(rating), note);
  res.json({ ok, message: ok ? 'تم حفظ التقييم' : 'السجل غير موجود' });
}));

/**
 * GET /api/ai-settings/usage/by-feature — تفاصيل الاستخدام حسب الميزة
 */
router.get('/usage/by-feature', authorize(...USER_ROLES), asyncHandler(async (_req, res) => {
  const data = await getUsageByFeature(1); // آخر شهر
  res.json({ ok: true, data });
}));

export default router;
