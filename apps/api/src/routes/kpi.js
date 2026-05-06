/**
 * routes/kpi.js — نظام متابعة الأداء الشهري
 * ──────────────────────────────────────────────────────────────
 *   POST   /entries                 — إدخال/تحديث قيمة شهرية (upsert)
 *   GET    /entries?year&month     — إدخالات شهر محدد
 *   GET    /matrix?year            — مصفوفة كاملة (heatmap)
 *   GET    /dashboard?year         — لوحة تنفيذية (بطاقات + ملخص)
 *   GET    /objective/:id?year     — تفاصيل مؤشر استراتيجي
 *   GET    /activity/:id?year      — تفاصيل نشاط تشغيلي
 *   GET    /indicator/:id?year     — تفاصيل مؤشر أداء
 *   GET    /alerts?year&month      — التنبيهات النشطة
 */
import express from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';
import { evaluateKpi, expectedByMonth, actualByMonth, ragStatus, achievementRatio, forecastYearEnd, detectAlerts } from '../lib/kpi-engine.js';
import { createSchema as kpiCreateSchema } from '../schemas/kpiEntry.schema.js';
import { runSchema } from '../schemas/_helpers.js';
import { upsertKpiEntry, isPeriodLocked } from '../services/kpi.js';
import { validateKpiEntryFKs } from '../lib/kpiEntry-integrity.js';
import { recomputeAfterEntry, recomputeIndicator } from '../services/rollup.js';
import { arabicSearchVariants } from '../utils/normalize.js';
import { frequencyLabel, isDueMonth } from '../lib/kpiFrequency.js';
import {
  activityScopeWhere,
  indicatorScopeWhere,
  initiativeScopeWhere,
  mergeScope,
  objectiveScopeWhere,
} from '../lib/accessScope.js';

const validateKpiEntry = runSchema(kpiCreateSchema);

const router = express.Router();
router.use(authenticate);

const currentMonth = () => new Date().getMonth() + 1;
const currentYear  = () => new Date().getFullYear();

// ─── Scope helper: can a user act on a specific KpiEntry? ───────────────
// SUPER_ADMIN / QUALITY_MANAGER  → full scope (any entry)
// COMMITTEE_MEMBER               → read-only scope (any entry, read only)
// DEPT_MANAGER                   → entries whose parent (objective/activity/indicator)
//                                  belongs to their department
// EMPLOYEE                       → only entries they themselves entered
// GUEST_AUDITOR                  → read-only
//
// `entry` may be either a full KpiEntry record, or { objectiveId, activityId,
// indicatorId, enteredById }. action ∈ {read, update, delete, submit, approve, reject}.
async function canAccessKpiEntry(user, entry, action) {
  if (!user?.role) return false;
  const role = user.role;
  if (role === 'SUPER_ADMIN' || role === 'QUALITY_MANAGER') return true;
  if (role === 'GUEST_AUDITOR' || role === 'COMMITTEE_MEMBER') return action === 'read';
  if (role === 'EMPLOYEE') {
    // Employees may only see/touch entries they themselves entered
    if (action !== 'read' && action !== 'update' && action !== 'submit') return false;
    return entry?.enteredById === user.sub;
  }
  if (role === 'DEPT_MANAGER') {
    if (!user.departmentId) return false;
    let parentDeptId = null;
    if (entry.objectiveId) {
      const o = await prisma.objective.findUnique({
        where: { id: entry.objectiveId }, select: { departmentId: true },
      });
      parentDeptId = o?.departmentId || null;
    } else if (entry.indicatorId) {
      const ind = await prisma.indicator.findUnique({
        where: { id: entry.indicatorId },
        select: {
          objective: { select: { departmentId: true } },
          owner: { select: { departmentId: true } },
          dataEntryUser: { select: { departmentId: true } },
          approver: { select: { departmentId: true } },
        },
      });
      const parentDeptIds = [
        ind?.objective?.departmentId,
        ind?.owner?.departmentId,
        ind?.dataEntryUser?.departmentId,
        ind?.approver?.departmentId,
      ].filter(Boolean);
      return parentDeptIds.includes(user.departmentId);
    } else if (entry.activityId) {
      const a = await prisma.operationalActivity.findUnique({
        where: { id: entry.activityId }, select: { deptId: true },
      });
      parentDeptId = a?.deptId || null;
    }
    return parentDeptId && parentDeptId === user.departmentId;
  }
  return false;
}

// Build a Prisma `where` filter that limits KpiEntry rows to the caller's scope.
async function kpiEntryScopeWhere(user) {
  const role = user?.role;
  if (!role) return { id: '___never___' };
  if (role === 'SUPER_ADMIN' || role === 'QUALITY_MANAGER' ||
      role === 'COMMITTEE_MEMBER' || role === 'GUEST_AUDITOR') {
    return {}; // full read scope
  }
  if (role === 'EMPLOYEE') return { enteredById: user.sub };
  if (role === 'DEPT_MANAGER') {
    if (!user.departmentId) return { id: '___never___' };
    return {
      OR: [
        { objective: { departmentId: user.departmentId } },
        { activity:  { deptId: user.departmentId } },
        { indicator: { objective: { departmentId: user.departmentId } } },
        { indicator: { owner: { departmentId: user.departmentId } } },
        { indicator: { dataEntryUser: { departmentId: user.departmentId } } },
        { indicator: { approver: { departmentId: user.departmentId } } },
      ],
    };
  }
  return { id: '___never___' };
}

