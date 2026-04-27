import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { authorize } from '../middleware/auth.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { NotFound } from '../utils/errors.js';

const base = crudRouter({
  resource: 'strategic-goals',
  model: 'strategicGoal',
  codePrefix: 'STR',
  searchFields: ['title', 'perspective', 'kpi', 'legacyInitiatives', 'responsible'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'startYear', 'endYear'],
  // Plan Freeze: once the parent strategic plan is frozen, master fields on the goal
  // are locked. transactionFields below remain editable (operational follow-up).
  enforceFreezeFor: async (id, prisma) => {
    const g = await prisma.strategicGoal.findUnique({
      where: { id }, select: { planId: true },
    });
    return g?.planId || null;
  },
  transactionFields: ['progress', 'status', 'responsible'],
});

const router = Router();

/**
 * GET /api/strategic-goals/:id/summary
 * Returns a goal with auto-computed progress from linked activities/objectives + linked risks
 */
router.get('/:id/summary', requireAction('strategic-goals', 'read'), asyncHandler(async (req, res) => {
  const goal = await prisma.strategicGoal.findFirst({
    where: activeWhere({ id: req.params.id }),
    include: {
      activities: true,
      objectives: true,
      risks: true,
    },
  });
  if (!goal) throw NotFound('الهدف الاستراتيجي غير موجود');

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
router.patch('/:id/recompute', requireAction('strategic-goals', 'update'), asyncHandler(async (req, res) => {
  const goal = await prisma.strategicGoal.findFirst({
    where: activeWhere({ id: req.params.id }),
    include: { activities: true, objectives: true },
  });
  if (!goal) throw NotFound('الهدف الاستراتيجي غير موجود');

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

/**
 * DELETE /api/strategic-goals/reset
 * حذف جميع بيانات الخطة الاستراتيجية والتشغيلية (SUPER_ADMIN فقط)
 *
 * حماية:
 *   - يتطلّب body.confirm === 'RESET-STRATEGIC-PLAN' (رمز تأكيد صريح)
 *   - يُنشئ نسخة JSON من البيانات قبل الحذف ويُعيد مسارها في الاستجابة
 */
// قفل منع التنفيذ المتزامن لعملية الـ reset (عملية مدمِّرة + كتابة ملف backup)
let _resetInProgress = false;

router.delete('/reset', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const CONFIRM = 'RESET-STRATEGIC-PLAN';
  if (req.body?.confirm !== CONFIRM) {
    return res.status(400).json({
      ok: false,
      error: `هذه عملية مدمِّرة. أرسل body.confirm="${CONFIRM}" للتأكيد.`,
    });
  }
  // قفل — يُرفض الطلب الثاني المتزامن
  if (_resetInProgress) {
    return res.status(409).json({
      ok: false,
      error: 'عملية إعادة تعيين أخرى قيد التنفيذ — انتظر حتى تكتمل.',
      code: 'RESET_IN_PROGRESS',
    });
  }
  _resetInProgress = true;
  // try/finally لضمان تحرير القفل في كل الحالات
  try {

  // 0️⃣ نسخة احتياطية JSON قبل الحذف
  const snapshot = {
    timestamp:              new Date().toISOString(),
    byUserId:               req.user?.sub || null,
    strategicGoals:         await prisma.strategicGoal.findMany(),
    objectives:             await prisma.objective.findMany(),
    operationalActivities:  await prisma.operationalActivity.findMany(),
    kpiEntries:             await prisma.kpiEntry.findMany(),
  };
  const { writeFile, mkdir } = await import('fs/promises');
  const { join } = await import('path');
  const backupDir  = process.env.QMS_BACKUP_DIR || '/app/uploads/backups';
  await mkdir(backupDir, { recursive: true }).catch(() => {});
  const backupPath = join(backupDir, `strategic-plan-${Date.now()}.json`);
  await writeFile(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');

  // 1️⃣ فك ربط المخاطر بالأهداف (لا نحذف المخاطر)
  const unlinked = await prisma.risk.updateMany({
    where: { strategicGoalId: { not: null } },
    data:  { strategicGoalId: null },
  });

  // 2️⃣ حذف بالترتيب الصحيح (FK)
  const kpi = await prisma.kpiEntry.deleteMany({});
  const obj = await prisma.objective.deleteMany({});
  const act = await prisma.operationalActivity.deleteMany({});
  const gol = await prisma.strategicGoal.deleteMany({});

  res.json({
    ok: true,
    backup: backupPath,
    deleted: {
      kpiEntries:           kpi.count,
      objectives:           obj.count,
      operationalActivities: act.count,
      strategicGoals:        gol.count,
      risksUnlinked:         unlinked.count,
    },
  });
  } finally {
    _resetInProgress = false;
  }
}));

router.use('/', base);

export default router;
