import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

// ─── Beneficiary Journey: programs + donations + assessments ───
router.get('/beneficiary/:id/journey', requireAction('beneficiaries', 'read'), asyncHandler(async (req, res) => {
  const ben = await prisma.beneficiary.findUnique({
    where: { id: req.params.id },
    include: {
      caseManager:   { select: { id: true, name: true } },
      benDepartment: { select: { id: true, name: true } },
      programs: {
        include: { program: { select: { id: true, code: true, name: true, category: true, status: true } } },
        orderBy: { enrolledAt: 'desc' },
      },
      donationsReceived: {
        orderBy: { receivedAt: 'desc' },
        select: { id: true, code: true, type: true, amount: true, itemName: true, receivedAt: true, status: true },
      },
    },
  });
  if (!ben) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, beneficiary: ben });
}));

// ─── Process Health: objectives + risks + KPIs + audits ───
router.get('/process/:id/health', requireAction('processes', 'read'), asyncHandler(async (req, res) => {
  const proc = await prisma.process.findUnique({
    where: { id: req.params.id },
    include: {
      ownerUser:         { select: { id: true, name: true } },
      processDepartment: { select: { id: true, name: true } },
      processObjectives: { include: { objective: { select: { id: true, code: true, title: true, status: true, progress: true } } } },
      processRisks:      { include: { risk: { select: { id: true, code: true, title: true, level: true, status: true } } } },
      processIndicators: { include: { indicator: { select: { id: true, code: true, nameAr: true, weight: true } } } },
      audits:            { take: 5, orderBy: { plannedDate: 'desc' }, select: { id: true, code: true, title: true, status: true, actualDate: true } },
    },
  });
  if (!proc) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, process: proc });
}));

// ─── Program Performance: beneficiaries + donations + financials ───
router.get('/program/:id/performance', requireAction('programs', 'read'), asyncHandler(async (req, res) => {
  const prog = await prisma.program.findUnique({
    where: { id: req.params.id },
    include: {
      programDepartment: { select: { id: true, name: true } },
      manager:           { select: { id: true, name: true } },
      beneficiaries:     { include: { beneficiary: { select: { id: true, code: true, fullName: true, status: true } } } },
      donations: {
        include: { donation: { select: { id: true, code: true, amount: true, donorName: true, type: true } } },
      },
    },
  });
  if (!prog) return res.status(404).json({ ok: false, error: 'Not found' });
  // Calculate financials
  const totalReceived = prog.donations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  res.json({ ok: true, program: { ...prog, financials: { totalReceived, budget: prog.budget, spent: prog.spent } } });
}));

// ─── User Competence Profile ───
router.get('/user/:id/competence', requireAction('competence', 'read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      department: { select: { id: true, name: true } },
      trainingRecords: {
        include: { training: { select: { id: true, code: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      },
      performanceReviewsAsEmployee: {
        select: { id: true, code: true, period: true, overallRating: true, status: true },
        orderBy: { periodEnd: 'desc' },
        take: 3,
      },
    },
  });
  if (!user) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, profile: user });
}));

