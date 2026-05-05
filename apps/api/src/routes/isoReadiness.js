import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

const scoreItem = (ok, weight = 1) => (ok ? weight : 0);
const currentYear = () => Number(new Date().getFullYear());

/**
 * GET /api/iso-readiness
 * Returns completion status per ISO 9001:2015 clause.
 *
 * Important: this endpoint measures execution evidence, not just whether a
 * screen exists. Empty NCR/CAPA, empty survey responses, or unapproved
 * documents should not falsely appear as full readiness.
 */
router.get('/', requireAction('iso-readiness', 'read'), asyncHandler(async (req, res) => {
  const year = Number(req.query.year || currentYear());

  const [
    swotCount,
    ipCount,
    processCount,
    policyActive,
    strategicCount,
    indicatorCount,
    annualTargetsCount,
    riskCount,
    ncrOpen,
    ncrClosed,
    capaOpen,
    capaClosed,
    auditPlanned,
    auditCompleted,
    auditFindings,
    complaintsResolved,
    complaintsOpen,
    surveysActive,
    surveyResponses,
    supplierApproved,
    supplierTotal,
    supplierEvalCount,
    docPublished,
    docApproved,
    docTotal,
    trainingCount,
    competenceCount,
    commCount,
    reviewCount,
    reviewCompleted,
    beneficiaries,
    donations,
  ] = await Promise.all([
    prisma.swotItem.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.interestedParty.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.process.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.qualityPolicy.count({ where: { active: true, deletedAt: null } }),
    prisma.strategicGoal.count({ where: { deletedAt: null } }),
    prisma.indicator.count({ where: { deletedAt: null } }),
    prisma.annualTarget.count({ where: { year } }),
    prisma.risk.count({ where: { deletedAt: null } }),
    prisma.nCR.count({ where: { status: { not: 'CLOSED' }, deletedAt: null } }),
    prisma.nCR.count({ where: { status: 'CLOSED', deletedAt: null } }),
    prisma.capa.count({ where: { status: { notIn: ['CLOSED', 'VERIFIED', 'EFFECTIVE'] }, deletedAt: null } }),
    prisma.capa.count({ where: { status: { in: ['CLOSED', 'VERIFIED', 'EFFECTIVE'] }, deletedAt: null } }),
    prisma.audit.count({ where: { status: 'PLANNED', deletedAt: null } }),
    prisma.audit.count({ where: { status: 'COMPLETED', deletedAt: null } }),
    prisma.auditFinding.count({ where: { deletedAt: null } }),
    prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] }, deletedAt: null } }),
    prisma.complaint.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] }, deletedAt: null } }),
    prisma.survey.count({ where: { active: true, deletedAt: null } }),
    prisma.surveyResponse.count(),
    prisma.supplier.count({ where: { status: 'APPROVED', deletedAt: null } }),
    prisma.supplier.count({ where: { deletedAt: null } }),
    prisma.supplierEval.count({ where: { deletedAt: null } }),
    prisma.document.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.document.count({ where: { status: 'APPROVED', deletedAt: null } }),
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.training.count({ where: { deletedAt: null } }),
    prisma.competenceRequirement.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.communicationPlan.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.managementReview.count({ where: { deletedAt: null } }),
    prisma.managementReview.count({ where: { status: 'COMPLETED', deletedAt: null } }),
    prisma.beneficiary.count(),
    prisma.donation.count(),
  ]);

  const hasQualityObjectives =
    strategicCount >= 3 &&
    indicatorCount >= 10 &&
    annualTargetsCount >= Math.min(indicatorCount, 10);

  const hasCustomerSatisfactionEvidence =
    surveyResponses > 0 ||
    surveysActive >= 1 ||
    complaintsResolved + complaintsOpen > 0;

  const complaintHandlingOk =
    complaintsResolved + complaintsOpen === 0
      ? false
      : complaintsResolved >= complaintsOpen;

  const hasCorrectiveActionEvidence =
    ncrOpen + ncrClosed + capaOpen + capaClosed > 0;

  const correctiveActionOk =
    hasCorrectiveActionEvidence && (ncrClosed + capaClosed >= ncrOpen + capaOpen);

  const clauses = [
    {
      clause: '4.1',
      title: 'فهم سياق المنظمة',
      weight: 5,
      score: scoreItem(swotCount >= 4, 5),
      evidence: `${swotCount} بند سياق/SWOT نشط`,
      required: 'تحليل سياق داخلي وخارجي معتمد ومراجع دورياً',
      ok: swotCount >= 4,
    },
    {
      clause: '4.2',
      title: 'الأطراف المعنية واحتياجاتها',
      weight: 5,
      score: scoreItem(ipCount >= 4, 5),
      evidence: `${ipCount} طرف معني نشط`,
      required: 'سجل أطراف معنية يوضح الاحتياجات وآلية المتابعة',
      ok: ipCount >= 4,
    },
    {
      clause: '4.4',
      title: 'خريطة العمليات',
      weight: 5,
      score: scoreItem(processCount >= 5, 5),
      evidence: `${processCount} عملية موثقة`,
      required: 'عمليات رئيسية وداعمة مع مدخلات ومخرجات ومالكين ومؤشرات',
      ok: processCount >= 5,
    },
    {
      clause: '5.2',
      title: 'سياسة الجودة',
      weight: 8,
      score: scoreItem(policyActive > 0, 8),
      evidence: policyActive ? 'سياسة جودة نشطة' : 'لا توجد سياسة نشطة',
      required: 'سياسة جودة معتمدة ومبلغة وقابلة للإقرار',
      ok: policyActive > 0,
    },
    {
      clause: '6.1',
      title: 'المخاطر والفرص',
      weight: 7,
      score: scoreItem(riskCount >= 5, 7),
      evidence: `${riskCount} خطر/فرصة`,
      required: 'سجل مخاطر وفرص فعال مع مالك ومعالجة ومراجعة',
      ok: riskCount >= 5,
    },
    {
      clause: '6.2',
      title: 'أهداف الجودة والمؤشرات',
      weight: 7,
      score: scoreItem(hasQualityObjectives, 7),
      evidence: `${strategicCount} هدف استراتيجي، ${indicatorCount} مؤشر، ${annualTargetsCount} مستهدف ${year}`,
      required: 'أهداف قابلة للقياس مرتبطة بمؤشرات ومستهدفات سنوية',
      ok: hasQualityObjectives,
    },
    {
      clause: '7.2',
      title: 'الكفاءة والتدريب',
      weight: 5,
      score: scoreItem(competenceCount >= 3 && trainingCount >= 1, 5),
      evidence: `${competenceCount} متطلب كفاءة، ${trainingCount} سجل تدريب`,
      required: 'مصفوفة كفاءات وسجل تدريب/توعية',
      ok: competenceCount >= 3 && trainingCount >= 1,
    },
    {
      clause: '7.4',
      title: 'التواصل',
      weight: 4,
      score: scoreItem(commCount >= 3, 4),
      evidence: `${commCount} خطة اتصال نشطة`,
      required: 'خطة اتصال تحدد الجمهور والقناة والتكرار والمسؤول',
      ok: commCount >= 3,
    },
    {
      clause: '7.5',
      title: 'المعلومات الموثقة',
      weight: 6,
      score: scoreItem(docPublished >= 5, 6),
      evidence: `${docPublished} منشورة، ${docApproved} معتمدة، من أصل ${docTotal}`,
      required: 'وثائق أساسية منشورة ومعتمدة ومجدولة للمراجعة',
      ok: docPublished >= 5,
    },
    {
      clause: '8.4',
      title: 'ضبط الموردين',
      weight: 5,
      score: scoreItem(supplierApproved >= 1 && supplierEvalCount >= 1, 5),
      evidence: `${supplierApproved}/${supplierTotal} مورد معتمد، ${supplierEvalCount} تقييم`,
      required: 'موردون مقيمون ومعتمدون حسب أثرهم على جودة الخدمة',
      ok: supplierApproved >= 1 && supplierEvalCount >= 1,
    },
    {
      clause: '9.1.2',
      title: 'رضا المستفيدين والتغذية الراجعة',
      weight: 5,
      score: scoreItem(hasCustomerSatisfactionEvidence && (surveyResponses > 0 || complaintHandlingOk), 5),
      evidence: `${surveysActive} استبيان نشط، ${surveyResponses} رد، شكاوى محلولة/مفتوحة: ${complaintsResolved}/${complaintsOpen}`,
      required: 'قياس رضا أو تغذية راجعة فعلية مع معالجة الشكاوى',
      ok: hasCustomerSatisfactionEvidence && (surveyResponses > 0 || complaintHandlingOk),
    },
    {
      clause: '9.2',
      title: 'التدقيق الداخلي',
      weight: 8,
      score: scoreItem(auditCompleted >= 1, 8),
      evidence: `مخطط: ${auditPlanned}، مكتمل: ${auditCompleted}، ملاحظات: ${auditFindings}`,
      required: 'تدقيق داخلي مكتمل بمخرجات وملاحظات عند اللزوم',
      ok: auditCompleted >= 1,
    },
    {
      clause: '9.3',
      title: 'المراجعة الإدارية',
      weight: 10,
      score: scoreItem(reviewCompleted >= 1, 10),
      evidence: `${reviewCompleted}/${reviewCount} مراجعة مكتملة`,
      required: 'مراجعة إدارية مكتملة بمدخلات ومخرجات وقرارات متابعة',
      ok: reviewCompleted >= 1,
    },
    {
      clause: '10.2',
      title: 'عدم المطابقة والإجراءات التصحيحية',
      weight: 8,
      score: scoreItem(correctiveActionOk, 8),
      evidence: `NCR مفتوح/مغلق: ${ncrOpen}/${ncrClosed}، CAPA مفتوح/مغلق: ${capaOpen}/${capaClosed}`,
      required: 'وجود سجل NCR/CAPA فعلي مع معالجة وفعالية، وليس مجرد شاشة فارغة',
      ok: correctiveActionOk,
    },
  ];

  const totalWeight = clauses.reduce((sum, clause) => sum + clause.weight, 0);
  const totalScore = clauses.reduce((sum, clause) => sum + clause.score, 0);
  const percentage = Math.round((totalScore / totalWeight) * 100);

  const level =
    percentage >= 90 ? 'جاهز للاعتماد' :
    percentage >= 75 ? 'قريب من الجاهزية' :
    percentage >= 50 ? 'قيد الإغلاق' :
    'تحت التجهيز';

  res.json({
    ok: true,
    year,
    percentage,
    level,
    totalScore,
    totalWeight,
    clauses,
    stats: {
      strategicGoals: strategicCount,
      indicators: indicatorCount,
      annualTargets: annualTargetsCount,
      risks: riskCount,
      beneficiaries,
      donations,
      documents: { published: docPublished, approved: docApproved, total: docTotal },
      audits: { planned: auditPlanned, completed: auditCompleted, findings: auditFindings },
      correctiveActions: { ncrOpen, ncrClosed, capaOpen, capaClosed },
      feedback: { surveysActive, surveyResponses, complaintsResolved, complaintsOpen },
    },
  });
}));

export default router;