async function canAccessKpiRecord(user, kind, id) {
  if (!user?.role || !id) return false;
  if (kind === 'objective') {
    return Boolean(await prisma.objective.findFirst({
      where: mergeScope({ id, deletedAt: null }, objectiveScopeWhere(user)),
      select: { id: true },
    }));
  }
  if (kind === 'activity') {
    return Boolean(await prisma.operationalActivity.findFirst({
      where: mergeScope({ id, deletedAt: null }, activityScopeWhere(user)),
      select: { id: true },
    }));
  }
  if (kind === 'indicator') {
    return Boolean(await prisma.indicator.findFirst({
      where: mergeScope({ id, deletedAt: null }, indicatorScopeWhere(user)),
      select: { id: true },
    }));
  }
  return false;
}

export { canAccessKpiEntry, kpiEntryScopeWhere };

// ─── upsert قيمة شهرية ────────────────────────────────────────
router.post('/entries', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    // Zod موحّد: يضمن الأنواع والمدى (year/month/actualValue) وينظف الحقول المجهولة
    const parsed = validateKpiEntry(req.body);
    // DATA-001: exactly-one-FK guard (orphan + mixed FK combinations)
    validateKpiEntryFKs(parsed);

    const result = await prisma.$transaction(async (tx) => {
      return upsertKpiEntry({
        ...parsed,
        userId:   req.user.sub,
        userRole: req.user?.role,
        tx,
      });
    });
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

// ─── إدخال مُجمَّع (Bulk) — لصق CSV أو JSON بدلاً من صف-بصف ──
// يقبل: { rows: [{ objectiveId|activityId|indicatorId, year, month, actualValue, spent? }, ...] }
// يُنفَّذ upsert لكل صف بشكل متسلسل (لنفس سجل الأب يتم rollup مرة واحدة في الآخر).
// يُرجع { ok, inserted, failed:[{row, error}], rollup:{objectiveIds, activityIds, indicatorIds} }.
router.post('/entries/bulk', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || !rows.length) throw BadRequest('rows مطلوبة كمصفوفة غير فارغة');
    if (rows.length > 500) throw BadRequest('الحد الأقصى 500 صف في الدفعة الواحدة');

    const inserted = [];
    const failed = [];
    // نؤجّل rollup إلى النهاية لتفادي إعادة حسابات متكرّرة لنفس الأب
    const touchedObj = new Set();
    const touchedAct = new Set();
    const touchedInd = new Set();
    const touchedYears = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const parsed = validateKpiEntry(row);
        // DATA-001: exactly-one-FK guard (orphan + mixed FK combinations)
        validateKpiEntryFKs(parsed);
        // استخدم upsertKpiEntry بـ skipRollup=true (سنعمل rollup دفعة واحدة)
        const result = await upsertKpiEntry({
          ...parsed,
          userId:   req.user.sub,
          userRole: req.user?.role,
          skipRollup: true,
        });
        inserted.push({ row: i, entryId: result.entry?.id });
        if (parsed.objectiveId) touchedObj.add(parsed.objectiveId);
        if (parsed.activityId)  touchedAct.add(parsed.activityId);
        if (parsed.indicatorId) touchedInd.add(parsed.indicatorId);
        touchedYears.add(parsed.year);
      } catch (e) {
        failed.push({ row: i, error: e.message || String(e) });
      }
    }

    // rollup واحد لكل أب × كل سنة تم لمسها
    const { recomputeObjective, recomputeActivity } = await import('../services/rollup.js');
    const rollupErrors = [];
    for (const objId of touchedObj) {
      for (const y of touchedYears) {
        try { await recomputeObjective(objId, { year: y }); } catch (err) {
          const msg = err?.message || String(err);
          console.error('[bulk rollup obj]', msg);
          rollupErrors.push({ kind: 'objective', id: objId, year: y, error: msg });
        }
      }
    }
    for (const actId of touchedAct) {
      for (const y of touchedYears) {
        try { await recomputeActivity(actId, { year: y }); } catch (err) {
          const msg = err?.message || String(err);
          console.error('[bulk rollup act]', msg);
          rollupErrors.push({ kind: 'activity', id: actId, year: y, error: msg });
        }
      }
    }
    for (const indicatorId of touchedInd) {
      for (const y of touchedYears) {
        try { await recomputeIndicator(indicatorId, { year: y }); } catch (err) {
          const msg = err?.message || String(err);
          console.error('[bulk rollup indicator]', msg);
          rollupErrors.push({ kind: 'indicator', id: indicatorId, year: y, error: msg });
        }
      }
    }

    res.json({
      ok: true,
      total: rows.length,
      inserted: inserted.length,
      failed,
      rollupErrors,
      rollup: {
        objectiveIds: [...touchedObj],
        activityIds:  [...touchedAct],
        indicatorIds: [...touchedInd],
        years: [...touchedYears],
      },
    });
  } catch (e) { next(e); }
});

