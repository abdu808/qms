/**
 * routes/kpiFollowUp.js — نظام متابعة الإدخالات المتأخرة
 *
 * Endpoints:
 *   GET    /                       — قائمة المتابعات (مع فلاتر)
 *   GET    /stats/summary          — ملخص إحصائي للوحة
 *   GET    /stats/trends           — اتجاهات شهرية (12 شهر)
 *   GET    /stats/heatmap          — heatmap للأقسام × الأشهر
 *   GET    /export/csv             — تصدير CSV كامل
 *   POST   /run-detection          — تشغيل الفحص يدوياً (QM only)
 *   GET    /:id                    — تفاصيل متابعة محددة
 *   GET    /:id/timeline           — سجل الإجراءات/الأحداث
 *   POST   /                       — إنشاء متابعة يدوياً
 *   PATCH  /:id                    — تحديث ملاحظات/حالة
 *   POST   /:id/escalate           — تصعيد مع ملاحظات
 *   POST   /:id/resolve            — حل + ربط بإدخال
 *   POST   /:id/abort              — إغلاق نهائياً (مع سبب)
 *   DELETE /:id                    — حذف ناعم
 */
import express from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { runDailyKpiFollowUpCheck, detectAndUpdateOverdueKpis } from '../services/kpiFollowUpDetector.js';

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────────────────

const requireQMAccess = (req, res, next) => {
  const allowed = ['SUPER_ADMIN', 'QUALITY_MANAGER'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'صلاحية إدارة الجودة مطلوبة' });
  }
  next();
};

// المدراء يستطيعون رؤية متابعات قسمهم فقط
const requireFollowUpReadAccess = (req, res, next) => {
  const allowed = ['SUPER_ADMIN', 'QUALITY_MANAGER', 'DEPT_MANAGER', 'COMMITTEE_MEMBER'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'صلاحية القراءة غير متوفرة' });
  }
  next();
};

// ──────────────────────────────────────────────────────────────
// HELPER: scope filtering by role
// ──────────────────────────────────────────────────────────────

function buildScopeFilter(user, where = {}) {
  if (['SUPER_ADMIN', 'QUALITY_MANAGER', 'COMMITTEE_MEMBER'].includes(user.role)) {
    return where;
  }
  if (user.role === 'DEPT_MANAGER' && user.departmentId) {
    return { ...where, departmentId: user.departmentId };
  }
  // EMPLOYEE / GUEST_AUDITOR fallback (not allowed but defensive)
  return { ...where, dataEntryUserId: user.sub };
}

// ──────────────────────────────────────────────────────────────
// LIST — GET / (with rich filters)
// ──────────────────────────────────────────────────────────────

