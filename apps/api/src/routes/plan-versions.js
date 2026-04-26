import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { createSchema, updateSchema } from '../schemas/planVersion.schema.js';

// Read-only CRUD router — create/update/delete are intentionally omitted from the
// standard routes; writes only happen via the POST /snapshot endpoint below.
const base = crudRouter({
  resource: 'plan-versions',
  model: 'strategicPlanVersion',
  allowedFilters: ['planId'],
  softDelete: false,
  schemas: { create: createSchema, update: updateSchema },
  include: {
    createdBy: { select: { id: true, name: true } },
  },
});

const router = Router();

/**
 * POST /api/plan-versions/snapshot
 * Body: { planId, reason }
 * Builds a full JSON snapshot of the strategic plan and saves it as a new version.
 */
router.post('/snapshot', requireAction('plan-versions', 'create'), asyncHandler(async (req, res) => {
  const { planId, reason } = req.body;

  if (!planId) {
    throw BadRequest('يجب توفير planId في جسم الطلب');
  }

  // Fetch the plan with its full hierarchy (goals → objectives → indicators)
  const plan = await prisma.strategicPlan.findUnique({
    where: { id: planId },
    include: {
      goals: {
        where: { deletedAt: null },
        include: {
          axis: { select: { id: true, code: true, nameAr: true } },
          objectives: {
            where: { deletedAt: null },
            include: {
              indicators: {
                where: { deletedAt: null },
                select: {
                  id: true, code: true, nameAr: true, nameEn: true,
                  indicatorType: true, weight: true, baseline: true,
                  unit: true, direction: true, ownerId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    throw NotFound('الخطة الاستراتيجية غير موجودة');
  }

  // Determine next version number
  const latest = await prisma.strategicPlanVersion.findFirst({
    where: { planId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.strategicPlanVersion.create({
    data: {
      planId,
      version: nextVersion,
      reason: reason ?? null,
      trigger: 'MANUAL',
      createdById: req.user.sub,
      snapshot: plan,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ ok: true, item: version });
}));

router.use('/', base);

export default router;
