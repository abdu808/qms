/**
 * services/progressReportService.js
 *
 * المحقق الشهري (Digital Quality Employee)
 * ══════════════════════════════════════════════════════
 *   generateReport()           — يبني التقرير تلقائياً من بيانات QMS + يولّد أسئلة AI
 *   scoreReport()              — يحسب درجة 0-100 لأداء القسم
 *   extractContext()           — يجمع السياق الخاص بقسم واحد (للـ AI)
 *   compareDepartments()       — مقارنة أفقية + رتّب
 *   detectTrends()             — اكتشاف الاتجاهات عبر الزمن
 *   detectCrossContradictions()— تناقضات بين الأقسام
 *   extractPromises()          — يستخرج الوعود من إجابات التقرير للشهر القادم
 * ══════════════════════════════════════════════════════
 */
import { PrismaClient } from '@prisma/client';
import { aiComplete } from '../lib/ai/index.js';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// 1. جمع السياق الخاص بقسم — البيانات التي ستبني عليها الطبقات الأربع
// ─────────────────────────────────────────────────────────────────────────────

export async function extractContext({ departmentId, year, month }) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  const deptName = dept?.name || '';

  const [objectives, activities, risks, ncrs, capas, complaints, trainings, previousReports] = await Promise.all([
    prisma.objective.findMany({
      where: { departmentId, deletedAt: null },
      include: {
        kpiEntries: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 },
        owner: { select: { id: true, name: true } },
      },
    }),

    // OperationalActivity.department هو حقل نصي (اسم الإدارة)، ليس FK
    // نُطابقه بنص اسم القسم
    prisma.operationalActivity.findMany({
      where: {
        deletedAt: null,
        ...(deptName ? { department: deptName } : {}),
      },
      include: { kpiEntries: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 } },
      take: 50,
    }).catch(() => []),

    prisma.risk.findMany({
      where: { departmentId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),

    prisma.nCR.findMany({
      where: { departmentId, deletedAt: null, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),

    // CAPA لا يحوي departmentId — نُرجع المفتوح فقط
    prisma.capa.findMany({
      where: { deletedAt: null, status: { notIn: ['CLOSED', 'VERIFIED'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }).catch(() => []),

    // Complaint لا يحوي departmentId — نُرجع ما يخص هذا الشهر
    prisma.complaint.findMany({
      where: { deletedAt: null, receivedAt: { gte: startOfMonth(year, month - 2) } },
      orderBy: { receivedAt: 'desc' },
    }).catch(() => []),

    // Training: حقل التاريخ اسمه `date` ولا يوجد deletedAt ولا status
    prisma.training.findMany({
      where: { date: { gte: startOfMonth(year, month - 1) } },
    }).catch(() => []),

    prisma.progressReport.findMany({
      where: { departmentId, deletedAt: null, status: { in: ['APPROVED', 'SUBMITTED'] } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 3,
    }).catch(() => []),
  ]);

  // معالجة: مؤشرات تحتاج قيمة هذا الشهر
  const kpisNeedingValue = [];
  for (const obj of objectives) {
    const hasThisMonth = obj.kpiEntries.some(k => k.year === year && k.month === month);
    if (!hasThisMonth) {
      const trend = obj.kpiEntries.slice(0, 3).reverse().map(k => k.actualValue);
      kpisNeedingValue.push({
        id: obj.id,
        type: 'objective',
        title: obj.title,
        kpi: obj.kpi,
        target: obj.target,
        unit: obj.unit,
        direction: obj.direction,
        trend,
        lastValue: trend[trend.length - 1] ?? null,
      });
    }
  }

  // الوعود من التقارير السابقة
  const previousPromises = [];
  for (const r of previousReports) {
    if (!r.extractedPromises) continue;
    try {
      const proms = JSON.parse(r.extractedPromises);
      for (const p of proms) {
        previousPromises.push({ ...p, fromReport: `${r.year}-${String(r.month).padStart(2, '0')}` });
      }
    } catch {}
  }

  return {
    department: { id: dept?.id, name: dept?.name, code: dept?.code },
    period: { year, month, label: `${year}-${String(month).padStart(2, '0')}` },
    owned: {
      objectives: objectives.map(o => ({
        id: o.id, code: o.code, title: o.title, kpi: o.kpi, target: o.target,
        currentValue: o.currentValue, progress: o.progress, status: o.status,
        owner: o.owner?.name, dueDate: o.dueDate,
        recentEntries: o.kpiEntries.slice(0, 6).map(k => ({
          year: k.year, month: k.month, value: k.actualValue,
        })),
      })),
      activities: activities.map(a => ({
        id: a.id, code: a.code, title: a.title, progress: a.progress, status: a.status,
        responsible: a.responsible, endDate: a.endDate,
        daysSinceUpdate: daysBetween(a.updatedAt, new Date()),
      })),
      risks: risks.map(r => ({
        id: r.id, code: r.code, title: r.title,
        level: r.level, score: r.score, probability: r.probability, impact: r.impact,
        status: r.status,
        hasResponsePlan: !!r.treatment,
      })),
      ncrs: ncrs.map(n => ({
        id: n.id, code: n.code, title: n.title, status: n.status,
        daysOpen: daysBetween(n.createdAt, new Date()),
      })),
      capas: capas.map(c => ({
        id: c.id, code: c.code, title: c.title, status: c.status,
        dueDate: c.dueDate,
        daysOverdue: c.dueDate && c.dueDate < new Date() ? daysBetween(c.dueDate, new Date()) : 0,
      })),
      complaints: complaints.map(c => ({
        id: c.id, code: c.code, status: c.status, source: c.source, receivedAt: c.receivedAt,
      })),
      trainings: trainings.map(t => ({
        id: t.id, title: t.title, date: t.date, category: t.category,
      })),
    },
    kpisNeedingValue,
    previousPromises,
    previousScores: previousReports.map(r => ({
      year: r.year, month: r.month, score: r.score,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. توليد التقرير (يُبنى مرة واحدة عند الفتح)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReport({ departmentId, year, month, forceRegenerate = false }) {
  // إن وُجد تقرير سابق لنفس (القسم/السنة/الشهر) — أعِده إلا إذا force
  const existing = await prisma.progressReport.findUnique({
    where: { departmentId_year_month: { departmentId, year, month } },
  });

  if (existing && !forceRegenerate) {
    return hydrateReport(existing);
  }

  // اجمع السياق
  const context = await extractContext({ departmentId, year, month });

  // ولِّد أسئلة التحقيق عبر AI
  let aiQuestions = [];
  try {
    aiQuestions = await generateInvestigationQuestions(context);
  } catch (e) {
    console.error('فشل توليد أسئلة التحقيق:', e.message);
    aiQuestions = buildFallbackQuestions(context);
  }

  const autoFilled = {
    generatedAt: new Date().toISOString(),
    department: context.department,
    period: context.period,
    activities: context.owned.activities,
    risks: context.owned.risks,
    ncrs: context.owned.ncrs,
    capas: context.owned.capas,
    complaints: context.owned.complaints,
    trainings: context.owned.trainings,
    kpisNeedingValue: context.kpisNeedingValue,
    previousPromises: context.previousPromises,
    previousScores: context.previousScores,
  };

  const data = {
    departmentId, year, month,
    status: 'DRAFT',
    autoFilled: JSON.stringify(autoFilled),
    aiQuestions: JSON.stringify(aiQuestions),
  };

  const saved = existing
    ? await prisma.progressReport.update({ where: { id: existing.id }, data })
    : await prisma.progressReport.create({ data });

  return hydrateReport(saved);
}

function hydrateReport(r) {
  return {
    ...r,
    autoFilled:        safeParse(r.autoFilled),
    deptFilled:        safeParse(r.deptFilled),
    aiQuestions:       safeParse(r.aiQuestions) || [],
    scoreBreakdown:    safeParse(r.scoreBreakdown),
    extractedPromises: safeParse(r.extractedPromises) || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. توليد أسئلة التحقيق — المنطق السحري
// ─────────────────────────────────────────────────────────────────────────────

const INVESTIGATOR_SYSTEM = `أنت محقق جودة ذكي بمعايير ISO 9001:2015.
مهمتك: توليد 3-5 أسئلة تحقيقية مركَّزة لرئيس قسم بناءً على بيانات قسمه فقط.

قواعد صارمة:
✅ كل سؤال يرتبط حرفياً ببند واحد من السياق (ID صريح)
✅ السؤال يكشف سبباً جذرياً، لا يطلب إعادة تقرير
✅ لا تسأل عن شيء النظام يعرفه (رقم، حالة، تاريخ)
✅ اِربط بالاتجاه الزمني إن وُجد
✅ إذا ظهر وعد سابق — اسأل عنه بالاسم
❌ لا أسئلة عامة من نوع "كيف أداء القسم؟"
❌ لا تكرار من الشهر الماضي إلا إذا كان وعداً لم يتحقق

أخرج JSON صافي (بدون نص آخر) بالشكل:
[
  {
    "id": "q1",
    "question": "نص السؤال بالعربية",
    "linkedField": "objective:<id> | activity:<id> | risk:<id> | capa:<id> | promise:<text> | cross:<dept>",
    "severity": "LOW|MEDIUM|HIGH",
    "reasoning": "لماذا يهم هذا السؤال (سطر واحد)"
  }
]`;

export async function generateInvestigationQuestions(context) {
  const compactContext = {
    dept: context.department.name,
    period: context.period.label,
    objectives: context.owned.objectives.map(o => ({
      id: o.id, title: o.title, target: o.target, currentValue: o.currentValue,
      progress: o.progress, trend: o.recentEntries.map(e => e.value),
    })),
    activities: context.owned.activities.map(a => ({
      id: a.id, title: a.title, progress: a.progress,
      daysSinceUpdate: a.daysSinceUpdate, endDate: a.endDate,
    })),
    risks: context.owned.risks.map(r => ({
      id: r.id, title: r.title, level: r.level, score: r.score, hasResponsePlan: r.hasResponsePlan,
    })),
    capas: context.owned.capas.map(c => ({
      id: c.id, title: c.title, status: c.status, daysOverdue: c.daysOverdue,
    })),
    ncrsCount: context.owned.ncrs.length,
    complaintsCount: context.owned.complaints.length,
    promises: context.previousPromises,
    scoresTrend: context.previousScores,
  };

  const result = await aiComplete({
    system:   INVESTIGATOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `سياق قسم ${context.department.name} لشهر ${context.period.label}:\n${JSON.stringify(compactContext, null, 2)}\n\nولِّد 3-5 أسئلة تحقيقية (JSON فقط).`,
    }],
    feature:   'investigator',
    maxTokens: 1500,
  });

  const text = (result.content || '').trim();
  // استخراج JSON حتى لو أتى AI بنص حوله
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return buildFallbackQuestions(context);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return buildFallbackQuestions(context);
    return parsed.slice(0, 5).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      question: String(q.question || '').trim(),
      linkedField: String(q.linkedField || ''),
      severity: ['LOW', 'MEDIUM', 'HIGH'].includes(q.severity) ? q.severity : 'MEDIUM',
      reasoning: String(q.reasoning || ''),
    })).filter(q => q.question);
  } catch {
    return buildFallbackQuestions(context);
  }
}

function buildFallbackQuestions(context) {
  const qs = [];
  // سؤال لكل نشاط بدون تحديث > 30 يوم
  const staleActivity = context.owned.activities.find(a => a.daysSinceUpdate > 30);
  if (staleActivity) {
    qs.push({
      id: 'q1',
      question: `نشاط "${staleActivity.title}" لم يُحدَّث منذ ${staleActivity.daysSinceUpdate} يوماً. ما الموقف؟`,
      linkedField: `activity:${staleActivity.id}`,
      severity: 'MEDIUM',
      reasoning: 'نشاط متوقف بدون تحديث',
    });
  }
  // CAPA متأخر
  const overdueCapa = context.owned.capas.find(c => c.daysOverdue > 15);
  if (overdueCapa) {
    qs.push({
      id: 'q2',
      question: `CAPA "${overdueCapa.code}" متأخر ${overdueCapa.daysOverdue} يوم. ما السبب؟`,
      linkedField: `capa:${overdueCapa.id}`,
      severity: 'HIGH',
      reasoning: 'إجراء تصحيحي متأخر',
    });
  }
  // خطر بدون خطة
  const riskNoPlan = context.owned.risks.find(r => !r.hasResponsePlan);
  if (riskNoPlan) {
    qs.push({
      id: 'q3',
      question: `خطر "${riskNoPlan.title}" بلا خطة استجابة. ما الخيارات المدروسة؟`,
      linkedField: `risk:${riskNoPlan.id}`,
      severity: 'MEDIUM',
      reasoning: 'خطر نشط بدون خطة',
    });
  }
  // وعد سابق
  for (const p of context.previousPromises.slice(0, 2)) {
    qs.push({
      id: `q_p${qs.length}`,
      question: `في تقرير ${p.fromReport} تم الوعد بـ: "${p.text}". ما موقف التنفيذ؟`,
      linkedField: `promise:${p.text}`,
      severity: 'MEDIUM',
      reasoning: 'متابعة وعد سابق',
    });
  }
  // سؤال مفتوح دائم
  qs.push({
    id: 'q_open',
    question: 'هل هناك شيء تريد لفت نظر إدارة الجودة إليه (معوقات، احتياجات، تغييرات)؟',
    linkedField: 'general',
    severity: 'LOW',
    reasoning: 'سؤال مفتوح',
  });
  return qs.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. حساب الدرجة 0-100
// ─────────────────────────────────────────────────────────────────────────────

export function scoreReport(report) {
  const auto = safeParse(report.autoFilled) || {};
  const dept = safeParse(report.deptFilled) || {};

  // 1. مؤشرات: نسبة الـ KPIs المُدخَلة هذا الشهر
  const kpisNeeded = (auto.kpisNeedingValue || []).length;
  const kpisFilled = (dept.kpiValues || []).length;
  const kpiScore = kpisNeeded === 0 ? 100 : Math.round((kpisFilled / kpisNeeded) * 100);

  // 2. أنشطة: متوسط التقدم
  const activities = auto.activities || [];
  const avgProgress = activities.length
    ? Math.round(activities.reduce((s, a) => s + (a.progress || 0), 0) / activities.length)
    : 100;

  // 3. امتثال: ناقص كل CAPA متأخر و NCR مفتوح طويلاً
  const capas = auto.capas || [];
  const overdueCapa = capas.filter(c => c.daysOverdue > 0).length;
  const ncrs = auto.ncrs || [];
  const oldNcrs = ncrs.filter(n => n.daysOpen > 60).length;
  const complianceScore = Math.max(0, 100 - (overdueCapa * 10) - (oldNcrs * 5));

  // 4. الوفاء بالوعود
  const aiAnswers = dept.aiAnswers || [];
  const promiseQuestions = (safeParse(report.aiQuestions) || []).filter(q => q.linkedField?.startsWith('promise:'));
  const answeredPromises = aiAnswers.filter(a =>
    promiseQuestions.some(q => q.id === a.questionId) && a.answer?.trim()
  ).length;
  const promiseScore = promiseQuestions.length === 0 ? 100
    : Math.round((answeredPromises / promiseQuestions.length) * 100);

  // 5. جودة الإجابات التحقيقية (طول الإجابة كمؤشر مبسَّط)
  const allQuestions = safeParse(report.aiQuestions) || [];
  const answered = aiAnswers.filter(a => (a.answer || '').trim().length >= 20).length;
  const investigationScore = allQuestions.length === 0 ? 100
    : Math.round((answered / allQuestions.length) * 100);

  // المتوسط المرجَّح
  const total = Math.round(
    kpiScore * 0.25 +
    avgProgress * 0.25 +
    complianceScore * 0.20 +
    promiseScore * 0.15 +
    investigationScore * 0.15
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    breakdown: {
      kpi: kpiScore,
      activity: avgProgress,
      compliance: complianceScore,
      promise: promiseScore,
      investigation: investigationScore,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. استخراج الوعود من إجابات هذا التقرير (لأجل التقرير القادم)
// ─────────────────────────────────────────────────────────────────────────────

const PROMISE_KEYWORDS = ['سنقوم', 'سأقوم', 'سنطلق', 'سنعمل', 'نعد', 'أعد', 'سنُنهي', 'سنُنجز', 'خلال', 'بنهاية', 'قبل'];

export function extractPromises(report) {
  const dept = safeParse(report.deptFilled) || {};
  const promises = [];
  const sources = [];

  for (const a of (dept.aiAnswers || [])) {
    if (a.answer) sources.push({ text: a.answer, source: `question:${a.questionId}` });
  }
  if (dept.freeText) sources.push({ text: dept.freeText, source: 'freeText' });

  for (const s of sources) {
    // تقسيم لجمل
    const sentences = s.text.split(/[.!?؟\n]/).map(x => x.trim()).filter(Boolean);
    for (const sent of sentences) {
      if (PROMISE_KEYWORDS.some(kw => sent.includes(kw))) {
        promises.push({ text: sent, source: s.source });
      }
    }
  }

  return promises.slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. مقارنة الأقسام
// ─────────────────────────────────────────────────────────────────────────────

export async function compareDepartments({ year, month }) {
  const reports = await prisma.progressReport.findMany({
    where: { year, month, deletedAt: null, status: { in: ['SUBMITTED', 'APPROVED'] } },
  });

  const depts = await prisma.department.findMany({ where: { active: true } });

  // احسب الشهر السابق
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  const rows = [];
  for (const d of depts) {
    const report = reports.find(r => r.departmentId === d.id);
    const prev = await prisma.progressReport.findFirst({
      where: {
        departmentId: d.id, deletedAt: null,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        year: prevYear, month: prevMonth,
      },
    });

    rows.push({
      departmentId: d.id,
      code: d.code,
      name: d.name,
      score: report?.score ?? null,
      previousScore: prev?.score ?? null,
      delta: (report?.score != null && prev?.score != null) ? (report.score - prev.score) : null,
      status: report?.status ?? 'MISSING',
      submittedAt: report?.submittedAt ?? null,
      classification: classifyDept(report?.score, prev?.score),
    });
  }

  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return rows;
}

function classifyDept(score, prev) {
  if (score == null) return 'MISSING';
  if (score >= 85 && (prev == null || score >= prev)) return 'EXCELLENT';
  if (score < 55 || (prev != null && score - prev <= -10)) return 'DISTRESSED';
  if (score < 70 || (prev != null && score - prev < -3)) return 'WARNING';
  return 'STABLE';
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. اكتشاف الاتجاهات عبر الزمن
// ─────────────────────────────────────────────────────────────────────────────

export async function detectTrends({ departmentId, months = 6 } = {}) {
  const where = { deletedAt: null, status: { in: ['SUBMITTED', 'APPROVED'] } };
  if (departmentId) where.departmentId = departmentId;

  const reports = await prisma.progressReport.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: months * 20,
  });

  // جمّع حسب القسم
  const byDept = {};
  for (const r of reports) {
    if (!byDept[r.departmentId]) byDept[r.departmentId] = [];
    byDept[r.departmentId].push({ year: r.year, month: r.month, score: r.score });
  }

  const trends = [];
  for (const [deptId, series] of Object.entries(byDept)) {
    const sorted = series.sort((a, b) => a.year - b.year || a.month - b.month).slice(-months);
    if (sorted.length < 2) continue;

    // ميل بسيط
    const n = sorted.length;
    const xs = sorted.map((_, i) => i);
    const ys = sorted.map(s => s.score ?? 0);
    const meanX = xs.reduce((a, b) => a + b) / n;
    const meanY = ys.reduce((a, b) => a + b) / n;
    const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
    const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0) || 1;
    const slope = num / den;

    const dept = await prisma.department.findUnique({ where: { id: deptId }, select: { code: true, name: true } });

    trends.push({
      departmentId: deptId,
      department: dept,
      series: sorted,
      slope: Math.round(slope * 100) / 100,
      direction: slope > 1 ? 'IMPROVING' : slope < -1 ? 'DECLINING' : 'STABLE',
      latestScore: sorted[sorted.length - 1].score,
    });
  }

  return trends.sort((a, b) => (a.slope ?? 0) - (b.slope ?? 0)); // الأسوأ أولاً
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. تناقضات بين الأقسام — المحقق الحقيقي
// ─────────────────────────────────────────────────────────────────────────────

const CROSS_CHECK_SYSTEM = `أنت محقق جودة. لديك تقارير شهرية من عدة أقسام.
مهمتك: اكتشاف التناقضات والتصريحات المتعارضة بين الأقسام.

مثال: قسم HR يقول "دربنا 30 موظفاً في قسم البرامج" وقسم البرامج يقول "لا يوجد تدريب".

أخرج JSON صافي:
[
  {
    "departments": ["HR", "Programs"],
    "title": "عنوان مختصر",
    "description": "وصف التناقض بسطرين",
    "evidence": { "claims": [{"dept": "HR", "text": "..."}, {"dept": "Programs", "text": "..."}] },
    "severity": "LOW|MEDIUM|HIGH|CRITICAL"
  }
]
إن لم تجد تناقضات أخرج [] فارغ.`;

export async function detectCrossContradictions({ year, month }) {
  const reports = await prisma.progressReport.findMany({
    where: { year, month, deletedAt: null, status: { in: ['SUBMITTED', 'APPROVED'] } },
  });
  if (reports.length < 2) return [];

  const depts = await prisma.department.findMany();
  const dMap = Object.fromEntries(depts.map(d => [d.id, d]));

  const snapshot = reports.map(r => {
    const dept = dMap[r.departmentId];
    const f = safeParse(r.deptFilled) || {};
    return {
      dept: dept?.name || r.departmentId,
      aiAnswers: f.aiAnswers || [],
      freeText: f.freeText || '',
      kpis: f.kpiValues || [],
    };
  });

  try {
    const result = await aiComplete({
      system: CROSS_CHECK_SYSTEM,
      messages: [{ role: 'user',
        content: `تقارير شهر ${year}-${String(month).padStart(2, '0')}:\n${JSON.stringify(snapshot, null, 2)}\n\nأخرج JSON للتناقضات.` }],
      feature:   'investigator-cross',
      maxTokens: 2000,
    });

    const match = (result.content || '').match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('cross-check failed', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function safeParse(s) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }
function daysBetween(a, b) { if (!a || !b) return 0; return Math.floor((new Date(b) - new Date(a)) / 86400000); }
function startOfMonth(year, month) {
  let y = year, m = month;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return new Date(y, m - 1, 1);
}
