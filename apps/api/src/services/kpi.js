/**
 * services/kpi.js — خدمات قراءات KPI الشهرية (ISO 9.1 / 9.3).
 *
 * المرحلة 2 — Service Layer.
 *   ▸ isPeriodLocked       — هل فترة مُغلَقة بمراجعة إدارية مكتملة؟
 *   ▸ upsertKpiEntry       — upsert مع كل الحراسات + feedback فوري
 *   ▸ computeKpiFeedback   — تقييم سريع للقراءة (expected/ratio/rag/alerts)
 */
import { prisma as globalPrisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';
import { evaluateKpi } from '../lib/kpi-engine.js';
import { recomputeAfterEntry } from './rollup.js';

/**
 * هل هذا الشهر/السنة مُغلَق بسبب مراجعة إدارية مكتملة تغطّي هذه الفترة؟
 * ISO 9.3: بعد اعتماد المراجعة الإدارية لفترة معينة، تُجمَّد بياناتها.
 */
export async function isPeriodLocked(year, month) {
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const review = await globalPrisma.managementReview.findFirst({
    where:   { status: 'COMPLETED', meetingDate: { gt: endOfMonth } },
    orderBy: { meetingDate: 'asc' },
    select:  { id: true, meetingDate: true, code: true },
  });
  return review
    ? { locked: true, reviewId: review.id, reviewCode: review.code, reviewDate: review.meetingDate }
    : { locked: false };
}

const RAG_MESSAGES = {
  GREEN:  '🎯 أداء مطابق للمستهدف',
  YELLOW: '⚠️ دون المستهدف — يحتاج متابعة',
  RED:    '🔴 انحراف كبير — يتطلب إجراء تصحيحي',
};

/**
 * computeKpiFeedback — ردّ فوري على إدخال قراءة (expected/actual/ratio/rag).
 * Silent-fail: يُرجع null إذا لم يعثر على السجل الأب أو فشل الحساب.
 */
export async function computeKpiFeedback({ objectiveId, activityId, indicatorId, year, month }) {
  try {
    let kpiRec;
    let targetValue;
    let whereEntries;

    if (objectiveId) {
      kpiRec = await globalPrisma.objective.findUnique({ where: { id: objectiveId } });
      targetValue = kpiRec?.target;
      whereEntries = { objectiveId, year };
    } else if (activityId) {
      kpiRec = await globalPrisma.operationalActivity.findUnique({ where: { id: activityId } });
      targetValue = kpiRec?.targetValue;
      whereEntries = { activityId, year };
    } else if (indicatorId) {
      kpiRec = await globalPrisma.indicator.findUnique({
        where: { id: indicatorId },
        include: { annualTargets: { where: { year }, take: 1 } },
      });
      targetValue = kpiRec?.annualTargets?.[0]?.targetValue;
      whereEntries = { indicatorId, year };
    }

    if (!kpiRec) return null;
    if (!targetValue || targetValue <= 0) return null;

    const allEntries = await globalPrisma.kpiEntry.findMany({
      where:   whereEntries,
      orderBy: [{ month: 'asc' }],
    });
    const kpi = {
      kpiType:     kpiRec.kpiType,
      seasonality: kpiRec.seasonality,
      direction:   kpiRec.direction,
      targetValue,
      unit:        objectiveId ? kpiRec.unit : activityId ? kpiRec.targetUnit : kpiRec.unit,
    };
    const ev = evaluateKpi(kpi, allEntries, year, month);
    return {
      expected: ev.expected, actual: ev.actual, ratio: ev.ratio, rag: ev.rag,
      forecast: ev.forecast, alerts: ev.alerts,
      message:  RAG_MESSAGES[ev.rag] || '⚪ بيانات غير كافية',
    };
  } catch {
    return null;
  }
}

/**
 * upsertKpiEntry — يمر من كل الحراسات ثم يُحدِّث/يُنشئ القراءة.
 * يُرجع: { entry, feedback, locked }
 * يقبل tx اختيارياً لتشغيله ضمن prisma.$transaction.
 */
export async function upsertKpiEntry({
  objectiveId, activityId, indicatorId, year, month,
  actualValue, spent, note, evidenceUrl,
  deviationReason, actionNote,   // Audit task 6 (architectural): حقول منفصلة
  userId, userRole, skipRollup = false, tx = globalPrisma,
}) {
  // منع الإدخال على شهر في المستقبل
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
    throw BadRequest('لا يمكن إدخال قراءة لشهر في المستقبل');
  }

  // منع الإدخال على فترة مُغلَقة بمراجعة إدارية (إلا SUPER_ADMIN)
  const lock = await isPeriodLocked(year, month);
  if (lock.locked && userRole !== 'SUPER_ADMIN') {
    const dateAr = new Date(lock.reviewDate).toLocaleDateString('ar-SA');
    throw BadRequest(
      `هذا الشهر مُغلَق باعتماد المراجعة الإدارية ${lock.reviewCode} (${dateAr}). لا يمكن التعديل عليه.`,
    );
  }

  // ── Audit task 6 (architectural): KPI deviation reason ────────────────
  // ratio < 80% → deviationReason إلزامي
  // ratio < 60% → actionNote إلزامي (الإجراء التصحيحي)
  if (objectiveId || activityId) {
    const parent = objectiveId
      ? await tx.objective.findUnique({ where: { id: objectiveId } })
      : await tx.operationalActivity.findUnique({ where: { id: activityId } });
    if (parent) {
      const existing = await tx.kpiEntry.findMany({
        where: objectiveId ? { objectiveId, year } : { activityId, year },
        orderBy: [{ month: 'asc' }],
      });
      const overlay = existing.filter(e => e.month !== month);
      overlay.push({ month, actualValue: Number(actualValue), spent: spent != null ? Number(spent) : null });
      overlay.sort((a, b) => a.month - b.month);
      const kpi = {
        kpiType:     parent.kpiType,
        seasonality: parent.seasonality,
        direction:   parent.direction,
        targetValue: objectiveId ? parent.target : parent.targetValue,
        unit:        objectiveId ? parent.unit   : parent.targetUnit,
      };
      const ev = evaluateKpi(kpi, overlay, year, month);
      const ratio = ev?.ratio;
      if (ratio != null && ratio < 0.80) {
        if (!deviationReason || String(deviationReason).trim() === '') {
          throw BadRequest(
            `نسبة التحقق ${Math.round(ratio * 100)}% أقل من 80% — سبب الانحراف (deviationReason) إلزامي`,
          );
        }
        if (ratio < 0.60) {
          if (!actionNote || String(actionNote).trim() === '') {
            throw BadRequest(
              `نسبة التحقق ${Math.round(ratio * 100)}% أقل من 60% — الإجراء التصحيحي (actionNote) إلزامي`,
            );
          }
        }
      }
    }
  }

  const where = objectiveId
    ? { objectiveId_year_month: { objectiveId, year, month } }
    : activityId
      ? { activityId_year_month: { activityId, year, month } }
      : { indicatorId_year_month: { indicatorId, year, month } };

  const data = {
    objectiveId:  objectiveId  || null,
    activityId:   activityId   || null,
    indicatorId:  indicatorId  || null,
    year, month,
    actualValue: Number(actualValue),
    spent:       spent != null ? Number(spent) : null,
    note:        note || null,
    deviationReason: deviationReason ? String(deviationReason).trim() : null,
    actionNote:      actionNote      ? String(actionNote).trim()      : null,
    evidenceUrl: evidenceUrl || null,
    enteredById: userId,
  };
  const entry = await tx.kpiEntry.upsert({ where, update: data, create: data });

  // ── Auto rollup: يُحدِّث progress الأب + جذر الخطة الاستراتيجية ─────
  // يُشَغَّل بعد الـ upsert مباشرةً. لا نكسر الـ request لو فشل (نسجّل فقط).
  let rollup = null;
  if (!skipRollup) {
    try {
      rollup = await recomputeAfterEntry({ objectiveId, activityId, indicatorId, year }, tx);
    } catch (err) {
      console.error('[kpi] rollup failed:', err?.message || err);
    }
  }

  const feedback = await computeKpiFeedback({ objectiveId, activityId, indicatorId, year, month });
  return { entry, feedback, rollup, locked: lock.locked };
}
