import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { NotFound, Conflict, BadRequest } from '../utils/errors.js';
import { normalizeEmail, stripUndefined } from '../lib/dataHelpers.js';
import { createSchema as userCreateSchema, updateSchema as userUpdateSchema } from '../schemas/user.schema.js';
import { runSchema } from '../schemas/_helpers.js';

const validateCreate = runSchema(userCreateSchema);
const validateUpdate = runSchema(userUpdateSchema);

const router = Router();
const pub = { id: true, email: true, name: true, role: true, departmentId: true, jobTitle: true, phone: true, active: true, lastLoginAt: true, createdAt: true };

// القراءة مُقيَّدة لمدير الجودة/المسؤول فقط — PII (email/phone) لا تُعرض لكل موظف
router.get('/', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ select: pub, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, items: users, total: users.length });
}));

router.get('/:id', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: pub });
  if (!user) throw NotFound();
  res.json({ ok: true, item: user });
}));

router.post('/', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  // Zod: password إلزامي عند إنشاء مستخدم جديد (لا نصنع مستخدم بلا كلمة سر)
  const body = validateCreate({ ...req.body, password: req.body?.password });
  if (!body.password) throw Conflict('كلمة المرور إلزامية عند إنشاء مستخدم جديد');

  const normalizedEmail = normalizeEmail(body.email);
  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) throw Conflict('البريد مسجل مسبقاً');

  const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name:         body.name,
      role:         body.role || 'EMPLOYEE',
      departmentId: body.departmentId ?? null,
      jobTitle:     body.jobTitle ?? null,
      phone:        body.phone ?? null,
      active:       body.active ?? true,
    },
    select: pub,
  });
  res.status(201).json({ ok: true, item: user });
}));

router.put('/:id', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const body = validateUpdate(req.body);
  // كلمة المرور لا تمر عبر schema العام — تبقى منفصلة حتى لا تُسرَّب عبر عمليات تعديل عامة
  const password = req.body?.password;

  const data = stripUndefined({
    name:         body.name,
    role:         body.role,
    departmentId: body.departmentId,
    jobTitle:     body.jobTitle,
    phone:        body.phone,
    active:       body.active,
  });
  if (password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw Conflict('كلمة المرور الجديدة ٨ أحرف كحد أدنى');
    }
    data.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: pub });
  res.json({ ok: true, item: user });
}));

router.delete('/:id', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw NotFound();
  // لا يمكن تعطيل المسؤول الوحيد النشط في النظام
  if (user.role === 'SUPER_ADMIN') {
    const activeAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', active: true } });
    if (activeAdmins <= 1) throw Conflict('لا يمكن تعطيل المسؤول الوحيد في النظام');
  }
  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  // إبطال جميع جلسات المستخدم المُعطَّل فوراً
  await prisma.refreshToken.updateMany({ where: { userId: req.params.id }, data: { revoked: true } });
  res.json({ ok: true });
}));

// POST /:id/restore — إعادة تفعيل مستخدم مُعطَّل (SUPER_ADMIN فقط)
router.post('/:id/restore', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw NotFound();
  if (user.active) throw Conflict('المستخدم نشط بالفعل');
  const restored = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: true },
    select: pub,
  });
  res.json({ ok: true, item: restored });
}));

export default router;