// ─── معاينة قراءة قبل الحفظ (Wizard step 2) ──────────────────
// يحسب expected / ratio / rag / forecast / alerts بناءً على قيمة مُقترَحة
// دون كتابتها في DB — يُمكِّن UX على شكل "راجع قبل الحفظ".
router.post('/entries/preview', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const parsed = validateKpiEntry(req.body);
    // DATA-001: exactly-one-FK guard (read-only preview but same validation for consistency)
    validateKpiEntryFKs(parsed);
    const { objectiveId, activityId, indicatorId, year, month, actualValue, spent } = parsed;

    // السجل الأب (للحصول على kpiType/target/seasonality/direction)
    let kpiRec;
    let targetValue;
    if (objectiveId) {
      kpiRec = await prisma.objective.findUnique({ where: { id: objectiveId } });
      if (!kpiRec) throw NotFound('المؤشر/النشاط غير موجود');
      targetValue = kpiRec.target;
    } else if (activityId) {
      kpiRec = await prisma.operationalActivity.findUnique({ where: { id: activityId } });
      if (!kpiRec) throw NotFound('المؤشر/النشاط غير موجود');
      targetValue = kpiRec.targetValue;
    } else if (indicatorId) {
      const indicator = await prisma.indicator.findUnique({
        where: { id: indicatorId },
        include: {
          annualTargets: { where: { year }, take: 1 },
        },
      });
      if (!indicator) throw NotFound('المؤشر غير موجود');
      if (!indicator.annualTargets?.[0]) {
        console.warn(`[preview] No AnnualTarget for indicator ${indicatorId} year ${year} — using 0`);
      }
      targetValue = indicator?.annualTargets?.[0]?.targetValue ?? 0;
      kpiRec = indicator;
    } else {
      throw BadRequest('يجب تحديد objectiveId أو activityId أو indicatorId');
    }

    // إدخالات السنة الحالية — مع تجاوز الشهر المعاين
    const whereEntries = objectiveId
      ? { objectiveId, year }
      : activityId
        ? { activityId, year }
        : { indicatorId, year };
    const existing = await prisma.kpiEntry.findMany({
      where:   whereEntries,
      orderBy: [{ month: 'asc' }],
    });
    const overlay = existing.filter(e => e.month !== month);
    overlay.push({ month, actualValue: Number(actualValue), spent: spent != null ? Number(spent) : null });
    overlay.sort((a, b) => a.month - b.month);

    const kpi = {
      kpiType: kpiRec.kpiType, seasonality: kpiRec.seasonality, direction: kpiRec.direction,
      targetValue,
      unit: objectiveId ? kpiRec.unit : activityId ? kpiRec.targetUnit : kpiRec.unit,
    };
    const ev = evaluateKpi(kpi, overlay, year, month);
    const lock = await isPeriodLocked(year, month);
    const RAG_MESSAGES = {
      GREEN:  '🎯 أداء مطابق للمستهدف',
      YELLOW: '⚠️ دون المستهدف — يحتاج متابعة',
      RED:    '🔴 انحراف كبير — يتطلب إجراء تصحيحي',
    };
    res.json({
      preview: true,
      locked: lock.locked,
      lockReason: lock.locked ? `مُغلَق باعتماد المراجعة ${lock.reviewCode}` : null,
      kpi: { kpiType: kpi.kpiType, targetValue: kpi.targetValue, unit: kpi.unit },
      evaluation: {
        expected: ev.expected, actual: ev.actual, ratio: ev.ratio, rag: ev.rag,
        forecast: ev.forecast, alerts: ev.alerts,
        message: RAG_MESSAGES[ev.rag] || '⚪ بيانات غير كافية',
      },
    });
  } catch (e) { next(e); }
});

// ─── حالة قفل الفترة ─────────────────────────────────────────
router.get('/period-lock', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year  = Number(req.query.year)  || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const lock = await isPeriodLocked(year, month);
    res.json({ year, month, ...lock });
  } catch (e) { next(e); }
});

