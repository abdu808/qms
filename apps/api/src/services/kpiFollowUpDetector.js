/**
 * services/kpiFollowUpDetector.js
 *
 * المحرّك الذكي لاكتشاف الإدخالات المتأخرة تلقائياً.
 *
 * يفحص جميع المؤشرات الشهرية النشطة، ويحاول تحديد department من 4 مصادر:
 *   1. Indicator.objective.departmentId
 *   2. Indicator.dataEntryUser.departmentId
 *   3. Indicator.owner.departmentId
 *   4. Indicator.approver.departmentId
 *
 * يفحص الفترات: الشهر الحالي + الشهرين السابقين.
 *
 * تدرّج الحالة حسب أيام التأخير:
 *   • Day 0-4   → PENDING
 *   • Day 5-9   → FIRST_NOTICE
 *   • Day 10-14 → ESCALATED Lvl 1
 *   • Day 15+   → ESCALATED Lvl 2 (يبقى مرئياً حتى يُحلّ أو يُغلَق يدوياً)
 *
 * ملاحظة هامّة: لا يوجد ABORTED تلقائي.
 * ABORTED قرار يدوي حصري لمدير الجودة عبر POST /:id/abort مع سبب موثَّق.
 * هذا يضمن صدق السجل: لا تُخفى المتأخرات القديمة، ولا يُغلَق ملف بدون قرار إنساني.
 */

import { prisma } from '../db.js';
import { sendNotification } from './notificationDispatcher.js';

// ─── ثوابت التدرج ───────────────────────────────────────────────
const ESCALATION_THRESHOLDS = {
  FIRST_NOTICE: 5,
  ESCALATE_L1: 10,
  ESCALATE_L2: 15,
};

// ─── حساب dueDate لمؤشر شهري ───────────────────────────────────
// dueDate = آخر يوم في الشهر + 5 أيام إمهال
function calculateDueDate(year, month) {
  const lastDay = new Date(year, month, 0); // month is 1-12
  lastDay.setDate(lastDay.getDate() + 5);
  return lastDay;
}

