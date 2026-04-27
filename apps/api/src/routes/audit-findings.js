/**
 * routes/audit-findings.js — Audit task 9 (architectural)
 * ISO 9001:2015 §9.2 — ملاحظات التدقيق الداخلي
 *
 * يوفّر:
 *   CRUD كامل عبر crudRouter (مع smart filters ومسار scoped)
 *   POST /:id/escalate — تصعيد المشكلة إلى NCR رسمي
 *   POST /:id/close    — إغلاق الملاحظة مع ملاحظة التحقق
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { AUDIT_FINDING_STATUS, assertTransition } from '../lib/stateMachines.js';
import { nextCode } from '../utils/codeGen.js';
import { createSchema, updateSchema } from '../schemas/auditFinding.schema.js';

// ── Smart filters ────────────────────────────────────────────────
const smartFilters = {
  // my: الملاحظات التي أنا مسؤول عنها
  mine: (req, where) => ({ ...where, ownerId: req.user?.sub }),
  // open: لا تزال مفتوحة (OPEN | IN_REVIEW)
  open: (_req, where) => ({ ...where, status: { in: ['OPEN', 'IN_REVIEW'] } }),
  // overdue: فات موعدها ولم تُغلق
  overdue: (_req, where) => ({
    ...where,
    status: { in: ['OPEN', 'IN_REVIEW', 'RESOLVED'] },
    dueDate: { lt: new Date() },
  }),
  // closed: مُغلقة أو مُصعَّدة
  closed: (_req, where) => ({ ...where, status: { in: ['CLOSED', 'ESCALATED'] } }),
  // critical: MAJOR_NC فقط
  critical: (_req, where) => ({ ...where, type: 'MAJOR_NC' }),
};

/**
 * scopeFilter — يُضيَّق نطاق القراءة حسب الدور (ISO §5.3 الفصل بين المهام).
 *
 * | الدور             | ما يراه                                                  |
 * |-------------------|----------------------------------------------------------|
 * | SUPER_ADMIN       | الكل                                                     |
 * | QUALITY_MANAGER   | الكل                                                     |
 * | COMMITTEE_MEMBER  | الكل (مراجعة شاملة عبر الأقسام — ISO §5.1.2 / §9.3)     |
 * | DEPT_MANAGER      | قسمه + ما يملكه أو أنشأه                                |
 * | EMPLOYEE          | ما يملكه أو أنشأه فقط                                    |
 * | GUEST_AUDITOR     | ما يملكه أو أنشأه فقط (قراءة فقط كما في permissions)     |
 */
const scopeFilter = (req) => {
  const { role, departmentId, sub } = req.user || {};
  if (!role) return { id: '__deny__' }; // لا ينبغي أن يصل هنا بدون دور

  // QM وما فوق + COMMITTEE_MEMBER: وصول كامل
  if (['SUPER_ADMIN', 'QUALITY_MANAGER', 'COMMITTEE_MEMBER'].includes(role)) return {};

  // DEPT_MANAGER: قسمه + ما يملكه أو أنشأه
  if (role === 'DEPT_MANAGER') {
    const conditions = [
      { ownerId:      sub },
      { createdById:  sub },
    ];
    if (departmentId) conditions.push({ departmentId });
    return { OR: conditions };
  }

  // EMPLOYEE و GUEST_AUDITOR: ما يملكه أو أنشأه فقط
  return { OR: [{ ownerId: sub }, { createdById: sub }] };
};

