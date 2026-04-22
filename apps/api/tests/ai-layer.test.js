/**
 * tests/ai-layer.test.js — اختبارات طبقة AI
 *  - التشفير/فك التشفير
 *  - حساب التكلفة
 *  - PII redaction
 *  - تحميل الوحدات
 */
import { describe, it, expect, beforeAll } from 'vitest';

// مفتاح اختبار ثابت لـ encryption
beforeAll(() => {
  if (!process.env.AI_ENCRYPTION_KEY) {
    process.env.AI_ENCRYPTION_KEY = 'test-ai-encryption-key-for-vitest-only-32b';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-32-bytes-min';
  }
});

describe('ai/crypto — تشفير مفاتيح API', () => {
  it('يُشفِّر ويفك التشفير بشكل صحيح', async () => {
    const { encrypt, decrypt } = await import('../src/lib/ai/crypto.js');
    const plain = 'sk-ant-api03-abc123-secret-key-xyz';
    const enc = encrypt(plain);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain(plain);
    const dec = decrypt(enc);
    expect(dec).toBe(plain);
  });

  it('يُعيد سلسلة فارغة للمدخلات الفارغة', async () => {
    const { encrypt, decrypt } = await import('../src/lib/ai/crypto.js');
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBe('');
    expect(encrypt(undefined)).toBe('');
    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBe('');
    expect(decrypt('not-encrypted-format')).toBe('');
  });

  it('يُخفي المفتاح بشكل صحيح', async () => {
    const { maskKey, isMasked } = await import('../src/lib/ai/crypto.js');
    expect(maskKey('sk-abc123xyz')).toBe('****3xyz');
    expect(maskKey('abc')).toBe('****');
    expect(maskKey('')).toBe('');
    expect(isMasked('****abcd')).toBe(true);
    expect(isMasked('sk-abc')).toBe(false);
  });

  it('يفشل بأمان عند فك تشفير بيانات تالفة', async () => {
    const { decrypt } = await import('../src/lib/ai/crypto.js');
    expect(decrypt('v1:deadbeef:deadbeef:deadbeef')).toBe('');
  });
});

describe('ai/pricing — حساب التكلفة', () => {
  it('يحسب تكلفة claude-haiku-4-5 بدقة', async () => {
    const { computeCost } = await import('../src/lib/ai/pricing.js');
    // 1M input @ $1.00 + 500K output @ $5.00 = $1.00 + $2.50 = $3.50
    const cost = computeCost('claude-haiku-4-5', 1_000_000, 500_000);
    expect(cost).toBeCloseTo(3.50, 2);
  });

  it('يُرجع 0 لنموذج غير معروف', async () => {
    const { computeCost } = await import('../src/lib/ai/pricing.js');
    expect(computeCost('unknown-model', 1000, 1000)).toBe(0);
  });

  it('يُقدِّر التوكنز للعربية والإنجليزية', async () => {
    const { estimateTokens } = await import('../src/lib/ai/pricing.js');
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
    expect(estimateTokens('مرحبا بالعالم')).toBeGreaterThan(0);
  });

  it('MODEL_CATALOG يحتوي نماذج من كل المزودين', async () => {
    const { MODEL_CATALOG } = await import('../src/lib/ai/pricing.js');
    const providers = new Set(MODEL_CATALOG.map(m => m.provider));
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('google')).toBe(true);
  });

  it('DEFAULT_MODELS موجودة لكل مزود', async () => {
    const { DEFAULT_MODELS, PRICING } = await import('../src/lib/ai/pricing.js');
    expect(DEFAULT_MODELS.anthropic).toBeTruthy();
    expect(DEFAULT_MODELS.openai).toBeTruthy();
    expect(DEFAULT_MODELS.google).toBeTruthy();
    // كل موديل افتراضي له سعر
    expect(PRICING[DEFAULT_MODELS.anthropic]).toBeDefined();
    expect(PRICING[DEFAULT_MODELS.openai]).toBeDefined();
    expect(PRICING[DEFAULT_MODELS.google]).toBeDefined();
  });
});

describe('ai/pii — إزالة البيانات الحساسة', () => {
  it('يُزيل الإيميل', async () => {
    const { redactPii } = await import('../src/lib/ai/pii.js');
    const r = redactPii('تواصل معي على user@example.com شكراً');
    expect(r.text).not.toContain('user@example.com');
    expect(r.text).toContain('[EMAIL]');
    expect(r.count).toBe(1);
  });

  it('يُزيل الجوال السعودي', async () => {
    const { redactPii } = await import('../src/lib/ai/pii.js');
    const r1 = redactPii('اتصل على 0501234567');
    expect(r1.text).toContain('[PHONE]');
    expect(r1.count).toBeGreaterThanOrEqual(1);
    const r2 = redactPii('جوالي +966501234567');
    expect(r2.text).toContain('[PHONE]');
  });

  it('يُزيل الهوية السعودية (10 أرقام تبدأ بـ 1 أو 2)', async () => {
    const { redactPii } = await import('../src/lib/ai/pii.js');
    const r = redactPii('رقم الهوية 1012345678');
    expect(r.text).toContain('[ID]');
  });

  it('يُزيل IBAN', async () => {
    const { redactPii } = await import('../src/lib/ai/pii.js');
    const r = redactPii('الحساب: SA0380000000608010167519');
    expect(r.text).toContain('[IBAN]');
  });

  it('لا يُعدِّل النص الذي لا يحتوي على PII', async () => {
    const { redactPii } = await import('../src/lib/ai/pii.js');
    const input = 'هذه جملة عادية بدون أي بيانات حساسة';
    const r = redactPii(input);
    expect(r.text).toBe(input);
    expect(r.count).toBe(0);
  });

  it('redactMessages يعمل على array من الرسائل', async () => {
    const { redactMessages } = await import('../src/lib/ai/pii.js');
    const msgs = [
      { role: 'user', content: 'إيميلي user@test.com' },
      { role: 'assistant', content: 'تم الاستلام' },
    ];
    const r = redactMessages(msgs);
    expect(r.messages[0].content).toContain('[EMAIL]');
    expect(r.messages[1].content).toBe('تم الاستلام');
    expect(r.count).toBe(1);
  });
});

describe('ai modules تحمَّل بدون أخطاء', () => {
  it('يستورد lib/ai/index.js', async () => {
    const mod = await import('../src/lib/ai/index.js');
    expect(typeof mod.aiComplete).toBe('function');
    expect(typeof mod.aiTestConnection).toBe('function');
    expect(typeof mod.getAiSettings).toBe('function');
    expect(typeof mod.getMonthlyCost).toBe('function');
    expect(typeof mod.MODEL_CATALOG).toBe('object');
  });

  it('يستورد providers/anthropic.js', async () => {
    const mod = await import('../src/lib/ai/providers/anthropic.js');
    expect(typeof mod.complete).toBe('function');
    expect(typeof mod.testConnection).toBe('function');
  });

  it('يستورد providers/openai.js', async () => {
    const mod = await import('../src/lib/ai/providers/openai.js');
    expect(typeof mod.complete).toBe('function');
    expect(typeof mod.testConnection).toBe('function');
  });

  it('يستورد providers/google.js', async () => {
    const mod = await import('../src/lib/ai/providers/google.js');
    expect(typeof mod.complete).toBe('function');
    expect(typeof mod.testConnection).toBe('function');
  });

  it('يستورد route aiSettings', async () => {
    const mod = await import('../src/routes/aiSettings.js');
    expect(mod.default).toBeDefined();
  });
});
