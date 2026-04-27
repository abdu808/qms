import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { createSchema, updateSchema } from '../schemas/indicator.schema.js';

const base = crudRouter({
  resource: 'indicators',
  model: 'indicator',
  codePrefix: 'IND',
  allowedFilters: ['objectiveId', 'ownerId', 'indicatorType', 'deletedAt'],
  softDelete: true,
  schemas: { create: createSchema, update: updateSchema },
  // Plan Freeze: indicator → objective → goal → plan
  // Once the plan is frozen, master fields lock; only ownership/notes remain editable.
  enforceFreezeFor: async (id, prisma) => {
    const ind = await prisma.indicator.findUnique({
      where: { id },
      select: { objective: { select: { goal: { select: { planId: true } } } } },
    });
    return ind?.objective?.goal?.planId || null;
  },
  transactionFields: ['ownerId', 'dataEntryUserId', 'approverUserId', 'notes'],
  include: {
    objective: { select: { id: true, title: true } },
    owner: { select: { id: true, name: true } },
  },
});

const router = Router();

/**
 * GET /api/indicators/weight-check
 * Returns sum of weights across all non-deleted indicators, optionally filtered by planId.
 */
router.get('/weight-check', requireAction('indicators', 'read'), asyncHandler(async (req, res) => {
  const { planId } = req.query;

  let where = { deletedAt: null };

  if (planId) {
    // Filter indicators belonging to the given strategic plan via:
    // StrategicPlan → StrategicGoal → Objective → Indicator
    where = {
      deletedAt: null,
      objective: {
        goal: {
          planId,
        },
      },
    };
  }

  const items = await prisma.indicator.findMany({
    where,
    select: { id: true, code: true, nameAr: true, weight: true },
  });

  const total = items.reduce((sum, i) => sum + (i.weight || 0), 0);
  const remaining = 100 - total;
  const isValid = total === 100;

  res.json({ ok: true, total, remaining, isValid, items });
}));

router.use('/', base);

export default router;
