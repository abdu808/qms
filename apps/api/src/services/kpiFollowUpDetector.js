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
import { dispatchIntegrationEvent } from './integrationDelivery.js';

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

async function dispatchKpiFollowUpReminder({ event, eventKey, followUp, recipient, title, message }) {
  if (!recipient?.id) return;
  await dispatchIntegrationEvent({
    event,
    eventKey: `${eventKey}:N8N`,
    title,
    message,
    recipient,
    entityType: 'KpiFollowUp',
    entityId: followUp.id,
    link: '/qms#/kpiFollowUp',
    data: {
      followUpId: followUp.id,
      followUpCode: followUp.code,
      indicatorCode: followUp.indicator?.code || null,
      indicatorName: followUp.indicator?.nameAr || null,
      departmentName: followUp.department?.name || null,
      year: followUp.year,
      month: followUp.month,
      daysLate: followUp.daysLate,
      status: followUp.status,
      escalationLevel: followUp.escalationLevel,
    },
  });
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

/**
 * يرسل إشعارات للمسؤولين عن المتابعات المُصعّدة
 */
export async function notifyEscalatedFollowUps() {
  const today = new Date().toISOString().slice(0, 10);
  const sent = { firstNotice: 0, deptManager: 0, executive: 0 };

  // 1. FIRST_NOTICE → إشعار مدخل البيانات
  const firstNotices = await prisma.kpiFollowUp.findMany({
    where: { status: 'FIRST_NOTICE' },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: { select: { name: true } },
      dataEntryUser: { select: { id: true, name: true, email: true, phone: true, role: true } },
    },
  });
  for (const f of firstNotices) {
    const eventKey = `KFU_FIRST_NOTICE:${f.id}:${today}`;
    const externalTitle = `مؤشر متأخر: ${f.indicator.code}`;
    const externalMessage = `لم تدخل قراءة ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (متأخر ${f.daysLate} يوم).`;
    const r = await prisma.notification.createMany({
      data: [{
        userId: f.dataEntryUserId,
        type: 'KPI_OVERDUE',
        title: `⏰ مؤشر متأخر: ${f.indicator.code}`,
        message: `لم تُدخل قراءة ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (متأخر ${f.daysLate} يوم).`,
        link: '/qms#/kpiFollowUp',
        entityType: 'KpiFollowUp',
        entityId: f.id,
        eventKey,
      }],
      skipDuplicates: true,
    });
    if (r.count > 0) {
      sent.firstNotice++;
      await dispatchKpiFollowUpReminder({
        event: 'KPI_FOLLOWUP_FIRST_NOTICE',
        eventKey,
        followUp: f,
        recipient: f.dataEntryUser,
        title: externalTitle,
        message: externalMessage,
      });
    }
  }

  // 2. ESCALATED Level 1 → إشعار مدير القسم
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
      const eventKey = `KFU_ESC_L1:${f.id}:${mgr.id}:${today}`;
      const externalTitle = `تصعيد: مؤشر ${f.indicator.code} متأخر`;
      const externalMessage = `${f.dataEntryUser?.name || 'الموظف'} لم يدخل ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (${f.daysLate} يوم).`;
      const r = await prisma.notification.createMany({
        data: [{
          userId: mgr.id,
          type: 'KPI_ESCALATED',
          title: `🚨 تصعيد: مؤشر ${f.indicator.code} متأخر`,
          message: `${f.dataEntryUser?.name || 'الموظف'} لم يُدخل ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (${f.daysLate} يوم).`,
          link: '/qms#/kpiFollowUp',
          entityType: 'KpiFollowUp',
          entityId: f.id,
          eventKey,
        }],
        skipDuplicates: true,
      });
      if (r.count > 0) {
        sent.deptManager++;
        await dispatchKpiFollowUpReminder({
          event: 'KPI_FOLLOWUP_ESCALATED_L1',
          eventKey,
          followUp: f,
          recipient: mgr,
          title: externalTitle,
          message: externalMessage,
        });
      }
    }
  }

  // 3. ESCALATED Level 2 → إشعار QM + Super Admin
  const lvl2 = await prisma.kpiFollowUp.findMany({
    where: { status: 'ESCALATED', escalationLevel: 2 },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: { select: { name: true } },
    },
  });
  if (lvl2.length > 0) {
    const execs = await prisma.user.findMany({
      where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    for (const f of lvl2) {
      for (const exec of execs) {
        const eventKey = `KFU_ESC_L2:${f.id}:${exec.id}:${today}`;
        const externalTitle = `تصعيد حرج: ${f.indicator.code}`;
        const externalMessage = `قسم ${f.department?.name || ''} متأخر ${f.daysLate} يوم في ${f.indicator.nameAr} (${f.month}/${f.year}).`;
        const r = await prisma.notification.createMany({
          data: [{
            userId: exec.id,
            type: 'KPI_ESCALATED_HIGH',
            title: `🆘 تصعيد حرج: ${f.indicator.code}`,
            message: `قسم ${f.department?.name || ''} متأخر ${f.daysLate} يوم في ${f.indicator.nameAr} (${f.month}/${f.year}).`,
            link: '/qms#/kpiFollowUp',
            entityType: 'KpiFollowUp',
            entityId: f.id,
            eventKey,
          }],
          skipDuplicates: true,
        });
        if (r.count > 0) {
          sent.executive++;
          await dispatchKpiFollowUpReminder({
            event: 'KPI_FOLLOWUP_ESCALATED_L2',
            eventKey,
            followUp: f,
            recipient: exec,
            title: externalTitle,
            message: externalMessage,
          });
        }
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
    const detection = await detectAndUpdateOverdueKpis();
    const notifications = await notifyEscalatedFollowUps();
    const ms = Date.now() - started;

    console.log(
      `[kpiFollowUp] ✓ ${ms}ms | indicators=${detection.indicatorsChecked} periods=${detection.periodsChecked} | created=${detection.created} updated=${detection.updated} resolved=${detection.resolved} aborted=${detection.aborted} | skip(noDept=${detection.skippedNoDept}, noUser=${detection.skippedNoUser}) | notified=${notifications.firstNotice + notifications.deptManager + notifications.executive}`
    );

    return { ...detection, ...notifications };
  } catch (e) {
    console.error('[kpiFollowUp] check failed:', e);
    throw e;
  }
}
