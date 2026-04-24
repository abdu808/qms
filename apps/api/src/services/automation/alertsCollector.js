/**
 * services/automation/alertsCollector.js — جامع التنبيهات الاستباقية
 *
 * يفحص كل بنود النظام ويُنتج قائمة تنبيهات مصنَّفة.
 * يُستدعى من:
 *   - GET /api/automation/alerts (n8n بشكل دوري)
 *   - يدوياً من المستشار
 *
 * كل تنبيه له: severity (CRITICAL|HIGH|MEDIUM|LOW), type, message, action
 */
import { prisma } from '../../db.js';

/**
 * @param {object} [opts]
 * @param {number} [opts.thresholdDays] — أيام لاعتبار البند "مُهدَّداً" (افتراضي 7)
 * @returns {object} { alerts[], counts, generatedAt }
 */
export async function collectAlerts({ thresholdDays = 7 } = {}) {
  const now     = new Date();
  const soon    = new Date(Date.now() + thresholdDays * 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const alerts = [];

  // ── 1. NCRs متأخرة ────────────────────────────────────────────────────────
  const overdueNcrs = await prisma.nCR.findMany({
    where: { status: { not: 'CLOSED' }, dueDate: { lt: now } },
    select: { code: true, title: true, severity: true, dueDate: true, department: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });
  for (const ncr of overdueNcrs) {
    const daysLate = Math.floor((now - ncr.dueDate) / 86400000);
    alerts.push({
      severity:   ncr.severity === 'مرتفعة' ? 'CRITICAL' : 'HIGH',
      type:       'NCR_OVERDUE',
      code:       ncr.code,
      title:      ncr.title,
      department: ncr.department?.name,
      message:    `${ncr.code} متأخر ${daysLate} يوم — ${ncr.title}`,
      action:     'راجع وأغلق أو مدِّد',
      daysLate,
    });
  }

  // ── 2. CAPAs تستحق قريباً أو متأخرة ─────────────────────────────────────
  const urgentCapas = await prisma.cAPA.findMany({
    where: {
      status: { notIn: ['CLOSED', 'CANCELLED'] },
      dueDate: { lt: soon },
    },
    select: { code: true, title: true, status: true, dueDate: true },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });
  for (const capa of urgentCapas) {
    const isOverdue = capa.dueDate < now;
    const daysLeft  = Math.floor((capa.dueDate - now) / 86400000);
    alerts.push({
      severity:  isOverdue ? 'HIGH' : 'MEDIUM',
      type:      isOverdue ? 'CAPA_OVERDUE' : 'CAPA_DUE_SOON',
      code:      capa.code,
      title:     capa.title,
      message:   isOverdue
        ? `${capa.code} متأخر ${Math.abs(daysLeft)} يوم — ${capa.title}`
        : `${capa.code} يستحق خلال ${daysLeft} يوم — ${capa.title}`,
      action:    'تحقق من حالة التنفيذ',
      daysLeft,
    });
  }

  // ── 3. شكاوى مفتوحة قديمة (أكثر من 7 أيام بدون تحديث) ──────────────────
  const staleComplaints = await prisma.complaint.findMany({
    where: {
      status: { notIn: ['CLOSED', 'REJECTED', 'RESOLVED'] },
      updatedAt: { lt: weekAgo },
    },
    select: { code: true, subject: true, severity: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 15,
  });
  for (const c of staleComplaints) {
    const daysSinceUpdate = Math.floor((now - c.updatedAt) / 86400000);
    alerts.push({
      severity:  c.severity === 'مرتفعة' ? 'HIGH' : 'MEDIUM',
      type:      'COMPLAINT_STALE',
      code:      c.code,
      title:     c.subject,
      message:   `${c.code} بدون تحديث منذ ${daysSinceUpdate} يوم — ${c.subject}`,
      action:    'تابع مع المسؤول',
      daysSinceUpdate,
    });
  }

  // ── 4. مؤشرات KPI بدون قيم في آخر 30 يوم (بيانات مفقودة) ───────────────
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const objectivesNoKpi = await prisma.objective.findMany({
    where: {
      status: { notIn: ['CANCELLED', 'ACHIEVED'] },
      kpiEntries: { none: { createdAt: { gte: monthAgo } } },
    },
    select: { code: true, title: true, department: { select: { name: true } } },
    take: 15,
  });
  for (const obj of objectivesNoKpi) {
    alerts.push({
      severity:   'LOW',
      type:       'KPI_NO_DATA',
      code:       obj.code,
      title:      obj.title,
      department: obj.department?.name,
      message:    `${obj.code} بدون تحديث KPI في آخر 30 يوم — ${obj.title}`,
      action:     'أدخل القيم الفعلية للمؤشر',
    });
  }

  // ── 5. مخاطر مرتفعة/حرجة بدون مراجعة منذ 90 يوم ────────────────────────
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const staleRisks = await prisma.risk.findMany({
    where: {
      level: { in: ['مرتفع', 'حرج'] },
      status: { not: 'CLOSED' },
      updatedAt: { lt: ninetyDaysAgo },
    },
    select: { code: true, title: true, level: true, updatedAt: true },
    take: 10,
  });
  for (const r of staleRisks) {
    const daysSince = Math.floor((now - r.updatedAt) / 86400000);
    alerts.push({
      severity: r.level === 'حرج' ? 'CRITICAL' : 'HIGH',
      type:     'RISK_STALE',
      code:     r.code,
      title:    r.title,
      message:  `${r.code} (${r.level}) لم يُراجَع منذ ${daysSince} يوم — ${r.title}`,
      action:   'راجع وحدِّث حالة المخاطر',
      daysSince,
    });
  }

  // ── 6. تدقيقات مخططة قريباً (خلال 7 أيام) ───────────────────────────────
  const upcomingAudits = await prisma.audit.findMany({
    where: {
      status: 'PLANNED',
      plannedDate: { gte: now, lte: soon },
    },
    select: { code: true, title: true, plannedDate: true, type: true },
    orderBy: { plannedDate: 'asc' },
    take: 5,
  });
  for (const audit of upcomingAudits) {
    const daysUntil = Math.floor((audit.plannedDate - now) / 86400000);
    alerts.push({
      severity: 'MEDIUM',
      type:     'AUDIT_UPCOMING',
      code:     audit.code,
      title:    audit.title,
      message:  `${audit.code} مجدول خلال ${daysUntil} يوم — ${audit.title}`,
      action:   'تأكد من جاهزية فريق التدقيق والوثائق',
      daysUntil,
    });
  }

  // ── ترتيب وإحصاء ──────────────────────────────────────────────────────────
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  const counts = {
    total:    alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    high:     alerts.filter(a => a.severity === 'HIGH').length,
    medium:   alerts.filter(a => a.severity === 'MEDIUM').length,
    low:      alerts.filter(a => a.severity === 'LOW').length,
  };

  return {
    alerts,
    counts,
    generatedAt: now.toISOString(),
    requiresAction: counts.critical + counts.high,
  };
}
