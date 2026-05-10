import { Router } from 'express';
import { prisma } from '../db.js';
import { crudRouter } from '../utils/crudFactory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { nextCode } from '../utils/codeGen.js';

const router = Router();

const base = crudRouter({
  resource: 'swot',
  model: 'swotItem',
  codePrefix: 'SWOT',
  searchFields: ['description', 'category', 'strategy'],
  allowedSortFields: ['createdAt', 'type', 'impact', 'status'],
  allowedFilters: ['type', 'status', 'relatedRiskId', 'relatedGoalId', 'departmentId', 'ownerUserId'],
  include: {
    relatedRisk:    { select: { id: true, code: true, title: true, level: true } },
    relatedGoal:    { select: { id: true, code: true, title: true } },
    ownerUser:      { select: { id: true, name: true } },
    swotDepartment: { select: { id: true, name: true } },
  },
});

function scoreFromImpact(impact) {
  const text = String(impact || '').trim();
  if (text.includes('مرتفع') || text.toUpperCase() === 'HIGH') {
    return { probability: 3, impact: 4 };
  }
  if (text.includes('منخفض') || text.toUpperCase() === 'LOW') {
    return { probability: 1, impact: 2 };
  }
  return { probability: 2, impact: 3 };
}

function levelFromScore(score) {
  if (score >= 20) return 'حرج';
  if (score >= 12) return 'مرتفع';
  if (score >= 6) return 'متوسط';
  return 'منخفض';
}

function riskTypeForSwot(type) {
  return String(type || '').toUpperCase() === 'OPPORTUNITY' ? 'OPPORTUNITY' : 'RISK';
}

function reviewDate(days = 90) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

router.get('/health', requireAction('swot', 'read'), asyncHandler(async (_req, res) => {
  const items = await prisma.swotItem.findMany({
    where: { deletedAt: null, status: { not: 'ARCHIVED' } },
    select: {
      id: true,
      code: true,
      type: true,
      description: true,
      relatedRiskId: true,
      relatedGoalId: true,
      ownerUserId: true,
      departmentId: true,
      reviewDate: true,
    },
  });

  const actionable = items.filter(i => ['WEAKNESS', 'THREAT', 'OPPORTUNITY'].includes(String(i.type).toUpperCase()));
  const missingRisk = actionable.filter(i => !i.relatedRiskId && String(i.type).toUpperCase() !== 'OPPORTUNITY');
  const missingGoal = actionable.filter(i => !i.relatedGoalId);
  const missingOwner = actionable.filter(i => !i.ownerUserId);
  const missingDepartment = actionable.filter(i => !i.departmentId);
  const missingReviewDate = actionable.filter(i => !i.reviewDate);

  res.json({
    ok: true,
    summary: {
      total: items.length,
      actionable: actionable.length,
      linkedToRisk: items.filter(i => i.relatedRiskId).length,
      linkedToGoal: items.filter(i => i.relatedGoalId).length,
      missingRisk: missingRisk.length,
      missingGoal: missingGoal.length,
      missingOwner: missingOwner.length,
      missingDepartment: missingDepartment.length,
      missingReviewDate: missingReviewDate.length,
    },
    issues: [
      ...missingRisk.slice(0, 20).map(i => ({ severity: 'warning', code: i.code, message: 'عنصر SWOT يحتاج ربطاً بخطر أو خطة معالجة.' })),
      ...missingGoal.slice(0, 20).map(i => ({ severity: 'info', code: i.code, message: 'عنصر SWOT غير مرتبط بهدف استراتيجي.' })),
      ...missingOwner.slice(0, 20).map(i => ({ severity: 'warning', code: i.code, message: 'عنصر SWOT بلا مالك متابعة.' })),
      ...missingDepartment.slice(0, 20).map(i => ({ severity: 'warning', code: i.code, message: 'عنصر SWOT بلا إدارة مسؤولة.' })),
      ...missingReviewDate.slice(0, 20).map(i => ({ severity: 'info', code: i.code, message: 'عنصر SWOT بلا تاريخ مراجعة.' })),
    ].slice(0, 50),
  });
}));

