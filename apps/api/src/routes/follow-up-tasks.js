/**
 * routes/follow-up-tasks.js — مهام المتابعة (FollowUpTask)
 *
 * Audit task 8 (architectural):
 * تنشأ تلقائياً من قرارات/إجراءات Management Review عند الاعتماد،
 * ويمكن إنشاؤها يدوياً أيضاً (للحالات اليومية: ربط بـ NCR/CAPA/AUDIT).
 *
 * Lifecycle: OPEN → IN_PROGRESS → DONE | CANCELLED.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { z } from 'zod';
import { runSchema } from '../schemas/_helpers.js';

// Zod schemas — minimal، الجوهر هو الـ FK والتواريخ
const baseShape = {
  title:       z.string().min(2).max(500),
  description: z.string().max(8000).optional().nullable(),
  ownerId:     z.string().min(1, 'ownerId إلزامي'),
  dueDate:     z.preprocess(v => (v ? new Date(v) : v), z.date()),
  source:      z.enum(['MANAGEMENT_REVIEW', 'AUDIT', 'NCR', 'CAPA', 'MANUAL', 'NOTIFICATION', 'KPI_DEVIATION', 'SWOT']),
  sourceId:    z.string().min(1, 'sourceId إلزامي'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().nullable(),
  notes:       z.string().max(8000).optional().nullable(),
};
const createSchema = z.object(baseShape).strip();
const updateSchema = z.object({
  title:       z.string().min(2).max(500).optional(),
  description: z.string().max(8000).optional().nullable(),
  ownerId:     z.string().min(1).optional(),
  dueDate:     z.preprocess(v => (v ? new Date(v) : v), z.date()).optional(),
  status:      z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().nullable(),
  notes:       z.string().max(8000).optional().nullable(),
  completedAt: z.preprocess(v => (v ? new Date(v) : v), z.date()).optional().nullable(),
}).strip();

const validateCreate = runSchema(createSchema);
const validateUpdate = runSchema(updateSchema);

const base = crudRouter({
  resource: 'follow-up-tasks',
  model: 'followUpTask',
  codePrefix: 'FUT',
  searchFields: ['title', 'description'],
  allowedSortFields: ['createdAt', 'dueDate', 'status', 'priority'],
  allowedFilters: ['status', 'source', 'sourceId', 'ownerId', 'priority'],
  schemas: { create: createSchema, update: updateSchema },
  softDelete: true,
  smartFilters: {
    mine:     (req) => ({ ownerId: req.user.sub }),
    overdue:  ()    => ({ status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } }),
    open:     ()    => ({ status: { in: ['OPEN', 'IN_PROGRESS'] } }),
    done:     ()    => ({ status: 'DONE' }),
  },
  beforeCreate: async (data, req) => {
    return { ...data, createdById: req.user.sub };
  },
  beforeUpdate: async (data) => {
    if (data.status === 'DONE' && !data.completedAt) {
      data.completedAt = new Date();
    }
    if (data.status && data.status !== 'DONE') {
      data.completedAt = null;
    }
    return data;
  },
  include: {
    owner:     { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
  },
});

const router = Router();

/**
 * POST /api/follow-up-tasks/:id/complete — اختصار لإغلاق مهمة
 */
router.post('/:id/complete', requireAction('follow-up-tasks', 'update'), asyncHandler(async (req, res) => {
  const item = await prisma.followUpTask.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('المهمة غير موجودة');
  if (item.status === 'DONE') throw BadRequest('المهمة مكتملة بالفعل');
  const updated = await prisma.followUpTask.update({
    where: { id: req.params.id },
    data: { status: 'DONE', completedAt: new Date() },
    include: { owner: { select: { id: true, name: true } } },
  });
  res.json({ ok: true, item: updated });
}));

router.use('/', base);
export default router;
