import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema, updateSchema } from '../schemas/annualTarget.schema.js';

const base = crudRouter({
  resource: 'annual-targets',
  model: 'annualTarget',
  allowedFilters: ['indicatorId', 'year'],
  softDelete: false,
  schemas: { create: createSchema, update: updateSchema },
  // Plan Freeze: target → indicator → objective → goal → plan
  // Once the plan is frozen, target values lock — must go through change-request workflow.
  enforceFreezeFor: async (id, prisma) => {
    const t = await prisma.annualTarget.findUnique({
      where: { id },
      select: {
        indicator: { select: { objective: { select: { goal: { select: { planId: true } } } } } },
      },
    });
    return t?.indicator?.objective?.goal?.planId || null;
  },
  // Quarter sub-targets and the (mandatory) modificationReason are operational
  // adjustments and remain editable while the parent plan is frozen.
  transactionFields: ['q1Target', 'q2Target', 'q3Target', 'q4Target', 'modificationReason'],
  include: {
    indicator: { select: { id: true, code: true, nameAr: true } },
    createdBy: { select: { id: true, name: true } },
  },
  // Prisma checked-input fix: relations must use connect syntax.
  // Same pattern as NCR-BUG-001 fix in routes/ncr.js.
  beforeCreate: async (data, req) => {
    if (data.indicatorId) {
      data.indicator = { connect: { id: data.indicatorId } };
      delete data.indicatorId;
    }
    const creatorId = data.createdById || req.user?.sub;
    if (creatorId) {
      data.createdBy = { connect: { id: creatorId } };
      delete data.createdById;
    }
    return data;
  },
  beforeUpdate: async (data, req) => {
    if (data.targetValue !== undefined) {
      if (!data.modificationReason || String(data.modificationReason).trim() === '') {
        throw BadRequest('يجب توفير سبب التعديل (modificationReason) عند تغيير القيمة المستهدفة');
      }

      // Fetch current record to build audit log details
      const existing = await prisma.annualTarget.findUnique({
        where: { id: req.params.id },
      });

      if (existing && existing.targetValue !== data.targetValue) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.sub,
            action: 'UPDATE_ANNUAL_TARGET',
            entityType: 'annual-targets',
            entityId: existing.id,
            changesJson: JSON.stringify({
              oldValue: existing.targetValue,
              newValue: data.targetValue,
              year: existing.year,
              reason: data.modificationReason,
            }),
            ipAddress: req.ip || null,
            userAgent: req.get?.('user-agent') || null,
          },
        });
      }
    }
    return data;
  },
});

const router = Router();

/**
 * GET /api/annual-targets/:indicatorId/history
 * Returns all AnnualTargets for a given indicator, ordered by year desc.
 */
router.get('/:indicatorId/history', requireAction('annual-targets', 'read'), asyncHandler(async (req, res) => {
  const items = await prisma.annualTarget.findMany({
    where: { indicatorId: req.params.indicatorId },
    orderBy: { year: 'desc' },
    include: {
      indicator: { select: { id: true, code: true, nameAr: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  res.json({ ok: true, items });
}));

router.use('/', base);

export default router;
