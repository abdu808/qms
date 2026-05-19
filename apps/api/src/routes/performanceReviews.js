/**
 * performanceReviews.js — تقييم الأداء السنوي (ISO 9001 §7.2)
 * P-05 §5 — يُنشئه المدير، يوقّعه الموظف، ثم يُختم كنهائي.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction, can } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';

const DIMENSIONS = [
  'jobKnowledge', 'qualityOfWork', 'productivity',
  'teamwork', 'communication', 'initiative', 'reliability',
];

const REVIEWER_ROLES = new Set(['DEPT_MANAGER', 'COMMITTEE_MEMBER', 'QUALITY_MANAGER', 'SUPER_ADMIN']);
const SENIOR_REVIEWER_ROLES = new Set(['COMMITTEE_MEMBER', 'QUALITY_MANAGER', 'SUPER_ADMIN']);
const QUALITY_REVIEWER_ROLES = new Set(['QUALITY_MANAGER', 'SUPER_ADMIN']);

function computeOverall(data) {
  const vals = DIMENSIONS.map(k => Number(data[k])).filter(v => Number.isFinite(v) && v >= 1 && v <= 5);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a,b) => a+b, 0) / vals.length) * 100) / 100;
}

function gradeFor(score) {
  if (score == null) return null;
  if (score >= 4.5) return 'ممتاز';
  if (score >= 4)   return 'جيد جداً';
  if (score >= 3)   return 'جيد';
  if (score >= 2)   return 'مقبول';
  return 'ضعيف';
}

function isPrivilegedReviewer(user) {
  return can(user, 'performance-reviews', 'delete');
}

async function loadReviewForUpdate(req) {
  const item = await prisma.performanceReview.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: {
      id: true,
      employeeId: true,
      reviewerId: true,
      status: true,
      ...Object.fromEntries(DIMENSIONS.map(k => [k, true])),
    },
  });
  if (!item) throw NotFound('Review not found');
  if (item.status === 'FINALIZED') throw BadRequest('Finalized reviews cannot be edited');
  if (!isPrivilegedReviewer(req.user) && item.reviewerId !== req.user.sub) {
    throw Forbidden('Only the reviewer or quality manager can edit this review');
  }
  return item;
}

function assertSeparationOfDuty(employeeId, reviewerId) {
  if (employeeId && reviewerId && employeeId === reviewerId) {
    throw BadRequest('Employee cannot review themselves');
  }
}

async function loadReviewUsers(employeeId, reviewerId) {
  const users = await prisma.user.findMany({
    where: { id: { in: [employeeId, reviewerId].filter(Boolean) } },
    select: { id: true, name: true, role: true, departmentId: true, active: true },
  });
  const byId = new Map(users.map(u => [u.id, u]));
  const employee = byId.get(employeeId);
  const reviewer = byId.get(reviewerId);
  if (!employee) throw BadRequest('الموظف المُقيَّم غير موجود');
  if (!reviewer) throw BadRequest('المُقيِّم غير موجود');
  if (!employee.active) throw BadRequest('لا يمكن إنشاء تقييم لموظف غير نشط');
  if (!reviewer.active) throw BadRequest('لا يمكن إسناد التقييم لمُقيِّم غير نشط');
  return { employee, reviewer };
}

function assertReviewerEligibility(employee, reviewer) {
  assertSeparationOfDuty(employee.id, reviewer.id);

  if (!REVIEWER_ROLES.has(reviewer.role)) {
    throw BadRequest('المُقيِّم يجب أن يكون رئيس قسم أو أعلى');
  }

  if (employee.role === 'EMPLOYEE') {
    if (reviewer.role === 'DEPT_MANAGER' && employee.departmentId !== reviewer.departmentId) {
      throw BadRequest('رئيس القسم لا يقيّم إلا موظفي قسمه');
    }
    return;
  }

  if (employee.role === 'DEPT_MANAGER') {
    if (!SENIOR_REVIEWER_ROLES.has(reviewer.role)) {
      throw BadRequest('تقييم رئيس القسم يحتاج مُقيِّماً أعلى من رئيس القسم');
    }
    return;
  }

  if (employee.role === 'COMMITTEE_MEMBER') {
    if (!QUALITY_REVIEWER_ROLES.has(reviewer.role)) {
      throw BadRequest('تقييم عضو اللجنة يحتاج مدير الجودة أو مسؤول النظام');
    }
    return;
  }

  if (employee.role === 'QUALITY_MANAGER') {
    if (reviewer.role !== 'SUPER_ADMIN') {
      throw BadRequest('تقييم مدير الجودة يحتاج مسؤول النظام');
    }
    return;
  }

  if (employee.role === 'SUPER_ADMIN') {
    throw BadRequest('لا يُنشأ تقييم أداء لمسؤول النظام من هذه الصفحة');
  }
}

async function assertReviewHierarchy(data, req, existing = {}) {
  const employeeId = data.employeeId ?? existing.employeeId;
  let reviewerId = data.reviewerId ?? existing.reviewerId ?? req.user.sub;

  if (!employeeId) throw BadRequest('يجب اختيار الموظف المُقيَّم');
  if (!reviewerId) reviewerId = req.user.sub;

  if (!isPrivilegedReviewer(req.user)) {
    if (data.reviewerId && data.reviewerId !== req.user.sub) {
      throw Forbidden('لا يمكن إسناد التقييم إلى مُقيِّم آخر');
    }
    if (reviewerId !== req.user.sub) {
      throw Forbidden('لا يمكنك تعديل تقييم لست مُقيِّمه');
    }
  }

  const { employee, reviewer } = await loadReviewUsers(employeeId, reviewerId);
  assertReviewerEligibility(employee, reviewer);

  if (req.user.role === 'DEPT_MANAGER' && employee.departmentId !== req.user.departmentId) {
    throw Forbidden('رئيس القسم يقيّم موظفي قسمه فقط');
  }

  return reviewerId;
}

function normalize(data, { partial = false } = {}) {
  for (const k of DIMENSIONS) {
    if (partial && !(k in data)) continue;
    if (data[k] === '' || data[k] === null || data[k] === undefined) {
      data[k] = null;
    } else {
      const n = Number(data[k]);
      if (!Number.isFinite(n) || n < 1 || n > 5) throw BadRequest(`قيمة "${k}" يجب أن تكون بين 1 و 5`);
      data[k] = n;
    }
  }
  const auto = partial ? null : computeOverall(data);
  if (auto != null) {
    data.overallRating = auto;
    data.grade = gradeFor(auto);
  }
  return data;
}

const base = crudRouter({
  resource: 'performance-reviews',
  model: 'performanceReview',
  codePrefix: 'PRV',
  searchFields: ['code', 'period', 'strengths', 'areasToImprove'],
  allowedSortFields: ['createdAt', 'periodEnd', 'status', 'overallRating'],
  allowedFilters: ['status', 'employeeId', 'reviewerId', 'period'],
  beforeCreate: async (data, req) => {
    if (!isPrivilegedReviewer(req.user)) data.reviewerId = req.user.sub;
    if (!data.reviewerId) data.reviewerId = req.user.sub;
    data.reviewerId = await assertReviewHierarchy(data, req);
    data = normalize(data);
    return data;
  },
  beforeUpdate: async (data, req) => {
    const existing = await loadReviewForUpdate(req);
    const reviewerId = await assertReviewHierarchy(data, req, existing);
    if (data.reviewerId !== undefined) data.reviewerId = reviewerId;
    data = normalize(data, { partial: true });
    if (DIMENSIONS.some(k => k in data)) {
      const merged = { ...existing, ...data };
      const auto = computeOverall(merged);
      data.overallRating = auto;
      data.grade = gradeFor(auto);
    }
    return data;
  },
});

const router = Router();

/**
 * POST /api/performance-reviews/:id/submit-to-employee
 * المُقيِّم يُنهي التقييم ويرسله للموظف ليوقّع.
 */
