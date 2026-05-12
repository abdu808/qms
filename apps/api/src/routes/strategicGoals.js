import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { authorize } from '../middleware/auth.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { NotFound } from '../utils/errors.js';
import { buildPlanConnectivity } from '../lib/planConnectivity.js';

const base = crudRouter({
  resource: 'strategic-goals',
  model: 'strategicGoal',
  codePrefix: 'STR',
  searchFields: ['title', 'perspective', 'kpi', 'legacyInitiatives', 'responsible'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'startYear', 'endYear'],
  // إرجاع اسم المحور + أعداد الأنشطة والمبادرات (النموذج المعتمد: هدف -> مؤشرات/أنشطة)
  include: {
    axis:   { select: { id: true, nameAr: true, code: true, color: true } },
    _count: {
      select: {
        activities: { where: { deletedAt: null } },
        objectives: { where: { deletedAt: null } },
        initiatives: { where: { deletedAt: null } },
      },
    },
  },
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
 * GET /api/strategic-goals/plan-map
 * Lightweight plan connectivity map:
 * Axis -> StrategicGoal -> Indicators + OperationalActivities -> KPI entries.
 * Objective remains optional/legacy and is not treated as a required layer.
 */
router.get('/plan-map', requireAction('strategic-goals', 'read'), asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const map = await buildPlanConnectivity({ year });
  res.json(map);
}));

/**
 * GET /api/strategic-goals/plan-map/export.xlsx
 * Full plan export: Axis -> Strategic Goal -> Indicator/Activity/Initiative.
 */
