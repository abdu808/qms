import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

// ─── Beneficiary Journey: programs + donations + assessments ───
router.get('/beneficiary/:id/journey', requireAction('beneficiaries', 'read'), asyncHandler(async (req, res) => {
  const ben = await prisma.beneficiary.findUnique({
    where: { id: req.params.id },
    include: {
      caseManager:   { select: { id: true, name: true } },
      benDepartment: { select: { id: true, name: true } },
      programs: {
        include: { program: { select: { id: true, code: true, name: true, category: true, status: true } } },
        orderBy: { enrolledAt: 'desc' },
      },
      donationsReceived: {
        orderBy: { receivedAt: 'desc' },
        select: { id: true, code: true, type: true, amount: true, itemName: true, receivedAt: true, status: true },
      },
    },
  });
  if (!ben) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, beneficiary: ben });
}));

// ─── Process Health: objectives + risks + KPIs + audits ───
router.get('/process/:id/health', requireAction('processes', 'read'), asyncHandler(async (req, res) => {
  const proc = await prisma.process.findUnique({
    where: { id: req.params.id },
    include: {
      ownerUser:         { select: { id: true, name: true } },
      processDepartment: { select: { id: true, name: true } },
      processObjectives: { include: { objective: { select: { id: true, code: true, title: true, status: true, progress: true } } } },
      processRisks:      { include: { risk: { select: { id: true, code: true, title: true, level: true, status: true } } } },
      processIndicators: { include: { indicator: { select: { id: true, code: true, nameAr: true, weight: true } } } },
      audits:            { take: 5, orderBy: { plannedDate: 'desc' }, select: { id: true, code: true, title: true, status: true, actualDate: true } },
    },
  });
  if (!proc) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, process: proc });
}));

// ─── Program Performance: beneficiaries + donations + financials ───
router.get('/program/:id/performance', requireAction('programs', 'read'), asyncHandler(async (req, res) => {
  const prog = await prisma.program.findUnique({
    where: { id: req.params.id },
    include: {
      programDepartment: { select: { id: true, name: true } },
      manager:           { select: { id: true, name: true } },
      beneficiaries:     { include: { beneficiary: { select: { id: true, code: true, fullName: true, status: true } } } },
      donations: {
        include: { donation: { select: { id: true, code: true, amount: true, donorName: true, type: true } } },
      },
    },
  });
  if (!prog) return res.status(404).json({ ok: false, error: 'Not found' });
  // Calculate financials
  const totalReceived = prog.donations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  res.json({ ok: true, program: { ...prog, financials: { totalReceived, budget: prog.budget, spent: prog.spent } } });
}));

// ─── User Competence Profile ───
router.get('/user/:id/competence', requireAction('competence', 'read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      department: { select: { id: true, name: true } },
      trainingRecords: {
        include: { training: { select: { id: true, code: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      },
      performanceReviewsAsEmployee: {
        select: { id: true, code: true, period: true, overallRating: true, status: true },
        orderBy: { periodEnd: 'desc' },
        take: 3,
      },
    },
  });
  if (!user) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, profile: user });
}));

export default router;