router.get('/', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const {
      year, month, status, departmentId, indicatorId, escalationLevel,
      search, page = '1', limit = '100', sortBy = 'dueDate', sortOrder = 'asc',
    } = req.query;

    let where = {};
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (indicatorId) where.indicatorId = indicatorId;
    if (escalationLevel !== undefined && escalationLevel !== '') {
      where.escalationLevel = parseInt(escalationLevel);
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { indicator: { nameAr: { contains: search, mode: 'insensitive' } } },
        { indicator: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    where = buildScopeFilter(req.user, where);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const skip = (pageNum - 1) * limitNum;

    const validSortFields = ['dueDate', 'daysLate', 'createdAt', 'status', 'escalationLevel'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'dueDate';
    const orderDir = sortOrder === 'desc' ? 'desc' : 'asc';

    const [followUps, total] = await Promise.all([
      prisma.kpiFollowUp.findMany({
        where,
        include: {
          indicator: { select: { id: true, code: true, nameAr: true, nameEn: true, unit: true } },
          department: { select: { id: true, code: true, name: true } },
          dataEntryUser: { select: { id: true, name: true, email: true } },
          performanceOwner: { select: { id: true, name: true, email: true } },
          escalatedBy: { select: { id: true, name: true } },
          previousEntry: { select: { id: true, year: true, month: true, actualValue: true } },
          resolvedEntry: { select: { id: true, year: true, month: true, actualValue: true, submittedAt: true } },
        },
        orderBy: { [orderField]: orderDir },
        skip,
        take: limitNum,
      }),
      prisma.kpiFollowUp.count({ where }),
    ]);

    res.json({
      data: followUps,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('GET /kpi-followups error:', error);
    res.status(500).json({ error: 'فشل تحميل سجل المتابعة', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// STATS — GET /stats/summary
// ──────────────────────────────────────────────────────────────

router.get('/stats/summary', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const now = new Date();
    const { year, month, departmentId, indicatorId, escalationLevel, search } = req.query;

    // الفلاتر المُطبَّقة على القائمة هي نفسها التي تُطبَّق على الإحصائيات
    // (status لا يُطبَّق هنا - الإحصائيات تعرض توزيع الحالات)
    const filterWhere = {};
    if (year) filterWhere.year = parseInt(year);
    if (month) filterWhere.month = parseInt(month);
    if (departmentId) filterWhere.departmentId = departmentId;
    if (indicatorId) filterWhere.indicatorId = indicatorId;
    if (escalationLevel !== undefined && escalationLevel !== '') {
      filterWhere.escalationLevel = parseInt(escalationLevel);
    }
    if (search) {
      filterWhere.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { indicator: { nameAr: { contains: search, mode: 'insensitive' } } },
        { indicator: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const baseWhere = buildScopeFilter(req.user, filterWhere);

    // ─── الاستعلامات الأساسية ───────────────────────────────────
    const [totalOverdue, byStatus] = await Promise.all([
      prisma.kpiFollowUp.count({
        where: { ...baseWhere, status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } },
      }),
      prisma.kpiFollowUp.groupBy({
        by: ['status'], where: baseWhere, _count: { _all: true },
      }),
    ]);

    // ─── الاستعلامات الإضافية ───────────────────────────────────
    let byEscalationLevel = [];
    let byDepartment = [];
    let totalAllTime = 0;
    let criticalCount = 0;

    try {
      byEscalationLevel = await prisma.kpiFollowUp.groupBy({
        by: ['escalationLevel'],
        where: { ...baseWhere, status: 'ESCALATED' },
        _count: { _all: true },
      });
    } catch (e) { console.warn('byEscalationLevel failed:', e.message); }

    try {
      byDepartment = await prisma.kpiFollowUp.groupBy({
        by: ['departmentId'],
        where: { ...baseWhere, status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] } },
        _count: { _all: true },
      });
    } catch (e) { console.warn('byDepartment failed:', e.message); }

    try {
      // totalAllTime يحترم scope ولكن يتجاهل filters الزمنية والظاهرية
      // (لإعطاء صورة شاملة عن النطاق المسموح للمستخدم)
      totalAllTime = await prisma.kpiFollowUp.count({ where: buildScopeFilter(req.user, {}) });
    } catch (e) { console.warn('totalAllTime failed:', e.message); }

    try {
      // criticalCount: متابعات حرجة ضمن الفلاتر (15+ يوم أو L2)
      criticalCount = await prisma.kpiFollowUp.count({
        where: {
          ...baseWhere,
          status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] },
          OR: [{ daysLate: { gte: 15 } }, { escalationLevel: 2 }],
        },
      });
    } catch (e) { console.warn('criticalCount failed:', e.message); }

    // ─── إثراء departments (آمن) ─────────────────────────────────
    let deptsMap = {};
    try {
      const deptIds = byDepartment.map(d => d.departmentId).filter(Boolean);
      if (deptIds.length > 0) {
        const depts = await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true, code: true },
        });
        deptsMap = Object.fromEntries(depts.map(d => [d.id, d]));
      }
    } catch (e) { console.warn('dept enrichment failed:', e.message); }

    // ─── تطبيع _count ─────────────────────────────────────────────
    const normalizeCount = (arr) => arr.map(item => ({
      ...item,
      _count: typeof item._count === 'number' ? item._count : (item._count?._all ?? 0),
    }));

    res.json({
      // النطاق الزمني المطبَّق (للعرض فقط — قد يكون null إن لم يُحدَّد فلتر)
      period: {
        year: year ? parseInt(year) : null,
        month: month ? parseInt(month) : null,
      },
      // الفلاتر المُطبَّقة (للتوضيح)
      appliedFilters: { year, month, departmentId, indicatorId, escalationLevel, search },
      totalOverdue,
      totalAllTime,
      criticalCount,
      byStatus: normalizeCount(byStatus),
      byEscalationLevel: normalizeCount(byEscalationLevel),
      byDepartment: normalizeCount(byDepartment).map(d => ({
        ...d,
        department: deptsMap[d.departmentId] || null,
      })),
    });
  } catch (error) {
    console.error('GET /stats/summary error:', error);
    res.status(500).json({ error: 'فشل تحميل الإحصائيات', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// STATS — GET /stats/trends (12-month trend)
// ──────────────────────────────────────────────────────────────

router.get('/stats/trends', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const now = new Date();
    const { departmentId, indicatorId, escalationLevel } = req.query;

    // الفلاتر الظاهرية تنطبق هنا؛ السنة/الشهر لا (نعرض 12 شهر)
    const filterWhere = {};
    if (departmentId) filterWhere.departmentId = departmentId;
    if (indicatorId) filterWhere.indicatorId = indicatorId;
    if (escalationLevel !== undefined && escalationLevel !== '') {
      filterWhere.escalationLevel = parseInt(escalationLevel);
    }
    const where = buildScopeFilter(req.user, filterWhere);

    const trends = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      const [total, resolved, escalated, aborted] = await Promise.all([
        prisma.kpiFollowUp.count({ where: { ...where, year, month } }),
        prisma.kpiFollowUp.count({ where: { ...where, year, month, status: 'RESOLVED' } }),
        prisma.kpiFollowUp.count({ where: { ...where, year, month, status: 'ESCALATED' } }),
        prisma.kpiFollowUp.count({ where: { ...where, year, month, status: 'ABORTED' } }),
      ]);

      trends.push({
        year, month,
        label: `${year}-${String(month).padStart(2, '0')}`,
        total, resolved, escalated, aborted,
        pending: total - resolved - escalated - aborted,
      });
    }
    res.json({ trends });
  } catch (error) {
    console.error('GET /stats/trends error:', error);
    res.status(500).json({ error: 'فشل تحميل الاتجاهات' });
  }
});

// ──────────────────────────────────────────────────────────────
// STATS — GET /stats/heatmap (departments × months)
// ──────────────────────────────────────────────────────────────

router.get('/stats/heatmap', authenticate, requireQMAccess, async (req, res) => {
  try {
    const now = new Date();
    const targetYear = parseInt(req.query.year) || now.getFullYear();

    const data = await prisma.kpiFollowUp.groupBy({
      by: ['departmentId', 'month'],
      where: { year: targetYear },
      _count: true,
    });

    const depts = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      year: targetYear,
      departments: depts,
      data,
    });
  } catch (error) {
    console.error('GET /stats/heatmap error:', error);
    res.status(500).json({ error: 'فشل تحميل الخريطة الحرارية' });
  }
});