function calculateDaysLate(dueDate, ref = new Date()) {
  const ms = ref.getTime() - dueDate.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function determineStatus(daysLate) {
  if (daysLate < ESCALATION_THRESHOLDS.FIRST_NOTICE) return { status: 'PENDING',      escalationLevel: 0 };
  if (daysLate < ESCALATION_THRESHOLDS.ESCALATE_L1)  return { status: 'FIRST_NOTICE', escalationLevel: 0 };
  if (daysLate < ESCALATION_THRESHOLDS.ESCALATE_L2)  return { status: 'ESCALATED',    escalationLevel: 1 };
  // 15+ days → يبقى ESCALATED Level 2 إلى أجل غير مسمى حتى يتدخل QM (حلّ أو إغلاق يدوي)
  return { status: 'ESCALATED', escalationLevel: 2 };
}

// ─── الفترات التي يجب فحصها ────────────────────────────────────
// الشهر الحالي + الشهرين السابقين (لتغطية المتأخرات الممتدة)
function getPeriodsToCheck() {
  const periods = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return periods;
}

function getPreviousMonthPeriod(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// ─── تحديد department للمؤشر من مصادر متعددة ───────────────────
// المؤشرات المستقلة (بلا objective) شائعة، لذا نحاول أكثر من مصدر
function resolveDepartmentForIndicator(indicator) {
  // 1. من objective
  if (indicator.objective?.departmentId) return indicator.objective.departmentId;
  // 2. من dataEntryUser
  if (indicator.dataEntryUser?.departmentId) return indicator.dataEntryUser.departmentId;
  // 3. من owner
  if (indicator.owner?.departmentId) return indicator.owner.departmentId;
  // 4. من approver
  if (indicator.approver?.departmentId) return indicator.approver.departmentId;
  return null;
}

// ─── تحديد responsible user للمؤشر ──────────────────────────────
// المسؤول عن الإدخال: dataEntryUser أو owner أو approver كـ fallback
function resolveDataEntryUser(indicator) {
  if (indicator.dataEntryUserId) return indicator.dataEntryUserId;
  if (indicator.ownerId) return indicator.ownerId;
  if (indicator.approverUserId) return indicator.approverUserId;
  return null;
}

/**
 * المحرّك الرئيسي - يكتشف ويحدّث الإدخالات المتأخرة
 * @returns {Promise<{...}>}
 */
export async function detectAndUpdateOverdueKpis() {
  const stats = {
    created: 0, updated: 0, resolved: 0, aborted: 0,
    skippedNoDept: 0, skippedNoUser: 0, skippedFutureDue: 0,
    indicatorsChecked: 0, periodsChecked: 0,
  };
  const now = new Date();
  const periods = getPeriodsToCheck();

  // ─── جلب جميع المؤشرات الشهرية النشطة (مرة واحدة) ──────────
  const indicators = await prisma.indicator.findMany({
    where: {
      frequency: 'MONTHLY',
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      nameAr: true,
      dataEntryUserId: true,
      ownerId: true,
      approverUserId: true,
      objective: { select: { departmentId: true } },
      dataEntryUser: { select: { id: true, departmentId: true } },
      owner: { select: { id: true, departmentId: true } },
      approver: { select: { id: true, departmentId: true } },
    },
  });

  stats.indicatorsChecked = indicators.length;

  for (const { year, month } of periods) {
    const dueDate = calculateDueDate(year, month);

    // إذا لم يصل dueDate بعد، تخطّ هذا الشهر
    if (now < dueDate) {
      stats.skippedFutureDue++;
      continue;
    }
    stats.periodsChecked++;

    const daysLate = calculateDaysLate(dueDate, now);
    const { status, escalationLevel } = determineStatus(daysLate);

    for (const indicator of indicators) {
      const departmentId = resolveDepartmentForIndicator(indicator);
      const dataEntryUserId = resolveDataEntryUser(indicator);

      // تخطّي إذا لم نتمكن من تحديد قسم
      if (!departmentId) {
        if (year === periods[periods.length - 1].year && month === periods[periods.length - 1].month) {
          stats.skippedNoDept++;
        }
        continue;
      }

      // تخطّي إذا لم يكن هناك مسؤول إدخال
      if (!dataEntryUserId) {
        if (year === periods[periods.length - 1].year && month === periods[periods.length - 1].month) {
          stats.skippedNoUser++;
        }
        continue;
      }

      // ─── فحص: هل تم إدخال البيانات لهذه الفترة؟ ───────────
      const entry = await prisma.kpiEntry.findFirst({
        where: { indicatorId: indicator.id, year, month },
        select: { id: true, entryStatus: true, submittedAt: true },
      });

      // ─── جلب المتابعة الحالية إن وُجدت ────────────────────
      const existing = await prisma.kpiFollowUp.findUnique({
        where: { indicatorId_year_month: { indicatorId: indicator.id, year, month } },
      });

      // ─── السيناريو 1: تم الإدخال + يوجد متابعة → حلّ تلقائي
      if (entry && existing && existing.status !== 'RESOLVED') {
        await prisma.kpiFollowUp.update({
          where: { id: existing.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedEntryId: entry.id,
            submittedAt: entry.submittedAt || new Date(),
            daysLate,
          },
        });
        stats.resolved++;
        continue;
      }

      // ─── السيناريو 2: تم الإدخال + لا يوجد متابعة → تخطّ ─
      if (entry) continue;

      // ─── السيناريو 3: لم يُدخل + لا يوجد متابعة → إنشاء ─
      if (!existing) {
        const count = await prisma.kpiFollowUp.count();
        const code = `KFU-${year}-${String(count + 1).padStart(4, '0')}`;

        try {
          await prisma.kpiFollowUp.create({
            data: {
              code,
              indicatorId: indicator.id,
              departmentId,
              dataEntryUserId,
              performanceOwnerId: indicator.ownerId || null,
              year,
              month,
              dueDate,
              daysLate,
              status,
              escalationLevel,
              escalatedAt: escalationLevel > 0 ? new Date() : null,
            },
          });
          stats.created++;
        } catch (e) {
          // race condition: قد يكون أُنشئ في نفس اللحظة. تجاهل.
          if (!String(e.message).includes('Unique constraint')) {
            console.warn(`[kpiFollowUp] create failed for ${indicator.code} ${year}/${month}:`, e.message);
          }
        }
      }
      // ─── السيناريو 4: لم يُدخل + يوجد متابعة → تحديث ────
      else if (!['RESOLVED', 'ABORTED'].includes(existing.status)) {
        const updated = { daysLate, status, escalationLevel };

        if (escalationLevel > existing.escalationLevel && !existing.escalatedAt) {
          updated.escalatedAt = new Date();
        }

        if (
          existing.status !== status ||
          existing.escalationLevel !== escalationLevel ||
          existing.daysLate !== daysLate
        ) {
          await prisma.kpiFollowUp.update({
            where: { id: existing.id },
            data: updated,
          });
          stats.updated++;
        }
      }
    }
  }

  return stats;
}

// ─── بناء متغيرات الـ template من سجل المتابعة ─────────────────
function buildVarsForFollowUp(f, recipient = {}) {
  return {
    employeeName:   f.dataEntryUser?.name || '',
    managerName:    recipient?.name || '',
    indicatorCode:  f.indicator?.code || '',
    indicatorName:  f.indicator?.nameAr || '',
    departmentName: f.department?.name || '',
    month:          f.month,
    year:           f.year,
    daysLate:       f.daysLate ?? 0,
    dueDate:        f.dueDate ? new Date(f.dueDate).toISOString().slice(0, 10) : '',
    link:           '/qms#/kpiFollowUp',
    followUpCode:   f.code || '',
  };
}

function buildVarsForIndicatorReminder(indicator, period, dueDate, recipient = {}) {
  return {
    employeeName:   recipient?.name || '',
    indicatorCode:  indicator?.code || '',
    indicatorName:  indicator?.nameAr || '',
    month:          period.month,
    year:           period.year,
    dueDate:        dueDate ? new Date(dueDate).toISOString().slice(0, 10) : '',
    link:           '/qms#/kpiEntries',
  };
}

export async function sendKpiPreDeadlineReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const period = getPreviousMonthPeriod(now);
  const dueDate = calculateDueDate(period.year, period.month);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

  if (daysUntilDue < 0 || daysUntilDue > 3) return { sent: 0, skippedWindow: true };

  const indicators = await prisma.indicator.findMany({
    where: { frequency: 'MONTHLY', deletedAt: null },
    select: {
      id: true,
      code: true,
      nameAr: true,
      dataEntryUserId: true,
      ownerId: true,
      approverUserId: true,
      dataEntryUser: { select: { id: true, name: true, email: true, phone: true, role: true, active: true } },
      owner: { select: { id: true, name: true, email: true, phone: true, role: true, active: true } },
      approver: { select: { id: true, name: true, email: true, phone: true, role: true, active: true } },
    },
  });
  if (!indicators.length) return { sent: 0, checked: 0 };

  const entries = await prisma.kpiEntry.findMany({
    where: {
      year: period.year,
      month: period.month,
      indicatorId: { in: indicators.map(i => i.id) },
    },
    select: { indicatorId: true },
  });
  const entered = new Set(entries.map(e => e.indicatorId));
  let sent = 0;

  for (const indicator of indicators) {
    if (entered.has(indicator.id)) continue;
    const recipient =
      indicator.dataEntryUser ||
      indicator.owner ||
      indicator.approver;
    if (!recipient?.id || recipient.active === false) continue;

    const r = await sendNotification({
      eventKey: 'KPI_PRE_DEADLINE',
      dedupeKey: `KPI_PRE_DEADLINE:${indicator.id}:${period.year}:${period.month}:${today}`,
      recipient,
      variables: buildVarsForIndicatorReminder(indicator, period, dueDate, recipient),
      entityType: 'Indicator',
      entityId: indicator.id,
      link: '/qms#/kpiEntries',
      fallbackTitle: `تذكير قبل الإغلاق الشهري: ${indicator.code}`,
      fallbackMessage: `يرجى إدخال قراءة مؤشر ${indicator.nameAr} لفترة ${period.month}/${period.year} قبل ${dueDate.toISOString().slice(0, 10)}.`,
      payloadExtra: { period, daysUntilDue },
    });
    if (r.inApp || r.dispatched) sent++;
  }

  return { sent, checked: indicators.length, period, daysUntilDue };
}

export async function sendKpiQualityManagerDailySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const items = await prisma.kpiFollowUp.findMany({
    where: { status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } },
    include: {
      department: { select: { name: true } },
    },
  });
  if (!items.length) return { sent: 0, total: 0 };

  const counts = {
    pending: 0,
    firstNotice: 0,
    escalatedL1: 0,
    escalatedL2: 0,
  };
  const byDept = new Map();
  let oldestDaysLate = 0;

  for (const item of items) {
    if (item.status === 'PENDING') counts.pending++;
    if (item.status === 'FIRST_NOTICE') counts.firstNotice++;
    if (item.status === 'ESCALATED' && item.escalationLevel === 1) counts.escalatedL1++;
    if (item.status === 'ESCALATED' && item.escalationLevel >= 2) counts.escalatedL2++;
    oldestDaysLate = Math.max(oldestDaysLate, item.daysLate || 0);
    const dept = item.department?.name || 'بدون قسم';
    byDept.set(dept, (byDept.get(dept) || 0) + 1);
  }

  const departmentSummary = Array.from(byDept.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name}: ${count}`)
    .join('\n');

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  let sent = 0;
  for (const recipient of recipients) {
    const r = await sendNotification({
      eventKey: 'KPI_QM_DAILY_SUMMARY',
      dedupeKey: `KPI_QM_DAILY_SUMMARY:${recipient.id}:${today}`,
      recipient,
      variables: {
        managerName: recipient.name || '',
        totalOverdue: items.length,
        pendingCount: counts.pending,
        firstNoticeCount: counts.firstNotice,
        escalatedL1Count: counts.escalatedL1,
        escalatedL2Count: counts.escalatedL2,
        oldestDaysLate,
        departmentSummary,
        link: '/qms#/kpiFollowUp',
      },
      entityType: 'KpiFollowUp',
      entityId: null,
      link: '/qms#/kpiFollowUp',
      fallbackTitle: `ملخص متابعات المؤشرات المتأخرة (${items.length})`,
      fallbackMessage: `يوجد ${items.length} متابعة مؤشر نشطة. التصعيد مستوى 2: ${counts.escalatedL2}.`,
      payloadExtra: { counts, oldestDaysLate, departmentSummary },
    });
    if (r.inApp || r.dispatched) sent++;
  }

  return { sent, total: items.length, counts, oldestDaysLate };
}

/**
 * يرسل إشعارات للمسؤولين عن المتابعات المُصعّدة
 * يستخدم القوالب القابلة للتعديل (NotificationTemplate) عبر sendNotification
 * — القوالب: KPI_FIRST_NOTICE, KPI_ESCALATED_L1, KPI_ESCALATED_L2
 */
export async function notifyEscalatedFollowUps() {
  const today = new Date().toISOString().slice(0, 10);
  const sent = { firstNotice: 0, deptManager: 0, executive: 0 };

  // ─── 1. FIRST_NOTICE → إشعار مدخل البيانات ──────────────────
  const firstNotices = await prisma.kpiFollowUp.findMany({
    where: { status: 'FIRST_NOTICE' },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: { select: { name: true } },
      dataEntryUser: { select: { id: true, name: true, email: true, phone: true, role: true } },
    },
  });
  for (const f of firstNotices) {
    const dedupeKey = `KFU_FIRST_NOTICE:${f.id}:${today}`;
    const r = await sendNotification({
      eventKey: 'KPI_FIRST_NOTICE',
      dedupeKey,
      recipient: f.dataEntryUser,
      variables: buildVarsForFollowUp(f, f.dataEntryUser),
      entityType: 'KpiFollowUp',
      entityId: f.id,
      link: '/qms#/kpiFollowUp',
      fallbackTitle: `⏰ مؤشر متأخر: ${f.indicator.code}`,
      fallbackMessage: `لم تُدخل قراءة ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (متأخر ${f.daysLate} يوم).`,
    });
    if (r.inApp || r.dispatched) sent.firstNotice++;
  }

  // ─── 2. ESCALATED Level 1 → مدير القسم ──────────────────────
  const lvl1 = await prisma.kpiFollowUp.findMany({
    where: { status: 'ESCALATED', escalationLevel: 1 },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: {
        select: {
          name: true,
          users: {
            where: { role: 'DEPT_MANAGER', active: true },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      },
      dataEntryUser: { select: { name: true } },
    },
  });
  for (const f of lvl1) {
    const managers = f.department?.users || [];
    for (const mgr of managers) {
      const dedupeKey = `KFU_ESC_L1:${f.id}:${mgr.id}:${today}`;
      const r = await sendNotification({
        eventKey: 'KPI_ESCALATED_L1',
        dedupeKey,
        recipient: mgr,
        variables: buildVarsForFollowUp(f, mgr),
        entityType: 'KpiFollowUp',
        entityId: f.id,
        link: '/qms#/kpiFollowUp',
        fallbackTitle: `🚨 تصعيد: مؤشر ${f.indicator.code} متأخر`,
        fallbackMessage: `${f.dataEntryUser?.name || 'الموظف'} لم يُدخل ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (${f.daysLate} يوم).`,
      });
      if (r.inApp || r.dispatched) sent.deptManager++;
    }
  }

  // ─── 3. ESCALATED Level 2 → QM + Super Admin ────────────────
  const lvl2 = await prisma.kpiFollowUp.findMany({
    where: { status: 'ESCALATED', escalationLevel: 2 },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: { select: { name: true } },
      dataEntryUser: { select: { name: true } },
    },
  });
  if (lvl2.length > 0) {
    const execs = await prisma.user.findMany({
      where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    for (const f of lvl2) {
      for (const exec of execs) {
        const dedupeKey = `KFU_ESC_L2:${f.id}:${exec.id}:${today}`;
        const r = await sendNotification({
          eventKey: 'KPI_ESCALATED_L2',
          dedupeKey,
          recipient: exec,
          variables: buildVarsForFollowUp(f, exec),
          entityType: 'KpiFollowUp',
          entityId: f.id,
          link: '/qms#/kpiFollowUp',
          fallbackTitle: `🆘 تصعيد حرج: ${f.indicator.code}`,
          fallbackMessage: `قسم ${f.department?.name || ''} متأخر ${f.daysLate} يوم في ${f.indicator.nameAr} (${f.month}/${f.year}).`,
        });
        if (r.inApp || r.dispatched) sent.executive++;
      }
    }
  }

  return sent;
}

/**
 * الدالة الرئيسية - تُستدعى يومياً + يدوياً
 */
export async function runDailyKpiFollowUpCheck() {
  const started = Date.now();
  try {
    const preDeadline = await sendKpiPreDeadlineReminders();
    const detection = await detectAndUpdateOverdueKpis();
    const notifications = await notifyEscalatedFollowUps();
    const qmSummary = await sendKpiQualityManagerDailySummary();
    const ms = Date.now() - started;

    console.log(
      `[kpiFollowUp] ✓ ${ms}ms | indicators=${detection.indicatorsChecked} periods=${detection.periodsChecked} | created=${detection.created} updated=${detection.updated} resolved=${detection.resolved} aborted=${detection.aborted} | skip(noDept=${detection.skippedNoDept}, noUser=${detection.skippedNoUser}) | preDeadline=${preDeadline.sent || 0} notified=${notifications.firstNotice + notifications.deptManager + notifications.executive} qmSummary=${qmSummary.sent || 0}`
    );

    return { ...detection, ...notifications, preDeadline, qmSummary };
  } catch (e) {
    console.error('[kpiFollowUp] check failed:', e);
    throw e;
  }
}
