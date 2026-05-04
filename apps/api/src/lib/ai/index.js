/**
 * lib/ai/index.js — الواجهة الموحَّدة لطبقة الذكاء الاصطناعي
 *
 * الاستخدام في أي مكان بالنظام:
 *
 *   import { aiComplete } from '../lib/ai/index.js';
 *   const result = await aiComplete({
 *     system: 'أنت مساعد خبير بالعربية',
 *     messages: [{ role: 'user', content: '...' }],
 *     feature: 'ingestion',    // للتتبع
 *     jsonSchema: { ... },     // اختياري
 *     provider: 'anthropic',   // اختياري — يستخدم الافتراضي
 *     model: 'claude-haiku-4-5',
 *     piiRedact: false,
 *   });
 *
 *   result = {
 *     content, json?, toolCalls?,
 *     usage: { inputTokens, outputTokens, costUSD },
 *     provider, model, durationMs
 *   }
 */
import { getAiSettings } from './settings.js';
import { DEFAULT_MODELS, computeCost, estimateCost, estimateTokens, providerForModel } from './pricing.js';
import { logUsage, assertBudget, rateUsage } from './usage.js';
export { rateUsage } from './usage.js';
import { redactMessages, redactPii } from './pii.js';
import { getTaskMaxTokens, getTaskPrompt } from './taskPrompts.js';
import * as anthropicProvider from './providers/anthropic.js';
import * as openaiProvider from './providers/openai.js';
import * as googleProvider from './providers/google.js';

// Anthropic هو المزود التشغيلي للمستشار والأدوات.
// OpenAI/Google متاحان فقط عند طلب provider صريح، مثل Playground أو اختبار احتياطي يدوي.
const PROVIDERS = {
  anthropic: anthropicProvider,
  openai:    openaiProvider,
  google:    googleProvider,
};

const DEFAULT_TIMEOUT_MS = 60_000;
const PROVIDER_FALLBACK_ORDER = ['anthropic', 'openai', 'google'];

/**
 * الاستدعاء الرئيسي
 */
