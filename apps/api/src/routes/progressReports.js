/**
 * routes/progressReports.js — المحقق الشهري
 *
 * Endpoints:
 *   POST   /api/progress-reports/generate           — توليد/استرجاع تقرير لقسم لشهر معيّن
 *   GET    /api/progress-reports                    — قائمة (مُفلترة بالدور)
 *   GET    /api/progress-reports/mine               — تقارير القسم الخاص برئيس القسم
 *   GET    /api/progress-reports/:id                — تفاصيل تقرير واحد
 *   PATCH  /api/progress-reports/:id                — تحديث deptFilled (رئيس القسم)
 *   POST   /api/progress-reports/:id/submit         — إرسال للاعتماد
 *   POST   /api/progress-reports/:id/approve        — اعتماد (QM/SUPER_ADMIN)
 *   POST   /api/progress-reports/:id/return         — إعادة للتعديل
 *   GET    /api/progress-reports/dashboard/compare  — مقارنة الأقسام
 *   GET    /api/progress-reports/dashboard/trends   — الاتجاهات
 *   POST   /api/progress-reports/dashboard/detect-contradictions — كشف التناقضات
 *   GET    /api/progress-reports/flags              — علامات التحقيق
 *   POST   /api/progress-reports/flags/:id/resolve  — حل علامة
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';
import {
  generateReport,
  scoreReport,
  extractPromises,
  compareDepartments,
  detectTrends,
  detectCrossContradictions,
} from '../services/progressReportService.js';

const router = Router();

// أدوار
const QM_ROLES   = ['SUPER_ADMIN', 'QUALITY_MANAGER'];
const DEPT_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER', 'DEPT_MANAGER'];

/**
 * JWT لا يحمل departmentId — نُحمِّله من DB مرة واحدة لكل request ونُخزِّن.
 */
async function resolveUserDept(req) {
  if (req._userDeptResolved) return req.user?.departmentId || null;
  const userId = req.user?.sub || req.user?.id;
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  if (u) req.user.departmentId = u.departmentId;
  req._userDeptResolved = true;
  return u?.departmentId || null;
}

async function canAccessDept(req, departmentId) {
  if (QM_ROLES.includes(req.user.role)) return true;
  if (req.user.role === 'DEPT_MANAGER') {
    const uDept = await resolveUserDept(req);
    return uDept && uDept === departmentId;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────
// GENERATE — يبني/يسترجع تقرير لقسم لشهر
// ─────────────────────────────────────────────────────────────────────
router.post('/generate', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const { departmentId, year, month, forceRegenerate = false } = req.body || {};
  if (!departmentId || !year || !month) throw BadRequest('departmentId, year, month مطلوبة');
  if (!(await canAccessDept(req, departmentId))) throw Forbidden('لا تملك صلاحية لهذا القسم');

  const report = await generateReport({ departmentId, year, month, forceRegenerate });
  res.json({ ok: true, report });
}));

// ─────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────
router.get('/', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const { year, month, status, departmentId } = req.query;
  const where = { deletedAt: null };
  if (year)  where.year  = parseInt(year);
  if (month) where.month = parseInt(month);
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;

  // رئيس قسم يرى قسمه فقط
  if (req.user.role === 'DEPT_MANAGER') {
    const uDept = await resolveUserDept(req);
    if (!uDept) throw Forbidden('لم يُربط حسابك بقسم');
    where.departmentId = uDept;
  }

  const reports = await prisma.progressReport.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 200,
  });

  // ضمّ أسماء الأقسام
  const deptIds = [...new Set(reports.map(r => r.departmentId))];
  const depts   = await prisma.department.findMany({ where: { id: { in: deptIds } } });
  const dMap    = Object.fromEntries(depts.map(d => [d.id, d]));

  res.json({
    ok: true,
    items: reports.map(r => ({
      id: r.id, departmentId: r.departmentId,
      department: dMap[r.departmentId] || null,
      year: r.year, month: r.month, status: r.status, score: r.score,
      submittedAt: r.submittedAt, approvedAt: r.approvedAt,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    })),
  });
}));

// ─────────────────────────────────────────────────────────────────────
// MINE — اختصار لرئيس القسم
// ─────────────────────────────────────────────────────────────────────
router.get('/mine', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const deptId = await resolveUserDept(req);
  if (!deptId && req.user.role === 'DEPT_MANAGER') throw BadRequest('حسابك غير مربوط بقسم');

  const where = deptId ? { departmentId: deptId, deletedAt: null } : { deletedAt: null };
  const reports = await prisma.progressReport.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
  });

  res.json({ ok: true, items: reports.map(r => ({
    id: r.id, year: r.year, month: r.month, status: r.status, score: r.score,
    submittedAt: r.submittedAt, approvedAt: r.approvedAt,
  })) });
}));

