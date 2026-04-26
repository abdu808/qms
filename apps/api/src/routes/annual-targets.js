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
  include: {
    indicator: { select: { id: true, code: true, nameAr: true } },
    createdBy: { select: { id: true, name: true } },
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
            resource: 'annual-targets',
            resourceId: existing.id,
            details: {
              oldValue: existing.targetValue,
              newValue: data.targetValue,
              year: existing.year,
              reason: data.modificationReason,
            },
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
