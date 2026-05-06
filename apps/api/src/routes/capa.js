import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { runSchema } from '../schemas/_helpers.js';
import { capaCreateSchema, capaUpdateSchema } from '../schemas/capa.schema.js';

/**
 * guardCapaClose — يتحقق من اكتمال شروط إغلاق CAPA قبل تنفيذه.
 * دالة pure مُستخرجة من handler لتسهيل الاختبار (Audit task 17).
 */
export function guardCapaClose({ effective, implementedAction, verificationNote, verifiedById }) {
  const missing = [];
  if (!implementedAction || String(implementedAction).trim() === '') missing.push('الإجراء المُنفَّذ');
  if (!verificationNote  || String(verificationNote ).trim() === '') missing.push('ملاحظة التحقق');
  if (!verifiedById) missing.push('المُتحقِّق (verifiedBy)');
  if (effective === undefined || effective === null) missing.push('نتيجة الفعالية');
  if (missing.length) throw BadRequest(`لا يمكن إغلاق CAPA — الحقول الناقصة: ${missing.join('، ')}`);
  if (effective === false || effective === 'false') {
    throw BadRequest('CAPA غير فعالة (effective=false) — لا تُغلق. أعد فتحها للتخطيط من جديد.');
  }
}

const router = Router();
const validateCreate = runSchema(capaCreateSchema);
const validateUpdate = runSchema(capaUpdateSchema);

const INCLUDE = {
  owner:      { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
  ncr:        { select: { id: true, code: true, title: true } },
  complaint:  { select: { id: true, code: true, subject: true } },
  risk:       { select: { id: true, code: true, title: true } },
};

const STATUS_FLOW = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'VERIFICATION', VERIFICATION: 'CLOSED' };

// auto-generate code مثل CAPA-2026-001
async function genCode() {
  const year = new Date().getFullYear();
  const prefix = `CAPA-${year}-`;
  const last = await prisma.capa.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const seq = last ? parseInt(last.code.split('-')[2] || '0') + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET / — قائمة
router.get('/', requireAction('capa', 'read'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, type, sourceType } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = activeWhere({
    ...(status     && { status }),
    ...(type       && { type }),
    ...(sourceType && { sourceType }),
    ...(search     && { OR: [{ title: { contains: search } }, { code: { contains: search } }, { sourceCode: { contains: search } }] }),
  });
  const [items, total] = await Promise.all([
    prisma.capa.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
    prisma.capa.count({ where }),
  ]);
  res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}));

// POST / — إنشاء
router.post('/', requireAction('capa', 'create'), asyncHandler(async (req, res) => {
  const data = validateCreate(req.body);
  const item = await prisma.capa.create({
    data: { ...data, code: await genCode(), createdById: req.user.sub, status: 'OPEN' },
    include: INCLUDE,
  });
  res.status(201).json({ ok: true, item });
}));

