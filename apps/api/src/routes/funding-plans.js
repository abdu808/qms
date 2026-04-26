import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema, updateSchema } from '../schemas/fundingPlan.schema.js';

const base = crudRouter({
  resource: 'funding-plans',
  model: 'fundingPlan',
  allowedFilters: ['planId', 'year', 'sourceId'],
  softDelete: false,
  schemas: { create: createSchema, update: updateSchema },
  include: {
    source: { select: { id: true, code: true, name: true, type: true } },
  },
});

const router = Router();

/**
 * GET /api/funding-plans/concentration
 * Query params: planId (required), year (required)
 * Returns per-source funding breakdown with concentration limit checks.
 */
router.get('/concentration', requireAction('funding-plans', 'read'), asyncHandler(async (req, res) => {
  const { planId, year } = req.query;

  if (!planId || !year) {
    throw BadRequest('يجب توفير planId و year كمعاملات في الطلب');
  }

  const yearInt = parseInt(year, 10);
  if (!Number.isFinite(yearInt)) {
    throw BadRequest('يجب أن تكون قيمة year رقمًا صحيحًا');
  }

  const fundingPlans = await prisma.fundingPlan.findMany({
    where: { planId, year: yearInt },
    include: {
      source: { select: { id: true, code: true, name: true, type: true } },
    },
  });

  const totalExpected = fundingPlans.reduce((sum, fp) => sum + (fp.expectedAmount || 0), 0);

  const items = fundingPlans.map((fp) => {
    const expected = fp.expectedAmount || 0;
    const actual   = fp.actualAmount   || 0;
    const pct      = totalExpected > 0 ? Math.round((expected / totalExpected) * 100) : 0;
    // concentrationLimit lives on the FundingPlan row itself (per-plan-source override)
    const limit    = fp.concentrationLimit ?? 35;
    const exceeds  = pct > limit;

    return {
      sourceId:   fp.sourceId,
      sourceName: fp.source?.name ?? null,
      expected,
      actual,
      pct,
      limit,
      exceeds,
    };
  });

  res.json({ ok: true, planId, year: yearInt, totalExpected, items });
}));

router.use('/', base);

export default router;