export async function aiComplete(params = {}) {
  const settings = await getAiSettings();

  if (!settings.enabled) {
    const err = new Error('طبقة AI معطَّلة في الإعدادات');
    err.code = 'AI_DISABLED';
    err.status = 503;
    throw err;
  }

  // اختيار المزود والموديل:
  // - إذا حدّد المستخدم provider/model صراحة نحترمه.
  // - إذا كان الموديل آتياً من تعيين ميزة، نستنتج المزود من اسم الموديل.
  // - إذا لم يوجد مفتاح للمزود المختار في تشغيل دوري، نسقط على أول مزود مفعّل بدلاً من تعطيل الروتين.
  const featureModel = settings.featureModels?.[params.feature];
  const requestedModel = params.model || featureModel || settings.defaultModel;
  const requestedProvider = params.provider || providerForModel(requestedModel) || settings.defaultProvider;
  const explicitProviderOrModel = !!(params.provider || params.model);
  const { provider, model, fallbackReason } = chooseProviderModel({
    requestedProvider,
    requestedModel,
    settings,
    explicitProviderOrModel,
  });
  const providerImpl = PROVIDERS[provider];
  if (!providerImpl) {
    throw new Error(`مزود AI غير مدعوم: ${provider}`);
  }

  // فحص المفتاح
  const apiKey = settings.keys[provider];
  if (!apiKey) {
    const err = new Error(`مفتاح API لـ ${provider} غير مُعيَّن. اذهب إلى إعدادات الذكاء الاصطناعي.`);
    err.code = 'AI_NO_KEY';
    err.status = 400;
    throw err;
  }

  // PII redaction
  let piiRedacted = false;
  let messages = params.messages || [];
  let system   = params.system || getTaskPrompt(params.feature);
  const shouldRedact = shouldApplyRedaction(settings.piiRedaction, params.piiRedact);
  if (shouldRedact) {
    const r1 = redactMessages(messages);
    messages = r1.messages;
    if (system) {
      const r2 = redactPii(system);
      system = r2.text;
      piiRedacted = piiRedacted || r2.count > 0;
    }
    piiRedacted = piiRedacted || r1.count > 0;
  }

  // ميزانية (قبل الاستدعاء) — بتقدير تقريبي يحسب النظام + الرسائل + سقف المخرجات.
  if (settings.monthlyBudgetUsd > 0) {
    const textForEstimate = [
      system || '',
      ...(messages || []).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')),
    ].join('\n');
    const estimatedInput = estimateTokens(textForEstimate);
    const estimatedOutput = Number(params.maxTokens || getTaskMaxTokens(params.feature, 1200));
    await assertBudget(settings.monthlyBudgetUsd, estimateCost(model, estimatedInput, estimatedOutput));
  }

  // timeout عبر AbortController
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = params.signal || controller.signal;

  const t0 = Date.now();
  let success = true;
  let errorMessage = null;
  let result = null;

  try {
    result = await providerImpl.complete({
      apiKey, model,
      system, messages,
      maxTokens:   params.maxTokens || getTaskMaxTokens(params.feature, undefined),
      temperature: params.temperature,
      jsonSchema:  params.jsonSchema,
      tools:       params.tools,
      signal,
    });
  } catch (e) {
    success = false;
    errorMessage = e.message || String(e);
    // نُسجِّل ثم نُعيد رمي الخطأ
    const durationMs = Date.now() - t0;
    await safeLog({
      provider, model, feature: params.feature || 'unknown',
      inputTokens: 0, outputTokens: 0, costUSD: 0, durationMs,
      userId: params.userId, success, errorMessage, piiRedacted,
      metadata: params.metadata,
    }, settings.logRequests);
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - t0;
  const inputTokens  = result.inputTokens  || 0;
  const outputTokens = result.outputTokens || 0;
  const costUSD      = computeCost(model, inputTokens, outputTokens);

  // تسجيل الاستخدام
  const logId = await safeLog({
    provider, model, feature: params.feature || 'unknown',
    inputTokens, outputTokens, costUSD, durationMs,
    userId: params.userId, success, errorMessage, piiRedacted,
    metadata: params.metadata,
  }, settings.logRequests);

  return {
    content:   result.content,
    json:      result.json,
    jsonParseError: result.jsonParseError,
    toolCalls: result.toolCalls,
    stopReason: result.stopReason,
    usage: { inputTokens, outputTokens, costUSD },
    cacheReadTokens:  result.cacheReadTokens  || 0,
    cacheWriteTokens: result.cacheWriteTokens || 0,
    provider, model, durationMs,
    piiRedacted,
    logId,
    fallbackReason,
  };
}

function chooseProviderModel({ requestedProvider, requestedModel, settings, explicitProviderOrModel }) {
  if (settings.keys?.[requestedProvider]) {
    return { provider: requestedProvider, model: requestedModel, fallbackReason: null };
  }

  if (explicitProviderOrModel) {
    return { provider: requestedProvider, model: requestedModel, fallbackReason: null };
  }

  for (const provider of PROVIDER_FALLBACK_ORDER) {
    if (!settings.keys?.[provider]) continue;
    return {
      provider,
      model: settings.defaultProvider === provider
        ? settings.defaultModel
        : DEFAULT_MODELS[provider],
      fallbackReason: `missing-api-key:${requestedProvider}`,
    };
  }

  return { provider: requestedProvider, model: requestedModel, fallbackReason: null };
}

/** هل نُطبِّق PII redaction حسب الإعداد العام + طلب الميزة؟ */
function shouldApplyRedaction(globalMode, featureRequested) {
  if (globalMode === 'always') return true;
  if (globalMode === 'never')  return false;
  // optional → الميزة تُقرِّر
  return !!featureRequested;
}

/** تسجيل لا يكسر الـ flow */
async function safeLog(data, enabled) {
  if (!enabled) return null;
  try { return await logUsage(data); } catch { return null; }
}

/**
 * اختبار مفتاح API (يُستخدَم من الـ UI)
 */
export async function aiTestConnection({ provider, model, apiKey }) {
  const impl = PROVIDERS[provider];
  if (!impl) throw new Error(`مزود غير مدعوم: ${provider}`);
  return await impl.testConnection({ apiKey, model });
}

// re-exports للراحة
export { getAiSettings, setSetting, setApiKey, invalidateAiSettingsCache } from './settings.js';
export { getMonthlyCost, getUsageSummary, getUsageByFeature } from './usage.js';
export { MODEL_CATALOG, DEFAULT_MODELS, computeCost, estimateTokens } from './pricing.js';
export { redactPii } from './pii.js';