// ─── "ما المطلوب منّي هذا الشهر؟" ────────────────────────────
// يُرجع المؤشرات/الأنشطة التي يملكها المستخدم مع حالة إدخال الشهر الحالي.
router.get('/my-due', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year  = Number(req.query.year)  || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const userId   = req.user.sub;
    const userName = req.user.name || '';

    const [objectives, activities, indicators, lock, user] = await Promise.all([
      prisma.objective.findMany({
        where: { deletedAt: null, ownerId: userId, status: { not: 'CANCELLED' } },
        include: { strategicGoal: { select: { title: true, perspective: true } }, kpiEntries: { where: { year } } },
      }),
      prisma.operationalActivity.findMany({
        where: {
          deletedAt: null, year, status: { not: 'CANCELLED' },
          OR: userName
            ? [
                { responsible: userName },
                // variants عربية (alef/yaa/taa-marbuta) — يطابق كتابات مختلفة للاسم نفسه
                ...arabicSearchVariants(userName).map(v => ({
                  responsible: { contains: v, mode: 'insensitive' },
                })),
              ]
            : [{ responsible: '___nomatch___' }],
        },
        include: { strategicGoal: { select: { title: true } }, kpiEntries: { where: { year } } },
      }),
      prisma.indicator.findMany({
        where: {
          deletedAt: null,
          OR: [
            { dataEntryUserId: userId },
            { ownerId: userId },
          ],
        },
        include: {
          annualTargets: { where: { year }, take: 1 },
          kpiEntries: { where: { year, month } },
        },
      }),
      isPeriodLocked(year, month),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } }),
    ]);

    const buildItem = (rec, kind) => {
      let kpiTargetValue;
      let kpiUnit;
      if (kind === 'objective') {
        kpiTargetValue = rec.target;
        kpiUnit = rec.unit;
      } else if (kind === 'activity') {
        kpiTargetValue = rec.targetValue;
        kpiUnit = rec.targetUnit;
      } else {
        // indicator — targetValue from AnnualTarget
        if (!rec.annualTargets?.[0]) {
          console.warn(`[my-due] No AnnualTarget for indicator ${rec.id} year ${year} — using 0`);
        }
        kpiTargetValue = rec.annualTargets?.[0]?.targetValue ?? 0;
        kpiUnit = rec.unit;
      }
      const kpi = {
        kpiType: rec.kpiType, seasonality: rec.seasonality, direction: rec.direction,
        targetValue: kpiTargetValue,
        unit: kpiUnit,
      };
      const allEntries = kind === 'indicator'
        ? rec.kpiEntries  // already filtered to year+month for indicators
        : rec.kpiEntries;
      const thisMonthEntry = kind === 'indicator'
        ? rec.kpiEntries.find(e => e.month === month)
        : rec.kpiEntries.find(e => e.month === month);
      const dueThisMonth = kind === 'indicator'
        ? isDueMonth(rec.frequency, month, rec.seasonality)
        : true;
      const ev = evaluateKpi(kpi, rec.kpiEntries, year, month);
      return {
        // Indicator يستخدم nameAr، Objective و Activity يستخدمان title
        kind, id: rec.id, code: rec.code, title: rec.title || rec.nameAr,
        perspective: rec.strategicGoal?.perspective || rec.perspective || '—',
        goalTitle: rec.strategicGoal?.title,
        kpiType: rec.kpiType, targetValue: kpi.targetValue, unit: kpi.unit,
        frequency: rec.frequency,
        frequencyLabel: kind === 'indicator' ? frequencyLabel(rec.frequency) : 'شهري',
        dueThisMonth,
        currentProgress: Number(rec.progress ?? 0),
        thisMonth: thisMonthEntry
          ? { actualValue: thisMonthEntry.actualValue, spent: thisMonthEntry.spent, enteredAt: thisMonthEntry.enteredAt, note: thisMonthEntry.note, evidenceUrl: thisMonthEntry.evidenceUrl, id: thisMonthEntry.id }
          : null,
        entered: !!thisMonthEntry,
        evaluation: ev,
      };
    };

    const objItems = objectives.map(o => buildItem(o, 'objective'));
    const actItems = activities.map(a => buildItem(a, 'activity'));
    const indItems = indicators
      .filter(i => isDueMonth(i.frequency, month, i.seasonality))
      .map(i => buildItem(i, 'indicator'));
    const all = [...objItems, ...actItems, ...indItems];

    const pending = all.filter(x => !x.entered);
    const entered = all.filter(x => x.entered);

    res.json({
      year, month,
      user: { id: userId, name: user?.name, role: user?.role },
      periodLock: lock,
      summary: {
        total: all.length,
        pending: pending.length,
        entered: entered.length,
        red:    entered.filter(x => x.evaluation.rag === 'RED').length,
        yellow: entered.filter(x => x.evaluation.rag === 'YELLOW').length,
        green:  entered.filter(x => x.evaluation.rag === 'GREEN').length,
      },
      pending, entered,
    });
  } catch (e) { next(e); }
});

// ─── KpiEntry Approval Workflow ──────────────────────────────
// DRAFT → SUBMITTED → APPROVED | REJECTED
// المُدخِل يقدّم القراءة، والمدير/QM يعتمد أو يرفض.

router.post('/entries/:id/submit', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const entry = await prisma.kpiEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) throw NotFound();
    const inScope = await canAccessKpiEntry(req.user, entry, 'submit');
    if (!inScope && entry.enteredById !== req.user.sub &&
        !['QUALITY_MANAGER', 'SUPER_ADMIN'].includes(req.user?.role)) {
      throw Forbidden('يمكنك تقديم قراءاتك فقط');
    }
    if (entry.entryStatus !== 'DRAFT') throw BadRequest('القراءة ليست في حالة DRAFT');
    const updated = await prisma.kpiEntry.update({
      where: { id: entry.id },
      data: { entryStatus: 'SUBMITTED', submittedAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  } catch (e) { next(e); }
});

router.post('/entries/:id/approve', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const entry = await prisma.kpiEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) throw NotFound();
    if (!['SUBMITTED', 'DRAFT'].includes(entry.entryStatus)) throw BadRequest('القراءة ليست قابلة للاعتماد');
    const role = req.user?.role;
    if (!['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER'].includes(role)) {
      throw Forbidden('فقط المدير أو QM يستطيع الاعتماد');
    }
    // DEPT_MANAGER must be in scope (own department) to approve
    if (role === 'DEPT_MANAGER') {
      const inScope = await canAccessKpiEntry(req.user, entry, 'approve');
      if (!inScope) throw Forbidden('لا تملك صلاحية اعتماد قراءات خارج نطاق إدارتك');
    }
    const updated = await prisma.kpiEntry.update({
      where: { id: entry.id },
      data: { entryStatus: 'APPROVED', approvedById: req.user.sub, approvedAt: new Date(), rejectionReason: null },
    });
    res.json({ ok: true, item: updated });
  } catch (e) { next(e); }
});

router.post('/entries/:id/reject', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const reason = req.body?.reason?.trim();
    if (!reason) throw BadRequest('سبب الرفض مطلوب');
    const entry = await prisma.kpiEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) throw NotFound();
    if (entry.entryStatus !== 'SUBMITTED') throw BadRequest('القراءة ليست في حالة SUBMITTED');
    const role = req.user?.role;
    if (!['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER'].includes(role)) {
      throw Forbidden('فقط المدير أو QM يستطيع الرفض');
    }
    if (role === 'DEPT_MANAGER') {
      const inScope = await canAccessKpiEntry(req.user, entry, 'reject');
      if (!inScope) throw Forbidden('لا تملك صلاحية رفض قراءات خارج نطاق إدارتك');
    }
    const updated = await prisma.kpiEntry.update({
      where: { id: entry.id },
      data: { entryStatus: 'REJECTED', rejectionReason: reason, approvedById: req.user.sub, approvedAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  } catch (e) { next(e); }
});

