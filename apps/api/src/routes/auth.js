import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Unauthorized, BadRequest } from '../utils/errors.js';
import { logAuth } from '../middleware/audit.js';

/**
 * Parse a duration string like "30d", "8h", "7d", "15m" into milliseconds.
 * Supports: d (days), h (hours), m (minutes), s (seconds).
 */
function parseDurationMs(str) {
  if (typeof str !== 'string') throw new Error(`parseDurationMs: expected string, got ${typeof str}`);
  const match = str.match(/^(\d+)([dhms])$/);
  if (!match) throw new Error(`parseDurationMs: unrecognised duration format "${str}"`);
  const n = Number(match[1]);
  switch (match[2]) {
    case 'd': return n * 24 * 60 * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'm': return n * 60 * 1000;
    case 's': return n * 1000;
  }
}

const router = Router();

// Strict limiter for /auth/login — IP + email based, counts only failures.
// 10 failed attempts per 15min per (IP+email) combination. Successful logins reset implicitly.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count 2xx responses toward limit
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    return `${req.ip}|${email}`;
  },
  message: { ok: false, error: 'تم تجاوز عدد محاولات الدخول. حاول بعد 15 دقيقة.' },
});

// Separate stricter per-IP limiter — catches distributed email guessing from same origin.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip,
  message: { ok: false, error: 'عدد كبير من محاولات الدخول من هذا العنوان. حاول لاحقاً.' },
});

// Refresh token limiter — prevents token enumeration attacks.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { ok: false, error: 'عدد كبير من الطلبات. حاول لاحقاً.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', loginIpLimiter, loginLimiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw BadRequest('بيانات الدخول غير صالحة');
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) throw Unauthorized('بيانات الدخول غير صحيحة');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    // Record failed attempt for security audit (ISO 9001 §7.5.3.2)
    await logAuth(user.id, 'LOGIN_FAILED', req).catch(() => {});
    throw Unauthorized('بيانات الدخول غير صحيحة');
  }

  const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn)),
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAuth(user.id, 'LOGIN', req);

  res.cookie('token', token, {
    httpOnly: true, secure: config.env === 'production', sameSite: 'lax', maxAge: parseDurationMs(config.jwt.expiresIn),
  });

  res.json({
    ok: true,
    token,
    refreshToken,
    mustChangePassword: user.mustChangePassword || false,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId },
  });
}));

router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw Unauthorized();
  let payload;
  try { payload = jwt.verify(refreshToken, config.jwt.refreshSecret); }
  catch { throw Unauthorized('الجلسة منتهية'); }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) throw Unauthorized('الجلسة منتهية');

  // اكتشاف إعادة استخدام token مُبطَل — مؤشر على سرقة — أبطل الجلسة كلها
  if (stored.revoked) {
    await prisma.refreshToken.updateMany({ where: { userId: stored.userId }, data: { revoked: true } });
    throw Unauthorized('تم اكتشاف نشاط مشبوه — سجّل دخولك مجدداً');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) throw Unauthorized();

  // Token Rotation: أبطل القديم وأنشئ جديداً في transaction واحدة
  const newRefreshToken = jwt.sign(
    { sub: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn },
  );
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } }),
    prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     newRefreshToken,
        expiresAt: new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn)),
      },
    }),
  ]);

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwt.secret, { expiresIn: config.jwt.expiresIn },
  );

  res.cookie('token', token, {
    httpOnly: true, secure: config.env === 'production', sameSite: 'lax', maxAge: parseDurationMs(config.jwt.expiresIn),
  });
  res.json({ ok: true, token, refreshToken: newRefreshToken });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
  }
  res.clearCookie('token');
  res.json({ ok: true });
}));

router.get('/me', asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) throw Unauthorized();
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, departmentId: true, jobTitle: true },
    });
    if (!user) throw Unauthorized();
    res.json({ ok: true, user });
  } catch {
    throw Unauthorized();
  }
}));

// تغيير كلمة المرور (مطلوب عند أول دخول أو كلمة مرور مؤقتة)
router.post('/change-password', asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) throw Unauthorized();

  let payload;
  try { payload = jwt.verify(token, config.jwt.secret); } catch { throw Unauthorized(); }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw BadRequest('كلمة المرور الحالية والجديدة مطلوبتان');
  if (newPassword.length < 8) throw BadRequest('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Unauthorized();

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw BadRequest('كلمة المرور الحالية غير صحيحة');
  if (currentPassword === newPassword) throw BadRequest('كلمة المرور الجديدة يجب أن تختلف عن الحالية');

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await logAuth(user.id, 'PASSWORD_CHANGED', req).catch(() => {});
  res.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
}));

export default router;
