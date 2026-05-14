import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { requireAction } from '../lib/permissions.js';
import { NotFound, Conflict, BadRequest, Forbidden } from '../utils/errors.js';
import { normalizeEmail, stripUndefined } from '../lib/dataHelpers.js';
import { createSchema as userCreateSchema, updateSchema as userUpdateSchema } from '../schemas/user.schema.js';
import { runSchema } from '../schemas/_helpers.js';

// QM cannot create, promote-to, or edit/delete SUPER_ADMIN accounts.
// Only SUPER_ADMIN can manage SUPER_ADMIN. This is enforced explicitly here
// regardless of what the permissions-matrix says, because the matrix is
// resource-level granular but cannot express "QM can write users EXCEPT SA".
function assertCanTouchTargetUser(actor, targetUser) {
  if (actor.role === 'SUPER_ADMIN') return;
  if (targetUser?.role === 'SUPER_ADMIN') {
    throw Forbidden('فقط المسؤول العام يستطيع تعديل مستخدمي SUPER_ADMIN');
  }
}
function assertCanAssignRole(actor, requestedRole) {
  if (!requestedRole) return;
  if (actor.role === 'SUPER_ADMIN') return;
  if (requestedRole === 'SUPER_ADMIN') {
    throw Forbidden('فقط المسؤول العام يستطيع منح/تعيين دور SUPER_ADMIN');
  }
}

const validateCreate = runSchema(userCreateSchema);
const validateUpdate = runSchema(userUpdateSchema);

const router = Router();
const pub = { id: true, email: true, name: true, role: true, departmentId: true, jobTitle: true, phone: true, active: true, lastLoginAt: true, createdAt: true };
const pubWithDept = { ...pub, department: { select: { id: true, name: true, code: true } } };

function normalizePersonName(name) {
  return String(name || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function countUserReferences(userId) {
  const counts = await Promise.all([
    prisma.objective.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }] } }),
    prisma.strategicGoal.count({ where: { ownerUserId: userId } }),
    prisma.indicator.count({ where: { OR: [{ ownerId: userId }, { dataEntryUserId: userId }, { approverUserId: userId }] } }),
    prisma.operationalActivity.count({ where: { ownerId: userId } }),
    prisma.initiative.count({ where: { ownerId: userId } }),
    prisma.risk.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }] } }),
    prisma.nCR.count({ where: { OR: [{ reporterId: userId }, { assigneeId: userId }] } }),
    prisma.complaint.count({ where: { assigneeId: userId } }),
    prisma.capa.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }, { verifiedById: userId }] } }),
    prisma.followUpTask.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }] } }),
    prisma.auditFinding.count({ where: { OR: [{ ownerId: userId }, { createdById: userId }] } }),
    prisma.kpiEntry.count({ where: { OR: [{ enteredById: userId }, { approvedById: userId }] } }),
    prisma.kpiFollowUp.count({ where: { OR: [{ dataEntryUserId: userId }, { performanceOwnerId: userId }, { escalatedById: userId }] } }),
    prisma.trainingRecord.count({ where: { userId } }),
    prisma.ack.count({ where: { userId } }),
    prisma.signature.count({ where: { userId } }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

// Permissions sourced from MATRIX['users']:
//   read   → MANAGER_UP, create/update → QM_UP, delete → SA.
// Plus explicit SUPER_ADMIN protection: QM may not create/promote/edit SA.

router.get('/', requireAction('users', 'read'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.onlyDeleted === '1' || req.query.active === 'false') {
    where.active = false;
  } else if (req.query.includeInactive !== '1' && req.query.active !== 'all') {
    where.active = true;
  }
  const users = await prisma.user.findMany({ where, select: pubWithDept, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, items: users, total: users.length });
}));

router.get('/duplicates', requireAction('users', 'read'), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: pubWithDept,
    orderBy: [{ name: 'asc' }, { active: 'desc' }, { createdAt: 'asc' }],
  });
  const groups = new Map();
  for (const user of users) {
    const key = normalizePersonName(user.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(user);
  }

  const items = [];
  for (const [normalizedName, group] of groups.entries()) {
    if (group.length < 2) continue;
    const usersWithRefs = await Promise.all(group.map(async (user) => ({
      ...user,
      referenceCount: await countUserReferences(user.id),
      suggestedKeep: false,
    })));
    usersWithRefs.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.referenceCount !== b.referenceCount) return b.referenceCount - a.referenceCount;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    if (usersWithRefs[0]) usersWithRefs[0].suggestedKeep = true;
    items.push({
      normalizedName,
      name: group[0].name,
      count: usersWithRefs.length,
      activeCount: usersWithRefs.filter(u => u.active).length,
      users: usersWithRefs,
    });
  }

  res.json({ ok: true, items, total: items.length });
}));

router.post('/trash/purge-unlinked', authorize('SUPER_ADMIN'), asyncHandler(async (_req, res) => {
  const inactiveUsers = await prisma.user.findMany({
    where: { active: false, role: { not: 'SUPER_ADMIN' } },
    select: pubWithDept,
    orderBy: { createdAt: 'asc' },
  });

  const purged = [];
  const skipped = [];
  for (const user of inactiveUsers) {
    const referenceCount = await countUserReferences(user.id);
    if (referenceCount > 0) {
      skipped.push({ ...user, referenceCount, reason: 'HAS_REFERENCES' });
      continue;
    }
    try {
      await prisma.user.delete({ where: { id: user.id } });
      purged.push({ ...user, referenceCount });
    } catch (e) {
      skipped.push({
        ...user,
        referenceCount,
        reason: 'DELETE_BLOCKED',
        message: e?.message || 'delete failed',
      });
    }
  }

  res.json({ ok: true, purged, skipped, totalPurged: purged.length, totalSkipped: skipped.length });
}));

router.get('/:id', requireAction('users', 'read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: pubWithDept });
  if (!user) throw NotFound();
  res.json({ ok: true, item: user });
}));

router.post('/', requireAction('users', 'create'), asyncHandler(async (req, res) => {
  // Zod: password إلزامي عند إنشاء مستخدم جديد (لا نصنع مستخدم بلا كلمة سر)
  const body = validateCreate({ ...req.body, password: req.body?.password });
  if (!body.password) throw Conflict('كلمة المرور إلزامية عند إنشاء مستخدم جديد');
  // QM cannot create a SUPER_ADMIN
  assertCanAssignRole(req.user, body.role);

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
    select: pubWithDept,
  });
  res.status(201).json({ ok: true, item: user });
}));

router.put('/:id', requireAction('users', 'update'), asyncHandler(async (req, res) => {
  const body = validateUpdate(req.body);
  // كلمة المرور لا تمر عبر schema العام — تبقى منفصلة حتى لا تُسرَّب عبر عمليات تعديل عامة
  const password = req.body?.password;

  // SUPER_ADMIN protection: QM cannot edit a SA, and cannot promote anyone TO SA
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
  if (!target) throw NotFound();
  assertCanTouchTargetUser(req.user, target);
  assertCanAssignRole(req.user, body.role);

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
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: pubWithDept });
  res.json({ ok: true, item: user });
}));

router.delete('/:id', requireAction('users', 'delete'), asyncHandler(async (req, res) => {
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

// POST /:id/restore — إعادة تفعيل مستخدم مُعطَّل (SUPER_ADMIN فقط — تماثل DELETE)
router.post('/:id/restore', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw NotFound();
  if (user.active) throw Conflict('المستخدم نشط بالفعل');
  const restored = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: true },
    select: pubWithDept,
  });
  res.json({ ok: true, item: restored });
}));

export default router;