// ──────────────────────────────────────────────────────────────
// EXPORT CSV — GET /export/csv
// ──────────────────────────────────────────────────────────────

router.get('/export/csv', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const { year, month, status, departmentId } = req.query;
    let where = {};
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    where = buildScopeFilter(req.user, where);

    const followUps = await prisma.kpiFollowUp.findMany({
      where,
      include: {
        indicator: { select: { code: true, nameAr: true, unit: true } },
        department: { select: { name: true } },
        dataEntryUser: { select: { name: true, email: true } },
        performanceOwner: { select: { name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { dueDate: 'asc' }],
    });

    const headers = [
      'الرمز', 'السنة', 'الشهر', 'كود المؤشر', 'اسم المؤشر',
      'الإدارة', 'مدخل البيانات', 'البريد', 'مالك الأداء',
      'تاريخ الاستحقاق', 'أيام التأخير', 'الحالة', 'مستوى التصعيد',
      'تاريخ التصعيد', 'تاريخ الحل', 'ملاحظات الجودة',
    ];

    const escapeCsv = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };

    const rows = followUps.map(f => [
      f.code, f.year, f.month, f.indicator?.code || '', f.indicator?.nameAr || '',
      f.department?.name || '', f.dataEntryUser?.name || '', f.dataEntryUser?.email || '',
      f.performanceOwner?.name || '',
      f.dueDate?.toISOString().slice(0, 10) || '',
      f.daysLate ?? '',
      f.status, f.escalationLevel,
      f.escalatedAt?.toISOString().slice(0, 10) || '',
      f.resolvedAt?.toISOString().slice(0, 10) || '',
      f.qmNotes || '',
    ].map(escapeCsv).join(','));

    const csv = '﻿' + [headers.join(','), ...rows].join('\n'); // BOM for Excel Arabic

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=kpi-followups-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('GET /export/csv error:', error);
    res.status(500).json({ error: 'فشل التصدير' });
  }
});