// GET /by-source/:sourceType/:sourceId — CAPA مرتبطة بسجل محدد
// يجب تسجيله قبل /:id لتجنب التعارض
router.get('/by-source/:sourceType/:sourceId', requireAction('capa', 'read'), asyncHandler(async (req, res) => {
  const items = await prisma.capa.findMany({
    where: { deletedAt: null, sourceType: req.params.sourceType.toUpperCase(), sourceId: req.params.sourceId },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
}));

// GET /:id
router.get('/:id', requireAction('capa', 'read'), asyncHandler(async (req, res) => {
  const item = await prisma.capa.findFirst({ where: { id: req.params.id, deletedAt: null }, include: INCLUDE });
  if (!item) throw NotFound('CAPA غير موجود');
  res.json({ ok: true, item });
}));

// PATCH /:id
router.patch('/:id', requireAction('capa', 'update'), asyncHandler(async (req, res) => {
  const data = validateUpdate(req.body);
  if (!Object.keys(data).length) throw BadRequest('لا توجد بيانات للتحديث');
  const item = await prisma.capa.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('CAPA غير موجود');
  const updated = await prisma.capa.update({ where: { id: item.id }, data, include: INCLUDE });
  res.json({ ok: true, item: updated });
}));

// DELETE /:id — حذف ناعم
router.delete('/:id', requireAction('capa', 'delete'), asyncHandler(async (req, res) => {
  const item = await prisma.capa.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('CAPA غير موجود');
  await prisma.capa.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
}));

// POST /:id/advance — تقديم الحالة
router.post('/:id/advance', requireAction('capa', 'update'), asyncHandler(async (req, res) => {
  const item = await prisma.capa.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('CAPA غير موجود');
  const next = STATUS_FLOW[item.status];
  if (!next) throw BadRequest(`لا يمكن التقدم من حالة ${item.status}`);

  const update = { status: next };
  if (next === 'IN_PROGRESS') {
    const rootCause = req.body.rootCauseAnalysis ?? item.rootCauseAnalysis;
    const plannedAction = req.body.plannedAction ?? item.plannedAction;
    const ownerId = req.body.ownerId ?? item.ownerId;
    const dueDate = req.body.dueDate ?? item.dueDate;
    const missing = [];
    if (!ownerId) missing.push('مالك الإجراء');
    if (!dueDate) missing.push('تاريخ الاستحقاق');
    if (!rootCause || String(rootCause).trim() === '') missing.push('تحليل السبب الجذري');
    if (!plannedAction || String(plannedAction).trim() === '') missing.push('الإجراء المخطط');
    if (missing.length) {
      throw BadRequest(`لا يمكن بدء CAPA قبل اكتمال التخطيط — الحقول الناقصة: ${missing.join('، ')}`);
    }
    if (req.body.ownerId) update.ownerId = req.body.ownerId;
    if (req.body.dueDate) update.dueDate = new Date(req.body.dueDate);
    if (req.body.rootCauseAnalysis) update.rootCauseAnalysis = String(req.body.rootCauseAnalysis).trim();
    if (req.body.plannedAction) update.plannedAction = String(req.body.plannedAction).trim();
  }
  if (next === 'VERIFICATION') {
    // الانتقال إلى التحقق يتطلب دليل تنفيذ
    const implAction = req.body.implementedAction || item.implementedAction;
    if (!implAction || String(implAction).trim() === '') {
      throw BadRequest('لا يمكن الانتقال إلى التحقق بدون تسجيل الإجراء المُنفَّذ (implementedAction)');
    }
    if (req.body.implementedAction) update.implementedAction = req.body.implementedAction;
    update.implementedAt = new Date();
  }
  if (next === 'CLOSED') {
    // ISO 10.2 — لا إغلاق بدون تحقق فعالية كامل
    const effective = req.body.effective !== undefined ? req.body.effective : item.effective;
    const verificationNote = req.body.verificationNote ?? item.verificationNote;
    const verifiedById = req.user?.sub || item.verifiedById;
    const implAction   = req.body.implementedAction || item.implementedAction;
    const missing = [];
    if (!implAction || String(implAction).trim() === '') missing.push('الإجراء المُنفَّذ');
    if (!verificationNote || String(verificationNote).trim() === '') missing.push('ملاحظة التحقق');
    if (!verifiedById) missing.push('المُتحقِّق (verifiedBy)');
    if (effective === undefined || effective === null) missing.push('نتيجة الفعالية');
    if (missing.length) {
      throw BadRequest(`لا يمكن إغلاق CAPA — الحقول الناقصة: ${missing.join('، ')}`);
    }
    if (effective === false || effective === 'false') {
      // CAPA غير فعالة — تُعاد إلى ACTION_PLANNED بدلاً من إغلاقها
      throw BadRequest('CAPA غير فعالة (effective=false) — لا تُغلق. أعد فتحها للتخطيط من جديد أو ابقها في VERIFICATION.');
    }
    if (req.body.verificationNote) update.verificationNote = req.body.verificationNote;
    if (req.body.effective !== undefined) update.effective = req.body.effective;
    if (req.body.lessonsLearned) update.lessonsLearned = req.body.lessonsLearned;
    update.closedAt    = new Date();
    update.verifiedAt  = item.verifiedAt || new Date();
    update.verifiedById = verifiedById;
  }

  const updated = await prisma.capa.update({ where: { id: item.id }, data: update, include: INCLUDE });
  res.json({ ok: true, item: updated });
}));

export default router;
