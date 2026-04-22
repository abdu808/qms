/**
 * providers/openai.js — OpenAI Chat Completions
 */
import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 2000;

export async function complete({
  apiKey, model = DEFAULT_MODEL,
  system, messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = 0.3,
  jsonSchema = null,
  tools = null,
  signal = null,
}) {
  if (!apiKey) throw new Error('OpenAI API key مفقود');

  const client = new OpenAI({ apiKey });

  // OpenAI يستخدم role=system كرسالة ضمن messages
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  for (const m of (messages || [])) {
    msgs.push({ role: m.role, content: m.content });
  }

  const body = {
    model,
    messages: msgs,
    max_tokens: maxTokens,
    temperature,
  };

  // JSON mode
  if (jsonSchema) {
    body.response_format = { type: 'json_object' };
    // نُضيف schema في الـ system للتوجيه
    const hint = `\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    if (msgs[0]?.role === 'system') msgs[0].content += hint;
    else msgs.unshift({ role: 'system', content: `You are a helpful assistant.${hint}` });
  }

  // Tools
  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema || t.inputSchema,
      },
    }));
  }

  const response = await client.chat.completions.create(body, { signal });

  const choice = response.choices?.[0];
  const msg = choice?.message || {};
  const content = msg.content || '';

  const toolCalls = (msg.tool_calls || []).map(tc => ({
    name: tc.function?.name,
    input: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } })(),
    id: tc.id,
  }));

  const result = {
    content,
    inputTokens:  response.usage?.prompt_tokens     || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    stopReason:   choice?.finish_reason,
    raw: response,
  };
  if (toolCalls.length) result.toolCalls = toolCalls;

  if (jsonSchema && content) {
    try { result.json = JSON.parse(content); }
    catch (e) { result.jsonParseError = e.message; }
  }

  return result;
}

export async function testConnection({ apiKey, model = DEFAULT_MODEL }) {
  const client = new OpenAI({ apiKey });
  const r = await client.chat.completions.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'ping' }],
  });
  return { ok: true, model: r.model, tokensOut: r.usage?.completion_tokens || 0 };
}

/**
 * جلب قائمة موديلات Chat من OpenAI API
 * يُصفّي فقط موديلات GPT وo-series القادرة على Chat
 */
export async function listModels({ apiKey }) {
  const client = new OpenAI({ apiKey });
  const r = await client.models.list();
  const CHAT_PREFIXES = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4'];
  return (r.data || [])
    .filter(m => CHAT_PREFIXES.some(p => m.id.startsWith(p)))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(m => ({ id: m.id, name: m.id, created: m.created }));
}