// ──────────────────────────────────────────────────────────────
// MANUAL DETECTION — POST /run-detection
// ──────────────────────────────────────────────────────────────

router.post('/run-detection', authenticate, requireQMAccess, async (req, res) => {
  try {
    const stats = await runDailyKpiFollowUpCheck();
    res.json({ message: 'تم تشغيل الفحص بنجاح', stats });
  } catch (error) {
    console.error('POST /run-detection error:', error);
    res.status(500).json({ error: 'فشل تشغيل الفحص', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// DETAILS — GET /:id
// ──────────────────────────────────────────────────────────────

router.get('/:id', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({
      where: { id: req.params.id },
      include: {
        indicator: { include: { axis: true, objective: { select: { id: true, title: true } } } },
        department: true,
        dataEntryUser: { select: { id: true, name: true, email: true, phone: true } },
        performanceOwner: { select: { id: true, name: true, email: true } },
        previousEntry: true,
        resolvedEntry: true,
        escalatedBy: { select: { id: true, name: true } },
      },
    });

    if (!followUp) return res.status(404).json({ error: 'السجل غير موجود' });

    // فحص النطاق للمدراء
    if (req.user.role === 'DEPT_MANAGER' && followUp.departmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'لا يمكنك الوصول لمتابعات قسم آخر' });
    }

    res.json(followUp);
  } catch (error) {
    console.error('GET /:id error:', error);
    res.status(500).json({ error: 'فشل تحميل التفاصيل' });
  }
});

// ──────────────────────────────────────────────────────────────
// TIMELINE — GET /:id/timeline
// ──────────────────────────────────────────────────────────────

router.get('/:id/timeline', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({
      where: { id: req.params.id },
      include: {
        escalatedBy: { select: { name: true } },
        resolvedEntry: { select: { id: true, submittedAt: true, enteredBy: { select: { name: true } } } },
      },
    });
    if (!followUp) return res.status(404).json({ error: 'السجل غير موجود' });

    const events = [];
    events.push({
      type: 'CREATED',
      icon: '📋',
      title: 'إنشاء سجل المتابعة',
      timestamp: followUp.createdAt,
      description: `تم اكتشاف تأخر إدخال شهر ${followUp.month}/${followUp.year}`,
    });
    if (followUp.escalatedAt) {
      events.push({
        type: 'ESCALATED',
        icon: '🚨',
        title: `تصعيد إلى المستوى ${followUp.escalationLevel}`,
        timestamp: followUp.escalatedAt,
        description: followUp.escalationLevel === 1
          ? 'تم إبلاغ مدير القسم'
          : 'تم إبلاغ الإدارة العليا',
        actor: followUp.escalatedBy?.name,
      });
    }
    if (followUp.submittedAt) {
      events.push({
        type: 'SUBMITTED',
        icon: '📥',
        title: 'تم إدخال البيانات',
        timestamp: followUp.submittedAt,
        description: 'تم تسجيل قراءة المؤشر',
      });
    }
    if (followUp.resolvedAt) {
      events.push({
        type: 'RESOLVED',
        icon: '✅',
        title: 'حل المتابعة',
        timestamp: followUp.resolvedAt,
        description: 'أُغلقت المتابعة وربطت بالإدخال',
        actor: followUp.resolvedEntry?.enteredBy?.name,
      });
    }
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ id: followUp.id, code: followUp.code, status: followUp.status, events });
  } catch (error) {
    console.error('GET /:id/timeline error:', error);
    res.status(500).json({ error: 'فشل تحميل السجل الزمني' });
  }
});

// ──────────────────────────────────────────────────────────────
// CREATE — POST /
// ──────────────────────────────────────────────────────────────

