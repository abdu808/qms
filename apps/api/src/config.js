import 'dotenv/config';

// ── Fail-fast على الأسرار الإلزامية ──────────────────────────────────────
// لو وُجد JWT_SECRET افتراضي في production، يُوقف التطبيق فوراً بدلاً
// من تشغيله بأسرار قابلة للتخمين. هذا يُحمي من تزوير الـ JWT.
const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const DEV_DEFAULTS = {
  JWT_SECRET:     'dev-jwt-secret-change-me',
  REFRESH_SECRET: 'dev-refresh-secret-change-me',
  ADMIN_PASSWORD: 'Admin@2026',
};

if (IS_PROD) {
  for (const [key, devVal] of Object.entries(DEV_DEFAULTS)) {
    if (!process.env[key] || process.env[key] === devVal) {
      console.error(`[config] FATAL: ${key} must be set to a strong secret in production.`);
      process.exit(1);
    }
  }
  // CORS: في الإنتاج يجب تحديد origin صراحةً — لا نسمح بـ '*' مع credentials
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '*') {
    console.error('[config] FATAL: CORS_ORIGIN must list explicit origins in production (no "*").');
    process.exit(1);
  }
}

// في التطوير: الافتراضي localhost فقط — لا wildcard
const _corsRaw = process.env.CORS_ORIGIN || 'http://localhost:3000';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'QMS - جمعية البر بصبيا',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: _corsRaw.split(',').map(s => s.trim()).filter(Boolean),
  jwt: {
    secret:           process.env.JWT_SECRET     || DEV_DEFAULTS.JWT_SECRET,
    expiresIn:        process.env.JWT_EXPIRES_IN  || '8h',
    refreshSecret:    process.env.REFRESH_SECRET  || DEV_DEFAULTS.REFRESH_SECRET,
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  admin: {
    email:    process.env.ADMIN_EMAIL    || 'admin@bir-sabia.org.sa',
    password: process.env.ADMIN_PASSWORD || DEV_DEFAULTS.ADMIN_PASSWORD,
    name:     process.env.ADMIN_NAME     || 'مسؤول النظام',
  },
};
