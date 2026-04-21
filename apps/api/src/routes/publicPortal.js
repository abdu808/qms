/**
 * routes/publicPortal.js — البوابة العامة (بدون مصادقة)
 *
 * GET /api/public/portal — يُرجع محتوى البوابة كاملاً:
 *   settings, policy, announcements, documents, surveys
 *
 * قواعد الأمان:
 *   - لا حقول داخلية (filePath, passwordHash, userId, ...)
 *   - الإعلانات النشطة فقط + غير منتهية الصلاحية
 *   - الوثائق isPublic=true + PUBLISHED فقط
 *   - الاستبيانات isPublic=true + active=true فقط
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/portal', asyncHandler(async (_req, res) => {
  const now = new Date();

  const [settings, policy, announcements, documents, surveys] = await Promise.all([
    // إعدادات البوابة — نُنشئ سجلاً افتراضياً إن لم يوجد
    prisma.portalSettings.upsert({
      where:  { id: 'default' },
      create: { id: 'default' },
      update: {},
    }),

    // سياسة الجودة النشطة
    prisma.qualityPolicy.findFirst({
      where:   { active: true, deletedAt: null },
      select:  { title: true, content: true, commitments: true, approvedBy: true, approvedAt: true, version: true },
      orderBy: { approvedAt: 'desc' },
    }),

    // الإعلانات النشطة (غير منتهية الصلاحية)
    prisma.announcement.findMany({
      where: {
        isActive:  true,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select:  { id: true, title: true, summary: true, body: true, category: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take:    20,
    }),

    // الوثائق العامة المنشورة
    prisma.document.findMany({
      where:   { isPublic: true, status: 'PUBLISHED', deletedAt: null },
      select:  { id: true, code: true, title: true, category: true, currentVersion: true, effectiveDate: true },
      orderBy: { effectiveDate: 'desc' },
      take:    50,
    }),

    // الاستبيانات العامة النشطة
    prisma.survey.findMany({
      where:   { isPublic: true, active: true, deletedAt: null },
      select:  { id: true, title: true, target: true, period: true },
      orderBy: { createdAt: 'desc' },
      take:    10,
    }),
  ]);

  res.json({ ok: true, settings, policy, announcements, documents, surveys });
}));

export default router;