router.post('/', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { indicatorId, departmentId, dataEntryUserId, performanceOwnerId, year, month, dueDate, previousEntryId } = req.body;

    if (!indicatorId || !departmentId || !dataEntryUserId || !year || !month || !dueDate) {
      return res.status(400).json({ error: 'حقول مطلوبة ناقصة' });
    }

    const existing = await prisma.kpiFollowUp.findUnique({
      where: { indicatorId_year_month: { indicatorId, year: parseInt(year), month: parseInt(month) } },
    });
    if (existing) return res.status(409).json({ error: 'يوجد متابعة لهذه الفترة بالفعل' });

    const count = await prisma.kpiFollowUp.count();
    const code = `KFU-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const followUp = await prisma.kpiFollowUp.create({
      data: {
        code, indicatorId, departmentId, dataEntryUserId, performanceOwnerId,
        year: parseInt(year), month: parseInt(month),
        dueDate: new Date(dueDate),
        previousEntryId,
      },
      include: { indicator: true, department: true, dataEntryUser: true },
    });
    res.status(201).json(followUp);
  } catch (error) {
    console.error('POST / error:', error);
    res.status(500).json({ error: 'فشل الإنشاء', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// UPDATE — PATCH /:id
// ──────────────────────────────────────────────────────────────

router.patch('/:id', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { qmNotes, status } = req.body;
    const data = {};
    if (qmNotes !== undefined) data.qmNotes = qmNotes;
    if (status !== undefined) data.status = status;

    const followUp = await prisma.kpiFollowUp.update({
      where: { id: req.params.id },
      data,
      include: { indicator: true, department: true, dataEntryUser: true },
    });
    res.json(followUp);
  } catch (error) {
    console.error('PATCH /:id error:', error);
    res.status(500).json({ error: 'فشل التحديث' });
  }
});

// ──────────────────────────────────────────────────────────────
// ESCALATE — POST /:id/escalate (with notes)
// ──────────────────────────────────────────────────────────────

router.post('/:id/escalate', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { escalationLevel = 1, notes } = req.body;
    const lvl = Math.max(0, Math.min(2, parseInt(escalationLevel) || 1));

    const current = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'السجل غير موجود' });

    const noteEntry = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${req.user.name}: تصعيد L${lvl} — ${notes || 'بدون ملاحظات'}`;
    const newNotes = current.qmNotes ? `${current.qmNotes}\n${noteEntry}` : noteEntry;

    const followUp = await prisma.kpiFollowUp.update({
      where: { id: req.params.id },
      data: {
        status: 'ESCALATED',
        escalationLevel: lvl,
        escalatedAt: new Date(),
        escalatedById: req.user.sub,
        qmNotes: newNotes,
      },
      include: { indicator: true, department: true, escalatedBy: true },
    });
    res.json(followUp);
  } catch (error) {
    console.error('POST /:id/escalate error:', error);
    res.status(500).json({ error: 'فشل التصعيد' });
  }
});

// ──────────────────────────────────────────────────────────────
// RESOLVE — POST /:id/resolve
// ──────────────────────────────────────────────────────────────

router.post('/:id/resolve', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { resolvedEntryId, notes } = req.body;
    const current = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'السجل غير موجود' });

    let entryId = resolvedEntryId;

    // إذا لم يُرسل entryId، نحاول العثور على إدخال موجود
    if (!entryId) {
      const entry = await prisma.kpiEntry.findFirst({
        where: { indicatorId: current.indicatorId, year: current.year, month: current.month },
        orderBy: { enteredAt: 'desc' },
      });
      entryId = entry?.id;
    }

    const noteEntry = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${req.user.name}: حل — ${notes || 'تم الحل'}`;
    const newNotes = current.qmNotes ? `${current.qmNotes}\n${noteEntry}` : noteEntry;

    const followUp = await prisma.kpiFollowUp.update({
      where: { id: req.params.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedEntryId: entryId,
        submittedAt: current.submittedAt || new Date(),
        qmNotes: newNotes,
      },
      include: { resolvedEntry: true, indicator: true, department: true },
    });
    res.json(followUp);
  } catch (error) {
    console.error('POST /:id/resolve error:', error);
    res.status(500).json({ error: 'فشل الحل', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// ABORT — POST /:id/abort
// ──────────────────────────────────────────────────────────────

router.post('/:id/abort', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || notes.trim().length < 10) {
      return res.status(400).json({ error: 'الإغلاق النهائي يتطلب سبب مفصّل (10 أحرف على الأقل)' });
    }

    const current = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'السجل غير موجود' });

    const noteEntry = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${req.user.name}: إغلاق نهائي — ${notes}`;
    const newNotes = current.qmNotes ? `${current.qmNotes}\n${noteEntry}` : noteEntry;

    const followUp = await prisma.kpiFollowUp.update({
      where: { id: req.params.id },
      data: { status: 'ABORTED', qmNotes: newNotes },
    });
    res.json(followUp);
  } catch (error) {
    console.error('POST /:id/abort error:', error);
    res.status(500).json({ error: 'فشل الإغلاق' });
  }
});

