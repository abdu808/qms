import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

const scoreItem = (ok, weight = 1) => (ok ? weight : 0);
const currentYear = () => Number(new Date().getFullYear());
const sourceChecklistName = 'قائمة التحقق لنظام إدارة الجودة ISO 9001:2015';

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

function requirementStatus(ok, partial = false, notApplicable = false) {
  if (notApplicable) return 'NOT_APPLICABLE';
  if (ok) return 'IMPLEMENTED';
  if (partial) return 'NEEDS_REVIEW';
  return 'MISSING';
}

function statusSummary(items) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

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

/**
 * GET /api/iso-readiness/org-chart
 * Evidence-oriented organizational chart for ISO 9001 clause 5.3.
 */
router.get('/org-chart', requireAction('iso-readiness', 'read'), asyncHandler(async (_req, res) => {
  const [departments, users, orgDocuments] = await Promise.all([
    prisma.department.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, nameEn: true, parentId: true, manager: true, active: true },
      orderBy: [{ parentId: 'asc' }, { code: 'asc' }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true, jobTitle: true, departmentId: true },
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    }),
    prisma.document.findMany({
      where: {
        deletedAt: null,
        OR: [
          { code: { contains: 'ORG', mode: 'insensitive' } },
          { title: { contains: 'هيكل', mode: 'insensitive' } },
          { title: { contains: 'تنظيمي', mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, title: true, status: true, currentVersion: true, updatedAt: true },
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
    }),
  ]);

  const usersByDepartment = new Map();
  for (const user of users) {
    const key = user.departmentId || '__unassigned';
    if (!usersByDepartment.has(key)) usersByDepartment.set(key, []);
    usersByDepartment.get(key).push(user);
  }

  const nodes = departments.map((dept) => ({
    ...dept,
    users: usersByDepartment.get(dept.id) || [],
    childrenCount: departments.filter((d) => d.parentId === dept.id).length,
  }));
  const unassignedUsers = usersByDepartment.get('__unassigned') || [];
  const approvedDoc = orgDocuments.find((doc) => ['APPROVED', 'PUBLISHED'].includes(doc.status)) || null;

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      departments: departments.length,
      activeUsers: users.length,
      unassignedUsers: unassignedUsers.length,
      linkedDocuments: orgDocuments.length,
      hasApprovedDocument: Boolean(approvedDoc),
      status: approvedDoc ? 'IMPLEMENTED' : (departments.length > 0 && users.length > 0 ? 'NEEDS_REVIEW' : 'MISSING'),
    },
    nodes,
    unassignedUsers,
    documents: orgDocuments,
    recommendation: approvedDoc
      ? 'الهيكل موجود في النظام وله وثيقة معتمدة/منشورة.'
      : 'الهيكل ظاهر من بيانات الإدارات والموظفين، لكنه يحتاج ربط ملف الهيكل التنظيمي المعتمد في سجل الوثائق.',
  });
}));

/**
 * GET /api/iso-readiness/requirements
 * Turns the external ISO checklist into a live requirements register.
 * Each requirement points to the best matching system screen and evidence.
 */
