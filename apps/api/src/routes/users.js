import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { NotFound, BadRequest, Conflict } from '../utils/errors.js';

const router = Router();
const pub = { id: true, email: true, name: true, role: true, departmentId: true, jobTitle: true, phone: true, active: true, lastLoginAt: true, createdAt: true };

router.get('/', asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ select: pub, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, items: users, total: users.length });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: pub });
  if (!user) throw NotFound();
  res.json({ ok: true, item: user });
}));

router.post('/', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const { email, password, name, role, departmentId, jobTitle, phone } = req.body;
  if (!email || !password || !name) throw BadRequest('الحقول الإلزامية مفقودة');
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) throw Conflict('البريد مسجل مسبقاً');
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: role || 'EMPLOYEE', departmentId, jobTitle, phone },
    select: pub,
  });
  res.status(201).json({ ok: true, item: user });
}));

router.put('/:id', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const { name, role, departmentId, jobTitle, phone, active, password } = req.body;
  const data = { name, role, departmentId, jobTitle, phone, active };
  if (password) data.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: pub });
  res.json({ ok: true, item: user });
}));

router.delete('/:id', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
}));

export default router;
