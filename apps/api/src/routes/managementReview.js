import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { MGMT_REVIEW_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';
import { nextCode } from '../utils/codeGen.js';
import { createSchema as mrCreate, updateSchema as mrUpdate } from '../schemas/managementReview.schema.js';
import { parseDecisionsField } from '../services/managementReviewTasks.js';

const base = crudRouter({
  resource: 'management-review',
  model: 'managementReview',
  codePrefix: 'MR',
  searchFields: ['title', 'attendees', 'decisions', 'improvementActions'],
  allowedSortFields: ['createdAt', 'meetingDate', 'status'],
  allowedFilters: ['status', 'planId', 'year'],
  include: {
    plan: { select: { id: true, code: true, title: true } },
  },
  schemas: { create: mrCreate, update: mrUpdate },
  beforeUpdate: async (data, req) => {
    if (data.status) {
      // COMPLETED يُنجز حصراً عبر POST /:id/complete لضمان الذرية مع مهام المتابعة
      if (data.status === 'COMPLETED') {
        throw BadRequest(
          'لإكمال المراجعة الإدارية استخدم: POST /api/management-review/:id/complete — ' +
          'يضمن إنشاء مهام المتابعة بشكل ذري مع تحديث الحالة (ISO 9.3.3)',
        );
      }
      const current = await prisma.managementReview.findUnique({
        where: { id: req.params.id, deletedAt: null },
        select: { status: true },
      });
      if (!current) throw NotFound('المراجعة غير موجودة');
      assertTransition(MGMT_REVIEW_STATUS, current.status, data.status, {
        label: 'المراجعة الإدارية', role: req.user?.role,
      });
    }
    return data;
  },
});

const router = Router();

/**
 * GET /api/management-review/:id/inputs
 * ISO 9.3.2 — auto-gather inputs scoped to the review's period
 * (from the previous review's meeting date up to this review's meeting date)
 */
router.get('/:id/inputs', requireAction('management-review', 'read'), asyncHandler(async (req, res) => {
  const review = await prisma.managementReview.findUnique({ where: { id: req.params.id, deletedAt: null } });
  if (!review) throw NotFound('المراجعة غير موجودة');

  // Determine period: from previous review (if any) to this review's meetingDate
  const previous = await prisma.managementReview.findFirst({
    where: { meetingDate: { lt: review.meetingDate } },
    orderBy: { meetingDate: 'desc' },
    select: { meetingDate: true },
  });
  const from = previous?.meetingDate || new Date('2000-01-01');
  const to   = review.meetingDate;

  const dateRange = { gte: from, lte: to };

  const [
    objStats, riskStats, ncrStats, complaintStats, auditStats, supplierStats,
    newComplaints, resolvedComplaints, avgSatisfaction,
    openNcrs, closedNcrs, effectiveNcrs,
    surveyResponses,
  ] = await Promise.all([
    prisma.objective.groupBy({ by: ['status'], _count: true }),
    prisma.risk.groupBy({ by: ['level'], _count: true }),
    prisma.nCR.groupBy({ by: ['status'], _count: true, where: { createdAt: dateRange } }),
    prisma.complaint.groupBy({ by: ['status'], _count: true, where: { receivedAt: dateRange } }),
    prisma.audit.groupBy({ by: ['status'], _count: true, where: { plannedDate: dateRange } }),
    prisma.supplier.groupBy({ by: ['status'], _count: true }),
    prisma.complaint.count({ where: { receivedAt: dateRange } }),
    prisma.complaint.count({ where: { receivedAt: dateRange, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.complaint.aggregate({
      where: { receivedAt: dateRange, satisfaction: { not: null } },
      _avg: { satisfaction: true },
      _count: { satisfaction: true },
    }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: { not: 'CLOSED' } } }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: 'CLOSED' } }),
    prisma.nCR.count({ where: { createdAt: dateRange, status: 'CLOSED', effective: true } }),
    prisma.survey.aggregate({
      where: { updatedAt: dateRange },
      _sum: { responses: true },
      _avg: { avgScore: true },
    }),
  ]);

  res.json({
    ok: true,
    period: { from, to, label: review.period || null },
    inputs: {
      objectives: objStats,
      risks: riskStats,
      ncr: {
        byStatus: ncrStats,
        open: openNcrs,
        closed: closedNcrs,
        effective: effectiveNcrs,
        effectivenessRate: closedNcrs > 0 ? Math.round((effectiveNcrs / closedNcrs) * 100) : null,
      },
      complaints: {
        byStatus: complaintStats,
        received: newComplaints,
        resolved: resolvedComplaints,
        resolutionRate: newComplaints > 0 ? Math.round((resolvedComplaints / newComplaints) * 100) : null,
        avgSatisfaction: avgSatisfaction._avg.satisfaction,
        satisfactionResponseCount: avgSatisfaction._count.satisfaction,
      },
      audits: auditStats,
      suppliers: supplierStats,
      surveys: {
        totalResponses: surveyResponses._sum.responses || 0,
        avgScore: surveyResponses._avg.avgScore,
      },
    },
  });
}));