// ──────────────────────────────────────────────────────────────
// INTEGRATION — POST /:id/create-capa
// إنشاء إجراء تصحيحي (CAPA) من المتابعة تلقائياً
// ──────────────────────────────────────────────────────────────

router.post('/:id/create-capa', authenticate, requireQMAccess, async (req, res) => {
  try {
    const { rootCause, plannedAction, dueDate, ownerId } = req.body;

    const followUp = await prisma.kpiFollowUp.findUnique({
      where: { id: req.params.id },
      include: {
        indicator: { select: { code: true, nameAr: true } },
        department: { select: { name: true } },
        dataEntryUser: { select: { name: true } },
      },
    });
    if (!followUp) return res.status(404).json({ error: 'السجل غير موجود' });

    // توليد رمز CAPA
    const capaCount = await prisma.capa.count();
    const capaCode = `CAPA-${new Date().getFullYear()}-${String(capaCount + 1).padStart(4, '0')}`;

    const title = `تأخّر متكرر: ${followUp.indicator.nameAr} (${followUp.month}/${followUp.year})`;
    const description = [
      `سجل المتابعة: ${followUp.code}`,
      `المؤشر: ${followUp.indicator.code} — ${followUp.indicator.nameAr}`,
      `الفترة: ${followUp.month}/${followUp.year}`,
      `الإدارة: ${followUp.department?.name || '—'}`,
      `مدخل البيانات: ${followUp.dataEntryUser?.name || '—'}`,
      `أيام التأخير: ${followUp.daysLate || '—'}`,
      `مستوى التصعيد: ${followUp.escalationLevel}`,
      followUp.qmNotes ? `\n--- ملاحظات الجودة ---\n${followUp.qmNotes}` : '',
    ].join('\n');

    const capa = await prisma.capa.create({
      data: {
        code: capaCode,
        type: 'CORRECTIVE',
        status: 'OPEN',
        title,
        description,
        sourceType: 'KPI_FOLLOWUP',
        sourceId: followUp.id,
        sourceCode: followUp.code,
        rootCauseAnalysis: rootCause || null,
        plannedAction: plannedAction || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        ownerId: ownerId || followUp.dataEntryUserId,
        createdById: req.user.sub,
      },
    });

    // تسجيل الإجراء في ملاحظات المتابعة
    const noteEntry = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${req.user.name}: تم فتح إجراء تصحيحي ${capa.code}`;
    await prisma.kpiFollowUp.update({
      where: { id: followUp.id },
      data: {
        qmNotes: followUp.qmNotes ? `${followUp.qmNotes}\n${noteEntry}` : noteEntry,
      },
    });

    res.status(201).json({ message: 'تم فتح إجراء تصحيحي', capa });
  } catch (error) {
    console.error('POST /:id/create-capa error:', error);
    res.status(500).json({ error: 'فشل فتح الإجراء التصحيحي', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// ISO 9001 COMPLIANCE REPORT — GET /reports/iso-compliance
// تقرير امتثال ISO 9001 §9.1.3 — تحليل أداء العمليات
// ──────────────────────────────────────────────────────────────

router.get('/reports/iso-compliance', authenticate, requireFollowUpReadAccess, async (req, res) => {
  try {
    const targetYear = parseInt(req.query.year) || new Date().getFullYear();
    let where = { year: targetYear };
    where = buildScopeFilter(req.user, where);

    const [
      totalIndicatorsTracked,
      totalFollowUps,
      resolvedCount,
      escalatedCount,
      abortedCount,
      avgDaysLateAgg,
      capasOpened,
    ] = await Promise.all([
      prisma.indicator.count({ where: { frequency: 'MONTHLY', deletedAt: null } }),
      prisma.kpiFollowUp.count({ where }),
      prisma.kpiFollowUp.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.kpiFollowUp.count({ where: { ...where, status: 'ESCALATED' } }),
      prisma.kpiFollowUp.count({ where: { ...where, status: 'ABORTED' } }),
      prisma.kpiFollowUp.aggregate({
        where: { ...where, daysLate: { gt: 0 } },
        _avg: { daysLate: true },
        _max: { daysLate: true },
      }),
      prisma.capa.count({ where: { sourceType: 'KPI_FOLLOWUP', createdAt: { gte: new Date(targetYear, 0, 1), lt: new Date(targetYear + 1, 0, 1) } } }),
    ]);

    // حساب المعدلات
    const onTimeRate = totalFollowUps === 0 ? 100 :
      Math.round(((totalFollowUps - escalatedCount - abortedCount) / totalFollowUps) * 100);
    const resolutionRate = totalFollowUps === 0 ? 100 :
      Math.round((resolvedCount / totalFollowUps) * 100);
    const escalationRate = totalFollowUps === 0 ? 0 :
      Math.round((escalatedCount / totalFollowUps) * 100);

    // تحديد مستوى الامتثال
    let complianceLevel = 'EXCELLENT';
    if (resolutionRate < 60) complianceLevel = 'CRITICAL';
    else if (resolutionRate < 80) complianceLevel = 'NEEDS_IMPROVEMENT';
    else if (resolutionRate < 95) complianceLevel = 'GOOD';

    res.json({
      year: targetYear,
      isoClause: '9.1.3',
      complianceLevel,
      metrics: {
        totalIndicatorsTracked,
        totalFollowUps,
        resolved: resolvedCount,
        escalated: escalatedCount,
        aborted: abortedCount,
        avgDaysLate: Math.round(avgDaysLateAgg._avg.daysLate || 0),
        maxDaysLate: avgDaysLateAgg._max.daysLate || 0,
        capasOpened,
      },
      rates: {
        onTimeRate,
        resolutionRate,
        escalationRate,
      },
      recommendations: buildRecommendations({ resolutionRate, escalationRate, abortedCount, totalFollowUps }),
    });
  } catch (error) {
    console.error('GET /reports/iso-compliance error:', error);
    res.status(500).json({ error: 'فشل توليد تقرير الامتثال' });
  }
});

function buildRecommendations({ resolutionRate, escalationRate, abortedCount, totalFollowUps }) {
  const recs = [];
  if (resolutionRate < 80) {
    recs.push({
      severity: 'high',
      finding: `معدل الحل أقل من 80% (الفعلي: ${resolutionRate}%)`,
      recommendation: 'مراجعة عمليات إدخال البيانات وتعزيز ثقافة الالتزام بالمواعيد',
    });
  }
  if (escalationRate > 30) {
    recs.push({
      severity: 'high',
      finding: `معدل التصعيد مرتفع (${escalationRate}%)`,
      recommendation: 'تحليل أسباب التصعيد المتكرر وعقد ورش تأهيلية لمدخلي البيانات',
    });
  }
  if (abortedCount > 0 && totalFollowUps > 0 && (abortedCount / totalFollowUps) > 0.1) {
    recs.push({
      severity: 'critical',
      finding: `إغلاق نهائي بدون حل لـ ${abortedCount} مؤشر`,
      recommendation: 'فتح إجراءات تصحيحية فورية ومراجعة ملكية المؤشرات في Management Review',
    });
  }
  if (recs.length === 0) {
    recs.push({
      severity: 'info',
      finding: 'الأداء ضمن المعدلات المقبولة',
      recommendation: 'الاستمرار في المراقبة الدورية والمحافظة على المستوى',
    });
  }
  return recs;
}

// ──────────────────────────────────────────────────────────────
// DELETE — مُعطَّل عمداً (قرار إشرافي)
// ──────────────────────────────────────────────────────────────
// لا يوجد مسار حذف لسجلات المتابعة. الإغلاق النهائي يجب أن يمرّ
// حصراً عبر POST /:id/abort مع سبب موثَّق.
// السماح بـ DELETE هنا كان "باباً جانبياً" يلتف على شرط التوثيق
// ويُفقد السجل صدقه. أيّ استدعاء DELETE يُرفض بـ 405.

router.delete('/:id', authenticate, (req, res) => {
  res.status(405).json({
    error: 'الحذف غير مسموح. استخدم POST /:id/abort مع سبب موثَّق للإغلاق النهائي.',
    correctEndpoint: `POST /api/kpi-followups/${req.params.id}/abort`,
  });
});

export default router;
