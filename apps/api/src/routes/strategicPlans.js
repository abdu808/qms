import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { NotFound } from '../utils/errors.js';

const base = crudRouter({
  resource: 'strategic-plans',
  model: 'strategicPlan',
  codePrefix: 'PLAN',
  searchFields: ['title', 'description'],
  allowedSortFields: ['createdAt', 'status', 'startYear', 'endYear', 'code'],
});

const router = Router();

/**
 * GET /api/strategic-plans/:id/goals
 * جميع الأهداف الاستراتيجية المرتبطة بخطة معينة
 */
router.get('/:id/goals', requireAction('strategic-plans', 'read'), asyncHandler(async (req, res) => {
  const plan = await prisma.strategicPlan.findFirst({
    where: activeWhere({ id: req.params.id }),
  });
  if (!plan) throw NotFound('الخطة الاستراتيجية غير موجودة');

  const goals = await prisma.strategicGoal.findMany({
    where: { planId: req.params.id, deletedAt: null },
    orderBy: { code: 'asc' },
    include: {
      activities: { where: { deletedAt: null }, select: { id: true, code: true, title: true, progress: true, status: true } },
      objectives: { where: { deletedAt: null }, select: { id: true, code: true, title: true, progress: true, status: true } },
    },
  });

  const totalProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length)
    : 0;

  res.json({
    ok: true,
    plan,
    goals,
    summary: {
      total: goals.length,
      averageProgress: totalProgress,
      byStatus: goals.reduce((acc, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {}),
    },
  });
}));

/**
 * POST /api/strategic-plans/:id/activate
 * تفعيل الخطة (DRAFT → ACTIVE) وأرشفة الخطط النشطة الأخرى
 */
router.post('/:id/activate', requireAction('strategic-plans', 'update'), asyncHandler(async (req, res) => {
  const plan = await prisma.strategicPlan.findFirst({
    where: activeWhere({ id: req.params.id }),
  });
  if (!plan) throw NotFound('الخطة الاستراتيجية غير موجودة');
  if (plan.status === 'ACTIVE') {
    return res.json({ ok: true, message: 'الخطة نشطة بالفعل', plan });
  }

  const [, activated] = await prisma.$transaction([
    // أرشفة الخطط النشطة الأخرى
    prisma.strategicPlan.updateMany({
      where: { status: 'ACTIVE', id: { not: req.params.id }, deletedAt: null },
      data: { status: 'ARCHIVED' },
    }),
    // تفعيل الخطة الحالية
    prisma.strategicPlan.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    }),
  ]);

  res.json({ ok: true, plan: activated });
}));

router.use('/', base);

export default router;
