/**
 * pii.js — إزالة البيانات الشخصية الحساسة قبل إرسالها للـ AI
 *
 * الاستخدام:
 *   redact(text) → { text: '...[REDACTED]...', count: 3 }
 *
 * يُغطي: أرقام الهويات السعودية (10 أرقام تبدأ بـ 1 أو 2)،
 *        الجوال السعودي (+9665... أو 05...)، الإيميل، IBAN، أرقام بطاقات.
 */

const PATTERNS = [
  // الإيميل
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, tag: '[EMAIL]' },
  // IBAN سعودي (SA + 22 digit)
  { re: /\bSA\d{22}\b/gi, tag: '[IBAN]' },
  // الهوية السعودية (10 أرقام تبدأ بـ 1 أو 2) — يجب أن يكون قبل CARD
  { re: /\b[12]\d{9}\b/g, tag: '[ID]' },
  // الجوال السعودي
  { re: /(?:\+?966|0)?5\d{8}\b/g, tag: '[PHONE]' },
  // بطاقة ائتمان (13-19 رقم) — بعد ID حتى لا يلتقطها
  { re: /\b(?:\d[ -]?){13,19}\b/g, tag: '[CARD]', guard: (s) => {
      const digits = s.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19;
    },
  },
];

/**
 * يُزيل PII من النص ويُرجع النص المُعالج + عدد العناصر المُزالة
 */
export function redactPii(text) {
  if (!text || typeof text !== 'string') return { text: text || '', count: 0 };
  let out = text;
  let count = 0;
  for (const { re, tag, guard } of PATTERNS) {
    out = out.replace(re, (match) => {
      if (guard && !guard(match)) return match;
      count++;
      return tag;
    });
  }
  return { text: out, count };
}

/**
 * يُعالج array من الرسائل (للـ chat/completion)
 */
export function redactMessages(messages) {
  if (!Array.isArray(messages)) return { messages, count: 0 };
  let totalCount = 0;
  const out = messages.map((msg) => {
    if (typeof msg?.content === 'string') {
      const r = redactPii(msg.content);
      totalCount += r.count;
      return { ...msg, content: r.text };
    }
    return msg;
  });
  return { messages: out, count: totalCount };
}
