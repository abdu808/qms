/**
 * providers/google.js — Google Gemini via @google/generative-ai
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-2.0-flash';
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

  // تحويل messages إلى صيغة Gemini (history + current)
  const history = [];
  let lastUserMessage = '';
  const msgs = messages || [];

  for (let i = 0; i < msgs.length - 1; i++) {
    const m = msgs[i];
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    });
  }
  if (msgs.length > 0) {
    const last = msgs[msgs.length - 1];
    lastUserMessage = String(last.content || '');
    if (last.role !== 'user') {
      // إن كانت آخر رسالة من المساعد، نضيفها للـ history ونُرسل سلسلة فارغة
      history.push({ role: 'model', parts: [{ text: lastUserMessage }] });
      lastUserMessage = '';
    }
  }

  const chat = geminiModel.startChat({ history });
  const response = await chat.sendMessage(lastUserMessage, { signal });
  const res = response.response;

  const text = res.text() || '';

  // استخراج tool calls
  const toolCalls = [];
  const candidates = res.candidates || [];
  for (const c of candidates) {
    for (const part of (c.content?.parts || [])) {
      if (part.functionCall) {
        toolCalls.push({
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
