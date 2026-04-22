/**
 * crypto.js — تشفير/فك تشفير مفاتيح AI API
 *
 * يستخدم AES-256-GCM (authenticated encryption) مع مفتاح رئيسي مشتق من env.
 * المفتاح الرئيسي: AI_ENCRYPTION_KEY (hex-32-bytes). إن لم يُعيَّن، يستخدم JWT_SECRET
 * كـ fallback (بعد SHA-256) — يجب أن يكون JWT_SECRET طويلاً وثابتاً.
 *
 * الصيغة المُخزَّنة في DB:   "v1:<iv_hex>:<authTag_hex>:<cipher_hex>"
 * القيم المُخفَّاة في الـ GET API تُعاد كـ "****<last-4-of-plain>" فقط.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { config } from '../../config.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;       // 96-bit IV موصى به لـ GCM
const PREFIX = 'v1:';

/** يستخرج master key (32 bytes) من env — ثابت طوال حياة العملية */
let _masterKey = null;
function getMasterKey() {
  if (_masterKey) return _masterKey;
  const raw = process.env.AI_ENCRYPTION_KEY || config.jwt?.secret || process.env.JWT_SECRET;
  if (!raw) {
    throw new Error('AI_ENCRYPTION_KEY أو JWT_SECRET مطلوب لتشفير مفاتيح AI');
  }
  // SHA-256 → 32 bytes ثابتة حتى لو كان المدخل متفاوت الطول
  _masterKey = createHash('sha256').update(String(raw)).digest();
  return _masterKey;
}

/** يُشفِّر نصّاً — يُرجع سلسلة جاهزة للحفظ في DB */
export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return '';
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

/** يفكّ التشفير — يُرجع النص الأصلي أو '' عند الفشل */
export function decrypt(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return '';
  if (!encrypted.startsWith(PREFIX)) return ''; // غير مُشفَّر أو صيغة قديمة
  try {
    const [, ivHex, tagHex, ctHex] = encrypted.split(':');
    if (!ivHex || !tagHex || !ctHex) return '';
    const key = getMasterKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return pt.toString('utf8');
  } catch (e) {
    console.warn('[ai/crypto] decrypt failed:', e.message);
    return '';
  }
}

/** يُخفي المفتاح للعرض في UI — "sk-abc123...xyz4" → "****xyz4" */
export function maskKey(plain) {
  if (!plain || typeof plain !== 'string') return '';
  const s = String(plain);
  if (s.length <= 4) return '****';
  return '****' + s.slice(-4);
}

/** true لو القيمة المُرسَلة من الـ UI هي mask (نعني: لا نُحدِّث) */
export function isMasked(value) {
  return typeof value === 'string' && value.startsWith('****');
}