// ─── حذف إدخال ───────────────────────────────────────────────
// SECURITY: requires 'delete' permission (QM_UP) — NOT 'update'.
// Previously used 'update' which let DEPT_MANAGER delete KPI entries.
router.delete('/entries/:id', requireAction('kpi', 'delete'), async (req, res, next) => {
  try {
    // نلتقط الأب/السنة قبل الحذف لإعادة الحساب بعده — كل شيء داخل transaction واحدة
    await prisma.$transaction(async (tx) => {
      const entry = await tx.kpiEntry.findUnique({
        where: { id: req.params.id },
        select: { objectiveId: true, activityId: true, indicatorId: true, year: true, enteredById: true },
      });
      if (!entry) throw NotFound('القراءة غير موجودة');
      // Scope: even with 'delete' permission, a user must be in scope for this entry
      const allowed = await canAccessKpiEntry(req.user, entry, 'delete');
      if (!allowed) throw Forbidden('لا تملك صلاحية حذف هذه القراءة (خارج نطاقك)');
      await tx.kpiEntry.delete({ where: { id: req.params.id } });
      await recomputeAfterEntry(entry, tx);
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── إدخالات شهر محدد ────────────────────────────────────────
router.get('/entries', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = req.query.month ? Number(req.query.month) : undefined;
    const scope = await kpiEntryScopeWhere(req.user);
    const where = { year, ...(month ? { month } : {}), ...scope };
    if (req.query.objectiveId) where.objectiveId = req.query.objectiveId;
    if (req.query.activityId)  where.activityId  = req.query.activityId;
    if (req.query.indicatorId) where.indicatorId = req.query.indicatorId;
    const entries = await prisma.kpiEntry.findMany({
      where,
      include: {
        objective: { select: { id: true, title: true } },
        activity:  { select: { id: true, code: true, title: true } },
        indicator: { select: { id: true, code: true, nameAr: true } },
        enteredBy: { select: { name: true } },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      take: 500,
    });
    res.json({ ok: true, items: entries, total: entries.length, truncated: entries.length >= 500 });
  } catch (e) { next(e); }
});

// ─── helpers ─────────────────────────────────────────────────
async function getObjectivesWithEntries(year, user) {
  const objectives = await prisma.objective.findMany({
    where: mergeScope({ deletedAt: null }, objectiveScopeWhere(user)), // استثناء المحذوفات منطقياً
    include: {
      strategicGoal: { select: { title: true, perspective: true } },
      kpiEntries: { where: { year }, orderBy: [{ month: 'asc' }] },
    },
  });
  return objectives.map(o => ({
    id: o.id, code: o.code, title: o.title,
    perspective: o.strategicGoal?.perspective || '—',
    goalTitle: o.strategicGoal?.title,
    kpi: o.kpi,
    kpiType: o.kpiType, seasonality: o.seasonality, direction: o.direction,
    targetValue: o.target, unit: o.unit,
    ownerId: o.ownerId, departmentId: o.departmentId, status: o.status,
    entries: o.kpiEntries,
  }));
}
async function getActivitiesWithEntries(year, user) {
  const activities = await prisma.operationalActivity.findMany({
    where: mergeScope({ year, deletedAt: null }, activityScopeWhere(user)), // استثناء المحذوفات منطقياً
    include: {
      strategicGoal: { select: { title: true } },
      kpiEntries: { where: { year }, orderBy: [{ month: 'asc' }] },
    },
  });
  return activities.map(a => ({
    id: a.id, code: a.code, title: a.title, description: a.description,
    perspective: a.perspective,
    goalTitle: a.strategicGoal?.title,
    kpiType: a.kpiType, seasonality: a.seasonality, direction: a.direction,
    targetValue: a.targetValue, unit: a.targetUnit,
    budget: a.budget,
    responsible: a.responsible, status: a.status,
    entries: a.kpiEntries,
  }));
}
async function getIndicatorsWithEntries(year, user) {
  const indicators = await prisma.indicator.findMany({
    where: mergeScope({ deletedAt: null }, indicatorScopeWhere(user)),
    include: {
      axis:          { select: { id: true, nameAr: true, code: true, weight: true } },
      objective:     { select: { id: true, departmentId: true } },
      owner:         { select: { departmentId: true } },
      dataEntryUser: { select: { departmentId: true } },
      approver:      { select: { departmentId: true } },
      annualTargets: { where: { year }, take: 1 },
      kpiEntries:    { where: { year }, orderBy: [{ month: 'asc' }] },
    },
  });
  return indicators.map(ind => {
    const annualTarget = ind.annualTargets?.[0];
    if (!annualTarget) {
      console.warn(`[getIndicatorsWithEntries] No AnnualTarget for indicator ${ind.id} year ${year} — using 0`);
    }
    return {
      // Indicator schema يستخدم nameAr، لا title
      id: ind.id, code: ind.code, title: ind.nameAr,
      // المحور (perspective) يأتي من axis.nameAr وليس حقل perspective (غير موجود في Indicator)
      perspective: ind.axis?.nameAr || '—',
      axisId:      ind.axisId,
      objectiveId: ind.objectiveId,
      axisWeight:  ind.axis?.weight,
      weight:      ind.weight,
      kpiType:     ind.kpiType,
      seasonality: ind.seasonality,
      direction:   ind.direction,
      targetValue: annualTarget?.targetValue ?? 0,
      unit:        ind.unit,
      ownerId:     ind.ownerId,
      // Indicator لا يحمل departmentId مباشرة — نأخذ كل الأقسام ذات العلاقة للنطاق والفلاتر
      departmentId: ind.objective?.departmentId ?? ind.owner?.departmentId ?? ind.dataEntryUser?.departmentId ?? ind.approver?.departmentId ?? null,
      departmentIds: [
        ind.objective?.departmentId,
        ind.owner?.departmentId,
        ind.dataEntryUser?.departmentId,
        ind.approver?.departmentId,
      ].filter(Boolean),
      greenThreshold:  ind.greenThreshold,
      yellowThreshold: ind.yellowThreshold,
      frequency:       ind.frequency,
      frequencyLabel:  frequencyLabel(ind.frequency),
      entries: ind.kpiEntries,
    };
  });
}

function filterObjectivesNotMeasuredByIndicators(objectives, indicators) {
  const measuredObjectiveIds = new Set(
    indicators
      .map(indicator => indicator.objectiveId)
      .filter(Boolean),
  );
  return objectives.filter(objective => !measuredObjectiveIds.has(objective.id));
}

// ── Smart filter chips للمؤشرات (quick=mine,red,behind...) ────────
// كل مرشّح predicate على كائن مُقيَّم (kpi مُرفَق مع evaluation).
// req: لتمرير معلومات المستخدم. month: لتحديد "missing".
export const KPI_SMART_FILTERS = {
  // الملكية
  mine: (k, req) => {
    if (k.kind === 'objective' || k.kind === 'indicator') return k.ownerId === req.user.sub;
    const name = (req.user.name || '').trim();
    return name && typeof k.responsible === 'string' && k.responsible.includes(name);
  },
  myDept: (k, req) =>
    (k.kind === 'objective' || k.kind === 'indicator') && req.user.departmentId
      ? (Array.isArray(k.departmentIds) ? k.departmentIds.includes(req.user.departmentId) : k.departmentId === req.user.departmentId)
      : false,

  // الحالة (evaluation.rag)
  red:     (k) => k.rag === 'RED',
  yellow:  (k) => k.rag === 'YELLOW',
  green:   (k) => k.rag === 'GREEN',
  gray:    (k) => k.rag === 'GRAY',

  // الأداء الكمّي
  behind:  (k) => k.ratio != null && k.ratio < 0.7,
  ahead:   (k) => k.ratio != null && k.ratio >= 1.0,

  // قراءات الشهر الحالي
  missing: (k, _req, ctx) => k.dueThisMonth !== false && !k.entries.some(e => e.month === ctx.month),
  entered: (k, _req, ctx) =>  k.dueThisMonth !== false && k.entries.some(e => e.month === ctx.month),

  // تنبيهات
  criticalAlerts: (k) =>
    Array.isArray(k.alerts) && k.alerts.some(a => a.severity === 'CRITICAL'),

  // محاور BSC (perspective=X عبر param خاص)
  // (يتحقَّق في الكود عبر req.query.perspective وليس quick)
};

function applyKpiQuick(items, req, month) {
  const raw = String(req.query.quick || '').trim();
  const keys = raw.split(',').map(s => s.trim()).filter(Boolean);
  const ctx = { month };
  let out = items;
  for (const key of keys) {
    const fn = KPI_SMART_FILTERS[key];
    if (fn) out = out.filter(k => fn(k, req, ctx));
  }
  const perspective = String(req.query.perspective || '').trim();
  if (perspective) out = out.filter(k => (k.perspective || '') === perspective);
  return out;
}

function computeKpiCounts(items, req, month) {
  const counts = {};
  const ctx = { month };
  for (const [key, fn] of Object.entries(KPI_SMART_FILTERS)) {
    try { counts[key] = items.filter(k => fn(k, req, ctx)).length; }
    catch { counts[key] = 0; }
  }
  return counts;
}

// ─── مصفوفة (heatmap) ────────────────────────────────────────
// يدعم Smart Filters عبر ?quick=mine,red,behind,missing,criticalAlerts,...
// + ?perspective=<محور BSC>. يُرجع counts لكل مرشّح (للـ chips في الواجهة).
router.get('/matrix', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities, indicators] = await Promise.all([
      getObjectivesWithEntries(year, req.user), getActivitiesWithEntries(year, req.user), getIndicatorsWithEntries(year, req.user),
    ]);
    const effectiveObjectives = filterObjectivesNotMeasuredByIndicators(objectives, indicators);
    const build = (list, kind) => list.map(k => {
      const ev = evaluateKpi(k, k.entries, year, month);
      const monthCells = Array.from({ length: 12 }, (_, i) => {
        const due = kind === 'indicator' ? isDueMonth(k.frequency, i + 1, k.seasonality) : true;
        const e = k.entries.find(x => x.month === i + 1);
        if (!due) return { month: i+1, actualValue: null, status: 'NOT_DUE', due: false };
        if (!e) return { month: i+1, actualValue: null, status: 'GRAY', due: true };
        const exp = expectedByMonth(k, i+1);
        const act = actualByMonth(k, k.entries, i+1);
        const r = achievementRatio(k, act, exp);
        return { month: i+1, actualValue: e.actualValue, spent: e.spent, status: ragStatus(r), due: true };
      });
      const dueThisMonth = kind === 'indicator' ? isDueMonth(k.frequency, month, k.seasonality) : true;
      return {
        kind, id: k.id, code: k.code, title: k.title,
        perspective: k.perspective, kpiType: k.kpiType,
        targetValue: k.targetValue, unit: k.unit,
        frequency: k.frequency, frequencyLabel: k.frequencyLabel,
        dueThisMonth,
        ownerId: k.ownerId, departmentId: k.departmentId,
        responsible: k.responsible,
        greenThreshold: k.greenThreshold, yellowThreshold: k.yellowThreshold,
        entries: k.entries,
        ...ev, months: monthCells,
      };
    });
    const allObjectives  = build(effectiveObjectives,  'objective');
    const allActivities  = build(activities,  'activity');
    const allIndicators  = build(indicators,  'indicator');
    const all = [...allObjectives, ...allActivities, ...allIndicators];

    // counts قبل التمرير — يستخدمها الـ UI لعرض chips حتى لو المرشّح مُفعَّل
    const counts = {
      total: all.length,
      ...computeKpiCounts(all, req, month),
    };

    // قائمة المحاور الفريدة (لعرض filter dropdown)
    const perspectives = [...new Set(all.map(k => k.perspective).filter(Boolean))];

    const filteredObj = applyKpiQuick(allObjectives, req, month);
    const filteredAct = applyKpiQuick(allActivities, req, month);
    const filteredInd = applyKpiQuick(allIndicators, req, month);

    res.json({
      year, month,
      objectives: filteredObj,
      activities: filteredAct,
      indicators: filteredInd,
      counts,
      perspectives,
      activeQuick: String(req.query.quick || '').split(',').filter(Boolean),
      activePerspective: req.query.perspective || null,
    });
  } catch (e) { next(e); }
});

// ─── لوحة تنفيذية ───────────────────────────────────────────
router.get('/dashboard', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities, indicators] = await Promise.all([
      getObjectivesWithEntries(year, req.user), getActivitiesWithEntries(year, req.user), getIndicatorsWithEntries(year, req.user),
    ]);
    const effectiveObjectives = filterObjectivesNotMeasuredByIndicators(objectives, indicators);
    const all = [
      ...effectiveObjectives.map(o=>({...o,kind:'objective'})),
      ...activities.map(a=>({...a,kind:'activity'})),
      ...indicators.map(i=>({...i,kind:'indicator'})),
    ].map(k => ({
      ...k,
      dueThisMonth: k.kind === 'indicator' ? isDueMonth(k.frequency, month, k.seasonality) : true,
      evaluation: evaluateKpi(k, k.entries, year, month),
    }));

    // تجميع حسب المحور
    const byPerspective = {};
    for (const k of all) {
      const p = k.perspective || '—';
      byPerspective[p] = byPerspective[p] || { perspective: p, total: 0, green: 0, yellow: 0, red: 0, gray: 0, avgRatio: 0, criticalAlerts: 0 };
      const bp = byPerspective[p];
      bp.total++;
      const rag = k.evaluation.rag;
      bp[rag.toLowerCase()]++;
      if (k.evaluation.ratio != null) bp.avgRatio += Math.min(k.evaluation.ratio, 2);
      bp.criticalAlerts += k.evaluation.alerts.filter(a=>a.severity==='CRITICAL').length;
    }
    Object.values(byPerspective).forEach(bp => {
      bp.avgRatio = bp.total ? +(bp.avgRatio / bp.total).toFixed(3) : 0;
    });

    // Top variances (أسوأ 10 مؤشرات)
    const topVariances = [...all]
      .filter(k => k.dueThisMonth !== false && k.evaluation.ratio != null)
      .sort((a,b) => a.evaluation.ratio - b.evaluation.ratio)
      .slice(0, 10)
      .map(k => ({
        kind: k.kind, id: k.id, code: k.code, title: k.title,
        perspective: k.perspective, targetValue: k.targetValue, unit: k.unit,
        actual: k.evaluation.actual, expected: k.evaluation.expected,
        ratio: k.evaluation.ratio, rag: k.evaluation.rag,
        forecast: k.evaluation.forecast,
      }));

    // إجمالي التنبيهات
    const allAlerts = all.flatMap(k => k.evaluation.alerts.map(a => ({
      ...a, kind: k.kind, id: k.id, code: k.code, title: k.title,
    })));

    // إجمالي الميزانية والصرف (نشاطات + مبادرات)
    const initiatives = await prisma.initiative.findMany({
      where: mergeScope({ deletedAt: null }, initiativeScopeWhere(req.user)),
      select: { budget: true, spent: true },
    });
    const activitiesBudget = activities.reduce((s,a)=>s+Number(a.budget||0), 0);
    const activitiesSpent  = activities.reduce((s,a)=>s+a.entries.reduce((ss,e)=>ss+Number(e.spent||0), 0), 0);
    const initiativesBudget = initiatives.reduce((s,i)=>s+Number(i.budget||0), 0);
    const initiativesSpent  = initiatives.reduce((s,i)=>s+Number(i.spent ||0), 0);
    const totalBudget = activitiesBudget + initiativesBudget;
    const totalSpent  = activitiesSpent  + initiativesSpent;

    res.json({
      year, month,
      perspectives: Object.values(byPerspective),
      summary: {
        totalObjectives: effectiveObjectives.length,
        totalActivities: activities.length,
        totalIndicators: indicators.length,
        dueThisMonth: all.filter(k => k.dueThisMonth !== false).length,
        green: all.filter(k=>k.evaluation.rag==='GREEN').length,
        yellow: all.filter(k=>k.evaluation.rag==='YELLOW').length,
        red: all.filter(k=>k.evaluation.rag==='RED').length,
        gray: all.filter(k=>k.evaluation.rag==='GRAY').length,
        criticalAlertsCount: allAlerts.filter(a=>a.severity==='CRITICAL').length,
        warningAlertsCount: allAlerts.filter(a=>a.severity==='WARNING' || a.severity==='HIGH').length,
        totalBudget, totalSpent,
        spentRatio: totalBudget ? +(totalSpent/totalBudget).toFixed(3) : 0,
      },
      topVariances,
      alerts: allAlerts.slice(0, 50),
    });
  } catch (e) { next(e); }
});

