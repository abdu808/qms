/**
 * routes/myWork.js — Batch 16 + UX-1 (role-based views)
 * لوحة "مهامي" — تتكيف محتوياتها حسب دور المستخدم:
 *   - EMPLOYEE      → مهامي الشخصية فقط
 *   - DEPT_MANAGER  → مهامي + ما يخص فريق قسمي
 *   - QUALITY_*     → نظرة جودة شاملة (انحرافات + workflow + SLA + data health)
 *   - SUPER_ADMIN   → كل ما سبق + ملخص تنفيذي
 *
 *   GET /api/my-work  → {
 *     viewMode, role, user,
 *     kpi, ncr, complaints, workflow, beneficiaries,
 *     dept?:       { users:[], ncrAssigned:[], complaintsAssigned:[], kpiPending:[] },
 *     exec?:       { objectives, risks, complaints, ncrs, documents, mgmtReview },
 *     dataHealth:  { criticalCount, highCount },
 *     alerts:      [ {type, severity, count, action} ],
 *     summary:     { totalActions }
 *   }
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { computeComplaintSla } from '../lib/sla.js';
import { needsReview as beneficiaryNeedsReview } from '../lib/beneficiaryAssessment.js';
import { isDueMonth } from '../lib/kpiFrequency.js';
import { ackAudienceTagsForUser } from '../lib/ackAudience.js';

const router = Router();

const NCR_OPEN   = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'];
const COMPL_OPEN = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];

function viewModeOf(role) {
  if (role === 'SUPER_ADMIN')                                return 'EXEC';
  if (role === 'QUALITY_MANAGER' || role === 'COMMITTEE_MEMBER') return 'QUALITY';
  if (role === 'DEPT_MANAGER')                               return 'DEPT';
  return 'EMPLOYEE';
}

router.get('/', asyncHandler(async (req, res) => {
  const userId   = req.user.sub;
  const role     = req.user.role;
  const viewMode = viewModeOf(role);
  const privileged = viewMode === 'QUALITY' || viewMode === 'EXEC';

  // ═══ 1) KPI الشخصية ═══
  let kpiSummary = null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  try {
    const ownedIndicators = await prisma.indicator.findMany({
      where: activeWhere({
        OR: [
          { dataEntryUserId: userId },
          { ownerId: userId },
        ],
      }),
      select: {
        id: true,
        frequency: true,
        seasonality: true,
        kpiEntries: { where: { year, month }, select: { id: true } },
      },
    });
    const dueIndicators = ownedIndicators.filter(i => isDueMonth(i.frequency, month, i.seasonality));
    const entered = dueIndicators.filter(i => i.kpiEntries.length > 0).length;
    const pending = dueIndicators.length - entered;
    kpiSummary = { total: dueIndicators.length, pending, entered, month, year };
  } catch { kpiSummary = null; }

  // ═══ 2) NCR — مسندة لي + (privileged) بانتظار مراجعة/اعتماد ═══
  const [ncrAssigned, ncrPendingReview, ncrPendingApproval] = await Promise.all([
    prisma.nCR.findMany({
      where: activeWhere({ assigneeId: userId, status: { in: NCR_OPEN } }),
      select: { id: true, code: true, title: true, severity: true, status: true, dueDate: true },
      take: 20,
    }),
    privileged ? prisma.nCR.findMany({
      where: activeWhere({ workflowState: 'SUBMITTED' }),
      select: { id: true, code: true, title: true, submittedAt: true },
      take: 20,
    }) : [],
    privileged ? prisma.nCR.findMany({
      where: activeWhere({ workflowState: 'UNDER_REVIEW' }),
      select: { id: true, code: true, title: true, reviewedAt: true },
      take: 20,
    }) : [],
  ]);

  // ═══ 3) الشكاوى — مسندة لي + (privileged) المتجاوزة ═══
  const [compAssigned, compAll] = await Promise.all([
    prisma.complaint.findMany({
      where: activeWhere({ assigneeId: userId, status: { in: COMPL_OPEN } }),
      select: { id: true, code: true, subject: true, severity: true, status: true,
                receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
      take: 20,
    }),
    privileged
      ? prisma.complaint.findMany({
          where: activeWhere({ status: { in: COMPL_OPEN } }),
          select: { id: true, code: true, subject: true, severity: true, status: true,
                    receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
          orderBy: { receivedAt: 'desc' },
          take: 200, // cap to keep latency bounded — SLA breach filter happens in-memory
        })
      : [],
  ]);
  const compBreached = compAll
    .map(c => ({ ...c, sla: computeComplaintSla(c) }))
    .filter(c => c.sla.overall === 'BREACHED');

  // ═══ 4) Workflow pending (privileged) ═══
  const [risksPendingReview, supplierEvalsPendingReview] = await Promise.all([
    privileged ? prisma.risk.findMany({
      where: activeWhere({ workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      select: { id: true, code: true, title: true, workflowState: true, submittedAt: true },
      take: 20,
    }) : [],
    privileged ? prisma.supplierEval.findMany({
      where: activeWhere({ workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      select: {
        id: true, code: true, workflowState: true, submittedAt: true,
        supplier: { select: { name: true, code: true } },
      },
      take: 20,
    }) : [],
  ]);

  // ═══ 4b) Pending Acks — توكنات إقرار شخصية مرسَلة لي (ISO 7.5.3.2(c)) ═══
  let pendingAcks = [];
  let pendingAckDocuments = [];
  try {
    pendingAcks = await prisma.ackToken.findMany({
      where: {
        userId,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true, token: true, documentVersion: true, expiresAt: true, sentAt: true,
        document: { select: { id: true, code: true, title: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const relevantAudiences = ackAudienceTagsForUser(req.user);
    const activeAckDocs = await prisma.ackDocument.findMany({
      where: activeWhere({
        active: true,
        audience: { hasSome: relevantAudiences },
      }),
      select: { id: true, code: true, title: true, category: true, version: true, mandatory: true },
      orderBy: [{ mandatory: 'desc' }, { effectiveDate: 'desc' }],
      take: 50,
    });
    const acked = activeAckDocs.length
      ? await prisma.acknowledgment.findMany({
          where: {
            userId,
            documentId: { in: activeAckDocs.map(d => d.id) },
          },
          select: { documentId: true, documentVersion: true },
        })
      : [];
    const ackedKeys = new Set(acked.map(a => `${a.documentId}:${a.documentVersion}`));
    const tokenKeys = new Set(pendingAcks
      .filter(t => t.document?.id)
      .map(t => `${t.document.id}:${t.documentVersion}`));
    pendingAckDocuments = activeAckDocs
      .filter(d => !ackedKeys.has(`${d.id}:${d.version}`) && !tokenKeys.has(`${d.id}:${d.version}`))
      .slice(0, 20);
  } catch {
    pendingAcks = [];
    pendingAckDocuments = [];
  }

  // ═══ 4b-2) تقييمات أداء بانتظار توقيعي — مسار 180 خفيف ═══
  let pendingPerformanceReviews = [];
  try {
    pendingPerformanceReviews = await prisma.performanceReview.findMany({
      where: {
        deletedAt: null,
        employeeId: userId,
        status: 'EMPLOYEE_REVIEW',
        employeeSignedAt: null,
      },
      select: {
        id: true,
        code: true,
        period: true,
        periodStart: true,
        periodEnd: true,
        overallRating: true,
        grade: true,
        strengths: true,
        areasToImprove: true,
        goalsNextPeriod: true,
        developmentPlan: true,
        employeeComments: true,
        reviewer: { select: { name: true, jobTitle: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
  } catch { pendingPerformanceReviews = []; }

  // ═══ 4c) مسوّداتي — NCR + Risk + Document حيث أنا المنشئ وفي حالة DRAFT ═══
  let myDrafts = { ncr: [], risks: [], documents: [], total: 0 };
  try {
    const [ncrDrafts, riskDrafts, docDrafts] = await Promise.all([
      prisma.nCR.findMany({
        where: activeWhere({ reporterId: userId, workflowState: 'DRAFT' }),
        select: { id: true, code: true, title: true, severity: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.risk.findMany({
        where: activeWhere({ createdById: userId, workflowState: 'DRAFT' }),
        select: { id: true, code: true, title: true, level: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.document.findMany({
        where: activeWhere({ createdById: userId, status: 'DRAFT' }),
        select: { id: true, code: true, title: true, category: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);
    myDrafts = {
      ncr: ncrDrafts,
      risks: riskDrafts,
      documents: docDrafts,
      total: ncrDrafts.length + riskDrafts.length + docDrafts.length,
    };
  } catch { /* non-fatal */ }

  // Personal follow-up tasks turn deviations/review decisions into one clear work queue.
  let myFollowUpTasks = { open: [], overdue: [], total: 0, overdueCount: 0 };
  try {
    const tasks = await prisma.followUpTask.findMany({
      where: {
        deletedAt: null,
        ownerId: userId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        code: true,
        title: true,
        dueDate: true,
        priority: true,
        source: true,
        status: true,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    });
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    myFollowUpTasks = {
      open: tasks,
      overdue,
      total: tasks.length,
      overdueCount: overdue.length,
    };
  } catch { /* non-fatal */ }

  // ═══ 5) إعادة تقييم مستفيدين (privileged) ═══
  let beneficiariesDueReview = [];
  if (privileged) {
    try {
      const actives = await prisma.beneficiary.findMany({
        where: activeWhere({ status: 'ACTIVE' }),
        select: { id: true, code: true, fullName: true, assessedAt: true },
        orderBy: { assessedAt: 'asc' }, // الأقدم أولاً يتصدّر قائمة الحاجة للمراجعة
        take: 500, // سقف للأداء — الفلتر بعده في الذاكرة
      });
      beneficiariesDueReview = actives.filter(b => beneficiaryNeedsReview(b)).slice(0, 20);
    } catch { /* non-fatal */ }
  }

  // ═══ 6) نطاق القسم (DEPT_MANAGER فقط) ═══
  let deptBlock = null;
  if (viewMode === 'DEPT') {
    try {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true, department: { select: { id: true, name: true, code: true } } },
      });
      if (me?.departmentId) {
        const teamUsers = await prisma.user.findMany({
          where: { departmentId: me.departmentId, active: true },
          select: { id: true, name: true, email: true, jobTitle: true },
        });
        const teamIds = teamUsers.map(u => u.id);

        const [dNcr, dComp, dIndicators] = await Promise.all([
          prisma.nCR.findMany({
            where: activeWhere({ assigneeId: { in: teamIds }, status: { in: NCR_OPEN } }),
            select: { id: true, code: true, title: true, severity: true, status: true, dueDate: true, assigneeId: true },
            take: 30,
          }),
          prisma.complaint.findMany({
            where: activeWhere({ assigneeId: { in: teamIds }, status: { in: COMPL_OPEN } }),
            select: { id: true, code: true, subject: true, severity: true, status: true,
                      receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
            take: 30,
          }),
          prisma.indicator.findMany({
            where: activeWhere({
              OR: [
                { dataEntryUserId: { in: teamIds } },
                { ownerId: { in: teamIds } },
                { approverUserId: { in: teamIds } },
              ],
            }),
            select: {
              id: true, code: true, nameAr: true, ownerId: true, dataEntryUserId: true,
              frequency: true, seasonality: true,
              kpiEntries: { where: { year, month }, select: { id: true } },
            },
          }),
        ]);
        const kpiPending = dIndicators
          .filter(i => isDueMonth(i.frequency, month, i.seasonality))
          .filter(i => i.kpiEntries.length === 0)
          .map(i => ({ id: i.id, code: i.code, title: i.nameAr, ownerId: i.ownerId, dataEntryUserId: i.dataEntryUserId }));
        const compWithSla = dComp.map(c => ({ ...c, sla: computeComplaintSla(c) }));

        deptBlock = {
          department: me.department,
          teamSize: teamUsers.length,
          ncrAssigned: dNcr,
          complaintsAssigned: compWithSla.map(c => ({
            id: c.id, code: c.code, subject: c.subject, severity: c.severity, status: c.status,
            assigneeId: c.assigneeId, ageDays: c.sla.ageDays, overall: c.sla.overall,
          })),
          kpiPending,
          kpiPendingCount: kpiPending.length,
        };
      }
    } catch { /* non-fatal */ }
  }

  // ═══ 6b) أهداف/أنشطة منخفضة progress — تنبيه proactive ═══
  //   - للموظف: أهدافه الشخصية بـ progress < 50
  //   - للمدير/الجودة/التنفيذ: كل أهداف/أنشطة المؤسّسة بـ progress < 50
  //   نعرض بطاقة action "راجع الأسباب" (تشير إلى الصفحة المناسبة).
  let atRisk = { objectives: [], activities: [], total: 0 };
  try {
    const objScope = privileged
      ? activeWhere({ status: { notIn: ['CANCELLED', 'ACHIEVED'] }, progress: { lt: 50 } })
      : activeWhere({ ownerId: userId, status: { notIn: ['CANCELLED', 'ACHIEVED'] }, progress: { lt: 50 } });
    const actScope = privileged
      ? activeWhere({ status: { not: 'CANCELLED' }, progress: { lt: 50 } })
      : null;
    const [atRiskObj, atRiskAct] = await Promise.all([
      prisma.objective.findMany({
        where: objScope,
        select: { id: true, code: true, title: true, progress: true, ownerId: true },
        orderBy: { progress: 'asc' },
        take: 20,
      }),
      actScope ? prisma.operationalActivity.findMany({
        where: actScope,
        select: { id: true, code: true, title: true, progress: true, responsible: true },
        orderBy: { progress: 'asc' },
        take: 20,
      }) : [],
    ]);
    atRisk = {
      objectives: atRiskObj,
      activities: atRiskAct,
      total: atRiskObj.length + atRiskAct.length,
    };
  } catch { atRisk = { objectives: [], activities: [], total: 0 }; }

  // ═══ 7a) ملخص جودة (QUALITY_MANAGER + COMMITTEE_MEMBER) ═══
  let qualityBlock = null;
  if (viewMode === 'QUALITY') {
    try {
      const nowQ = new Date();
      const [ncrOpen, ncrOverdue, compOpen, afOpen, afCritical, futPending, futOverdue] = await Promise.all([
        prisma.nCR.count({ where: activeWhere({ status: { in: NCR_OPEN } }) }),
        prisma.nCR.count({ where: activeWhere({ status: { in: NCR_OPEN }, dueDate: { lt: nowQ } }) }),
        prisma.complaint.count({ where: activeWhere({ status: { in: COMPL_OPEN } }) }),
        prisma.auditFinding.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_REVIEW'] } } }).catch(() => 0),
        prisma.auditFinding.count({ where: { deletedAt: null, type: 'MAJOR_NC', status: { not: 'CLOSED' } } }).catch(() => 0),
        prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0),
        prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: nowQ } } }).catch(() => 0),
      ]);
      qualityBlock = {
        ncr:          { open: ncrOpen, overdue: ncrOverdue, pendingReview: ncrPendingReview.length, pendingApproval: ncrPendingApproval.length },
        complaints:   { open: compOpen, breached: compBreached.length },
        auditFindings:{ open: afOpen,  critical: afCritical },
        followUpTasks:{ pending: futPending, overdue: futOverdue },
      };
    } catch { /* non-fatal */ }
  }

  // ═══ 7) ملخص تنفيذي (SUPER_ADMIN فقط) ═══
  let execBlock = null;
  if (viewMode === 'EXEC') {
    try {
        const nowExec = new Date();
      const [objectives, risks, complaintsAll, ncrsAll, documents, mgmtReview,
             futPending, futOverdue, afOpen, afCritical] = await Promise.all([
        prisma.objective.groupBy({
          by: ['status'], _count: { id: true }, where: activeWhere({}),
        }),
        prisma.risk.groupBy({
          by: ['level'], _count: { id: true }, where: activeWhere({ status: { not: 'CLOSED' } }),
        }),
        prisma.complaint.groupBy({
          by: ['status'], _count: { id: true }, where: activeWhere({}),
        }),
        prisma.nCR.groupBy({
          by: ['severity'], _count: { id: true }, where: activeWhere({ status: { in: NCR_OPEN } }),
        }),
        prisma.document.count({ where: activeWhere({ status: 'PUBLISHED' }) }).catch(() => 0),
        prisma.managementReview.findFirst({
          where: activeWhere({}),
          orderBy: { meetingDate: 'desc' },
          select: { id: true, meetingDate: true, status: true },
        }).catch(() => null),
        prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0),
        prisma.followUpTask.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: nowExec } } }).catch(() => 0),
        prisma.auditFinding.count({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_REVIEW'] } } }).catch(() => 0),
        prisma.auditFinding.count({ where: { deletedAt: null, type: 'MAJOR_NC', status: { not: 'CLOSED' } } }).catch(() => 0),
      ]);

      const objByStatus = Object.fromEntries(objectives.map(r => [r.status, r._count.id]));
      const riskByLvl   = Object.fromEntries(risks.map(r => [r.level, r._count.id]));
      const compByStat  = Object.fromEntries(complaintsAll.map(r => [r.status, r._count.id]));
      const ncrBySev    = Object.fromEntries(ncrsAll.map(r => [r.severity, r._count.id]));

      execBlock = {
        objectives: {
          total: Object.values(objByStatus).reduce((a, b) => a + b, 0),
          byStatus: objByStatus,
        },
        risks: {
          critical: (riskByLvl['حرج'] || 0) + (riskByLvl['مرتفع'] || 0),
          byLevel: riskByLvl,
        },
        complaints: {
          open: (compByStat['NEW'] || 0) + (compByStat['UNDER_REVIEW'] || 0) + (compByStat['IN_PROGRESS'] || 0),
          byStatus: compByStat,
        },
        ncrs: {
          open: Object.values(ncrBySev).reduce((a, b) => a + b, 0),
          bySeverity: ncrBySev,
        },
        documents: { published: documents },
        mgmtReview,
        followUpTasks: { pending: futPending, overdue: futOverdue },
        auditFindings: { open: afOpen, critical: afCritical },
      };
    } catch { /* non-fatal */ }
  }

  // ═══ 8) Data Health (ملخص) — privileged ═══
  let dataHealth = null;
  if (privileged) {
    try {
      // lightweight: نعتمد على الموجود في beneficiariesDueReview + compBreached + ncrs as proxy
      dataHealth = {
        criticalCount: compBreached.length,
        highCount: beneficiariesDueReview.length,
      };
    } catch { dataHealth = null; }
  }

  // ═══ 9) إجمالي المهام ═══
  const totalActions =
    (kpiSummary?.pending || 0) +
    ncrAssigned.length +
    (privileged ? ncrPendingReview.length + ncrPendingApproval.length : 0) +
    compAssigned.length +
    (privileged ? compBreached.length : 0) +
    (privileged ? risksPendingReview.length + supplierEvalsPendingReview.length : 0) +
    (privileged ? beneficiariesDueReview.length : 0) +
    pendingAcks.length +
    pendingAckDocuments.length +
    pendingPerformanceReviews.length +
    myDrafts.total +
    myFollowUpTasks.total +
    (deptBlock ? (deptBlock.ncrAssigned.length + deptBlock.complaintsAssigned.length + deptBlock.kpiPendingCount) : 0);

  // ═══ 10) تنبيهات موحّدة (بطاقات Action) ═══
  const alerts = [];
  if ((kpiSummary?.pending || 0) > 0) {
    alerts.push({
      type: 'kpi_missing',
      severity: 'warning',
      count: kpiSummary.pending,
      title: `${kpiSummary.pending} مؤشر بدون قراءة لهذا الشهر`,
      action: { page: 'myKpi', label: 'إدخال قراءة' },
    });
  }
  if (ncrAssigned.length > 0) {
    alerts.push({
      type: 'ncr_assigned',
      severity: 'warning',
      count: ncrAssigned.length,
      title: `${ncrAssigned.length} حالة عدم مطابقة مسنَدة إليك`,
      action: { page: 'ncr', label: 'فتح القائمة' },
    });
  }
  const pendingAckTotal = pendingAcks.length + pendingAckDocuments.length;
  if (pendingAckTotal > 0) {
    alerts.push({
      type: 'acks_pending',
      severity: 'info',
      count: pendingAckTotal,
      title: `${pendingAckTotal} إقرار بانتظار توقيعك`,
      action: { page: 'myAcknowledgments', label: 'فتح الإقرارات' },
    });
  }
  if (pendingPerformanceReviews.length > 0) {
    alerts.push({
      type: 'performance_review_signature',
      severity: 'info',
      count: pendingPerformanceReviews.length,
      title: `${pendingPerformanceReviews.length} تقييم أداء بانتظار تعليقك وتوقيعك`,
      action: { page: 'myWork', label: 'فتح التقييم' },
    });
  }
  if (myDrafts.total > 0) {
    alerts.push({
      type: 'drafts',
      severity: 'info',
      count: myDrafts.total,
      title: `${myDrafts.total} مسوّدة لم تُرسَل بعد`,
      action: { page: 'myWork', label: 'إكمال المسوّدات' },
    });
  }
  if (myFollowUpTasks.total > 0) {
    alerts.push({
      type: 'follow_up_tasks',
      severity: myFollowUpTasks.overdueCount > 0 ? 'critical' : 'warning',
      count: myFollowUpTasks.total,
      title: `${myFollowUpTasks.total} مهمة متابعة مفتوحة${myFollowUpTasks.overdueCount ? ` — ${myFollowUpTasks.overdueCount} متأخرة` : ''}`,
      action: { page: 'follow-up-tasks', label: 'فتح مهام المتابعة' },
    });
  }
  if (atRisk.total > 0) {
    alerts.push({
      type: 'progress_low',
      severity: atRisk.total >= 5 ? 'critical' : 'warning',
      count: atRisk.total,
      title: `${atRisk.total} ${privileged ? 'هدف/نشاط' : 'هدف'} دون 50% — راجع الأسباب`,
      action: { page: privileged ? 'strategicGoals' : 'myKpi', label: 'فتح القائمة' },
    });
  }
  if (compAssigned.length > 0) {
    alerts.push({
      type: 'complaints_assigned',
      severity: 'info',
      count: compAssigned.length,
      title: `${compAssigned.length} شكوى مسنَدة إليك`,
      action: { page: 'complaints', label: 'فتح القائمة' },
    });
  }
  if (privileged && compBreached.length > 0) {
    alerts.push({
      type: 'sla_breached',
      severity: 'critical',
      count: compBreached.length,
      title: `${compBreached.length} شكوى تجاوزت مدّة SLA`,
      action: { page: 'slaBoard', label: 'لوحة SLA' },
    });
  }
  if (privileged && beneficiariesDueReview.length > 0) {
    alerts.push({
      type: 'beneficiary_review_due',
      severity: 'warning',
      count: beneficiariesDueReview.length,
      title: `${beneficiariesDueReview.length} مستفيد يحتاج إعادة تقييم (>365 يوم)`,
      action: { page: 'beneficiaries', label: 'فتح القائمة' },
    });
  }
  if (privileged && (risksPendingReview.length + supplierEvalsPendingReview.length) > 0) {
    const n = risksPendingReview.length + supplierEvalsPendingReview.length;
    alerts.push({
      type: 'workflow_pending',
      severity: 'info',
      count: n,
      title: `${n} عنصر workflow بانتظار مراجعتك`,
      action: { page: 'risks', label: 'المخاطر' },
    });
  }
  if (execBlock?.mgmtReview) {
    const last = execBlock.mgmtReview.meetingDate ? new Date(execBlock.mgmtReview.meetingDate) : null;
    if (last) {
      const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
      if (daysSince > 180) {
        alerts.push({
          type: 'mgmt_review_overdue',
          severity: 'critical',
          count: 1,
          title: `لم تُعقد مراجعة إدارية منذ ${daysSince} يوم`,
          action: { page: 'managementReview', label: 'فتح المراجعة' },
        });
      } else if (daysSince > 150) {
        alerts.push({
          type: 'mgmt_review_due_soon',
          severity: 'warning',
          count: 1,
          title: `المراجعة الإدارية مستحقة خلال ${180 - daysSince} يوم`,
          action: { page: 'managementReview', label: 'جدولة' },
        });
      }
    }
  }

  // ═══ KPI Follow-Up alerts — متابعات الإدخالات المتأخرة ═══
  // EMPLOYEE: متابعاته كمدخل بيانات
  // DEPT_MANAGER: متابعات قسمه (مُصعَّدة L1)
  // QUALITY/EXEC: جميع المتابعات النشطة
  try {
    let kfuWhere = { status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } };
    let kfuLink = '/qms#/kpiFollowUp';
    let kfuTitle = '';

    if (role === 'EMPLOYEE') {
      kfuWhere.dataEntryUserId = userId;
      kfuTitle = 'مؤشر متأخر بانتظار إدخالك';
    } else if (role === 'DEPT_MANAGER') {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
      if (me?.departmentId) {
        kfuWhere.departmentId = me.departmentId;
        kfuWhere.escalationLevel = { gte: 1 };
        kfuTitle = 'متابعة مُصعَّدة لقسمك تتطلب تدخلاً';
      } else {
        kfuWhere = null;
      }
    } else if (privileged) {
      kfuWhere.escalationLevel = { gte: 1 };
      kfuTitle = 'متابعة مُصعَّدة بانتظار قرار الجودة';
    } else {
      kfuWhere = null;
    }

    if (kfuWhere) {
      const kfuCount = await prisma.kpiFollowUp.count({ where: kfuWhere });
      if (kfuCount > 0) {
        alerts.push({
          type: 'kpi_followup',
          severity: kfuCount >= 5 ? 'critical' : 'warning',
          count: kfuCount,
          title: `${kfuCount} ${kfuTitle}`,
          action: { page: 'kpiFollowUp', label: 'فتح السجل' },
        });
      }
    }
  } catch (e) {
    console.warn('[myWork] kpi-followup alert failed:', e.message);
  }

  res.json({
    ok: true,
    viewMode,
    role,
    user: { id: userId, role },
    kpi: kpiSummary,
    ncr: {
      assigned: ncrAssigned,
      pendingReview:   privileged ? ncrPendingReview   : [],
      pendingApproval: privileged ? ncrPendingApproval : [],
    },
    complaints: {
      assigned: compAssigned,
      breached: privileged ? compBreached.map(c => ({
        id: c.id, code: c.code, subject: c.subject, severity: c.severity, status: c.status,
        ageDays: c.sla.ageDays, overall: c.sla.overall,
      })) : [],
    },
    workflow: {
      risksPendingReview:         privileged ? risksPendingReview : [],
      supplierEvalsPendingReview: privileged ? supplierEvalsPendingReview : [],
    },
    beneficiaries: {
      dueReview: privileged ? beneficiariesDueReview : [],
    },
    pendingAcks,
    pendingAckDocuments,
    pendingPerformanceReviews,
    myDrafts,
    myFollowUpTasks,
    atRisk,
    dept: deptBlock,
    quality: qualityBlock,
    exec: execBlock,
    dataHealth,
    alerts,
    summary: { totalActions },
  });
}));

export default router;
