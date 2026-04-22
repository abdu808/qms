/**
 * csrf.js — حماية Double-Submit Cookie ضدّ هجمات CSRF
 *
 * النمط:
 *   - عند تسجيل الدخول (أو أي طلب GET موثّق) نزرع cookie `csrf` (غير httpOnly كي يقرأها JS).
 *   - العميل يُرسل نفس القيمة في header `X-CSRF-Token` على كل mutation (POST/PUT/PATCH/DELETE).
 *   - الوسيط يقارن القيمتين — إن لم يتطابقا = رفض 403.
 *
 * لماذا آمن: المهاجم على موقع خارجي لا يستطيع قراءة الكوكي (same-origin)
 * ولا وضع headers مخصّصة إلا بطلب CORS preflight الذي نرفضه.
 *
 * استثناءات:
 *   - GET/HEAD/OPTIONS (قراءة فقط)
 *   - /api/auth/login — لا جلسة بعد
 *   - /api/auth/refresh — يتحقّق من refresh token
 *   - /eval, /survey, /ack, /api/public — نقاط عامة بحماية أخرى (tokens, rate limits)
 */
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'csrf';
const CSRF_HEADER = 'x-csrf-token';

// مسارات mutations العامة التي لا تتطلّب CSRF (لديها حماية أخرى):
const SKIP_PATHS = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/refresh$/,
  /^\/api\/auth\/logout$/,   // مُسموح — logout ليس ضاراً
  /^\/eval\//,
  /^\/survey\//,
  /^\/ack\//,
  /^\/api\/public\//,
];

export function issueCsrfCookie(req, res, next) {
  // إن لم يوجد cookie csrf بعد، ولّد واحداً
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(24).toString('base64url');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,                                 // يجب أن يقرأه JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,                      // 8h — يتجدّد عند انتهائه
    });
  }
  next();
}

export function verifyCsrf(req, res, next) {
  // قراءة فقط → تجاوز
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // مسارات مُستثناة
  if (SKIP_PATHS.some(re => re.test(req.path))) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      ok: false,
      error: 'CSRF token غير صالح أو مفقود',
      code: 'CSRF_INVALID',
    });
  }
  next();
}
