/**
 * routes/kpiFollowUp.js — نظام متابعة الإدخالات المتأخرة
 * سجل متابعة الإدخالات المتأخرة للمؤشرات
 */
import express from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ======================================
// MIDDLEWARE
// ======================================

// Only QM and Super Admin can access follow-up routes
const requireQMAccess = async (req, res, next) => {
  const user = req.user;
  const allowedRoles = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for KPI Follow-Up access' });
  }
  next();
};

// ======================================
// ROUTES
// ======================================

/**
 * GET /api/kpi-followups
 * List all KPI follow-ups with filtering
 */
router.get(
  '/',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const {
        year,
        month,
        status,
        departmentId,
        indicatorId,
        escalationLevel,
        page = '1',
        limit = '100',
      } = req.query;

      const where = {};
      if (year) where.year = parseInt(year);
      if (month) where.month = parseInt(month);
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (indicatorId) where.indicatorId = indicatorId;
      if (escalationLevel) where.escalationLevel = parseInt(escalationLevel);

      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 100;
      const skip = (pageNum - 1) * limitNum;

      const [followUps, total] = await Promise.all([
        prisma.kpiFollowUp.findMany({
          where,
          include: {
            indicator: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            department: { select: { id: true, code: true, name: true } },
            dataEntryUser: { select: { id: true, name: true, email: true } },
            performanceOwner: { select: { id: true, name: true, email: true } },
            previousEntry: true,
            resolvedEntry: true,
            escalatedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { dueDate: 'asc' },
          skip,
          take: limitNum,
        }),
        prisma.kpiFollowUp.count({ where }),
      ]);

      res.json({
        data: followUps,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('GET /kpi-followups error:', error);
      res.status(500).json({ error: 'Failed to fetch KPI follow-ups', details: error.message });
    }
  }
);

/**
 * GET /api/kpi-followups/stats/summary
 * Get dashboard statistics
 */
router.get(
  '/stats/summary',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const [totalOverdue, byStatus, byEscalationLevel, byDepartment] = await Promise.all([
        // Total overdue
        prisma.kpiFollowUp.count({
          where: {
            status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] },
            year: currentYear,
            month: currentMonth,
          },
        }),
        // By status
        prisma.kpiFollowUp.groupBy({
          by: ['status'],
          where: { year: currentYear, month: currentMonth },
          _count: true,
        }),
        // By escalation level
        prisma.kpiFollowUp.groupBy({
          by: ['escalationLevel'],
          where: { status: { in: ['ESCALATED'] }, year: currentYear, month: currentMonth },
          _count: true,
        }),
        // By department
        prisma.kpiFollowUp.groupBy({
          by: ['departmentId'],
          where: { status: { in: ['PENDING', 'FIRST_NOTICE', 'ESCALATED'] }, year: currentYear, month: currentMonth },
          _count: true,
        }),
      ]);

      res.json({
        period: { year: currentYear, month: currentMonth },
        totalOverdue,
        byStatus,
        byEscalationLevel,
        byDepartment,
      });
    } catch (error) {
      console.error('GET /stats/summary error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

/**
 * GET /api/kpi-followups/:id
 * Get a specific follow-up record
 */
router.get(
  '/:id',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const { id } = req.params;

      const followUp = await prisma.kpiFollowUp.findUnique({
        where: { id },
        include: {
          indicator: true,
          department: true,
          dataEntryUser: true,
          performanceOwner: true,
          previousEntry: true,
          resolvedEntry: true,
          escalatedBy: true,
        },
      });

      if (!followUp) {
        return res.status(404).json({ error: 'Follow-up record not found' });
      }

      res.json(followUp);
    } catch (error) {
      console.error('GET /kpi-followups/:id error:', error);
      res.status(500).json({ error: 'Failed to fetch follow-up record' });
    }
  }
);

/**
 * POST /api/kpi-followups
 * Create a new follow-up record
 */
router.post(
  '/',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const {
        indicatorId,
        departmentId,
        dataEntryUserId,
        performanceOwnerId,
        year,
        month,
        dueDate,
        previousEntryId,
      } = req.body;

      // Check if follow-up already exists for this period
      const existing = await prisma.kpiFollowUp.findUnique({
        where: {
          indicatorId_year_month: {
            indicatorId,
            year: parseInt(year),
            month: parseInt(month),
          },
        },
      });

      if (existing) {
        return res.status(409).json({ error: 'Follow-up already exists for this period' });
      }

      // Generate code
      const count = await prisma.kpiFollowUp.count();
      const code = `KFU-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const followUp = await prisma.kpiFollowUp.create({
        data: {
          code,
          indicatorId,
          departmentId,
          dataEntryUserId,
          performanceOwnerId,
          year: parseInt(year),
          month: parseInt(month),
          dueDate: new Date(dueDate),
          previousEntryId,
        },
        include: {
          indicator: true,
          department: true,
          dataEntryUser: true,
        },
      });

      res.status(201).json(followUp);
    } catch (error) {
      console.error('POST /kpi-followups error:', error);
      res.status(500).json({ error: 'Failed to create follow-up record', details: error.message });
    }
  }
);

/**
 * PATCH /api/kpi-followups/:id
 * Update follow-up record
 */
router.patch(
  '/:id',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { qmNotes, status } = req.body;

      const data = {};
      if (qmNotes !== undefined) data.qmNotes = qmNotes;
      if (status !== undefined) data.status = status;

      const followUp = await prisma.kpiFollowUp.update({
        where: { id },
        data,
        include: {
          indicator: true,
          department: true,
          dataEntryUser: true,
        },
      });

      res.json(followUp);
    } catch (error) {
      console.error('PATCH /kpi-followups/:id error:', error);
      res.status(500).json({ error: 'Failed to update follow-up record' });
    }
  }
);

/**
 * POST /api/kpi-followups/:id/escalate
 * Escalate a follow-up to next level
 */
router.post(
  '/:id/escalate',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { escalationLevel, notes } = req.body;
      const user = req.user;

      const followUp = await prisma.kpiFollowUp.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          escalationLevel: parseInt(escalationLevel || 1),
          escalatedAt: new Date(),
          escalatedById: user.id,
          qmNotes: notes
            ? `[${new Date().toISOString()}] Escalated: ${notes}`
            : undefined,
        },
        include: {
          indicator: true,
          escalatedBy: true,
        },
      });

      res.json(followUp);
    } catch (error) {
      console.error('POST /escalate error:', error);
      res.status(500).json({ error: 'Failed to escalate follow-up' });
    }
  }
);

/**
 * POST /api/kpi-followups/:id/resolve
 * Mark a follow-up as resolved
 */
router.post(
  '/:id/resolve',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { resolvedEntryId } = req.body;

      const followUp = await prisma.kpiFollowUp.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedEntryId: resolvedEntryId || undefined,
        },
        include: {
          resolvedEntry: true,
        },
      });

      res.json(followUp);
    } catch (error) {
      console.error('POST /resolve error:', error);
      res.status(500).json({ error: 'Failed to resolve follow-up' });
    }
  }
);

/**
 * DELETE /api/kpi-followups/:id
 * Delete a follow-up record (soft delete)
 */
router.delete(
  '/:id',
  authenticate,
  requireQMAccess,
  async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.kpiFollowUp.update({
        where: { id },
        data: {
          status: 'ABORTED',
        },
      });

      res.json({ message: 'Follow-up marked as aborted' });
    } catch (error) {
      console.error('DELETE error:', error);
      res.status(500).json({ error: 'Failed to delete follow-up' });
    }
  }
);

export default router;