router.get('/requirements', requireAction('iso-readiness', 'read'), asyncHandler(async (req, res) => {
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
    riskTreated,
    trainingCount,
    competenceCount,
    commCount,
    docs,
    ackDocsActive,
    suppliersTotal,
    supplierEvalCount,
    ncrCount,
    capaCount,
    capaClosed,
    complaintCount,
    surveysActive,
    surveyResponses,
    auditPlanned,
    auditCompleted,
    reviewCount,
    reviewCompleted,
    operationalActivities,
    departmentCount,
    activeUserCount,
  ] = await Promise.all([
    prisma.swotItem.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.interestedParty.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.process.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.qualityPolicy.count({ where: { active: true, deletedAt: null } }),
    prisma.strategicGoal.count({ where: { deletedAt: null } }),
    prisma.indicator.count({ where: { deletedAt: null } }),
    prisma.annualTarget.count({ where: { year } }),
    prisma.risk.count({ where: { deletedAt: null } }),
    prisma.risk.count({ where: { deletedAt: null, treatment: { not: null } } }),
    prisma.training.count({ where: { deletedAt: null } }),
    prisma.competenceRequirement.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.communicationPlan.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.document.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, title: true, status: true, isoClause: true, currentVersion: true },
      orderBy: [{ status: 'desc' }, { code: 'asc' }],
      take: 250,
    }),
    prisma.ackDocument.count({ where: { active: true, deletedAt: null } }),
    prisma.supplier.count({ where: { deletedAt: null } }),
    prisma.supplierEval.count({ where: { deletedAt: null } }),
    prisma.nCR.count({ where: { deletedAt: null } }),
    prisma.capa.count({ where: { deletedAt: null } }),
    prisma.capa.count({ where: { deletedAt: null, status: { in: ['CLOSED', 'VERIFIED', 'EFFECTIVE'] } } }),
    prisma.complaint.count({ where: { deletedAt: null } }),
    prisma.survey.count({ where: { active: true, deletedAt: null } }),
    prisma.surveyResponse.count(),
    prisma.audit.count({ where: { status: 'PLANNED', deletedAt: null } }),
    prisma.audit.count({ where: { status: 'COMPLETED', deletedAt: null } }),
    prisma.managementReview.count({ where: { deletedAt: null } }),
    prisma.managementReview.count({ where: { status: 'COMPLETED', deletedAt: null } }),
    prisma.operationalActivity.count({ where: { deletedAt: null } }),
    prisma.department.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true } }),
  ]);

  const docMatches = (clause, hints = []) => {
    const normalizedHints = hints.map(h => String(h).toLowerCase());
    return docs
      .filter(d => {
        const haystack = `${d.code || ''} ${d.title || ''} ${d.isoClause || ''}`.toLowerCase();
        return (clause && String(d.isoClause || '').startsWith(clause)) ||
          normalizedHints.some(h => haystack.includes(h));
      })
      .slice(0, 3);
  };

  const buildRequirement = (item) => ({
    ...item,
    sourceChecklist: sourceChecklistName,
    evidenceDocuments: docMatches(item.clause, item.documentHints || []),
  });

  const requirements = [
    buildRequirement({ id: 'ISO-REQ-001', group: 'السياق', clause: '4.1', title: 'سجل تحليل سياق المنظمة SWOT', requiredEvidence: 'تحليل داخلي وخارجي معتمد ومراجع دورياً.', systemPage: 'swot', systemLabel: 'سياق المنظمة', status: requirementStatus(swotCount >= 4, swotCount > 0), evidence: `${swotCount} بند سياق نشط`, documentHints: ['SWOT', 'سياق'] }),
    buildRequirement({ id: 'ISO-REQ-002', group: 'السياق', clause: '4.2', title: 'قائمة الأطراف المعنية واحتياجاتها', requiredEvidence: 'أصحاب علاقة، احتياجات، توقعات، وآلية متابعة.', systemPage: 'interestedParties', systemLabel: 'الأطراف ذات العلاقة', status: requirementStatus(ipCount >= 4, ipCount > 0), evidence: `${ipCount} طرف معني نشط`, documentHints: ['الأطراف', 'معنية'] }),
    buildRequirement({ id: 'ISO-REQ-003', group: 'السياق', clause: '4.3', title: 'نطاق نظام إدارة الجودة Scope', requiredEvidence: 'حدود النظام والاستثناءات ومجال التطبيق.', systemPage: 'qualityScope', systemLabel: 'نطاق نظام الجودة', status: requirementStatus(docMatches('4.3', ['نطاق', 'ISO-DOC-002']).length > 0), evidence: 'صفحة نطاق نظام الجودة + وثيقة ISO-DOC-002', documentHints: ['نطاق', 'ISO-DOC-002'] }),
    buildRequirement({ id: 'ISO-REQ-004', group: 'السياق', clause: '4.4', title: 'خريطة تدفق العمليات Flowchart', requiredEvidence: 'عمليات رئيسية وداعمة بمدخلات ومخرجات وملاك.', systemPage: 'processes', systemLabel: 'خريطة العمليات', status: requirementStatus(processCount >= 5, processCount > 0), evidence: `${processCount} عملية موثقة`, documentHints: ['العمليات', 'خريطة'] }),
    buildRequirement({ id: 'ISO-REQ-005', group: 'القيادة', clause: '5.3', title: 'هيكل تنظيمي إداري', requiredEvidence: 'هيكل ومسؤوليات وصلاحيات واضحة.', systemPage: 'organizationalChart', systemLabel: 'الهيكل التنظيمي', status: requirementStatus(docs.some(d => /هيكل|تنظيمي/.test(d.title || '')), departmentCount > 0 && activeUserCount > 0), evidence: `${departmentCount} إدارة/قسم، ${activeUserCount} مستخدم نشط. يحتاج ملف الهيكل المعتمد إن لم يكن مرتبطاً.`, documentHints: ['هيكل', 'تنظيمي'] }),
    buildRequirement({ id: 'ISO-REQ-006', group: 'القيادة', clause: '5.2', title: 'سياسة نظام إدارة الجودة', requiredEvidence: 'سياسة معتمدة ومبلغة وقابلة للإقرار.', systemPage: 'qualityPolicy', systemLabel: 'سياسة الجودة', status: requirementStatus(policyActive > 0), evidence: policyActive ? 'سياسة جودة نشطة' : 'لا توجد سياسة نشطة', documentHints: ['سياسة الجودة'] }),
    buildRequirement({ id: 'ISO-REQ-007', group: 'القيادة', clause: '5.3', title: 'نموذج الوصف الوظيفي', requiredEvidence: 'مهام وصلاحيات وكفاءات لكل وظيفة حرجة.', systemPage: 'competence', systemLabel: 'مصفوفة الكفاءات', status: requirementStatus(competenceCount >= 3, competenceCount > 0), evidence: `${competenceCount} متطلب كفاءة نشط`, documentHints: ['الوصف الوظيفي', 'الكفاءة'] }),

    buildRequirement({ id: 'ISO-REQ-008', group: 'التخطيط', clause: '6.1', title: 'سجل تقييم المخاطر والفرص Risk Matrix', requiredEvidence: 'احتمالية، أثر، مستوى، مالك، ومعالجة.', systemPage: 'risks', systemLabel: 'المخاطر والفرص', status: requirementStatus(riskCount >= 5, riskCount > 0), evidence: `${riskCount} خطر/فرصة`, documentHints: ['المخاطر', 'Risk'] }),
    buildRequirement({ id: 'ISO-REQ-009', group: 'التخطيط', clause: '6.1', title: 'خطة إجراءات معالجة المخاطر والفرص', requiredEvidence: 'إجراءات، مسؤول، موعد، ومتابعة فعالية.', systemPage: 'risks', systemLabel: 'المخاطر والفرص', status: requirementStatus(riskTreated >= 3, riskTreated > 0), evidence: `${riskTreated} خطر/فرصة لها معالجة`, documentHints: ['معالجة المخاطر'] }),
    buildRequirement({ id: 'ISO-REQ-010', group: 'التخطيط', clause: '6.2', title: 'أهداف الجودة', requiredEvidence: 'أهداف قابلة للقياس مرتبطة بالسياسة والخطة.', systemPage: 'indicators', systemLabel: 'مكتبة المؤشرات', status: requirementStatus(indicatorCount >= 10 && strategicCount >= 3, indicatorCount > 0), evidence: `${strategicCount} هدف، ${indicatorCount} مؤشر`, documentHints: ['أهداف الجودة'] }),
    buildRequirement({ id: 'ISO-REQ-011', group: 'التخطيط', clause: '6.2', title: 'خطة تحقيق أهداف الجودة', requiredEvidence: 'من سيفعل؟ ماذا؟ متى؟ وبأي موارد؟', systemPage: 'operationalActivities', systemLabel: 'الخطة التشغيلية', status: requirementStatus(operationalActivities >= 10 && annualTargetsCount >= 10, operationalActivities > 0 || annualTargetsCount > 0), evidence: `${operationalActivities} نشاط، ${annualTargetsCount} مستهدف ${year}`, documentHints: ['تحقيق أهداف الجودة', 'الخطة'] }),
    buildRequirement({ id: 'ISO-REQ-012', group: 'التخطيط', clause: '6.2', title: 'سجل متابعة وتقييم تحقيق الأهداف', requiredEvidence: 'قراءات دورية وانحرافات وإجراءات متابعة.', systemPage: 'kpiTracking', systemLabel: 'متابعة الأداء', status: requirementStatus(annualTargetsCount >= 10, annualTargetsCount > 0), evidence: `${annualTargetsCount} مستهدف سنوي`, documentHints: ['متابعة الأهداف'] }),

    buildRequirement({ id: 'ISO-REQ-013', group: 'الدعم', clause: '7.2', title: 'خطة التدريب السنوية', requiredEvidence: 'خطة تدريب مبنية على الاحتياج والكفاءة.', systemPage: 'training', systemLabel: 'التدريب', status: requirementStatus(trainingCount >= 1, false), evidence: `${trainingCount} سجل تدريب`, documentHints: ['التدريب'] }),
    buildRequirement({ id: 'ISO-REQ-014', group: 'الدعم', clause: '7.2', title: 'سجل تقييم فعالية التدريب', requiredEvidence: 'قياس أثر التدريب على الأداء أو المعرفة.', systemPage: 'training', systemLabel: 'التدريب', status: requirementStatus(trainingCount >= 1, false), evidence: `${trainingCount} سجل تدريب`, documentHints: ['فعالية التدريب'] }),
    buildRequirement({ id: 'ISO-REQ-015', group: 'الدعم', clause: '7.4', title: 'خطة التواصل الداخلي والخارجي', requiredEvidence: 'الجمهور، الرسالة، القناة، التكرار، المسؤول.', systemPage: 'communication', systemLabel: 'خطة الاتصال', status: requirementStatus(commCount >= 3, commCount > 0), evidence: `${commCount} خطة اتصال نشطة`, documentHints: ['التواصل', 'الاتصال'] }),
    buildRequirement({ id: 'ISO-REQ-016', group: 'الدعم', clause: '7.5', title: 'القائمة الرئيسية للوثائق الحالية', requiredEvidence: 'سجل وثائق محكوم بالإصدار والحالة والمراجعة.', systemPage: 'documents', systemLabel: 'الوثائق والسجلات', status: requirementStatus(docs.length >= 10, docs.length > 0), evidence: `${docs.length} وثيقة/سجل`, documentHints: ['القائمة الرئيسية', 'الوثائق'] }),
    buildRequirement({ id: 'ISO-REQ-017', group: 'الدعم', clause: '7.5', title: 'نموذج استلام والتدريب على الوثائق', requiredEvidence: 'إقرار قراءة/استلام للوثائق المهمة.', systemPage: 'ackDocuments', systemLabel: 'السياسات والمواثيق', status: requirementStatus(ackDocsActive >= 1, false), evidence: `${ackDocsActive} وثيقة إقرار نشطة`, documentHints: ['استلام', 'إقرار'] }),
    buildRequirement({ id: 'ISO-REQ-018', group: 'الدعم', clause: '7.1.5', title: 'خطة المعايرة السنوية', requiredEvidence: 'تطبق إذا وجدت أجهزة قياس تؤثر على جودة الخدمة.', systemPage: 'documents', systemLabel: 'الوثائق والسجلات', status: 'NOT_APPLICABLE', evidence: 'غير منطبق حالياً ما لم توجد أجهزة قياس/معايرة مؤثرة', documentHints: ['المعايرة'] }),

    buildRequirement({ id: 'ISO-REQ-019', group: 'التشغيل', clause: '8.2', title: 'سجل متطلبات العملاء/المستفيدين ومراجعتها', requiredEvidence: 'تحديد احتياجات المستفيدين ومراجعتها قبل تقديم الخدمة.', systemPage: 'beneficiaries', systemLabel: 'المستفيدون', status: requirementStatus(true), evidence: 'تدار عبر ملفات المستفيدين وطلبات الخدمة/رافد كمصدر بيانات', documentHints: ['المستفيدين', 'متطلبات العملاء'] }),
    buildRequirement({ id: 'ISO-REQ-020', group: 'التشغيل', clause: '8.5', title: 'سجل تتبع الخدمة', requiredEvidence: 'قابلية تتبع تنفيذ الخدمة أو الصرف أو الطلب.', systemPage: 'operationalActivities', systemLabel: 'الخطة التشغيلية', status: requirementStatus(operationalActivities > 0, false), evidence: `${operationalActivities} نشاط تشغيلي قابل للمتابعة`, documentHints: ['تتبع الخدمة'] }),
    buildRequirement({ id: 'ISO-REQ-021', group: 'التشغيل', clause: '8.4', title: 'سجل متابعة وتقييم الموردين', requiredEvidence: 'موردون ومتابعة وتقييم واعتماد.', systemPage: 'suppliers', systemLabel: 'الموردون', status: requirementStatus(suppliersTotal > 0 && supplierEvalCount > 0, suppliersTotal > 0), evidence: `${suppliersTotal} مورد، ${supplierEvalCount} تقييم`, documentHints: ['الموردين'] }),
    buildRequirement({ id: 'ISO-REQ-022', group: 'التشغيل', clause: '8.6', title: 'سجل فحص واستلام المواد/الخدمات الموردة', requiredEvidence: 'فحص قبول الخدمة/المادة قبل استخدامها أو صرفها.', systemPage: 'suppliers', systemLabel: 'الموردون', status: requirementStatus(supplierEvalCount > 0, suppliersTotal > 0), evidence: 'يرتبط بتقييم المورد وسجلات الاستلام عند توفرها', documentHints: ['فحص', 'استلام'] }),
    buildRequirement({ id: 'ISO-REQ-023', group: 'التشغيل', clause: '8.7', title: 'سجل حالات عدم المطابقة', requiredEvidence: 'رصد عدم المطابقة ومعالجتها ومنع استخدامها.', systemPage: 'ncr', systemLabel: 'عدم المطابقة', status: requirementStatus(ncrCount > 0, false), evidence: `${ncrCount} حالة عدم مطابقة`, documentHints: ['عدم المطابقة'] }),

    buildRequirement({ id: 'ISO-REQ-024', group: 'تقييم الأداء', clause: '9.1', title: 'سجل مؤشرات الأداء الرئيسية', requiredEvidence: 'مؤشرات وقراءات وتحليل انحراف.', systemPage: 'kpiTracking', systemLabel: 'متابعة الأداء', status: requirementStatus(indicatorCount >= 10 && annualTargetsCount >= 10, indicatorCount > 0), evidence: `${indicatorCount} مؤشر، ${annualTargetsCount} مستهدف`, documentHints: ['مؤشرات الأداء'] }),
    buildRequirement({ id: 'ISO-REQ-025', group: 'تقييم الأداء', clause: '9.1.2', title: 'سجل رضا المستفيدين/تقرير الشكاوى', requiredEvidence: 'استبيانات أو شكاوى وتحليل نتائج.', systemPage: 'surveys', systemLabel: 'استبيانات الرضا', status: requirementStatus(surveyResponses > 0 || complaintCount > 0, surveysActive > 0 || complaintCount > 0), evidence: `${surveysActive} استبيان، ${surveyResponses} رد، ${complaintCount} شكوى`, documentHints: ['رضا', 'الشكاوى'] }),
    buildRequirement({ id: 'ISO-REQ-026', group: 'تقييم الأداء', clause: '9.2', title: 'الخطة السنوية للمراجعة الداخلية', requiredEvidence: 'خطة تدقيق سنوية بنطاق ومعايير ومواعيد.', systemPage: 'audits', systemLabel: 'التدقيق الداخلي', status: requirementStatus(auditPlanned > 0 || auditCompleted > 0, false), evidence: `مخطط: ${auditPlanned}، مكتمل: ${auditCompleted}`, documentHints: ['التدقيق', 'المراجعة الداخلية'] }),
    buildRequirement({ id: 'ISO-REQ-027', group: 'تقييم الأداء', clause: '9.2', title: 'تقرير المراجعات الداخلية', requiredEvidence: 'تقرير تدقيق ونتائج وملاحظات.', systemPage: 'audits', systemLabel: 'التدقيق الداخلي', status: requirementStatus(auditCompleted > 0, auditPlanned > 0), evidence: `${auditCompleted} تدقيق مكتمل`, documentHints: ['تقرير التدقيق'] }),
    buildRequirement({ id: 'ISO-REQ-028', group: 'تقييم الأداء', clause: '9.3', title: 'أجندة/محضر اجتماع مراجعة الإدارة', requiredEvidence: 'مدخلات ومخرجات وقرارات متابعة.', systemPage: 'managementReview', systemLabel: 'مراجعة الإدارة', status: requirementStatus(reviewCompleted > 0, reviewCount > 0), evidence: `${reviewCompleted}/${reviewCount} مراجعة مكتملة`, documentHints: ['مراجعة الإدارة'] }),

    buildRequirement({ id: 'ISO-REQ-029', group: 'التحسين', clause: '10.2', title: 'سجل الإجراءات التصحيحية', requiredEvidence: 'CAPA بسبب واضح ومالك وموعد.', systemPage: 'capa', systemLabel: 'CAPA', status: requirementStatus(capaCount > 0, false), evidence: `${capaCount} إجراء تصحيحي`, documentHints: ['الإجراءات التصحيحية', 'CAPA'] }),
    buildRequirement({ id: 'ISO-REQ-030', group: 'التحسين', clause: '10.2', title: 'سجل تقييم فعالية الإجراء التصحيحي', requiredEvidence: 'تحقق من الفعالية بعد التنفيذ.', systemPage: 'capa', systemLabel: 'CAPA', status: requirementStatus(capaClosed > 0, capaCount > 0), evidence: `${capaClosed} إجراء مغلق/متحقق`, documentHints: ['فعالية الإجراء'] }),
    buildRequirement({ id: 'ISO-REQ-031', group: 'التحسين', clause: '10.3', title: 'سجل مقترحات التطوير والتحسين', requiredEvidence: 'فرص تحسين موثقة ومصنفة.', systemPage: 'improvementProjects', systemLabel: 'التحسين المستمر', status: requirementStatus(capaCount > 0 || riskTreated > 0, false), evidence: 'يرتبط بفرص التحسين و CAPA والمخاطر', documentHints: ['التحسين'] }),
    buildRequirement({ id: 'ISO-REQ-032', group: 'التحسين', clause: '10.3', title: 'سجل متابعة أفعال التطوير والتحسين', requiredEvidence: 'متابعة إجراءات التحسين حتى الإغلاق.', systemPage: 'improvementProjects', systemLabel: 'التحسين المستمر', status: requirementStatus(capaClosed > 0 || reviewCompleted > 0, capaCount > 0 || reviewCount > 0), evidence: 'يرتبط بقرارات المراجعة، CAPA، والتحسين المستمر', documentHints: ['متابعة التحسين'] }),
  ];

  const summary = statusSummary(requirements);
  const implemented = summary.IMPLEMENTED || 0;
  const applicableTotal = requirements.filter(r => r.status !== 'NOT_APPLICABLE').length;
  const implementationRate = applicableTotal ? Math.round((implemented / applicableTotal) * 100) : 0;

  res.json({
    ok: true,
    year,
    sourceChecklist: sourceChecklistName,
    sourceAttachment: {
      title: ')  قائمة التحقق لنظام إدارة الجودة (2).pdf',
      note: 'الملف الأصلي مرجعي؛ هذا السجل هو النسخة التشغيلية داخل النظام.',
    },
    summary: {
      total: requirements.length,
      applicableTotal,
      implementationRate,
      byStatus: summary,
    },
    requirements,
  });
}));