/**
 * POST /api/management-review/:id/populate-inputs
 * P-13 §6.1 — يولّد نصاً جاهزاً لكل حقل مدخلات في المراجعة (ISO 9.3.2)
 * يكتب النص في الحقول الفارغة فقط، ويحترم ما كتبه المستخدم يدوياً.
 */
router.post(
  '/:id/populate-inputs',
  requireAction('management-review', 'update'),
  asyncHandler(async (req, res) => {
    const { overwrite = false } = req.body || {};
    const review = await prisma.managementReview.findUnique({ where: { id: req.params.id } });
    if (!review) throw NotFound('المراجعة غير موجودة');
    if (review.status === 'COMPLETED') {
      throw BadRequest('لا يمكن توليد مدخلات مراجعة مكتملة');
    }

    // نفس منطق الفترة في endpoint الـ inputs
    const previous = await prisma.managementReview.findFirst({
      where: { meetingDate: { lt: review.meetingDate } },
      orderBy: { meetingDate: 'desc' },
      select: { meetingDate: true },
    });
    const from = previous?.meetingDate || new Date('2000-01-01');
    const to   = review.meetingDate;
    const dr = { gte: from, lte: to };

    const [
      objectives, risks, ncrOpen, ncrClosed, ncrEffective,
      complaintsReceived, complaintsResolved, avgSat,
      auditsDone, auditsPlanned,
      topRisks, openNcrItems,
      supplierSummary, surveys,
    ] = await Promise.all([
      prisma.objective.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.risk.groupBy({ by: ['level'], _count: { _all: true }, where: { status: { not: 'CLOSED' } } }),
      prisma.nCR.count({ where: { createdAt: dr, status: { not: 'CLOSED' } } }),
      prisma.nCR.count({ where: { createdAt: dr, status: 'CLOSED' } }),
      prisma.nCR.count({ where: { createdAt: dr, status: 'CLOSED', effective: true } }),
      prisma.complaint.count({ where: { receivedAt: dr } }),
      prisma.complaint.count({ where: { receivedAt: dr, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.complaint.aggregate({
        where: { receivedAt: dr, satisfaction: { not: null } },
        _avg: { satisfaction: true }, _count: { satisfaction: true },
      }),
      prisma.audit.count({ where: { plannedDate: dr, status: 'COMPLETED' } }),
      prisma.audit.count({ where: { plannedDate: dr, status: 'PLANNED' } }),
      prisma.risk.findMany({
        where: { status: { not: 'CLOSED' }, level: { in: ['حرج', 'مرتفع'] } },
        select: { code: true, title: true, level: true },
        orderBy: { score: 'desc' }, take: 5,
      }),
      prisma.nCR.findMany({
        where: { createdAt: dr, status: { not: 'CLOSED' } },
        select: { code: true, title: true, severity: true },
        orderBy: { createdAt: 'desc' }, take: 5,
      }),
      prisma.supplier.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.survey.aggregate({
        where: { updatedAt: dr },
        _sum: { responses: true }, _avg: { avgScore: true },
      }),
    ]);

    const fmtCount = (rows, keyName) =>
      rows.map(r => `  • ${r[keyName]}: ${r._count._all}`).join('\n') || '  • لا توجد بيانات في الفترة';
    const periodLabel = `${from.toISOString().slice(0,10)} → ${to.toISOString().slice(0,10)}`;

    const generated = {
      objectivesReview:
        `[مولّد تلقائياً — فترة ${periodLabel}]\n` +
        `توزيع حالات الأهداف:\n${fmtCount(objectives, 'status')}`,
      risksStatus:
        `[مولّد تلقائياً]\nالمخاطر النشطة حسب المستوى:\n${fmtCount(risks, 'level')}\n\n` +
        `أعلى 5 مخاطر:\n` +
        (topRisks.map(r => `  • [${r.level}] ${r.code} — ${r.title}`).join('\n') || '  • لا توجد'),
      conformityStatus:
        `[مولّد تلقائياً — فترة ${periodLabel}]\n` +
        `عدم مطابقة مفتوحة: ${ncrOpen} · مغلقة: ${ncrClosed} · بفعالية مثبتة: ${ncrEffective}\n` +
        `نسبة فعالية الإغلاق: ${ncrClosed ? Math.round((ncrEffective / ncrClosed) * 100) : 0}%\n\n` +
        `أحدث NCRs مفتوحة:\n` +
        (openNcrItems.map(n => `  • ${n.code} [${n.severity}] — ${n.title}`).join('\n') || '  • لا توجد'),
      customerFeedback:
        `[مولّد تلقائياً — فترة ${periodLabel}]\n` +
        `الشكاوى المستلمة: ${complaintsReceived} · المُعالَجة: ${complaintsResolved}\n` +
        `نسبة الإغلاق: ${complaintsReceived ? Math.round((complaintsResolved / complaintsReceived) * 100) : 0}%\n` +
        `متوسط الرضا: ${avgSat._avg.satisfaction ? avgSat._avg.satisfaction.toFixed(2) + '/5' : '—'} ` +
        `(${avgSat._count.satisfaction} ردود)\n` +
        `الاستبيانات: ${surveys._sum.responses || 0} رد · متوسط: ${surveys._avg.avgScore ? surveys._avg.avgScore.toFixed(1) : '—'}`,
      auditResults:
        `[مولّد تلقائياً — فترة ${periodLabel}]\n` +
        `تدقيقات مكتملة: ${auditsDone} · مخططة لم تُنفَّذ: ${auditsPlanned}`,
      processPerformance:
        `[مولّد تلقائياً]\nالموردون حسب الحالة:\n${fmtCount(supplierSummary, 'status')}`,
    };

    // اكتب فقط الحقول الفارغة (إلا لو overwrite=true)
    const updates = {};
    for (const [key, value] of Object.entries(generated)) {
      const existing = review[key];
      if (overwrite || !existing || existing.trim() === '') {
        updates[key] = value;
      }
    }

    const updated = await prisma.managementReview.update({
      where: { id: req.params.id },
      data: updates,
    });

    res.json({
      ok: true,
      review: updated,
      populated: Object.keys(updates),
      skipped: Object.keys(generated).filter(k => !(k in updates)),
    });
  })
);

/**
 * POST /api/management-review/:id/complete
 * ISO 9.3.3 — اعتماد مخرجات المراجعة الإدارية بشكل ذري
 *
 * يجمع في transaction واحدة:
 *   1. تحديث الحالة إلى COMPLETED
 *   2. إنشاء FollowUpTask لكل عنصر في decisions/improvementActions
 *
 * إذا فشل أيٌّ منهما → تراجع كامل، تبقى المراجعة بحالتها السابقة.
 */
router.post(
  '/:id/complete',
  requireAction('management-review', 'update'),
  asyncHandler(async (req, res) => {
    const current = await prisma.managementReview.findUnique({
      where: { id: req.params.id, deletedAt: null },
      select: { status: true, decisions: true, improvementActions: true, code: true },
    });
    if (!current) throw NotFound('المراجعة غير موجودة');

    // 1. التحقق من الانتقال المسموح
    assertTransition(MGMT_REVIEW_STATUS, current.status, 'COMPLETED', {
      label: 'المراجعة الإدارية', role: req.user?.role,
    });

    // 2. ISO 9.3.1 — حضور الإدارة العليا إلزامي
    const {
      topManagementPresent,
      decisions:          bodyDecisions,
      improvementActions: bodyImprovementActions,
    } = req.body || {};

    if (topManagementPresent !== true && topManagementPresent !== 'true') {
      throw BadRequest('لا يمكن إكمال المراجعة الإدارية دون تأكيد حضور الإدارة العليا (ISO 9.3.1)');
    }

    // 3. التحقق من بنية decisions/improvementActions قبل بدء الـ TX
    const merged = {
      decisions:          bodyDecisions          ?? current.decisions,
      improvementActions: bodyImprovementActions ?? current.improvementActions,
    };
    const decisionItems = parseDecisionsField('decisions',          merged.decisions);
    const actionItems   = parseDecisionsField('improvementActions', merged.improvementActions);
    const allItems = [
      ...decisionItems.map(i => ({ ...i, _from: 'decisions' })),
      ...actionItems.map(i => ({ ...i, _from: 'improvementActions' })),
    ];

    // 4. ISO 9.3.3 — توقيع رقمي من مدير الجودة
    await requireSignatureFor(req, {
      entityType: 'ManagementReview',
      entityId:   req.params.id,
      purpose:    'complete',
      label:      'اعتماد مخرجات المراجعة الإدارية',
    });

    // 5. توليد كودات المهام قبل الـ TX (nextCode يستخدم الـ prisma العام).
    // nextCode يقرأ آخر كود محفوظ؛ لذلك استدعاؤه عدة مرات قبل الحفظ يُرجع نفس الكود.
    // نولّد الكود الأول ثم نزيد اللاحقة رقمياً داخل نفس الدفعة.
    const pregenCodes = [];
    if (allItems.length > 0) {
      const firstCode = await nextCode('followUpTask', 'FUT');
      const m = firstCode.match(/^(.*-)(\d+)$/);
      if (!m) {
        pregenCodes.push(firstCode);
      } else {
        const [, head, raw] = m;
        const start = Number(raw);
        for (let i = 0; i < allItems.length; i++) {
          pregenCodes.push(`${head}${String(start + i).padStart(raw.length, '0')}`);
        }
      }
    }

    // 6. Transaction ذري: تحديث الحالة + إنشاء المهام في عملية واحدة
    const updateData = { status: 'COMPLETED', topManagementPresent: true };
    if (bodyDecisions          !== undefined) updateData.decisions          = bodyDecisions;
    if (bodyImprovementActions !== undefined) updateData.improvementActions = bodyImprovementActions;

    const { item, followUpTasksCreated } = await prisma.$transaction(async (tx) => {
      const review = await tx.managementReview.update({
        where:   { id: req.params.id },
        data:    updateData,
        include: { plan: { select: { id: true, code: true, title: true } } },
      });

      // Idempotency داخل الـ TX — تمنع التكرار لو استُدعي /complete مرتين
      const existingCount = await tx.followUpTask.count({
        where: { source: 'MANAGEMENT_REVIEW', sourceId: req.params.id, deletedAt: null },
      });

      let created = 0;
      if (existingCount === 0 && allItems.length > 0) {
        for (let i = 0; i < allItems.length; i++) {
          const it = allItems[i];
          await tx.followUpTask.create({
            data: {
              code:        pregenCodes[i],
              title:       String(it.title).trim(),
              description: it.description?.trim() ||
                           `[من ${it._from} في مراجعة ${review.code}]`,
              ownerId:     it.ownerId,
              dueDate:     new Date(it.dueDate),
              source:      'MANAGEMENT_REVIEW',
              sourceId:    req.params.id,
              priority:    it.priority || null,
              status:      'OPEN',
              createdById: req.user.sub,
            },
          });
          created++;
        }
      }

      return { item: review, followUpTasksCreated: created };
    });

    if (followUpTasksCreated > 0) {
      console.log(`[mgmt-review] atomic: ${followUpTasksCreated} FollowUpTask(s) created from ${item.code}`);
    }
    res.json({ ok: true, item, followUpTasksCreated });
  }),
);

router.use('/', base);

export default router;
