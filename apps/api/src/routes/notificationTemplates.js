/**
 * routes/notificationTemplates.js
 *
 * GET    /api/notification-templates         — قائمة القوالب
 * GET    /api/notification-templates/:key    — قالب محدد بالـ eventKey
 * PATCH  /api/notification-templates/:key    — تعديل قالب موجود (لا إضافة جديدة من الواجهة)
 * POST   /api/notification-templates/:key/preview — معاينة بمتغيرات مثال
 *
 * ملاحظة: لا يوجد POST/DELETE للقوالب من الواجهة.
 * القوالب تُضاف فقط عبر migrations seed (لربطها بأحداث الكود).
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest, NotFound } from '../utils/errors.js';

const router = Router();

// محرّك بسيط للمتغيرات: {{varName}}
export function renderTemplate(template, variables = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, name) => {
    const v = variables[name];
    if (v === undefined || v === null) return match; // اترك المتغير غير المعرَّف كما هو لتسهيل الفحص
    return String(v);
  });
}

// قائمة القنوات المسموحة
const ALLOWED_CHANNELS = ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'];

function validateChannels(csv) {
  if (!csv || typeof csv !== 'string') return 'IN_APP';
  const list = csv.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  for (const c of list) {
    if (!ALLOWED_CHANNELS.includes(c)) {
      throw BadRequest(`قناة غير مسموحة: ${c}. المسموح: ${ALLOWED_CHANNELS.join(', ')}`);
    }
  }
  return list.join(',');
}

// ──────────────────────────────────────────────────────────────
// GET /
// ──────────────────────────────────────────────────────────────

router.get('/', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const { category, enabled } = req.query;
  const where = {};
  if (category) where.category = category;
  if (enabled !== undefined && enabled !== '') where.enabled = enabled === 'true';

  const items = await prisma.notificationTemplate.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
  });
  res.json({ ok: true, data: items });
}));

// ──────────────────────────────────────────────────────────────
// GET /:key
// ──────────────────────────────────────────────────────────────

router.get('/:key', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const item = await prisma.notificationTemplate.findUnique({
    where: { eventKey: req.params.key },
    include: { updatedBy: { select: { id: true, name: true } } },
  });
  if (!item) throw NotFound('القالب غير موجود');
  res.json({ ok: true, item });
}));

// ──────────────────────────────────────────────────────────────
// PATCH /:key — تعديل القالب
// ──────────────────────────────────────────────────────────────

router.patch('/:key', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const { name, description, subject, body, channels, enabled } = req.body;

  const data = { updatedById: req.user.sub };
  if (name !== undefined) data.name = String(name).trim();
  if (description !== undefined) data.description = description ? String(description) : null;
  if (subject !== undefined) {
    if (!subject || !String(subject).trim()) throw BadRequest('العنوان مطلوب');
    data.subject = String(subject);
  }
  if (body !== undefined) {
    if (!body || !String(body).trim()) throw BadRequest('المتن مطلوب');
    data.body = String(body);
  }
  if (channels !== undefined) data.channels = validateChannels(channels);
  if (enabled !== undefined) data.enabled = !!enabled;

  try {
    const item = await prisma.notificationTemplate.update({
      where: { eventKey: req.params.key },
      data,
      include: { updatedBy: { select: { id: true, name: true } } },
    });
    res.json({ ok: true, item });
  } catch (e) {
    if (e.code === 'P2025') throw NotFound('القالب غير موجود');
    throw e;
  }
}));

// ──────────────────────────────────────────────────────────────
// POST /:key/preview — معاينة بمتغيرات
// ──────────────────────────────────────────────────────────────

router.post('/:key/preview', authorize('SUPER_ADMIN', 'QUALITY_MANAGER'), asyncHandler(async (req, res) => {
  const tpl = await prisma.notificationTemplate.findUnique({
    where: { eventKey: req.params.key },
  });
  if (!tpl) throw NotFound('القالب غير موجود');

  // استخدم القيم المُرسلة، أو fallback لقيم مثال واقعية
  const sample = {
    employeeName: 'محمد عبدالله',
    managerName: 'فهد العتيبي',
    indicatorCode: 'IND-2026-007',
    indicatorName: 'نسبة رضا المستفيدين',
    departmentName: 'إدارة الخدمات',
    month: '5',
    year: '2026',
    daysLate: '7',
    dueDate: '2026-05-05',
    link: 'https://quality.aqiltech.sa/qms#/kpiFollowUp',
    followUpCode: 'KFU-2026-0023',
    totalOverdue: '18',
    pendingCount: '2',
    firstNoticeCount: '5',
    escalatedL1Count: '4',
    escalatedL2Count: '7',
    oldestDaysLate: '24',
    departmentSummary: 'إدارة الخدمة المجتمعية: 7\nإدارة الدعم المؤسسي: 4\nالإدارة المالية: 3',
    ...req.body,
  };

  res.json({
    ok: true,
    rendered: {
      subject: renderTemplate(tpl.subject, sample),
      body: renderTemplate(tpl.body, sample),
    },
    channels: tpl.channels.split(',').map(s => s.trim()),
    enabled: tpl.enabled,
  });
}));

export default router;