// ════════════════════════════════════════════════════════════════════
// Management Review Snapshot — التبويب الجامع لكل شيء (ISO 9.3)
// ════════════════════════════════════════════════════════════════════
// يجمع كل المدخلات المطلوبة لمراجعة الإدارة من جميع الوحدات:
//   • سياق المنظمة (SWOT + الأطراف ذات العلاقة + التغييرات)
//   • تقدّم الأهداف الاستراتيجية والتشغيلية
//   • أداء العمليات (المؤشرات + RAG)
//   • حالة المخاطر (مع الـ heatmap)
//   • نتائج التدقيق الداخلي (NCRs مفتوحة + مغلقة)
//   • شكاوى العملاء وتحليلها
//   • رضا المستفيدين (من الاستبيانات)
//   • تقدّم المبادرات والمشاريع التحسينية
//   • أداء التدريب والكفاءات
//   • الموارد المالية (التبرعات + المخصصات)
// ════════════════════════════════════════════════════════════════════
router.get('/management-review-snapshot', requireAction('management-review', 'read'), asyncHandler(async (req, res) => {
  const planId = req.query.planId || null;
  const year   = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  // الخطة الحالية (إن لم تُحدّد، الـ ACTIVE الأولى)
  let plan = null;
  if (planId) {
    plan = await prisma.strategicPlan.findUnique({
      where: { id: planId },
      include: { goals: { select: { id: true, code: true, title: true, progress: true, status: true, perspective: true } } },
    });
  } else {
    plan = await prisma.strategicPlan.findFirst({
      where: { status: 'ACTIVE', deletedAt: null },
      include: { goals: { select: { id: true, code: true, title: true, progress: true, status: true, perspective: true } } },
    });
  }

  // ─── 1. السياق (SWOT + الأطراف) ────────────────────────────────────
  const [swotItems, parties, processChanges] = await Promise.all([
    prisma.swotItem.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, type: true, description: true, impact: true },
    }),
    prisma.interestedParty.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, name: true, type: true, influence: true },
    }),
    prisma.process.count({ where: { deletedAt: null } }),
  ]);
  const swotByType = swotItems.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {});

  // ─── 2. الأهداف الاستراتيجية والتشغيلية ────────────────────────────
  const objectives = await prisma.objective.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, title: true, status: true, progress: true, target: true, currentValue: true },
  });
  const objStats = {
    total: objectives.length,
    achieved: objectives.filter(o => o.status === 'ACHIEVED').length,
    inProgress: objectives.filter(o => o.status === 'IN_PROGRESS').length,
    delayed: objectives.filter(o => o.status === 'DELAYED').length,
    avgProgress: objectives.length ? Math.round(objectives.reduce((s, o) => s + (o.progress || 0), 0) / objectives.length) : 0,
  };

  // ─── 3. أداء العمليات (KPIs + RAG) ─────────────────────────────────
  const indicators = await prisma.indicator.findMany({
    where: { deletedAt: null },
    include: {
      annualTargets: { where: { year }, take: 1 },
      kpiEntries:    { where: { year }, orderBy: [{ month: 'desc' }], take: 1 },
      axis:          { select: { id: true, nameAr: true } },
    },
  });
  const indicatorPerf = indicators.map(ind => {
    const at = ind.annualTargets?.[0];
    const lastEntry = ind.kpiEntries?.[0];
    const target = at?.targetValue || 0;
    const actual = lastEntry?.actualValue;
    const ratio = (target && actual != null) ? actual / target : null;
    let rag = 'GRAY';
    if (ratio != null) {
      if (ratio >= (ind.greenThreshold || 95) / 100) rag = 'GREEN';
      else if (ratio >= (ind.yellowThreshold || 75) / 100) rag = 'YELLOW';
      else rag = 'RED';
    }
    return { code: ind.code, nameAr: ind.nameAr, axis: ind.axis?.nameAr, weight: ind.weight, target, actual, ratio, rag };
  });
  const ragSummary = {
    total: indicatorPerf.length,
    green:  indicatorPerf.filter(i => i.rag === 'GREEN').length,
    yellow: indicatorPerf.filter(i => i.rag === 'YELLOW').length,
    red:    indicatorPerf.filter(i => i.rag === 'RED').length,
    gray:   indicatorPerf.filter(i => i.rag === 'GRAY').length,
  };

  // ─── 4. حالة المخاطر ────────────────────────────────────────────────
  const risks = await prisma.risk.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, title: true, level: true, status: true, score: true },
  });
  const riskByLevel = risks.reduce((acc, r) => { acc[r.level || 'متوسط'] = (acc[r.level || 'متوسط'] || 0) + 1; return acc; }, {});
  const riskByStatus = risks.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const criticalRisks = risks.filter(r => r.level === 'حرج' && r.status !== 'CLOSED');

  // ─── 5. NCRs والتدقيق ───────────────────────────────────────────────
  const [ncrs, audits] = await Promise.all([
    prisma.nCR.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, title: true, status: true, severity: true, createdAt: true },
    }),
    prisma.audit.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, title: true, status: true, plannedDate: true, actualDate: true },
      orderBy: { plannedDate: 'desc' },
      take: 10,
    }),
  ]);
  const ncrStats = {
    total: ncrs.length,
    open: ncrs.filter(n => n.status === 'OPEN').length,
    closed: ncrs.filter(n => n.status === 'CLOSED').length,
    inProgress: ncrs.filter(n => n.status === 'IN_PROGRESS').length,
  };
  const auditStats = {
    total: audits.length,
    planned: audits.filter(a => a.status === 'PLANNED').length,
    completed: audits.filter(a => a.status === 'COMPLETED').length,
  };

  // ─── 6. شكاوى ورضا المستفيدين ───────────────────────────────────────
  const [complaints, surveys] = await Promise.all([
    prisma.complaint.findMany({
      where: { deletedAt: null },
      select: { id: true, status: true, severity: true },
    }),
    prisma.survey.findMany({
      where: { deletedAt: null, target: 'BENEFICIARY' },
      select: { id: true, code: true, title: true, responses: true, avgScore: true },
    }),
  ]);
  const complaintStats = {
    total: complaints.length,
    open: complaints.filter(c => c.status === 'OPEN').length,
    closed: complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length,
  };
  const surveyAvg = surveys.length
    ? surveys.reduce((s, sv) => s + (sv.avgScore || 0), 0) / surveys.filter(sv => sv.avgScore != null).length || 0
    : null;

  // ─── 7. المبادرات + التحسين ─────────────────────────────────────────
  const [initiatives, improvements] = await Promise.all([
    prisma.initiative.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, status: true, progress: true, budget: true, spent: true },
    }),
    prisma.improvementProject.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, status: true },
    }),
  ]);
  const initStats = {
    total: initiatives.length,
    notStarted: initiatives.filter(i => i.status === 'NOT_STARTED').length,
    inProgress: initiatives.filter(i => i.status === 'IN_PROGRESS').length,
    completed:  initiatives.filter(i => i.status === 'COMPLETED').length,
    totalBudget: initiatives.reduce((s, i) => s + (i.budget || 0), 0),
    totalSpent:  initiatives.reduce((s, i) => s + (i.spent  || 0), 0),
  };

  // ─── 8. التدريب والكفاءات ───────────────────────────────────────────
  const [trainings, perfReviews] = await Promise.all([
    prisma.training.count({ where: { deletedAt: null } }),
    prisma.performanceReview.findMany({
      where: { periodStart: { gte: new Date(`${year}-01-01`) } },
      select: { id: true, status: true, overallRating: true },
    }),
  ]);
  const perfStats = {
    total: perfReviews.length,
    completed: perfReviews.filter(p => p.status === 'COMPLETED' || p.status === 'CLOSED').length,
    avgRating: perfReviews.filter(p => p.overallRating).length
      ? perfReviews.reduce((s, p) => s + (p.overallRating || 0), 0) / perfReviews.filter(p => p.overallRating).length
      : null,
  };

  // ─── 9. الموارد المالية ─────────────────────────────────────────────
  const donations = await prisma.donation.findMany({
    where: {
      deletedAt: null,
      receivedAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
    select: { id: true, type: true, amount: true, status: true },
  });
  const donationStats = {
    total: donations.length,
    totalAmount: donations.filter(d => d.amount).reduce((s, d) => s + (d.amount || 0), 0),
    received: donations.filter(d => d.status === 'RECEIVED').length,
  };

  // ─── 10. تقارير المراجعات السابقة ───────────────────────────────────
  const previousReviews = await prisma.managementReview.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, title: true, meetingDate: true, status: true, decisions: true },
    orderBy: { meetingDate: 'desc' },
    take: 3,
  });

  res.json({
    ok: true,
    snapshot: {
      meta: {
        plan: plan ? { id: plan.id, code: plan.code, title: plan.title, startYear: plan.startYear, endYear: plan.endYear, status: plan.status } : null,
        year,
        generatedAt: new Date().toISOString(),
        clauses: 'ISO 9001:2015 §9.3.2 (Management Review Inputs)',
      },
      // ─── المدخلات المطلوبة (Inputs §9.3.2) ───
      inputs: {
        // 9.3.2.a: الإجراءات من المراجعات السابقة
        previousActions: previousReviews,

        // 9.3.2.b: التغييرات في القضايا الخارجية والداخلية
        context: {
          swotItems:    swotItems.length,
          swotByType,
          interestedParties: parties.length,
          processes:    processChanges,
        },

        // 9.3.2.c.1: رضا المستفيدين والتغذية الراجعة
        customerFeedback: {
          surveys:      surveys.length,
          surveyAvg:    surveyAvg ? Number(surveyAvg.toFixed(2)) : null,
          complaints:   complaintStats,
        },

        // 9.3.2.c.2: مدى تحقيق الأهداف
        objectives: {
          strategicGoals: plan?.goals?.length || 0,
          goalsList:      plan?.goals || [],
          operationalObjectives: objStats,
        },

        // 9.3.2.c.3: أداء العمليات والمطابقة
        processPerformance: {
          indicators: ragSummary,
          worstIndicators: indicatorPerf
            .filter(i => i.rag === 'RED')
            .slice(0, 5)
            .map(i => ({ code: i.code, nameAr: i.nameAr, ratio: i.ratio })),
        },

        // 9.3.2.c.4: عدم المطابقة + الإجراءات التصحيحية
        nonConformity: {
          ncrs: ncrStats,
        },

        // 9.3.2.c.5: نتائج المراقبة والقياس (تظهر أعلاه)

        // 9.3.2.c.6: نتائج التدقيق
        audits: auditStats,

        // 9.3.2.c.7: أداء المورّدين الخارجيين (من Donation Evals)
        // [محسوب لاحقاً عند الحاجة]

        // 9.3.2.d: كفاية الموارد
        resources: {
          donations: donationStats,
          financials: {
            initiativesBudget: initStats.totalBudget,
            initiativesSpent:  initStats.totalSpent,
          },
          training: trainings,
          performance: perfStats,
        },

        // 9.3.2.e: فعالية معالجة المخاطر
        risks: {
          total: risks.length,
          byLevel: riskByLevel,
          byStatus: riskByStatus,
          critical: criticalRisks,
        },

        // 9.3.2.f: فرص التحسين
        improvements: {
          initiatives:        initStats,
          improvementProjects: improvements.length,
        },
      },
      // ─── ملخص للعرض السريع ───
      summary: {
        riskHighlight: criticalRisks.length > 0 ? `🚨 ${criticalRisks.length} مخاطر حرجة مفتوحة` : '✅ لا مخاطر حرجة مفتوحة',
        objectivesHighlight: objStats.delayed > 0 ? `⚠️ ${objStats.delayed} هدف متأخر` : `${objStats.avgProgress}% متوسط الإنجاز`,
        ncrHighlight: ncrStats.open > 0 ? `🔧 ${ncrStats.open} حالة عدم مطابقة مفتوحة` : '✅ لا انحرافات مفتوحة',
        complaintsHighlight: complaintStats.open > 0 ? `📞 ${complaintStats.open} شكوى مفتوحة` : '✅ لا شكاوى مفتوحة',
        kpiHighlight: `أحمر: ${ragSummary.red} | أصفر: ${ragSummary.yellow} | أخضر: ${ragSummary.green}`,
      },
    },
  });
}));

export default router;
