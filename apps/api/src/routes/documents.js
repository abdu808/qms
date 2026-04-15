import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = crudRouter({
  model: 'document',
  codePrefix: 'DOC',
  searchFields: ['title', 'code'],
  include: {
    department: true,
    createdBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    _count: { select: { acks: true, versions: true } },
  },
  allowedSortFields: ['createdAt', 'title', 'status'],
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub }),
});

// Acknowledge a document
router.post('/:id/ack', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ ok: false });
  const ack = await prisma.ack.upsert({
    where: { documentId_userId_version: { documentId: doc.id, userId: req.user.sub, version: doc.currentVersion } },
    update: { ackedAt: new Date() },
    create: { documentId: doc.id, userId: req.user.sub, version: doc.currentVersion },
  });
  res.json({ ok: true, item: ack });
}));

export default router;