// ─────────────────────────────────────────────────────────────────────
// GET by id
// ─────────────────────────────────────────────────────────────────────
router.get('/:id', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const report = await prisma.progressReport.findUnique({
    where: { id: req.params.id },
    include: { flags: { orderBy: { createdAt: 'desc' } } },
  });
  if (!report || report.deletedAt) throw NotFound('التقرير غير موجود');
  if (!(await canAccessDept(req, report.departmentId))) throw Forbidden();

  const dept = await prisma.department.findUnique({ where: { id: report.departmentId } });

  res.json({
    ok: true,
    report: {
      ...report,
      department: dept,
      autoFilled:        safeParse(report.autoFilled),
      deptFilled:        safeParse(report.deptFilled),
      aiQuestions:       safeParse(report.aiQuestions) || [],
      scoreBreakdown:    safeParse(report.scoreBreakdown),
      extractedPromises: safeParse(report.extractedPromises) || [],
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────
// PATCH — تحديث deptFilled (الحفظ التلقائي عند ملء النموذج)
// ─────────────────────────────────────────────────────────────────────
router.patch('/:id', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const report = await prisma.progressReport.findUnique({ where: { id: req.params.id } });
  if (!report || report.deletedAt) throw NotFound();
  if (!(await canAccessDept(req, report.departmentId))) throw Forbidden();
  if (!['DRAFT', 'RETURNED'].includes(report.status)) throw BadRequest('لا يمكن تعديل تقرير بعد الإرسال');

  const { deptFilled } = req.body || {};
  if (deptFilled == null) throw BadRequest('deptFilled مطلوب');

  const updated = await prisma.progressReport.update({
    where: { id: report.id },
    data: { deptFilled: typeof deptFilled === 'string' ? deptFilled : JSON.stringify(deptFilled) },
  });

  res.json({ ok: true, report: { id: updated.id, updatedAt: updated.updatedAt } });
}));

// ─────────────────────────────────────────────────────────────────────
// SUBMIT — رئيس القسم يُرسل التقرير للاعتماد
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/submit', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const report = await prisma.progressReport.findUnique({ where: { id: req.params.id } });
  if (!report || report.deletedAt) throw NotFound();
  if (!(await canAccessDept(req, report.departmentId))) throw Forbidden();
  if (!['DRAFT', 'RETURNED'].includes(report.status)) throw BadRequest('التقرير مُرسل بالفعل');

  // احسب الدرجة + استخرج الوعود
  const score     = scoreReport(report);
  const promises  = extractPromises(report);

  // سجّل KPI entries من kpiValues (upsert)
  const dept = safeParse(report.deptFilled) || {};
  for (const kv of (dept.kpiValues || [])) {
    if (!kv.objectiveId || kv.value == null) continue;
    try {
      await prisma.kpiEntry.upsert({
        where: { objectiveId_year_month: { objectiveId: kv.objectiveId, year: report.year, month: report.month } },
        update: { actualValue: Number(kv.value), note: kv.note || null, enteredById: req.user.sub || req.user.id },
        create: {
          objectiveId: kv.objectiveId, year: report.year, month: report.month,
          actualValue: Number(kv.value), note: kv.note || null,
          enteredById: req.user.sub || req.user.id,
        },
      });
    } catch (e) {
      console.error('KPI upsert failed', e.message);
    }
  }

  const updated = await prisma.progressReport.update({
    where: { id: report.id },
    data: {
      status: 'SUBMITTED',
      submittedAt:     new Date(),
      submittedById:   req.user.sub || req.user.id,
      score:           score.total,
      scoreBreakdown:  JSON.stringify(score.breakdown),
      extractedPromises: JSON.stringify(promises),
    },
  });

  // إشعار مديري الجودة بالتقرير المُرسل
  try {
    const dept = await prisma.department.findUnique({ where: { id: report.departmentId } });
    const qms  = await prisma.user.findMany({
      where: { role: { in: QM_ROLES }, active: true },
      select: { id: true },
    });
    if (qms.length) {
      await prisma.notification.createMany({
        data: qms.map(u => ({
          userId: u.id,
          type: 'PROGRESS_REPORT_SUBMITTED',
          title: `📊 تقرير شهري جديد: ${dept?.name || ''}`,
          message: `شهر ${report.month}/${report.year} — الدرجة: ${score.total}/100 — جاهز للاعتماد.`,
          link: `/qms#/progressReports?id=${report.id}`,
          entityType: 'ProgressReport',
          entityId: report.id,
          eventKey: `PR_SUBMIT:${report.id}:${u.id}`,
        })),
        skipDuplicates: true,
      });
    }
  } catch (e) { console.warn('[progressReports] notify submit failed:', e.message); }

  res.json({ ok: true, report: updated, score });
}));

