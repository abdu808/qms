import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';

const base = crudRouter({
  model: 'training',
  codePrefix: 'TRN',
  searchFields: ['title', 'trainer'],
  include: {
    records: { include: { user: { select: { id: true, name: true, email: true } } } },
  },
  allowedSortFields: ['createdAt', 'date'],
});

const router = Router();

// GET /:id/records — list attendance/effectiveness records
router.get('/:id/records', asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!training) throw NotFound('التدريب غير موجود');
  const records = await prisma.trainingRecord.findMany({
    where: { trainingId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // Stats
  const attended = records.filter(r => r.attended).length;
  const effective = records.filter(r => r.effective === true).length;
  const assessed  = records.filter(r => r.effective !== null && r.effective !== undefined).length;
  const avgScore  = (() => {
    const scores = records.map(r => r.score).filter(s => s !== null && s !== undefined);
    return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
  })();
  res.json({
    ok: true,
    training,
    records,
    stats: {
      total: records.length,
      attended,
      attendanceRate: records.length ? Math.round((attended / records.length) * 100) : 0,
      effective,
      assessed,
      effectivenessRate: assessed ? Math.round((effective / assessed) * 100) : 0,
      avgScore,
    },
  });
}));

// POST /:id/records — upsert a single record (attendance/score/effectiveness)
router.post('/:id/records', asyncHandler(async (req, res) => {
  const { userId, attended, score, effective, certUrl } = req.body;
  if (!userId) throw BadRequest('مطلوب اختيار الموظف');

  const t = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!t) throw NotFound('التدريب غير موجود');

  const data = {
    attended: !!attended,
    score: score === '' || score === null || score === undefined ? null : Number(score),
    effective: effective === '' || effective === null || effective === undefined ? null
               : (effective === true || effective === 'true'),
    certUrl: certUrl || null,
  };

  if (data.score !== null && (!Number.isFinite(data.score) || data.score < 0 || data.score > 100)) {
    throw BadRequest('الدرجة يجب أن تكون بين 0 و 100');
  }

  const record = await prisma.trainingRecord.upsert({
    where: { trainingId_userId: { trainingId: req.params.id, userId } },
    update: data,
    create: { trainingId: req.params.id, userId, ...data },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ ok: true, item: record });
}));

// DELETE /:id/records/:userId — remove a record
router.delete('/:id/records/:userId', asyncHandler(async (req, res) => {
  await prisma.trainingRecord.delete({
    where: { trainingId_userId: { trainingId: req.params.id, userId: req.params.userId } },
  });
  res.json({ ok: true });
}));

router.use('/', base);

export default router;
