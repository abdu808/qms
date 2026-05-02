/**
 * services/kpiFollowUpDetector.js
 *
 * المحرّك الذكي لاكتشاف الإدخالات المتأخرة تلقائياً.
 *
 * يعمل يومياً:
 *   1. يفحص جميع المؤشرات الشهرية النشطة
 *   2. يحسب dueDate لكل مؤشر (نهاية الشهر + 5 أيام إمهال)
 *   3. ينشئ KpiFollowUp إذا لم يُدخل في الموعد
 *   4. يتدرّج الحالة تلقائياً حسب أيام التأخير:
 *      • Day 0-4   → PENDING
 *      • Day 5-9   → FIRST_NOTICE     (إشعار أول)
 *      • Day 10-14 → ESCALATED Lvl 1  (مدير القسم)
 *      • Day 15-19 → ESCALATED Lvl 2  (المدير التنفيذي)
 *      • Day 20+   → ABORTED          (يحتاج تدخل تحقيقي)
 *   5. يحلّ المتابعة تلقائياً عند إدخال البيانات
 */

import { prisma } from '../db.js';

// ─── ثوابت التدرج (قابلة للضبط) ─────────────────────────────────
const ESCALATION_THRESHOLDS = {
  FIRST_NOTICE: 5,    // بعد 5 أيام من dueDate
  ESCALATE_L1: 10,    // بعد 10 أيام → مدير القسم
  ESCALATE_L2: 15,    // بعد 15 يوم → المدير التنفيذي
  ABORT: 20,          // بعد 20 يوم → يحتاج تحقيق
};

// ─── حساب dueDate لمؤشر شهري ───────────────────────────────────
// dueDate = آخر يوم في الشهر + 5 أيام إمهال للإدخال
function calculateDueDate(year, month) {
  // آخر يوم في الشهر
  const lastDay = new Date(year, month, 0); // month here is 1-12, Date wants 0-11 + 1 = month+1-1
  // + 5 أيام إمهال
  lastDay.setDate(lastDay.getDate() + 5);
  return lastDay;
}

