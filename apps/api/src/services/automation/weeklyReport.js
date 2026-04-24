/**
 * services/automation/weeklyReport.js — مولِّد التقرير الأسبوعي
 *
 * يُنتج تقريراً أسبوعياً شاملاً بنداء AI واحد (Sonnet).
 * يُستدعى من:
 *   - POST /api/automation/weekly-report (n8n كل أحد)
 *   - يدوياً من المستشار ("ولِّد التقرير الأسبوعي")
 *
 * الناتج: نص منظم يمكن إرساله بالبريد أو WhatsApp عبر n8n.
 */
import { aiComplete } from '../../lib/ai/index.js';
import { prisma }     from '../../db.js';

/**
 * @param {object} opts
 * @param {'management'|'quality_manager'|'all'} [opts.targetAudience]
 * @param {'ar'|'en'} [opts.language]
 * @returns {object} { text, sections, generatedAt, stats }
 */
export async function generateWeeklyReport({ targetAudience = 'management', language = 'ar' } = {}) {
  // ── جمع البيانات ─────────────────────────────────────────────────────────
  const snapshot = await collectSystemSnapshot();

  // ── بناء البرومت ──────────────────────────────────────────────────────────
  const audience = {
    management:     'الإدارة العليا — بالغ الإيجاز والوضوح، بدون تفاصيل تقنية',
    quality_manager: 'مدير الجودة — تفصيلي، مع توصيات قابلة للتنفيذ',
    all:            'جميع الأطراف — متوازن',
  }[targetAudience] || 'الإدارة العليا';

  const prompt = `أنت مستشار جودة متخصص. ولِّد تقريراً أسبوعياً لـ: ${audience}.

بيانات النظام (الأسبوع الحالي):
${JSON.stringify(snapshot, null, 2)}

اكتب التقرير بـ ${language === 'ar' ? 'العربية' : 'الإنجليزية'} بالبنية التالية:

## 📊 ملخص تنفيذي
[جملتان: الحالة العامة + أبرز إنجاز]

## 🎯 أداء المؤشرات
[قائمة نقطية: المؤشرات الحرجة فقط، مع الاتجاه (↑ ↓ →)]

## ⚠️ يستدعي الانتباه
[أقصى 5 بنود حرجة — NCR، CAPA، مؤشرات متأخرة — مرتبة بالأولوية]

## ✅ إنجازات الأسبوع
[أقصى 3 إنجازات]

## 📋 توصيات للأسبوع القادم
[أقصى 3 توصيات قابلة للتنفيذ]

---
درجة الصحة التنظيمية: ${snapshot.healthScore}/100 ${snapshot.healthLabel}`;

  // ── استدعاء AI واحد ───────────────────────────────────────────────────────
  const result = await aiComplete({
    system: 'أنت مستشار جودة يُعِد تقارير إدارية موجزة ومؤثرة.',
    messages: [{ role: 'user', content: prompt }],
    feature:   'weekly_report',
    maxTokens: 1500,
  });

  return {
    text:        result.content,
    generatedAt: new Date().toISOString(),
    targetAudience,
    stats:       snapshot,
    aiCost:      result.usage?.costUSD || 0,
  };
}

// ── جمع البيانات الإحصائية ────────────────────────────────────────────────
async function collectSystemSnapshot() {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    ncrsOverdue, ncrsNew, ncrsClosedThisWeek,
    capasOverdue, capasNew,
    complaintsOpen, complaintsNew, complaintsResolved,
    objectivesAchieved, objectivesAtRisk, objectivesOverdue,
    activitiesCompleted, activitiesOverdue,
    risksHigh, auditsDue,
    kpiEntriesThisWeek,
  ] = await Promise.all([
    prisma.nCR.count({ where: { status: { not: 'CLOSED' }, dueDate: { lt: now } } }),
    prisma.nCR.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.nCR.count({ where: { status: 'CLOSED', updatedAt: { gte: weekAgo } } }),
    prisma.cAPA.count({ where: { status: { notIn: ['CLOSED','CANCELLED'] }, dueDate: { lt: now } } }),
    prisma.cAPA.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.complaint.count({ where: { status: { notIn: ['CLOSED','REJECTED'] } } }),
    prisma.complaint.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.complaint.count({ where: { status: { in: ['RESOLVED','CLOSED'] }, updatedAt: { gte: weekAgo } } }),
    prisma.objective.count({ where: { status: 'ACHIEVED' } }),
    Promise.resolve(0), // atRisk — يحتاج raw query لمقارنة حقلين: تُترك للتحسين لاحقاً
    prisma.objective.count({ where: { status: { notIn: ['ACHIEVED','CANCELLED'] }, dueDate: { lt: now } } }),
    prisma.operationalActivity.count({ where: { status: 'COMPLETED', updatedAt: { gte: weekAgo } } }),
    prisma.operationalActivity.count({ where: { status: { notIn: ['COMPLETED','CANCELLED'] }, endDate: { lt: now } } }),
    prisma.risk.count({ where: { level: { in: ['مرتفع','حرج'] }, status: { not: 'CLOSED' } } }),
    prisma.audit.count({ where: { status: 'PLANNED', plannedDate: { lte: new Date(Date.now() + 14 * 86400000) } } }),
    prisma.kpiEntry.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  // حساب درجة الصحة
  let healthScore = 100;
  healthScore -= Math.min(ncrsOverdue   * 5, 25);
  healthScore -= Math.min(capasOverdue  * 5, 25);
  healthScore -= Math.min(complaintsOpen* 2, 20);
  healthScore -= Math.min(objectivesOverdue * 3, 15);
  healthScore -= Math.min(risksHigh     * 3, 15);
  healthScore  = Math.max(0, healthScore);

  const healthLabel =
    healthScore >= 85 ? '🟢 ممتاز' :
    healthScore >= 70 ? '🟡 جيد'   :
    healthScore >= 55 ? '🟠 مقبول' :
    healthScore >= 40 ? '🔴 ضعيف'  : '🔴 حرج';

  return {
    healthScore,
    healthLabel,
    ncrs:       { overdue: ncrsOverdue, new: ncrsNew, closedThisWeek: ncrsClosedThisWeek },
    capas:      { overdue: capasOverdue, new: capasNew },
    complaints: { open: complaintsOpen, new: complaintsNew, resolvedThisWeek: complaintsResolved },
    objectives: { achieved: objectivesAchieved, atRisk: objectivesAtRisk, overdue: objectivesOverdue },
    activities: { completedThisWeek: activitiesCompleted, overdue: activitiesOverdue },
    risks:      { highCritical: risksHigh },
    audits:     { due14Days: auditsDue },
    kpi:        { entriesThisWeek: kpiEntriesThisWeek },
  };
}