// ─────────────────────────────────────────────────────────────────────
// APPROVE — مدير الجودة
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/approve', authorize(...QM_ROLES), asyncHandler(async (req, res) => {
  const report = await prisma.progressReport.findUnique({ where: { id: req.params.id } });
  if (!report || report.deletedAt) throw NotFound();
  if (report.status !== 'SUBMITTED') throw BadRequest('التقرير ليس جاهزاً للاعتماد');

  const updated = await prisma.progressReport.update({
    where: { id: report.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user.sub || req.user.id },
  });

  // إشعار رئيس القسم
  try {
    if (report.submittedById) {
      await prisma.notification.create({
        data: {
          userId: report.submittedById,
          type: 'PROGRESS_REPORT_APPROVED',
          title: '✅ تمّ اعتماد تقريرك الشهري',
          message: `شهر ${report.month}/${report.year} — الدرجة المعتمدة: ${report.score ?? 0}/100`,
          link: `/qms#/progressReports?id=${report.id}`,
          entityType: 'ProgressReport',
          entityId: report.id,
          eventKey: `PR_APPROVED:${report.id}`,
        },
      });
    }
  } catch (e) { /* duplicate or missing — non-fatal */ }

  res.json({ ok: true, report: updated });
}));

// ─────────────────────────────────────────────────────────────────────
// RETURN — إعادة للتعديل
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/return', authorize(...QM_ROLES), asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  if (!reason?.trim()) throw BadRequest('سبب الإعادة مطلوب');

  const report = await prisma.progressReport.findUnique({ where: { id: req.params.id } });
  if (!report || report.deletedAt) throw NotFound();
  if (report.status !== 'SUBMITTED') throw BadRequest('لا يمكن إرجاع تقرير غير مُرسَل');

  const updated = await prisma.progressReport.update({
    where: { id: report.id },
    data: { status: 'RETURNED', returnedAt: new Date(), returnedReason: reason.trim() },
  });

  // إشعار رئيس القسم بالإعادة
  try {
    if (report.submittedById) {
      await prisma.notification.create({
        data: {
          userId: report.submittedById,
          type: 'PROGRESS_REPORT_RETURNED',
          title: '↩️ أُعيد تقريرك الشهري للتعديل',
          message: `شهر ${report.month}/${report.year} — السبب: ${reason.trim().slice(0, 200)}`,
          link: `/qms#/progressReports?id=${report.id}`,
          entityType: 'ProgressReport',
          entityId: report.id,
          eventKey: `PR_RETURNED:${report.id}:${Date.now()}`,
        },
      });
    }
  } catch (e) { /* non-fatal */ }

  res.json({ ok: true, report: updated });
}));

// ─────────────────────────────────────────────────────────────────────
// DASHBOARD — مقارنة الأقسام
// ─────────────────────────────────────────────────────────────────────
router.get('/dashboard/compare', authorize(...QM_ROLES), asyncHandler(async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const rows  = await compareDepartments({ year, month });
  res.json({ ok: true, year, month, rows });
}));

// DASHBOARD — اتجاهات
router.get('/dashboard/trends', authorize(...QM_ROLES), asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const trends = await detectTrends({ months });
  res.json({ ok: true, trends });
}));

// DASHBOARD — اكتشاف التناقضات (ينشئ flags)
router.post('/dashboard/detect-contradictions', authorize(...QM_ROLES), asyncHandler(async (req, res) => {
  const year  = parseInt(req.body?.year)  || new Date().getFullYear();
  const month = parseInt(req.body?.month) || (new Date().getMonth() + 1);

  const contradictions = await detectCrossContradictions({ year, month });

  // خزّنها كـ flags
  const created = [];
  for (const c of contradictions) {
    const flag = await prisma.investigationFlag.create({
      data: {
        type: 'CONTRADICTION',
        severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(c.severity) ? c.severity : 'MEDIUM',
        status: 'OPEN',
        title: c.title || 'تناقض بين الأقسام',
        description: c.description || '',
        evidence: JSON.stringify(c.evidence || c.departments || {}),
        aiGenerated: true,
      },
    });
    created.push(flag);
  }

  res.json({ ok: true, found: created.length, flags: created });
}));

// ─────────────────────────────────────────────────────────────────────
// FLAGS
// ─────────────────────────────────────────────────────────────────────
router.get('/flags', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const { status = 'OPEN', type, departmentId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (type)   where.type   = type;
  if (departmentId) where.departmentId = departmentId;

  if (req.user.role === 'DEPT_MANAGER') {
    const uDept = await resolveUserDept(req);
    if (!uDept) throw Forbidden('لم يُربط حسابك بقسم');
    where.departmentId = uDept;
  }

  const flags = await prisma.investigationFlag.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
  });

  res.json({ ok: true, items: flags });
}));

router.post('/flags/:id/resolve', authorize(...DEPT_ROLES), asyncHandler(async (req, res) => {
  const { note } = req.body || {};
  const flag = await prisma.investigationFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) throw NotFound();

  const updated = await prisma.investigationFlag.update({
    where: { id: flag.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: req.user.sub || req.user.id,
      resolutionNote: note || null,
    },
  });
  res.json({ ok: true, flag: updated });
}));

// ─────────────────────────────────────────────────────────────────────
function safeParse(s) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }

export default router;