router.post('/:id/create-risk', requireAction('risks', 'create'), asyncHandler(async (req, res) => {
  const item = await prisma.swotItem.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      relatedRisk: { select: { id: true, code: true, title: true } },
      ownerUser: { select: { id: true, name: true } },
      swotDepartment: { select: { id: true, name: true } },
    },
  });
  if (!item) throw NotFound('عنصر SWOT غير موجود');
  if (item.relatedRiskId && item.relatedRisk) {
    return res.json({ ok: true, item: item.relatedRisk, reused: true });
  }

  const sourceType = String(item.type || '').toUpperCase();
  if (!['WEAKNESS', 'THREAT', 'OPPORTUNITY'].includes(sourceType)) {
    throw BadRequest('هذا العنصر قوة داخلية؛ لا يحتاج تحويله إلى خطر أو فرصة معالجة.');
  }

  const ownerId = item.ownerUserId || req.user.sub;
  const departmentId = item.departmentId || req.user.departmentId || null;
  const scoreBase = scoreFromImpact(item.impact);
  const score = scoreBase.probability * scoreBase.impact;
  const riskType = riskTypeForSwot(item.type);
  const code = await nextCode('risk', 'RSK');

  const risk = await prisma.risk.create({
    data: {
      code,
      type: riskType,
      title: `${riskType === 'OPPORTUNITY' ? 'فرصة' : 'خطر'} من SWOT: ${item.description.slice(0, 120)}`,
      description: item.description,
      source: `SWOT:${item.code}`,
      departmentId,
      probability: scoreBase.probability,
      impact: scoreBase.impact,
      score,
      level: levelFromScore(score),
      treatment: item.strategy || 'استكمال خطة التعامل مع عنصر SWOT وتحويله إلى إجراء متابعة واضح.',
      treatmentType: riskType === 'OPPORTUNITY' ? 'استثمار' : 'تخفيف',
      earlyWarning: 'تراجع قراءة المؤشر أو تأخر تنفيذ النشاط المرتبط.',
      ownerId,
      status: 'IDENTIFIED',
      reviewDate: item.reviewDate || reviewDate(),
      createdById: req.user.sub,
      strategicGoalId: item.relatedGoalId || null,
    },
    select: { id: true, code: true, title: true, level: true, status: true },
  });

  await prisma.swotItem.update({
    where: { id: item.id },
    data: {
      relatedRiskId: risk.id,
      ownerUserId: item.ownerUserId || ownerId,
      departmentId: item.departmentId || departmentId,
      reviewDate: item.reviewDate || reviewDate(),
    },
  });

  res.status(201).json({ ok: true, item: risk });
}));

router.post('/:id/create-follow-up', requireAction('follow-up-tasks', 'create'), asyncHandler(async (req, res) => {
  const item = await prisma.swotItem.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!item) throw NotFound('عنصر SWOT غير موجود');

  const existing = await prisma.followUpTask.findFirst({
    where: {
      deletedAt: null,
      source: 'SWOT',
      sourceId: item.id,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    select: { id: true, code: true, title: true },
  });
  if (existing) return res.json({ ok: true, item: existing, reused: true });

  const ownerId = item.ownerUserId || req.user.sub;
  const code = await nextCode('followUpTask', 'FUT');
  const task = await prisma.followUpTask.create({
    data: {
      code,
      title: `متابعة عنصر SWOT: ${item.code}`,
      description: [
        item.description,
        item.strategy ? `الاستراتيجية المقترحة: ${item.strategy}` : null,
      ].filter(Boolean).join('\n'),
      ownerId,
      dueDate: item.reviewDate || reviewDate(30),
      source: 'SWOT',
      sourceId: item.id,
      priority: String(item.impact || '').includes('مرتفع') ? 'HIGH' : 'MEDIUM',
      createdById: req.user.sub,
    },
    select: { id: true, code: true, title: true, dueDate: true, priority: true },
  });

  res.status(201).json({ ok: true, item: task });
}));

router.use('/', base);

export default router;
