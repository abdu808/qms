/**
 * providers/google.js — Google Gemini via @google/generative-ai
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-2.5-flash';
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
  if (!apiKey) throw new Error('Google API key مفقود');

  const genAI = new GoogleGenerativeAI(apiKey);

  // خريطة tool_use.id → function name — نحتاجها لتحويل tool_result إلى functionResponse
  // لأن Gemini يطلب name = اسم الدالة، بينما Anthropic يستخدم opaque id.
  const toolIdToName = new Map();
  // أولاً اجمع من كل الرسائل ids → names لاستخدامها لاحقاً في tool_result
  for (const m of messages || []) {
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === 'tool_use' && b.id && b.name) {
          toolIdToName.set(b.id, b.name);
        }
      }
    }
  }

  const modelConfig = {
    model,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  // System instruction
  if (system) modelConfig.systemInstruction = system;

  // JSON mode
  if (jsonSchema) {
    modelConfig.generationConfig.responseMimeType = 'application/json';
    if (typeof jsonSchema === 'object') {
      // Gemini يقبل responseSchema — لكن نُبقي النص كـ hint أيضاً
      modelConfig.generationConfig.responseSchema = sanitizeSchema(jsonSchema);
    }
  }

  // Tools (function calling)
  if (tools && tools.length > 0) {
    modelConfig.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: sanitizeSchema(t.input_schema || t.inputSchema),
      })),
    }];
  }

  const geminiModel = genAI.getGenerativeModel(modelConfig);

  // تحويل messages إلى صيغة Gemini — مع دعم صيغة Anthropic (content-array)
  const history = [];
  let lastUserMessage = '';
  const msgs = messages || [];

  /** تحويل رسالة واحدة إلى Gemini parts */
  function toGeminiParts(m) {
    if (typeof m.content === 'string') return [{ text: m.content }];
    if (!Array.isArray(m.content)) return [{ text: '' }];
    const parts = [];
    for (const b of m.content) {
      if (b.type === 'text')       parts.push({ text: b.text || '' });
      else if (b.type === 'tool_use')   parts.push({ functionCall: { name: b.name, args: b.input || {} } });
      else if (b.type === 'tool_result') {
        const fnName = toolIdToName.get(b.tool_use_id) || 'tool';
        parts.push({ functionResponse: {
          name: fnName,
          response: { content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) },
        }});
      }
      // ── Vision: document (PDF) / image — تحويل من صيغة Anthropic إلى inlineData ──
      else if ((b.type === 'document' || b.type === 'image') && b.source?.type === 'base64') {
        parts.push({
          inlineData: {
            mimeType: b.source.media_type,
            data:     b.source.data,
          },
        });
      }
    }
    return parts.length ? parts : [{ text: '' }];
  }

  for (let i = 0; i < msgs.length - 1; i++) {
    const m = msgs[i];
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m),
    });
  }
  // lastUserMessage يمكن أن يكون string أو array of parts (للـ vision)
  let lastUserParts = null;
  if (msgs.length > 0) {
    const last = msgs[msgs.length - 1];
    if (last.role === 'user') {
      if (typeof last.content === 'string') {
        lastUserMessage = last.content;
      } else {
        // content array — نُحوِّلها إلى parts
        lastUserParts = toGeminiParts(last);
        lastUserMessage = '';
      }
    } else {
      history.push({ role: 'model', parts: toGeminiParts(last) });
      lastUserMessage = '';
    }
  }

  const chat = geminiModel.startChat({ history });
  const response = await chat.sendMessage(lastUserParts || lastUserMessage, { signal });
  const res = response.response;

  const text = res.text() || '';

  // استخراج tool calls
  const toolCalls = [];
  const candidates = res.candidates || [];
  // generate stable synthetic ids so the loop can pair tool_result → tool_use
  // (Gemini لا يُرجع id، لكن Anthropic/loop يحتاجه)
  let _toolIdCounter = 0;
  for (const c of candidates) {
    for (const part of (c.content?.parts || [])) {
      if (part.functionCall) {
        const id = `gem_${Date.now().toString(36)}_${_toolIdCounter++}`;
        toolCalls.push({
          id,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      }
    }
  }

  const usage = res.usageMetadata || {};
  const result = {
    content: text,
    inputTokens:  usage.promptTokenCount     || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    stopReason:   candidates[0]?.finishReason,
    raw: res,
  };
  if (toolCalls.length) result.toolCalls = toolCalls;

  if (jsonSchema && text) {
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      result.json = JSON.parse(cleaned);
    } catch (e) {
      result.jsonParseError = e.message;
    }
  }

  return result;
}

/**
 * Gemini لا يقبل كل خصائص JSON schema — نُزيل ما لا يدعمه
 */
function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const clean = Array.isArray(schema) ? [] : {};
  const UNSUPPORTED = new Set(['$schema', 'additionalProperties', '$ref', 'definitions', 'oneOf', 'anyOf', 'allOf']);
  for (const [k, v] of Object.entries(schema)) {
    if (UNSUPPORTED.has(k)) continue;
    if (v && typeof v === 'object') clean[k] = sanitizeSchema(v);
    else clean[k] = v;
  }
  return clean;
}

export async function testConnection({ apiKey, model = DEFAULT_MODEL }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model, generationConfig: { maxOutputTokens: 10 } });
  const r = await m.generateContent('ping');
  return {
    ok: true,
    model,
    tokensOut: r.response?.usageMetadata?.candidatesTokenCount || 0,
  };
}

/**
 * جلب قائمة موديلات Gemini التي تدعم generateContent
 */
export async function listModels({ apiKey }) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`
  );
  if (!r.ok) throw new Error(`Google API: ${r.status} ${r.statusText}`);
  const data = await r.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
    }));
}
