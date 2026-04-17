import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';

// ISO 7.5 — only privileged roles may approve/publish documents
const APPROVE_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];
// Status transitions workflow
const ALLOWED_TRANSITIONS = {
  DRAFT:        ['UNDER_REVIEW', 'OBSOLETE'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'OBSOLETE'],
  APPROVED:     ['PUBLISHED', 'DRAFT', 'OBSOLETE'],
  PUBLISHED:    ['OBSOLETE', 'UNDER_REVIEW'],
  OBSOLETE:     [],
};

function canTransition(from, to) {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

const router = crudRouter({
  model: 'document',
  codePrefix: 'DOC',
  searchFields: ['title', 'code'],
  include: {
    department: true,
    createdBy:  { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    _count: { select: { acks: true, versions: true } },
  },
  allowedSortFields: ['createdAt', 'title', 'status'],
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub, status: 'DRAFT' }),
  beforeUpdate: async (data, req) => {
    // Strip approval fields — only /approve endpoint may set them
    delete data.approvedById;
    delete data.approvedAt;

    // Validate status transition if provided
    if (data.status) {
      const current = await prisma.document.findUnique({
        where: { id: req.params.id },
        select: { status: true },
      });
      if (current && !canTransition(current.status, data.status)) {
        throw BadRequest(`لا يمكن الانتقال من الحالة ${current.status} إلى ${data.status}`);
      }
      // Moving to APPROVED/PUBLISHED from generic update is blocked — must use /approve
      if (['APPROVED', 'PUBLISHED'].includes(data.status) && current?.status !== data.status) {
        throw BadRequest('يجب استخدام مسار الاعتماد الرسمي (/approve) لتفعيل الاعتماد أو النشر');
      }
    }
    return data;
  },
});

// POST /:id/approve — formal approval by authorized role
router.post('/:id/approve', asyncHandler(async (req, res) => {
  if (!APPROVE_ROLES.includes(req.user.role)) {
    throw Forbidden('فقط مدير الجودة أو مسؤول النظام يمكنه اعتماد الوثائق');
  }
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound();
  if (!['UNDER_REVIEW', 'APPROVED'].includes(doc.status)) {
    throw BadRequest('لا يمكن اعتماد الوثيقة إلا من حالة "قيد المراجعة" أو بعد اعتمادها');
  }
  const publish = req.body?.publish === true || req.body?.publish === 'true';
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: publish ? 'PUBLISHED' : 'APPROVED',
      approvedById: req.user.sub,
      approvedAt: new Date(),
      effectiveDate: publish ? new Date() : doc.effectiveDate,
    },
    include: { approvedBy: { select: { id: true, name: true } } },
  });
  res.json({ ok: true, item: updated });
}));

// POST /:id/obsolete — retire a document
router.post('/:id/obsolete', asyncHandler(async (req, res) => {
  if (!APPROVE_ROLES.includes(req.user.role)) {
    throw Forbidden('غير مصرح بسحب الوثيقة');
  }
  const updated = await prisma.document.update({
    where: { id: req.params.id },
    data: { status: 'OBSOLETE' },
  });
  res.json({ ok: true, item: updated });
}));

// Acknowledge a document
router.post('/:id/ack', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (doc.status !== 'PUBLISHED') {
    throw BadRequest('لا يمكن الإقرار إلا على الوثائق المنشورة');
  }
  const ack = await prisma.ack.upsert({
    where: { documentId_userId_version: { documentId: doc.id, userId: req.user.sub, version: doc.currentVersion } },
    update: { ackedAt: new Date() },
    create: { documentId: doc.id, userId: req.user.sub, version: doc.currentVersion },
  });
  res.json({ ok: true, item: ack });
}));

export default router;
