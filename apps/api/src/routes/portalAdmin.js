/**
 * routes/portalAdmin.js — إدارة البوابة العامة (مصادَق)
 *
 * GET    /api/portal/settings          — قراءة إعدادات البوابة
 * PATCH  /api/portal/settings          — تحديث الإعدادات
 *
 * GET    /api/portal/announcements     — قائمة الإعلانات
 * POST   /api/portal/announcements     — إنشاء إعلان
 * GET    /api/portal/announcements/:id — قراءة إعلان
 * PATCH  /api/portal/announcements/:id — تعديل إعلان
 * DELETE /api/portal/announcements/:id — حذف ناعم
 *
 * GET    /api/portal/documents         — الوثائق مع toggle isPublic
 * PATCH  /api/portal/documents/:id/visibility  — تفعيل/إيقاف isPublic
 *
 * GET    /api/portal/surveys           — الاستبيانات مع toggle isPublic
 * PATCH  /api/portal/surveys/:id/visibility    — تفعيل/إيقاف isPublic
 *
 * الصلاحيات: SUPER_ADMIN + QUALITY_MANAGER فقط
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { NotFound, BadRequest } from '../utils/errors.js';

const router = Router();
const ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', authorize(...ROLES), asyncHandler(async (_req, res) => {
  const settings = await prisma.portalSettings.upsert({
    where:  { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
  res.json({ ok: true, item: settings });
}));

router.patch('/settings', authorize(...ROLES), asyncHandler(async (req, res) => {
  const allowed = ['orgName', 'orgDescription', 'showPolicy', 'showDocuments',
                   'showAnnouncements', 'showSurveys', 'showKpis', 'footerText'];
  const data = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) throw BadRequest('لا توجد حقول للتحديث');

  const settings = await prisma.portalSettings.upsert({
    where:  { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
  res.json({ ok: true, item: settings });
}));

// ─── Announcements ────────────────────────────────────────────────────────────

router.get('/announcements', authorize(...ROLES), asyncHandler(async (_req, res) => {
  const items = await prisma.announcement.findMany({
    where:   { deletedAt: null },
    orderBy: { publishedAt: 'desc' },
    take:    100,
  });
  res.json({ ok: true, items, total: items.length });
}));

router.post('/announcements', authorize(...ROLES), asyncHandler(async (req, res) => {
  const { title, summary, body, category, isActive, publishedAt, expiresAt } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw BadRequest('عنوان الإعلان مطلوب');
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    throw BadRequest('نص الإعلان مطلوب');
  }
  const item = await prisma.announcement.create({
    data: {
      title:       title.trim(),
      summary:     summary?.trim() ?? null,
      body:        body.trim(),
      category:    category?.trim() ?? null,
      isActive:    isActive !== false,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      expiresAt:   expiresAt ? new Date(expiresAt) : null,
    },
  });
  res.status(201).json({ ok: true, item });
}));

router.get('/announcements/:id', authorize(...ROLES), asyncHandler(async (req, res) => {
  const item = await prisma.announcement.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!item) throw NotFound('الإعلان غير موجود');
  res.json({ ok: true, item });
}));

router.patch('/announcements/:id', authorize(...ROLES), asyncHandler(async (req, res) => {
  const existing = await prisma.announcement.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!existing) throw NotFound('الإعلان غير موجود');

  const allowed = ['title', 'summary', 'body', 'category', 'isActive', 'publishedAt', 'expiresAt'];
  const data = {};
  for (const key of allowed) {
    if (key in req.body) {
      if (key === 'publishedAt' || key === 'expiresAt') {
        data[key] = req.body[key] ? new Date(req.body[key]) : null;
      } else {
        data[key] = req.body[key];
      }
    }
  }
  if (Object.keys(data).length === 0) throw BadRequest('لا توجد حقول للتحديث');

  const item = await prisma.announcement.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ ok: true, item });
}));

router.delete('/announcements/:id', authorize(...ROLES), asyncHandler(async (req, res) => {
  const existing = await prisma.announcement.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!existing) throw NotFound('الإعلان غير موجود');
  await prisma.announcement.update({
    where: { id: req.params.id },
    data:  { deletedAt: new Date() },
  });
  res.json({ ok: true });
}));

// ─── Documents visibility toggle ─────────────────────────────────────────────

router.get('/documents', authorize(...ROLES), asyncHandler(async (_req, res) => {
  const items = await prisma.document.findMany({
    where:   { deletedAt: null, status: 'PUBLISHED' },
    select:  { id: true, code: true, title: true, category: true, currentVersion: true, isPublic: true, effectiveDate: true },
    orderBy: { effectiveDate: 'desc' },
    take:    200,
  });
  res.json({ ok: true, items, total: items.length });
}));

router.patch('/documents/:id/visibility', authorize(...ROLES), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (doc.status !== 'PUBLISHED') throw BadRequest('يمكن نشر الوثائق المنشورة فقط في البوابة');

  const isPublic = typeof req.body.isPublic === 'boolean' ? req.body.isPublic : !doc.isPublic;
  const updated = await prisma.document.update({
    where:  { id: req.params.id },
    data:   { isPublic },
    select: { id: true, code: true, title: true, isPublic: true },
  });
  res.json({ ok: true, item: updated });
}));

// ─── Surveys visibility toggle ────────────────────────────────────────────────

router.get('/surveys', authorize(...ROLES), asyncHandler(async (_req, res) => {
  const items = await prisma.survey.findMany({
    where:   { deletedAt: null, active: true },
    select:  { id: true, title: true, target: true, period: true, isPublic: true },
    orderBy: { createdAt: 'desc' },
    take:    100,
  });
  res.json({ ok: true, items, total: items.length });
}));

router.patch('/surveys/:id/visibility', authorize(...ROLES), asyncHandler(async (req, res) => {
  const survey = await prisma.survey.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!survey) throw NotFound('الاستبيان غير موجود');

  const isPublic = typeof req.body.isPublic === 'boolean' ? req.body.isPublic : !survey.isPublic;
  const updated = await prisma.survey.update({
    where:  { id: req.params.id },
    data:   { isPublic },
    select: { id: true, title: true, isPublic: true },
  });
  res.json({ ok: true, item: updated });
}));

export default router;
