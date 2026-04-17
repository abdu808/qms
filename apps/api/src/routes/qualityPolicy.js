import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { crudRouter } from '../utils/crudFactory.js';

const base = crudRouter({
  model: 'qualityPolicy',
  searchFields: ['title', 'content', 'version'],
  allowedSortFields: ['createdAt', 'effectiveDate', 'active'],
});

const router = Router();

// Get the ACTIVE quality policy
router.get('/active', asyncHandler(async (req, res) => {
  const item = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, item });
}));

// Activate a policy (deactivates others)
router.post('/:id/activate', asyncHandler(async (req, res) => {
  await prisma.$transaction([
    prisma.qualityPolicy.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.qualityPolicy.update({ where: { id: req.params.id }, data: { active: true } }),
  ]);
  res.json({ ok: true });
}));

router.use('/', base);

export default router;
