/**
 * publicPortal.js — API عامة للبوابة المؤسسية (بدون auth)
 *
 * كل الـ endpoints هنا:
 * - لا تتطلب تسجيل دخول
 * - تُرجع فقط البيانات المصرح بنشرها
 * - لا تكشف حقولاً داخلية (userId, filePath, idHash, ...)
 * - محمية بـ publicReadLimiter + publicSecurityHeaders في server.js
 */

import express from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();

// ─── GET /api/public/portal ───────────────────────────────────────────────────
// يُرجع كل محتوى البوابة في طلب واحد (يقلل الـ round-trips للعميل)
router.get('/portal', asyncHandler(async (_req, res) => {
  const now = new Date();

  const [settings, policy, announcements, documents, surveys] = await Promise.all([

    // ── إعدادات البوابة (صف واحد دائماً — upsert عند أول طلب)
    prisma.portalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
      select: {
        orgName: true,
        orgDescription: true,
        showPolicy: true,
        showDocuments: true,
        showAnnouncements: true,
        showSurveys: true,
        footerText: true,
      },
    }),

    // ── سياسة الجودة النشطة
    prisma.qualityPolicy.findFirst({
      where: { active: true, deletedAt: null },
      select: { version: true, title: true, content: true, commitments: true, approvedAt: true, effectiveDate: true },
      orderBy: { approvedAt: 'desc' },
    }),

    // ── الإعلانات النشطة غير المنتهية
    prisma.announcement.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, summary: true, body: true, category: true, publishedAt: true },
    }),

    // ── الوثائق المصرح بنشرها
    prisma.document.findMany({
      where: { isPublic: true, status: 'PUBLISHED', deletedAt: null },
      orderBy: { approvedAt: 'desc' },
      take: 50,
      select: { id: true, code: true, title: true, category: true, currentVersion: true, approvedAt: true, isoClause: true },
    }),

    // ── الاستبيانات العامة المفعّلة
    prisma.survey.findMany({
      where: { isPublic: true, active: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, target: true, period: true },
      // questionsJson مستبعد عمداً — الجمهور يصل للاستبيان عبر /survey/:id
    }),
  ]);

  res.json({ ok: true, settings, policy, announcements, documents, surveys });
}));

export default router;
