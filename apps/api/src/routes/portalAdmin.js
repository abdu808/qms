/**
 * portalAdmin.js — إدارة محتوى البوابة العامة (authenticated)
 *
 * الصلاحيات: SUPER_ADMIN + QUALITY_MANAGER
 * الوظائف:
 *   - إعدادات البوابة (orgName, توggles, ...)
 *   - CRUD الإعلانات
 *   - تبديل isPublic على الوثائق والاستبيانات
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Forbidden, NotFound } from '../utils/errors.js';

const PORTAL_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

function requirePortalRole(req, _res, next) {
  if (!PORTAL_ROLES.includes(req.user?.role)) throw new Forbidden('صلاحية مدير الجودة مطلوبة');
  next();
}

const router = Router();
router.use(requirePortalRole);

// ─── إعدادات البوابة ──────────────────────────────────────────────────────────

router.get('/settings', asyncHandler(async (_req, res) => {
  const settings = await prisma.portalSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
  res.json({ ok: true, settings });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const { orgName, orgDescription, showPolicy, showDocuments,
          showAnnouncements, showSurveys, footerText } = req.body;

  const settings = await prisma.portalSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      ...(orgName !== undefined && { orgName }),
      ...(orgDescription !== undefined && { orgDescription }),
      ...(showPolicy !== undefined && { showPolicy: Boolean(showPolicy) }),
      ...(showDocuments !== undefined && { showDocuments: Boolean(showDocuments) }),
      ...(showAnnouncements !== undefined && { showAnnouncements: Boolean(showAnnouncements) }),
      ...(showSurveys !== undefined && { showSurveys: Boolean(showSurveys) }),
      ...(footerText !== undefined && { footerText }),
    },
    update: {
      ...(orgName !== undefined && { orgName }),
      ...(orgDescription !== undefined && { orgDescription }),
      ...(showPolicy !== undefined && { showPolicy: Boolean(showPolicy) }),
      ...(showDocuments !== undefined && { showDocuments: Boolean(showDocuments) }),
      ...(showAnnouncements !== undefined && { showAnnouncements: Boolean(showAnnouncements) }),
      ...(showSurveys !== undefined && { showSurveys: Boolean(showSurveys) }),
      ...(footerText !== undefined && { footerText }),
    },
  });
  res.json({ ok: true, settings });
}));

// ─── الإعلانات ────────────────────────────────────────────────────────────────

router.get('/announcements', asyncHandler(async (_req, res) => {
  const items = await prisma.announcement.findMany({
    where: { deletedAt: null },
    orderBy: { publishedAt: 'desc' },
  });
  res.json({ ok: true, items });
}));

router.post('/announcements', asyncHandler(async (req, res) => {
  const { title, summary, body, category, isActive, publishedAt, expiresAt } = req.body;
  if (!title?.trim()) throw new Error('العنوان مطلوب');
  if (!body?.trim())  throw new Error('المحتوى مطلوب');

  const item = await prisma.announcement.create({
    data: {
      title: title.trim(),
      summary: summary?.trim() || null,
      body: body.trim(),
      category: category?.trim() || null,
      isActive: isActive !== false,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  res.status(201).json({ ok: true, item });
}));

router.patch('/announcements/:id', asyncHandler(async (req, res) => {
  const item = await prisma.announcement.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw new NotFound('الإعلان غير موجود');

  const { title, summary, body, category, isActive, publishedAt, expiresAt } = req.body;
  const updated = await prisma.announcement.update({
    where: { id: item.id },
    data: {
      ...(title !== undefined      && { title: title.trim() }),
      ...(summary !== undefined    && { summary: summary?.trim() || null }),
      ...(body !== undefined       && { body: body.trim() }),
      ...(category !== undefined   && { category: category?.trim() || null }),
      ...(isActive !== undefined   && { isActive: Boolean(isActive) }),
      ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
      ...(expiresAt !== undefined  && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  });
  res.json({ ok: true, item: updated });
}));

router.delete('/announcements/:id', asyncHandler(async (req, res) => {
  const item = await prisma.announcement.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw new NotFound('الإعلان غير موجود');
  await prisma.announcement.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
}));

// ─── تبديل isPublic للوثائق ───────────────────────────────────────────────────

router.get('/documents', asyncHandler(async (_req, res) => {
  const items = await prisma.document.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    orderBy: { approvedAt: 'desc' },
    select: { id: true, code: true, title: true, category: true, currentVersion: true, approvedAt: true, isPublic: true },
  });
  res.json({ ok: true, items });
}));

router.patch('/documents/:id/toggle-public', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!doc) throw new NotFound('الوثيقة غير موجودة');
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { isPublic: !doc.isPublic },
    select: { id: true, isPublic: true },
  });
  res.json({ ok: true, item: updated });
}));

// ─── تبديل isPublic للاستبيانات ──────────────────────────────────────────────

router.get('/surveys', asyncHandler(async (_req, res) => {
  const items = await prisma.survey.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, title: true, target: true, active: true, isPublic: true, responses: true },
  });
  res.json({ ok: true, items });
}));

router.patch('/surveys/:id/toggle-public', asyncHandler(async (req, res) => {
  const survey = await prisma.survey.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!survey) throw new NotFound('الاستبيان غير موجود');
  const updated = await prisma.survey.update({
    where: { id: survey.id },
    data: { isPublic: !survey.isPublic },
    select: { id: true, isPublic: true },
  });
  res.json({ ok: true, item: updated });
}));

export default router;