router.post('/:id/submit-to-employee',
  requireAction('performance-reviews', 'update'),
  asyncHandler(async (req, res) => {
    const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!item) throw NotFound('التقييم غير موجود');
    if (item.status !== 'DRAFT') throw BadRequest('يمكن إرسال المسودات فقط');
    if (item.reviewerId !== req.user.sub && !can(req.user, 'performance-reviews', 'delete')) {
      throw Forbidden('فقط المُقيِّم أو QM يمكنه إرسال التقييم');
    }
    const updated = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data: { status: 'EMPLOYEE_REVIEW' },
    });
    await prisma.notification.upsert({
      where: { eventKey: `PERFORMANCE_REVIEW_SIGNATURE:${item.id}` },
      update: {
        title: 'تقييم أداء بانتظار تعليقك وتوقيعك',
        message: `لديك تقييم أداء للفترة ${item.period}. راجعه من مهامي اليوم ثم أضف تعليقك ووقّع.`,
        link: '/#/myWork',
        readAt: null,
      },
      create: {
        userId: item.employeeId,
        type: 'PERFORMANCE_REVIEW_SIGNATURE',
        title: 'تقييم أداء بانتظار تعليقك وتوقيعك',
        message: `لديك تقييم أداء للفترة ${item.period}. راجعه من مهامي اليوم ثم أضف تعليقك ووقّع.`,
        link: '/#/myWork',
        entityType: 'PerformanceReview',
        entityId: item.id,
        eventKey: `PERFORMANCE_REVIEW_SIGNATURE:${item.id}`,
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * POST /api/performance-reviews/:id/sign
 * الموظف يوقّع التقييم (يقرّ بالاطّلاع).
 * يستطيع إضافة تعليقه في employeeComments.
 */
router.post('/:id/sign', asyncHandler(async (req, res) => {
  const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('التقييم غير موجود');
  if (item.employeeId !== req.user.sub) throw Forbidden('لا يمكنك توقيع تقييم موظف آخر');
  if (item.status !== 'EMPLOYEE_REVIEW') throw BadRequest('التقييم ليس في مرحلة التوقيع');

  const updated = await prisma.performanceReview.update({
    where: { id: req.params.id },
    data: {
      employeeComments: req.body?.employeeComments || item.employeeComments,
      employeeSignedAt: new Date(),
    },
  });
  await prisma.notification.updateMany({
    where: {
      eventKey: `PERFORMANCE_REVIEW_SIGNATURE:${item.id}`,
      userId: req.user.sub,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  res.json({ ok: true, item: updated });
}));

/**
 * POST /api/performance-reviews/:id/finalize
 * QM+ يختم التقييم كنهائي بعد توقيع الموظف.
 */
router.post('/:id/finalize',
  requireAction('performance-reviews', 'delete'), // QM+
  asyncHandler(async (req, res) => {
    const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!item) throw NotFound('التقييم غير موجود');
    if (!item.employeeSignedAt) throw BadRequest('لا يمكن ختم التقييم قبل توقيع الموظف');
    const updated = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data: { status: 'FINALIZED', finalizedAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * GET /api/performance-reviews/matrix?period=2026
 * مصفوفة تقييم: كل الموظفين × المتوسط الإجمالي في الفترة.
 */
router.get('/matrix', requireAction('performance-reviews', 'read'), asyncHandler(async (req, res) => {
  const period = req.query.period || String(new Date().getFullYear());
  const [users, reviews] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, jobTitle: true, departmentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.performanceReview.findMany({
      where: activeWhere({ period }),
      select: { employeeId: true, overallRating: true, grade: true, status: true, code: true },
    }),
  ]);
  const byUser = new Map(reviews.map(r => [r.employeeId, r]));
  const rows = users.map(u => ({
    ...u,
    review: byUser.get(u.id) || null,
  }));
  res.json({
    ok: true, period,
    total: users.length,
    reviewed: reviews.length,
    coverage: users.length ? Math.round((reviews.length / users.length) * 100) : 0,
    rows,
  });
}));

router.use('/', base);

export default router;