// ─── التنبيهات ──────────────────────────────────────────────
router.get('/alerts', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities, indicators] = await Promise.all([
      getObjectivesWithEntries(year, req.user), getActivitiesWithEntries(year, req.user), getIndicatorsWithEntries(year, req.user),
    ]);
    const effectiveObjectives = filterObjectivesNotMeasuredByIndicators(objectives, indicators);
    const all = [
      ...effectiveObjectives.map(o=>({...o,kind:'objective'})),
      ...activities.map(a=>({...a,kind:'activity'})),
      ...indicators.map(i=>({...i,kind:'indicator'})),
    ];
    const alerts = [];
    for (const k of all) {
      if (k.kind === 'indicator' && !isDueMonth(k.frequency, month, k.seasonality)) continue;
      const list = detectAlerts(k, k.entries, year, month);
      for (const a of list) {
        alerts.push({ ...a, kind: k.kind, id: k.id, code: k.code, title: k.title, perspective: k.perspective });
      }
    }
    const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
    alerts.sort((a,b) => (order[a.severity]||9) - (order[b.severity]||9));
    res.json({ year, month, alerts });
  } catch (e) { next(e); }
});

// ─── تفاصيل مؤشر أو نشاط ───────────────────────────────────
router.get('/:kind(objective|activity|indicator)/:id', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();

    let rec, entries, kpi;
    if (kind === 'objective') {
      if (!await canAccessKpiRecord(req.user, kind, id)) throw Forbidden('لا يمكنك الاطلاع على هذا المؤشر خارج نطاق صلاحيتك');
      rec = await prisma.objective.findUnique({
        where: { id }, include: { strategicGoal: { select: { title: true, perspective: true } } },
      });
      if (!rec) throw NotFound('مؤشر غير موجود');
      entries = await prisma.kpiEntry.findMany({ where: { objectiveId: id, year }, orderBy: [{ month: 'asc' }] });
      kpi = {
        kpiType: rec.kpiType,
        targetValue: rec.target,
        unit: rec.unit,
        seasonality: rec.seasonality,
        direction: rec.direction,
        budget: rec.budget,
      };
    } else if (kind === 'activity') {
      if (!await canAccessKpiRecord(req.user, kind, id)) throw Forbidden('لا يمكنك الاطلاع على هذا النشاط خارج نطاق صلاحيتك');
      rec = await prisma.operationalActivity.findUnique({
        where: { id }, include: { strategicGoal: { select: { title: true } } },
      });
      if (!rec) throw NotFound('نشاط غير موجود');
      entries = await prisma.kpiEntry.findMany({ where: { activityId: id, year }, orderBy: [{ month: 'asc' }] });
      kpi = {
        kpiType: rec.kpiType,
        targetValue: rec.targetValue,
        unit: rec.targetUnit,
        seasonality: rec.seasonality,
        direction: rec.direction,
        budget: rec.budget,
      };
    } else {
      // kind === 'indicator'
      if (!await canAccessKpiRecord(req.user, kind, id)) throw Forbidden('لا يمكنك الاطلاع على هذا المؤشر خارج نطاق صلاحيتك');
      rec = await prisma.indicator.findUnique({
        where: { id },
        include: { annualTargets: { where: { year }, take: 1 } },
      });
      if (!rec) throw NotFound('المؤشر غير موجود');
      if (!rec.annualTargets?.[0]) {
        console.warn(`[GET /indicator/${id}] No AnnualTarget for year ${year} — using 0`);
      }
      entries = await prisma.kpiEntry.findMany({ where: { indicatorId: id, year }, orderBy: [{ month: 'asc' }] });
      kpi = {
        kpiType: rec.kpiType,
        targetValue: rec.annualTargets?.[0]?.targetValue ?? 0,
        unit: rec.unit,
        seasonality: rec.seasonality,
        direction: rec.direction,
        budget: rec.budget,
        greenThreshold: rec.greenThreshold,
        yellowThreshold: rec.yellowThreshold,
      };
    }

    const evaluation = evaluateKpi(kpi, entries, year, month);

    // سلسلة زمنية: متوقع/فعلي شهرياً
    const series = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const due = kind === 'indicator' ? isDueMonth(rec.frequency, m, rec.seasonality) : true;
      const entry = entries.find(e => e.month === m);
      if (!due) {
        return {
          month: m,
          due: false,
          expected: null,
          actual: null,
          cumulativeActual: null,
          spent: null,
          status: 'NOT_DUE',
          evidenceUrl: null,
          note: null,
        };
      }
      const exp = expectedByMonth(kpi, m);
      const act = actualByMonth(kpi, entries, m);
      const r = achievementRatio(kpi, act, exp);
      return {
        month: m,
        due: true,
        expected: exp,
        actual: entry ? Number(entry.actualValue) : null,
        cumulativeActual: act,
        spent: entry ? Number(entry.spent || 0) : null,
        status: ragStatus(r),
        evidenceUrl: entry?.evidenceUrl,
        note: entry?.note,
      };
    });

    res.json({ kind, record: rec, kpi, evaluation, series, year, month });
  } catch (e) { next(e); }
});

export default router;
