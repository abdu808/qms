/**
 * routes/change-requests.js — نظام طلبات تعديل الحقول المقفولة
 *
 * يسمح للأدوار التي لا تملك صلاحية التعديل المباشر (DEPT_MANAGER/EMPLOYEE
 * على الحقول الحاكمة) بفتح طلب تعديل للمراجعة من قبل QUALITY_MANAGER/SUPER_ADMIN.
 * عند الاعتماد، يطبَّق التغيير على المورد الأصلي ضمن transaction واحدة.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';
import { nextCode } from '../utils/codeGen.js';

const router = Router();

// خريطة resource → اسم نموذج Prisma (camelCase)
const RESOURCE_TO_MODEL = {
  'indicators':             'indicator',
  'objectives':             'objective',
  'annual-targets':         'annualTarget',
  'initiatives':            'initiative',
  'operational-activities': 'operationalActivity',
  'risks':                  'risk',
  'strategic-goals':        'strategicGoal',
};

// ─── LIST ────────────────────────────────────────────────────
router.get('/', requireAction('change-requests', 'read'), asyncHandler(async (req, res) => {
  const role = req.user?.role;
  const isReviewer = ['QUALITY_MANAGER', 'SUPER_ADMIN'].includes(role);
  const where = {};
  if (!isReviewer) where.requestedById = req.user.sub;
  if (req.query.status) where.status = req.query.status;
  const items = await prisma.changeRequest.findMany({
    where,
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy:  { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ ok: true, items, total: items.length });
}));

// ─── READ ────────────────────────────────────────────────────
router.get('/:id', requireAction('change-requests', 'read'), asyncHandler(async (req, res) => {
  const item = await prisma.changeRequest.findUnique({
    where: { id: req.params.id },
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy:  { select: { id: true, name: true } },
    },
  });
  if (!item) throw NotFound();
  const role = req.user?.role;
  const isReviewer = ['QUALITY_MANAGER', 'SUPER_ADMIN'].includes(role);
  if (!isReviewer && item.requestedById !== req.user.sub) throw Forbidden();
  res.json({ ok: true, item });
}));

// ─── CREATE ──────────────────────────────────────────────────
router.post('/', requireAction('change-requests', 'create'), asyncHandler(async (req, res) => {
  const { resource, resourceId, fieldName, oldValue, newValue, reason } = req.body;
  if (!resource || !resourceId || !fieldName || newValue === undefined || newValue === null || !reason?.trim()) {
    throw BadRequest('resource, resourceId, fieldName, newValue, reason كلها مطلوبة');
  }

  // محاولة التقاط عنوان المورد لعرضه في قائمة الطلبات (best-effort)
  let resourceTitle = null;
  try {
    const modelName = RESOURCE_TO_MODEL[resource];
    if (modelName && prisma[modelName]) {
      const rec = await prisma[modelName].findUnique({ where: { id: resourceId } });
      resourceTitle = rec?.title || rec?.nameAr || rec?.name || null;
    }
  } catch { /* ignore — العنوان اختياري */ }

  const code = await nextCode('changeRequest', 'CR');
  const item = await prisma.changeRequest.create({
    data: {
      code, resource, resourceId, resourceTitle, fieldName,
      oldValue: oldValue != null ? String(oldValue) : null,
      newValue: String(newValue),
      reason: reason.trim(),
      status: 'PENDING',
      requestedById: req.user.sub,
    },
    include: { requestedBy: { select: { id: true, name: true } } },
  });
  res.status(201).json({ ok: true, item });
}));

// ─── APPROVE ─────────────────────────────────────────────────
router.post('/:id/approve', requireAction('change-requests', 'approve'), asyncHandler(async (req, res) => {
  const cr = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
  if (!cr) throw NotFound();
  if (cr.status !== 'PENDING') throw BadRequest('الطلب ليس في حالة انتظار');
  const note = req.body?.note?.trim() || null;

  const modelName = RESOURCE_TO_MODEL[cr.resource];
  if (!modelName || !prisma[modelName]) throw BadRequest(`المورد ${cr.resource} غير مدعوم`);

  // تحويل بسيط للأرقام — السلاسل تبقى كما هي. للحقول الأخرى (تواريخ/booleans)
  // يمكن لاحقاً إضافة معالجة نوعية خاصة بكل field.
  let value = cr.newValue;
  if (!isNaN(Number(value)) && value !== '') value = Number(value);

  await prisma.$transaction(async (tx) => {
    await tx[modelName].update({
      where: { id: cr.resourceId },
      data: { [cr.fieldName]: value },
    });
    await tx.changeRequest.update({
      where: { id: cr.id },
      data: { status: 'APPROVED', reviewedById: req.user.sub, reviewedAt: new Date(), reviewerNote: note },
    });
  });

  const updated = await prisma.changeRequest.findUnique({
    where: { id: cr.id },
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy:  { select: { id: true, name: true } },
    },
  });
  res.json({ ok: true, item: updated });
}));

// ─── REJECT ──────────────────────────────────────────────────
router.post('/:id/reject', requireAction('change-requests', 'approve'), asyncHandler(async (req, res) => {
  const cr = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
  if (!cr) throw NotFound();
  if (cr.status !== 'PENDING') throw BadRequest('الطلب ليس في حالة انتظار');
  const note = req.body?.note?.trim();
  if (!note) throw BadRequest('سبب الرفض مطلوب');
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { status: 'REJECTED', reviewedById: req.user.sub, reviewedAt: new Date(), reviewerNote: note },
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy:  { select: { id: true, name: true } },
    },
  });
  res.json({ ok: true, item: updated });
}));

// ─── CANCEL (الطالب يلغي طلبه) ────────────────────────────────
router.post('/:id/cancel', requireAction('change-requests', 'create'), asyncHandler(async (req, res) => {
  const cr = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
  if (!cr) throw NotFound();
  if (cr.requestedById !== req.user.sub) throw Forbidden('يمكنك إلغاء طلباتك فقط');
  if (cr.status !== 'PENDING') throw BadRequest('الطلب ليس في حالة انتظار');
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { status: 'CANCELLED' },
  });
  res.json({ ok: true, item: updated });
}));

export default router;