const base = crudRouter({
  resource:         'audit-findings',
  model:            'auditFinding',
  codePrefix:       'AF',
  searchFields:     ['title', 'description', 'clauseRef'],
  allowedSortFields:['createdAt', 'dueDate', 'status', 'type'],
  allowedFilters:   ['auditId', 'type', 'status', 'departmentId', 'processId', 'ownerId'],
  include: {
    audit:      { select: { id: true, code: true, title: true, status: true } },
    owner:      { select: { id: true, name: true, jobTitle: true } },
    department: { select: { id: true, name: true } },
    process:    { select: { id: true, name: true, code: true } },
    ncr:        { select: { id: true, code: true, status: true, title: true } },
    createdBy:  { select: { id: true, name: true } },
  },
  schemas: { create: createSchema, update: updateSchema },
  smartFilters,
  scopeFilter,

  beforeCreate: async (data, req) => {
    // التأكد من وجود الـ Audit
    const audit = await prisma.audit.findUnique({
      where: { id: data.auditId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!audit) throw NotFound('التدقيق غير موجود');
    // لا يمكن إضافة ملاحظات لتدقيق ملغى
    if (audit.status === 'CANCELLED') {
      throw BadRequest('لا يمكن إضافة ملاحظات لتدقيق ملغى');
    }
    data.createdById = req.user.sub;
    return data;
  },

  beforeUpdate: async (data, req) => {
    if (data.status) {
      // منع تغيير الحالة مباشرةً لـ ESCALATED أو CLOSED — استخدم /escalate أو /close
      if (data.status === 'ESCALATED') {
        throw BadRequest('لتصعيد الملاحظة إلى NCR استخدم: POST /api/audit-findings/:id/escalate');
      }
      if (data.status === 'CLOSED') {
        throw BadRequest('لإغلاق الملاحظة استخدم: POST /api/audit-findings/:id/close');
      }
      const current = await prisma.auditFinding.findUnique({
        where: { id: req.params.id, deletedAt: null },
        select: { status: true },
      });
      if (!current) throw NotFound('الملاحظة غير موجودة');
      assertTransition(AUDIT_FINDING_STATUS, current.status, data.status, {
        label: 'ملاحظة التدقيق', role: req.user?.role,
      });
    }
    return data;
  },
});

const router = Router();

// ── POST /:id/escalate ──────────────────────────────────────────
/**
 * تصعيد ملاحظة MINOR_NC أو MAJOR_NC إلى NCR رسمي.
 * ينشئ NCR مربوطاً بالملاحظة ويضع الحالة ESCALATED.
 * idempotent: إذا كانت مرتبطة بـ ncrId لا يكرر الإنشاء.
 */
router.post(
  '/:id/escalate',
  requireAction('audit-findings', 'update'),
  asyncHandler(async (req, res) => {
    const finding = await prisma.auditFinding.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { audit: { select: { id: true, code: true, departmentId: true } } },
    });
    if (!finding) throw NotFound('الملاحظة غير موجودة');

    // فقط MINOR_NC و MAJOR_NC يمكن تصعيدها
    if (!['MINOR_NC', 'MAJOR_NC'].includes(finding.type)) {
      throw BadRequest(
        `نوع الملاحظة "${finding.type}" لا يُصعَّد — فقط MINOR_NC و MAJOR_NC قابلة للتصعيد`,
      );
    }

    // التحقق من الانتقال
    assertTransition(AUDIT_FINDING_STATUS, finding.status, 'ESCALATED', {
      label: 'ملاحظة التدقيق', role: req.user?.role,
    });

    // Idempotency: إذا كانت مرتبطة بـ NCR بالفعل
    if (finding.ncrId) {
      const existing = await prisma.auditFinding.update({
        where: { id: req.params.id },
        data: { status: 'ESCALATED' },
        include: { ncr: { select: { id: true, code: true } } },
      });
      return res.json({ ok: true, item: existing, ncrCreated: false });
    }

    // توليد كود NCR ثم transaction ذري
    const ncrCode = await nextCode('nCR', 'NCR');
    const { item } = await prisma.$transaction(async (tx) => {
      // إنشاء NCR من الملاحظة
      const ncr = await tx.nCR.create({
        data: {
          code:        ncrCode,
          title:       finding.title,
          description: finding.description,
          departmentId: finding.departmentId ?? finding.audit.departmentId ?? null,
          reporterId:  req.user.sub,
          severity:    finding.type === 'MAJOR_NC' ? 'مرتفعة' : 'متوسطة',
          status:      'OPEN',
        },
      });

      // ربط الـ NCR بالـ Audit أيضاً عبر AuditNCR junction — upsert يتجنب P2002
      await tx.auditNCR.upsert({
        where:  { auditId_ncrId: { auditId: finding.auditId, ncrId: ncr.id } },
        create: { auditId: finding.auditId, ncrId: ncr.id },
        update: {},  // لا شيء يُحدَّث عند التكرار (no-op)
      });

      // تحديث الملاحظة
      const updated = await tx.auditFinding.update({
        where: { id: req.params.id },
        data:  { status: 'ESCALATED', ncrId: ncr.id },
        include: {
          audit:  { select: { id: true, code: true } },
          ncr:    { select: { id: true, code: true, status: true } },
          owner:  { select: { id: true, name: true } },
        },
      });

      return { item: updated, ncr };
    });

    console.log(`[audit-finding] escalated ${finding.code} → NCR ${ncrCode}`);
    res.json({ ok: true, item, ncrCreated: true });
  }),
);

// ── POST /:id/close ──────────────────────────────────────────────
/**
 * إغلاق ملاحظة التدقيق مع ملاحظة التحقق.
 * يشترط closureNote لـ MINOR_NC و MAJOR_NC.
 */
router.post(
  '/:id/close',
  requireAction('audit-findings', 'update'),
  asyncHandler(async (req, res) => {
    const finding = await prisma.auditFinding.findUnique({
      where: { id: req.params.id, deletedAt: null },
      select: { status: true, type: true, code: true },
    });
    if (!finding) throw NotFound('الملاحظة غير موجودة');

    assertTransition(AUDIT_FINDING_STATUS, finding.status, 'CLOSED', {
      label: 'ملاحظة التدقيق', role: req.user?.role,
    });

    const { closureNote } = req.body || {};

    // MINOR_NC و MAJOR_NC تتطلب ملاحظة إغلاق
    if (['MINOR_NC', 'MAJOR_NC'].includes(finding.type)) {
      if (!closureNote || String(closureNote).trim() === '') {
        throw BadRequest(
          `${finding.type === 'MAJOR_NC' ? 'عدم المطابقة الرئيسية' : 'عدم المطابقة الطفيفة'}: ` +
          'يجب توفير ملاحظة الإغلاق (closureNote) التي تؤكد أن التصحيح تحقق',
        );
      }
    }

    const item = await prisma.auditFinding.update({
      where: { id: req.params.id },
      data: {
        status:      'CLOSED',
        closureNote: closureNote?.trim() || null,
        closedAt:    new Date(),
      },
      include: {
        audit:  { select: { id: true, code: true } },
        owner:  { select: { id: true, name: true } },
        ncr:    { select: { id: true, code: true, status: true } },
      },
    });

    res.json({ ok: true, item });
  }),
);

router.use('/', base);

export default router;