router.get('/plan-map/export.xlsx', requireAction('strategic-goals', 'read'), asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const map = await buildPlanConnectivity({ year });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QMS - جمعية البر بصبيا';
  wb.created = new Date();

  const styleHeader = (ws) => {
    ws.views = [{ rightToLeft: true }];
    ws.getRow(1).height = 24;
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E8B57' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });
  };
  const styleRows = (ws) => {
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9F4' } };
        });
      }
    });
  };
  const goalStatus = (goal) => {
    const blocking = (goal?.issues || []).some(i => i.severity === 'ERROR');
    const warnings = (goal?.issues || []).some(i => i.severity === 'WARNING');
    const hasIndicators = (goal?.indicators || []).length || (goal?.supportingAxisIndicators || []).length;
    const hasActivities = (goal?.activities || []).length;
    if (blocking) return 'يحتاج تصحيح';
    if (!hasIndicators) return 'بلا قياس';
    if (!hasActivities) return 'بلا نشاط';
    if (warnings) return 'يحتاج ضبط';
    return 'مكتمل للمتابعة';
  };
  const statusBreakdown = (map.goals || []).reduce((acc, goal) => {
    const status = goalStatus(goal);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const urgentGoals = (statusBreakdown['يحتاج تصحيح'] || 0) + (statusBreakdown['بلا قياس'] || 0) + (statusBreakdown['بلا نشاط'] || 0);
  const readyGoals = statusBreakdown['مكتمل للمتابعة'] || 0;
  const executiveVerdict = (map.summary?.score || 0) >= 85 && urgentGoals === 0
    ? 'جاهزة للمتابعة التشغيلية'
    : ((map.summary?.score || 0) < 65 || urgentGoals > 0)
      ? 'تحتاج معالجة مركزة قبل التعميم'
      : 'تحتاج ضبط قبل الاعتماد التشغيلي';

  const executive = wb.addWorksheet('تقرير تنفيذي');
  executive.columns = [
    { header: 'البند', key: 'label', width: 34 },
    { header: 'القيمة', key: 'value', width: 44 },
  ];
  [
    ['السنة', year || 'كل السنوات'],
    ['درجة صحة الخطة', `${map.summary?.score ?? 0}%`],
    ['قرار القراءة', executiveVerdict],
    ['الأهداف الجاهزة للمتابعة', readyGoals],
    ['الأهداف التي تحتاج معالجة', urgentGoals],
    ['المشكلات', map.summary?.errors ?? 0],
    ['التنبيهات', map.summary?.warnings ?? 0],
  ].forEach(([label, value]) => executive.addRow({ label, value }));
  executive.addRow({});
  executive.addRow({ label: 'توزيع حالات الأهداف', value: Object.entries(statusBreakdown).map(([label, count]) => `${label}: ${count}`).join(' | ') });
  executive.addRow({});
  executive.addRow({ label: 'أهم الإجراءات المقترحة', value: '' });
  (map.nextActions || []).slice(0, 8).forEach((item, idx) => {
    executive.addRow({ label: `${idx + 1}. ${item.label || 'إجراء مطلوب'}`, value: item.recommendation || '' });
  });
  styleHeader(executive);
  styleRows(executive);

  const hierarchy = wb.addWorksheet('الخطة الكاملة');
  hierarchy.columns = [
    { header: 'المحور', key: 'axis', width: 30 },
    { header: 'رمز الهدف', key: 'goalCode', width: 16 },
    { header: 'الهدف الاستراتيجي', key: 'goalTitle', width: 38 },
    { header: 'النوع', key: 'type', width: 14 },
    { header: 'الرمز', key: 'code', width: 18 },
    { header: 'العنصر', key: 'name', width: 45 },
    { header: 'المالك/المسؤول', key: 'owner', width: 24 },
    { header: 'الإدارة/القسم', key: 'department', width: 24 },
    { header: 'تردد القياس/السنة', key: 'frequency', width: 18 },
    { header: 'المستهدفات', key: 'targets', width: 26 },
    { header: 'الحالة/التقدم', key: 'status', width: 18 },
  ];

  for (const goal of map.goals || []) {
    const base = {
      axis: goal.axis?.nameAr || 'بلا محور',
      goalCode: goal.code || '',
      goalTitle: goal.title || '',
    };
    const indicators = [...(goal.indicators || []), ...(goal.supportingAxisIndicators || [])];
    if (!indicators.length && !(goal.activities || []).length && !(goal.initiatives || []).length) {
      hierarchy.addRow({ ...base, type: 'هدف', code: goal.code, name: goal.title, owner: goal.owner?.name || goal.responsible || '', status: goal.status || '' });
    }
    for (const ind of indicators) {
      hierarchy.addRow({
        ...base,
        type: goal.indicators?.some(x => x.id === ind.id) ? 'مؤشر مباشر' : 'مؤشر داعم',
        code: ind.code || '',
        name: ind.nameAr || '',
        owner: ind.owner?.name || '',
        department: ind.ownerDept?.name || ind.dataEntryDept?.name || '',
        frequency: ind.frequency || '',
        targets: (ind.targets || []).map(t => `${t.year}: ${t.targetValue}`).join(' | '),
        status: ind.unit || '',
      });
    }
    for (const act of goal.activities || []) {
      hierarchy.addRow({
        ...base,
        type: 'نشاط',
        code: act.code || '',
        name: act.title || '',
        owner: act.owner?.name || '',
        department: act.dept?.name || '',
        frequency: act.year || '',
        targets: act.indicator ? `${act.indicator.code} - ${act.indicator.nameAr}` : '',
        status: `${act.status || ''} ${act.progress ?? 0}%`.trim(),
      });
    }
    for (const ini of goal.initiatives || []) {
      hierarchy.addRow({
        ...base,
        type: 'مبادرة',
        code: ini.code || '',
        name: ini.name || '',
        owner: ini.owner?.name || '',
        department: ini.department?.name || '',
        frequency: '',
        targets: '',
        status: `${ini.status || ''} ${ini.progress ?? 0}%`.trim(),
      });
    }
  }
  styleHeader(hierarchy);
  styleRows(hierarchy);

  const indicatorsSheet = wb.addWorksheet('المؤشرات');
  indicatorsSheet.columns = [
    { header: 'الرمز', key: 'code', width: 16 },
    { header: 'المؤشر', key: 'name', width: 45 },
    { header: 'المحور', key: 'axis', width: 28 },
    { header: 'الوحدة', key: 'unit', width: 12 },
    { header: 'التردد', key: 'frequency', width: 14 },
    { header: 'المالك', key: 'owner', width: 22 },
    { header: 'مدخل البيانات', key: 'dataEntryUser', width: 22 },
    { header: 'المعتمد', key: 'approver', width: 22 },
    { header: 'مصدر البيانات', key: 'dataSource', width: 32 },
    { header: 'المستهدفات', key: 'targets', width: 26 },
  ];
  for (const ind of map.indicators || []) {
    indicatorsSheet.addRow({
      code: ind.code || '',
      name: ind.nameAr || '',
      axis: ind.axis?.nameAr || '',
      unit: ind.unit || '',
      frequency: ind.frequency || '',
      owner: ind.owner?.name || '',
      dataEntryUser: ind.dataEntryUser?.name || '',
      approver: ind.approver?.name || '',
      dataSource: ind.dataSource || '',
      targets: (ind.targets || []).map(t => `${t.year}: ${t.targetValue}`).join(' | '),
    });
  }
  styleHeader(indicatorsSheet);
  styleRows(indicatorsSheet);

  const summary = wb.addWorksheet('ملخص');
  summary.columns = [{ header: 'البند', key: 'label', width: 34 }, { header: 'القيمة', key: 'value', width: 24 }];
  [
    ['الخطة', map.plan?.title || ''],
    ['السنة', year || 'كل السنوات'],
    ['درجة الصحة', `${map.summary?.score ?? 0}%`],
    ['المحاور', map.summary?.axes ?? 0],
    ['الأهداف', map.summary?.goals ?? 0],
    ['المؤشرات', map.summary?.indicators ?? 0],
    ['الأنشطة', map.summary?.activities ?? 0],
    ['المشكلات', map.summary?.errors ?? 0],
    ['التنبيهات', map.summary?.warnings ?? 0],
  ].forEach(([label, value]) => summary.addRow({ label, value }));
  styleHeader(summary);
  styleRows(summary);

  const filename = encodeURIComponent(`الخطة-الكاملة-${year || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  await wb.xlsx.write(res);
  res.end();
}));

/**
 * GET /api/strategic-goals/plan-health
 * Compact health summary for AI/tools and dashboards.
 */
router.get('/plan-health', requireAction('strategic-goals', 'read'), asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const map = await buildPlanConnectivity({ year });
  res.json({
    ok: true,
    operatingModel: map.operatingModel,
    summary: map.summary,
    acceptanceCriteria: map.acceptanceCriteria,
    nextActions: map.nextActions,
    issues: map.issues,
  });
}));

/**
 * GET /api/strategic-goals/:id/summary
 * Returns a goal with auto-computed progress from linked activities/objectives + linked risks
 */
router.get('/:id/summary', requireAction('strategic-goals', 'read'), asyncHandler(async (req, res) => {
  const goal = await prisma.strategicGoal.findFirst({
    where: activeWhere({ id: req.params.id }),
    include: {
      activities: { where: { deletedAt: null } },
      objectives: { where: { deletedAt: null } },
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
