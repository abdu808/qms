/**
 * routes/consultSessions.js — جلسات المستشار الذكي
 *
 *  GET    /api/consult-sessions          — قائمة جلسات المستخدم الحالي
 *  POST   /api/consult-sessions          — إنشاء أو تحديث جلسة
 *  GET    /api/consult-sessions/:id      — تحميل جلسة محددة
 *  DELETE /api/consult-sessions/:id      — حذف جلسة
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { prisma } from '../db.js';

const router = Router();
const ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER', 'DEPT_MANAGER'];
const MAX_SESSIONS_PER_USER = 50; // الحد الأقصى للجلسات المحفوظة

/**
 * GET /api/consult-sessions — قائمة جلسات المستخدم (بدون messages لتخفيف الحمل)
 */
router.get('/', authorize(...ROLES), asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.user?.id;
  const sessions = await prisma.consultSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, title: true, messageCount: true,
      costUSD: true, lastModel: true,
      createdAt: true, updatedAt: true,
    },
  });
  res.json({ ok: true, items: sessions });
}));

/**
 * POST /api/consult-sessions — حفظ جلسة (إنشاء أو تحديث)
 * body: { id?, title?, messages, inputTokens?, outputTokens?, costUSD?, lastModel? }
 */
router.post('/', authorize(...ROLES), asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.user?.id;
  const { id, title, messages, inputTokens = 0, outputTokens = 0, costUSD = 0, lastModel = '' } = req.body || {};

  if (!Array.isArray(messages)) throw BadRequest('messages: مصفوفة مطلوبة');
  if (messages.length > 200) throw BadRequest('عدد الرسائل تجاوز الحد (200)');

  const messagesJson = JSON.stringify(messages);
  const messageCount = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

  // استخلاص العنوان من أول رسالة مستخدم إذا لم يُحدَّد
  const autoTitle = title || (() => {
    const first = messages.find(m => m.role === 'user' && typeof m.content === 'string');
    return first ? first.content.slice(0, 60).trim() : 'جلسة جديدة';
  })();

  let session;
  if (id) {
    // تحديث جلسة موجودة — تأكد أنها تخص المستخدم الحالي
    const existing = await prisma.consultSession.findFirst({ where: { id, userId } });
    if (!existing) throw NotFound('الجلسة غير موجودة');
    session = await prisma.consultSession.update({
      where: { id },
      data: {
        title: autoTitle,
        messages: messagesJson,
        messageCount,
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        costUSD: { increment: costUSD },
        lastModel: lastModel || existing.lastModel,
      },
    });
  } else {
    // إنشاء جلسة جديدة — حذف الأقدم إذا تجاوز الحد
    const count = await prisma.consultSession.count({ where: { userId } });
    if (count >= MAX_SESSIONS_PER_USER) {
      // احذف أقدم جلسة
      const oldest = await prisma.consultSession.findFirst({
        where: { userId }, orderBy: { updatedAt: 'asc' }, select: { id: true },
      });
      if (oldest) await prisma.consultSession.delete({ where: { id: oldest.id } });
    }
    session = await prisma.consultSession.create({
      data: { userId, title: autoTitle, messages: messagesJson, messageCount, inputTokens, outputTokens, costUSD, lastModel },
    });
  }

  res.json({ ok: true, item: { id: session.id, title: session.title, updatedAt: session.updatedAt } });
}));

/**
 * GET /api/consult-sessions/:id — تحميل جلسة كاملة مع messages
 */
router.get('/:id', authorize(...ROLES), asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.user?.id;
  const session = await prisma.consultSession.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!session) throw NotFound('الجلسة غير موجودة');

  let messages = [];
  try { messages = JSON.parse(session.messages); } catch {}

  res.json({
    ok: true,
    item: {
      id: session.id, title: session.title,
      messages, messageCount: session.messageCount,
      costUSD: session.costUSD, lastModel: session.lastModel,
      createdAt: session.createdAt, updatedAt: session.updatedAt,
    },
  });
}));

/**
 * DELETE /api/consult-sessions/:id — حذف جلسة
 */
router.delete('/:id', authorize(...ROLES), asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.user?.id;
  const existing = await prisma.consultSession.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw NotFound('الجلسة غير موجودة');
  await prisma.consultSession.delete({ where: { id: req.params.id } });
  res.json({ ok: true, message: 'تم حذف الجلسة' });
}));

export default router;
