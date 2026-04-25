/**
 * providers/anthropic.js — Claude via Anthropic SDK
 *
 * يُصدِّر:
 *   complete({ apiKey, model, system, messages, maxTokens, temperature, jsonSchema, tools, signal })
 *   testConnection({ apiKey, model })
 */
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 2000;

/**
 * استدعاء موحَّد — يُرجع { content, inputTokens, outputTokens, toolCalls?, json? }
 */
export async function complete({
  apiKey, model = DEFAULT_MODEL,
  system, messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = 0.6,  // مرتفع للمستشار — يمنح تنوعاً في الاقتراحات دون فقدان الدقة
  jsonSchema = null,
  tools = null,
  signal = null,
}) {
  if (!apiKey) throw new Error('Anthropic API key مفقود');

  const client = new Anthropic({ apiKey });

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages || [],
  };
  // System prompt — نُفعِّل الكاش إن كان النص طويلاً (> 1024 توكن تقريباً = 4096 حرف)
  if (system) {
    if (system.length > 4096) {
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
    } else {
      body.system = system;
    }
  }

  // Tools — نُفعِّل الكاش على آخر أداة (Anthropic يكشّ كل ما قبلها تلقائياً)
  // الكاش يوفر ~90% على توكنات الأدوات في الاستدعاءات المتكررة خلال 5 دقائق
  if (tools && tools.length > 0) {
    const mapped = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema || t.inputSchema,
    }));
    // أضف cache_control على آخر أداة فقط
    if (mapped.length > 0) {
      mapped[mapped.length - 1].cache_control = { type: 'ephemeral' };
    }
    body.tools = mapped;
  }

  // JSON mode via prompting (Anthropic لا يدعم JSON mode صريح — نفرضه عبر system)
  if (jsonSchema && !tools) {
    const jsonHint = `\n\nIMPORTANT: استجب بـ JSON صالح فقط يطابق هذا الـ schema (بدون أي نص خارجي، بدون markdown):\n${JSON.stringify(jsonSchema, null, 2)}`;
    body.system = (body.system || '') + jsonHint;
  }

  const response = await client.messages.create(body, { signal });

  // استخراج المحتوى
  let content = '';
  const toolCalls = [];
  for (const block of (response.content || [])) {
    if (block.type === 'text') content += block.text;
    else if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: block.input, id: block.id });
  }

  const result = {
    content,
    inputTokens:       response.usage?.input_tokens              || 0,
    outputTokens:      response.usage?.output_tokens             || 0,
    cacheReadTokens:   response.usage?.cache_read_input_tokens   || 0,
    cacheWriteTokens:  response.usage?.cache_creation_input_tokens || 0,
    stopReason:        response.stop_reason,
    raw: response,
  };
  if (toolCalls.length) result.toolCalls = toolCalls;

  // محاولة parse JSON إن طُلب
  if (jsonSchema && content) {
    try {
      // إزالة markdown fences إن وُجدت
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      result.json = JSON.parse(cleaned);
    } catch (e) {
      result.jsonParseError = e.message;
    }
  }

  return result;
}

/** اختبار سريع للمفتاح */
export async function testConnection({ apiKey, model = DEFAULT_MODEL }) {
  const client = new Anthropic({ apiKey });
  const r = await client.messages.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'ping' }],
  });
  return { ok: true, model: r.model, tokensOut: r.usage?.output_tokens || 0 };
}

/**
 * جلب قائمة الموديلات المتاحة من Anthropic API
 * يُرجع: [{ id, name, created }]
 */
/**
 * جلب قائمة موديلات Claude عبر REST API مباشرةً
 * (SDK v0.32 لا يدعم client.models — نستخدم fetch كحل مستقل عن إصدار SDK)
 */
export async function listModels({ apiKey }) {
  const r = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!r.ok) throw new Error(`Anthropic API: ${r.status} ${r.statusText}`);
  const data = await r.json();
  return (data.data || []).map(m => ({
    id: m.id,
    name: m.display_name || m.id,
    created: m.created_at,
  }));
}