// ─── حساب أيام التأخير ─────────────────────────────────────────
function calculateDaysLate(dueDate, referenceDate = new Date()) {
  const ms = referenceDate.getTime() - dueDate.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ─── تحديد الحالة المناسبة حسب الأيام ───────────────────────────
function determineStatus(daysLate) {
  if (daysLate < ESCALATION_THRESHOLDS.FIRST_NOTICE) return { status: 'PENDING', escalationLevel: 0 };
  if (daysLate < ESCALATION_THRESHOLDS.ESCALATE_L1) return { status: 'FIRST_NOTICE', escalationLevel: 0 };
  if (daysLate < ESCALATION_THRESHOLDS.ESCALATE_L2) return { status: 'ESCALATED', escalationLevel: 1 };
  if (daysLate < ESCALATION_THRESHOLDS.ABORT)       return { status: 'ESCALATED', escalationLevel: 2 };
  return { status: 'ABORTED', escalationLevel: 2 };
}

// ─── يحدد الفترات الشهرية التي يجب فحصها ────────────────────────
// يفحص الشهر الحالي + الشهر السابق (للتأكد من عدم نسيان متأخرات قديمة)
function getPeriodsToCheck() {
  const periods = [];
  const now = new Date();
  // الشهر السابق
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  periods.push({ year: prev.getFullYear(), month: prev.getMonth() + 1 });
  // الشهر الحالي (إذا تجاوزنا dueDate)
  periods.push({ year: now.getFullYear(), month: now.getMonth() + 1 });
  return periods;
}

/**
 * المحرّك الرئيسي - يكتشف ويحدّث الإدخالات المتأخرة
 * @returns {Promise<{created: number, updated: number, resolved: number}>}
 */
export async function detectAndUpdateOverdueKpis() {
  const stats = { created: 0, updated: 0, resolved: 0, aborted: 0 };
  const now = new Date();
  const periods = getPeriodsToCheck();

  for (const { year, month } of periods) {
    const dueDate = calculateDueDate(year, month);

    // إذا لم يصل dueDate بعد، تخطّ
    if (now < dueDate) continue;

    const daysLate = calculateDaysLate(dueDate, now);
    const { status, escalationLevel } = determineStatus(daysLate);

    // ─── جلب جميع المؤشرات الشهرية النشطة ──────────────────────
    const indicators = await prisma.indicator.findMany({
      where: {
        frequency: 'MONTHLY',
        // المؤشر يجب أن يكون له dataEntryUser محدد
        dataEntryUserId: { not: null },
        // وأن يكون نشطاً (deletedAt is null)
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        dataEntryUserId: true,
        ownerId: true,
        objective: { select: { departmentId: true } },
      },
    });

    for (const indicator of indicators) {
      // ─── تخطّي إن لم يكن للمؤشر قسم محدّد ─────────────────────
      const departmentId = indicator.objective?.departmentId;
      if (!departmentId) continue;

      // ─── فحص: هل تم إدخال البيانات لهذه الفترة؟ ─────────────────
      const entry = await prisma.kpiEntry.findFirst({
        where: {
          indicatorId: indicator.id,
          year,
          month,
          // أي إدخال (DRAFT أو SUBMITTED أو APPROVED) يُعتبر إنجاز
        },
        select: { id: true, entryStatus: true, submittedAt: true },
      });

      // ─── جلب المتابعة الحالية إن وُجدت ─────────────────────────
      const existing = await prisma.kpiFollowUp.findUnique({
        where: {
          indicatorId_year_month: {
            indicatorId: indicator.id,
            year,
            month,
          },
        },
      });

      // ─── السيناريو 1: تم الإدخال + يوجد متابعة → حلّ تلقائي ──
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

      // ─── السيناريو 2: تم الإدخال + لا يوجد متابعة → تخطّ ─────
      if (entry) continue;

      // ─── السيناريو 3: لم يُدخل + لا يوجد متابعة → إنشاء جديد ─
      if (!existing) {
        // توليد الرمز
        const count = await prisma.kpiFollowUp.count();
        const code = `KFU-${year}-${String(count + 1).padStart(4, '0')}`;

        await prisma.kpiFollowUp.create({
          data: {
            code,
            indicatorId: indicator.id,
            departmentId,
            dataEntryUserId: indicator.dataEntryUserId,
            performanceOwnerId: indicator.ownerId,
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
      }
      // ─── السيناريو 4: لم يُدخل + يوجد متابعة → تحديث الحالة ──
      else if (existing.status !== 'RESOLVED' && existing.status !== 'ABORTED') {
        const updated = {
          daysLate,
          status,
          escalationLevel,
        };

        // تسجيل تاريخ التصعيد فقط في أول مرة
        if (escalationLevel > existing.escalationLevel && !existing.escalatedAt) {
          updated.escalatedAt = new Date();
        }

        // تجنب التحديث إن لم يتغيّر شيء
        if (existing.status !== status || existing.escalationLevel !== escalationLevel || existing.daysLate !== daysLate) {
          await prisma.kpiFollowUp.update({
            where: { id: existing.id },
            data: updated,
          });

          if (status === 'ABORTED') stats.aborted++;
          else stats.updated++;
        }
      }
    }
  }

  return stats;
}

/**
 * يرسل إشعارات للمسؤولين عن المتابعات المُصعّدة
 * يستخدم notifyOnce pattern (idempotent باستخدام eventKey يومي)
 */
export async function notifyEscalatedFollowUps() {
  const today = new Date().toISOString().slice(0, 10);
  const sent = { firstNotice: 0, deptManager: 0, executive: 0 };

  // ─── 1. FIRST_NOTICE → إشعار مدخل البيانات ─────────────────
  const firstNotices = await prisma.kpiFollowUp.findMany({
    where: { status: 'FIRST_NOTICE' },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: { select: { name: true } },
    },
  });

  for (const f of firstNotices) {
    const eventKey = `KFU_FIRST_NOTICE:${f.id}:${today}`;
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
    if (r.count > 0) sent.firstNotice++;
  }

  // ─── 2. ESCALATED Level 1 → إشعار مدير القسم ───────────────
  const lvl1 = await prisma.kpiFollowUp.findMany({
    where: { status: 'ESCALATED', escalationLevel: 1 },
    include: {
      indicator: { select: { code: true, nameAr: true } },
      department: {
        select: {
          name: true,
          users: {
            where: { role: 'DEPT_MANAGER', active: true },
            select: { id: true },
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
      const r = await prisma.notification.createMany({
        data: [{
          userId: mgr.id,
          type: 'KPI_ESCALATED',
          title: `🚨 تصعيد: مؤشر ${f.indicator.code} متأخر`,
          message: `${f.dataEntryUser?.name || 'الموظف'} لم يُدخل قراءة ${f.indicator.nameAr} لشهر ${f.month}/${f.year} (متأخر ${f.daysLate} يوم) — تدخّل مطلوب.`,
          link: '/qms#/kpiFollowUp',
          entityType: 'KpiFollowUp',
          entityId: f.id,
          eventKey,
        }],
        skipDuplicates: true,
      });
      if (r.count > 0) sent.deptManager++;
    }
  }

  // ─── 3. ESCALATED Level 2 → إشعار QM + Super Admin ─────────
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
      select: { id: true },
    });

    for (const f of lvl2) {
      for (const exec of execs) {
        const eventKey = `KFU_ESC_L2:${f.id}:${exec.id}:${today}`;
        const r = await prisma.notification.createMany({
          data: [{
            userId: exec.id,
            type: 'KPI_ESCALATED_HIGH',
            title: `🆘 تصعيد حرج: ${f.indicator.code}`,
            message: `قسم ${f.department?.name || ''} متأخر ${f.daysLate} يوم في إدخال ${f.indicator.nameAr} (${f.month}/${f.year}). تدخّل تنفيذي مطلوب.`,
            link: '/qms#/kpiFollowUp',
            entityType: 'KpiFollowUp',
            entityId: f.id,
            eventKey,
          }],
          skipDuplicates: true,
        });
        if (r.count > 0) sent.executive++;
      }
    }
  }

  return sent;
}

/**
 * الدالة الرئيسية - تُستدعى يومياً من scheduler
 */
export async function runDailyKpiFollowUpCheck() {
  const started = Date.now();
  try {
    const detection = await detectAndUpdateOverdueKpis();
    const notifications = await notifyEscalatedFollowUps();
    const ms = Date.now() - started;

    console.log(
      `[kpiFollowUp] ✓ ${ms}ms | created=${detection.created} updated=${detection.updated} resolved=${detection.resolved} aborted=${detection.aborted} | notified=${notifications.firstNotice + notifications.deptManager + notifications.executive}`
    );

    return { ...detection, ...notifications };
  } catch (e) {
    console.error('[kpiFollowUp] check failed:', e);
    throw e;
  }
}
