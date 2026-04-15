import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Unauthorized, BadRequest } from '../utils/errors.js';
import { logAuth } from '../middleware/audit.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw BadRequest('بيانات الدخول غير صالحة');
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) throw Unauthorized('بيانات الدخول غير صحيحة');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Unauthorized('بيانات الدخول غير صحيحة');

  const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAuth(user.id, 'LOGIN', req);

  res.cookie('token', token, {
    httpOnly: true, secure: config.env === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    ok: true,
    token,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId },
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw Unauthorized();
  let payload;
  try { payload = jwt.verify(refreshToken, config.jwt.refreshSecret); }
  catch { throw Unauthorized('الجلسة منتهية'); }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) throw Unauthorized('الجلسة منتهية');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) throw Unauthorized();

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwt.secret, { expiresIn: config.jwt.expiresIn },
  );
  res.json({ ok: true, token });
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

export default router;
