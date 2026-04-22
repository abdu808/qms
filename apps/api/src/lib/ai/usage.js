/**
 * usage.js — تسجيل استخدام AI + فحص الميزانية + ملخصات
 */
import { prisma } from '../../db.js';

/** يُرجع بداية الشهر الحالي (UTC) */
function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** يُسجِّل استدعاء AI */
export async function logUsage({
  provider, model, feature,
  inputTokens = 0, outputTokens = 0,
  costUSD = 0, durationMs = 0,
  userId = null, success = true, errorMessage = null,
  piiRedacted = false, metadata = null,
}) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        provider: String(provider || 'unknown'),
        model:    String(model || 'unknown'),
        feature:  String(feature || 'unknown'),
        inputTokens:  Math.max(0, Math.round(inputTokens)),
        outputTokens: Math.max(0, Math.round(outputTokens)),
        costUSD:      Math.max(0, Number(costUSD) || 0),
        durationMs:   Math.max(0, Math.round(durationMs)),
        userId:       userId || null,
        success:      !!success,
        errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : null,
        piiRedacted:  !!piiRedacted,
        metadata:     metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      },
    });
  } catch (e) {
    // لا نُكسر الـ flow إن فشل التسجيل
    console.warn('[ai/usage] log failed:', e.message);
  }
}

/** إجمالي التكلفة الشهرية */
export async function getMonthlyCost() {
  const from = startOfMonth();
  try {
    const r = await prisma.aiUsageLog.aggregate({
      _sum: { costUSD: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      where: { createdAt: { gte: from }, success: true },
    });
    return {
      costUSD:       Number(r._sum.costUSD || 0),
      inputTokens:   Number(r._sum.inputTokens || 0),
      outputTokens:  Number(r._sum.outputTokens || 0),
      requestCount:  Number(r._count._all || 0),
      periodStart:   from.toISOString(),
    };
  } catch (e) {
    console.warn('[ai/usage] getMonthlyCost failed:', e.message);
    return { costUSD: 0, inputTokens: 0, outputTokens: 0, requestCount: 0, periodStart: from.toISOString() };
  }
}

/** يفحص هل هناك ميزانية متاحة — يرمي خطأ إن تجاوزت */
export async function assertBudget(budgetUSD, estimatedCost = 0) {
  if (!budgetUSD || budgetUSD <= 0) return; // لا حد
  const { costUSD } = await getMonthlyCost();
  if (costUSD + estimatedCost > budgetUSD) {
    const err = new Error(
      `تم تجاوز الميزانية الشهرية لـ AI — الحد: $${budgetUSD.toFixed(2)}، المستخدم: $${costUSD.toFixed(2)}، التقدير: $${estimatedCost.toFixed(4)}`
    );
    err.code = 'AI_BUDGET_EXCEEDED';
    err.status = 429;
    throw err;
  }
}

/** ملخص تفصيلي لـ dashboard الإعدادات */
export async function getUsageSummary() {
  const monthly = await getMonthlyCost();
  const from = startOfMonth();

  // توزيع حسب feature
  let byFeature = [];
  try {
    byFeature = await prisma.aiUsageLog.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: from }, success: true },
      _sum: { costUSD: true },
      _count: { _all: true },
    });
  } catch { /* silent */ }

  // توزيع حسب provider
  let byProvider = [];
  try {
    byProvider = await prisma.aiUsageLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: from }, success: true },
      _sum: { costUSD: true },
      _count: { _all: true },
    });
  } catch { /* silent */ }

  // آخر 10 استدعاءات
  let recent = [];
  try {
    recent = await prisma.aiUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, provider: true, model: true, feature: true,
        inputTokens: true, outputTokens: true, costUSD: true,
        durationMs: true, success: true, errorMessage: true, createdAt: true,
      },
    });
  } catch { /* silent */ }

  return {
    monthly,
    byFeature: byFeature.map(r => ({
      feature: r.feature,
      costUSD: Number(r._sum.costUSD || 0),
      requests: Number(r._count._all || 0),
    })),
    byProvider: byProvider.map(r => ({
      provider: r.provider,
      costUSD: Number(r._sum.costUSD || 0),
      requests: Number(r._count._all || 0),
    })),
    recent,
  };
}
