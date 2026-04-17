import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';

const base = crudRouter({
  model: 'strategicGoal',
  codePrefix: 'STR',
  searchFields: ['title', 'perspective', 'kpi', 'initiatives', 'responsible'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'startYear', 'endYear'],
});

const router = Router();

/**
 * GET /api/strategic-goals/:id/summary
 * Returns a goal with auto-computed progress from linked activities/objectives + linked risks
 */
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const goal = await prisma.strategicGoal.findUnique({
    where: { id: req.params.id },
    include: {
      activities: true,
      objectives: true,
      risks: true,
    },
  });
  if (!goal) return res.status(404).json({ ok: false, error: { message: 'غير موجود' } });

  const acts = goal.activities || [];
  const objs = goal.objectives || [];
  const computedProgress = (() => {
    const all = [...acts.map(a => a.progress || 0), ...objs.map(o => o.progress || 0)];
    if (!all.length) return goal.progress || 0;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  })();

  const totalBudget = acts.reduce((s, a) => s + (a.budget || 0), 0);
  const totalSpent  = acts.reduce((s, a) => s + (a.spent || 0), 0);

  res.json({
    ok: true,
    goal,
    summary: {
      activitiesCount:  acts.length,
      objectivesCount:  objs.length,
      risksCount:       goal.risks.length,
      computedProgress,
      totalBudget,
      totalSpent,
      budgetUtilization: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    },
  });
}));

/**
 * PATCH /api/strategic-goals/:id/recompute
 * Sync progress from linked activities + objectives
 */
router.patch('/:id/recompute', asyncHandler(async (req, res) => {
  const goal = await prisma.strategicGoal.findUnique({
    where: { id: req.params.id },
    include: { activities: true, objectives: true },
  });
  if (!goal) return res.status(404).json({ ok: false, error: { message: 'غير موجود' } });

  const all = [
    ...(goal.activities || []).map(a => a.progress || 0),
    ...(goal.objectives || []).map(o => o.progress || 0),
  ];
  const progress = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;

  const updated = await prisma.strategicGoal.update({
    where: { id: req.params.id },
    data: { progress },
  });
  res.json({ ok: true, item: updated });
}));

router.use('/', base);

export default router;