/**
 * GET /api/iso-readiness/action-center
 * A practical, low-burden action center for the quality manager.
 *
 * This intentionally does not create records or decide on behalf of the team.
 * It turns existing evidence gaps into weekly/monthly routines with direct
 * system links, so ISO work remains a rhythm rather than a separate project.
 */
router.get('/action-center', requireAction('iso-readiness', 'read'), asyncHandler(async (req, res) => {
  const year = Number(req.query.year || currentYear());
  const today = startOfDay();
  const next14 = addDays(today, 14);

  const countSafe = async (promise) => {
    try { return await promise; } catch { return 0; }
  };

  const [
    overdueKpiEntries,
    activeKpiFollowUps,
    openComplaints,
    openNcr,
    overdueNcr,
    openCapa,
    overdueCapa,
    plannedAudits,
    completedAudits,
    plannedReviews,
    completedReviews,
    dueDocuments,
    trainingCount,
    trainingEffectivenessMissing,
    activeAckDocuments,
    riskWithoutTreatment,
    openImprovements,
    activeSurveys,
    surveyResponses,
  ] = await Promise.all([
    countSafe(prisma.kpiFollowUp.count({ where: { year, status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } } })),
    countSafe(prisma.kpiFollowUp.count({ where: { year, status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } } })),
    countSafe(prisma.complaint.count({ where: { deletedAt: null, status: { in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] } } })),
    countSafe(prisma.nCR.count({ where: { deletedAt: null, status: { not: 'CLOSED' } } })),
    countSafe(prisma.nCR.count({ where: { deletedAt: null, status: { not: 'CLOSED' }, dueDate: { lt: today } } })),
    countSafe(prisma.capa.count({ where: { deletedAt: null, status: { notIn: ['CLOSED', 'VERIFIED', 'EFFECTIVE'] } } })),
    countSafe(prisma.capa.count({ where: { deletedAt: null, status: { notIn: ['CLOSED', 'VERIFIED', 'EFFECTIVE'] }, dueDate: { lt: today } } })),
    countSafe(prisma.audit.count({ where: { deletedAt: null, status: { in: ['PLANNED', 'IN_PROGRESS'] }, plannedDate: { lte: next14 } } })),
    countSafe(prisma.audit.count({ where: { deletedAt: null, status: 'COMPLETED' } })),
    countSafe(prisma.managementReview.count({ where: { deletedAt: null, year, status: { not: 'COMPLETED' } } })),
    countSafe(prisma.managementReview.count({ where: { deletedAt: null, year, status: 'COMPLETED' } })),
    countSafe(prisma.document.count({ where: { deletedAt: null, reviewDate: { lte: next14 }, status: { not: 'ARCHIVED' } } })),
    countSafe(prisma.training.count({ where: { deletedAt: null } })),
    countSafe(prisma.trainingRecord.count({ where: { effective: null } })),
    countSafe(prisma.ackDocument.count({ where: { active: true, deletedAt: null } })),
    countSafe(prisma.risk.count({ where: { deletedAt: null, treatment: null } })),
    countSafe(prisma.improvementProject.count({ where: { deletedAt: null, status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] } } })),
    countSafe(prisma.survey.count({ where: { active: true, deletedAt: null } })),
    countSafe(prisma.surveyResponse.count()),
  ]);

  const action = ({ id, title, detail, page, count = 0, cadence, tone = 'info', button = 'فتح' }) => ({
    id, title, detail, page, count, cadence, tone, button,
    status: count > 0 ? 'OPEN' : 'OK',
  });

  const weekly = [
    action({
      id: 'kpi-late',
      title: 'متابعة قراءات المؤشرات المتأخرة',
      detail: 'راجع الإدخالات المتأخرة، أرسل تذكير، ثم صعّد فقط عند الحاجة.',
      page: 'kpiFollowUp',
      count: activeKpiFollowUps,
      cadence: 'أسبوعي',
      tone: activeKpiFollowUps > 0 ? 'danger' : 'success',
      button: 'فتح السجل',
    }),
    action({
      id: 'complaints-open',
      title: 'مراجعة الشكاوى والبلاغات المفتوحة',
      detail: 'تأكد أن كل شكوى لها مالك وحالة واضحة وموعد معالجة.',
      page: 'complaints',
      count: openComplaints,
      cadence: 'أسبوعي',
      tone: openComplaints > 0 ? 'warning' : 'success',
    }),
    action({
      id: 'ncr-capa-overdue',
      title: 'إغلاق المتأخر من عدم المطابقة والإجراءات التصحيحية',
      detail: 'ابدأ بالمتأخر، ثم راجع السبب والفعالية قبل الإغلاق.',
      page: overdueNcr > 0 ? 'ncr' : 'capa',
      count: overdueNcr + overdueCapa,
      cadence: 'أسبوعي',
      tone: overdueNcr + overdueCapa > 0 ? 'danger' : 'success',
    }),
    action({
      id: 'docs-review',
      title: 'مراجعة الوثائق التي اقترب موعد مراجعتها',
      detail: 'راجع النسخة، القرار، تاريخ الاعتماد، والرابط أو المرفق المعتمد.',
      page: 'documents',
      count: dueDocuments,
      cadence: 'أسبوعي',
      tone: dueDocuments > 0 ? 'warning' : 'success',
    }),
  ];

  const monthly = [
    action({
      id: 'audit-ready',
      title: 'تدقيق داخلي أو فحص جاهزية مصغر',
      detail: 'يكفي نطاق صغير وواضح: وثائق، تدريب، مؤشرات، NCR/CAPA.',
      page: 'audits',
      count: plannedAudits,
      cadence: 'شهري',
      tone: completedAudits > 0 ? 'success' : (plannedAudits > 0 ? 'warning' : 'danger'),
      button: 'فتح التدقيق',
    }),
    action({
      id: 'management-review',
      title: 'تحضير مراجعة الإدارة',
      detail: 'اجمع مدخلات الأداء والمخاطر والشكاوى والتدقيق وقرارات التحسين.',
      page: 'managementReview',
      count: plannedReviews,
      cadence: 'شهري/ربعي',
      tone: completedReviews > 0 ? 'success' : (plannedReviews > 0 ? 'warning' : 'danger'),
      button: 'فتح المراجعة',
    }),
    action({
      id: 'training-effectiveness',
      title: 'استكمال دليل التدريب وفعاليته',
      detail: 'التدريب وحده لا يكفي؛ نحتاج حضوراً وقياس فهم أو أثر مختصر.',
      page: 'training',
      count: trainingCount === 0 ? 1 : trainingEffectivenessMissing,
      cadence: 'شهري',
      tone: trainingCount === 0 || trainingEffectivenessMissing > 0 ? 'warning' : 'success',
      button: 'فتح التدريب',
    }),
    action({
      id: 'risks-treatment',
      title: 'تحديث المخاطر والفرص وخطط المعالجة',
      detail: 'لا نحتاج كثرة مخاطر؛ نحتاج مخاطر قليلة بمالك ومعالجة ومراجعة.',
      page: 'risks',
      count: riskWithoutTreatment,
      cadence: 'شهري',
      tone: riskWithoutTreatment > 0 ? 'warning' : 'success',
    }),
    action({
      id: 'beneficiary-feedback',
      title: 'التغذية الراجعة ورضا المستفيد',
      detail: 'استبيان نشط أو شكاوى محللة تكفي كبداية، ثم نضيف التحسينات.',
      page: activeSurveys > 0 ? 'surveys' : 'complaints',
      count: surveyResponses,
      cadence: 'شهري',
      tone: surveyResponses > 0 || openComplaints > 0 ? 'success' : 'warning',
      button: activeSurveys > 0 ? 'فتح الاستبيانات' : 'فتح البلاغات',
    }),
  ];

  const trialCycle = [
    action({ id: 'trial-training', title: 'تدريب توعوي قصير عن ISO والنظام', detail: 'جلسة واحدة مع حضور وقياس فعالية بسيط.', page: 'training', count: trainingCount, cadence: 'تجريبي', tone: trainingCount > 0 ? 'success' : 'warning' }),
    action({ id: 'trial-ncr', title: 'فتح حالة عدم مطابقة واحدة عند وجود ملاحظة حقيقية', detail: 'مثال: وثيقة ناقصة، تأخر قراءة، أو إجراء غير مكتمل.', page: 'ncr', count: openNcr, cadence: 'تجريبي', tone: openNcr > 0 ? 'success' : 'warning' }),
    action({ id: 'trial-capa', title: 'ربط إجراء تصحيحي بسبب واضح', detail: 'نربطه بالـ NCR أو الشكوى أو فجوة وثائق، ثم نتحقق من فعاليته.', page: 'capa', count: openCapa, cadence: 'تجريبي', tone: openCapa > 0 ? 'success' : 'warning' }),
    action({ id: 'trial-audit', title: 'تنفيذ تدقيق داخلي مصغر', detail: 'نطاق محدود حتى يتدرب الفريق بدون ضغط.', page: 'audits', count: completedAudits, cadence: 'تجريبي', tone: completedAudits > 0 ? 'success' : 'warning' }),
    action({ id: 'trial-review', title: 'مراجعة إدارة تمهيدية بمحضر مختصر', detail: 'ليست اجتماع لجنة مراجعة؛ هي اجتماع إدارة لمراجعة جاهزية النظام وقرارات التحسين.', page: 'managementReview', count: completedReviews, cadence: 'تجريبي', tone: completedReviews > 0 ? 'success' : 'warning' }),
    action({ id: 'trial-docs', title: 'تثبيت الوثائق والإقرارات الأساسية', detail: 'السياسة، النطاق، الهيكل، وإقرارات القراءة للوثائق المهمة.', page: activeAckDocuments > 0 ? 'ackDocuments' : 'documents', count: activeAckDocuments, cadence: 'تجريبي', tone: activeAckDocuments > 0 ? 'success' : 'warning' }),
  ];

  const openWeekly = weekly.filter(i => i.status === 'OPEN').length;
  const openMonthly = monthly.filter(i => i.status === 'OPEN').length;
  const trialReady = trialCycle.filter(i => i.tone === 'success').length;

  res.json({
    ok: true,
    year,
    generatedAt: new Date().toISOString(),
    summary: {
      openWeekly,
      openMonthly,
      trialReady,
      trialTotal: trialCycle.length,
      overdueKpiEntries,
      openNcr,
      openCapa,
      openImprovements,
    },
    weekly,
    monthly,
    trialCycle,
    guidance: {
      principle: 'الهدف ليس زيادة العمل؛ الهدف تحويل ISO إلى روتين متابعة خفيف بأدلة واضحة.',
      nextBestStep: openWeekly > 0
        ? 'ابدأ بالمتأخرات الأسبوعية لأنها تؤثر على صدق النظام.'
        : openMonthly > 0
          ? 'ابدأ بإغلاق عناصر الشهر المفتوحة قبل إضافة نماذج جديدة.'
          : 'ابدأ دورة ISO التجريبية المصغرة لتدريب الفريق على السجل الكامل.',
    },
  });
}));

export default router;
