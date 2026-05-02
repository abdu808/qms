import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// ======================================
// VALIDATION SCHEMAS
// ======================================

const createFollowUpSchema = z.object({
  indicatorId: z.string().cuid(),
  departmentId: z.string().cuid(),
  dataEntryUserId: z.string().cuid(),
  performanceOwnerId: z.string().cuid().optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  dueDate: z.string().datetime(),
  previousEntryId: z.string().cuid().optional(),
});

const updateFollowUpSchema = z.object({
  qmNotes: z.string().optional(),
  status: z.enum(['PENDING', 'FIRST_NOTICE', 'ESCALATED', 'RESOLVED', 'ABORTED']).optional(),
});

const escalateFollowUpSchema = z.object({
  escalationLevel: z.number().int().min(0).max(2),
  notes: z.string().optional(),
});

// ======================================
// MIDDLEWARE
// ======================================

// Only QM, Executive Director, and Super Admin can access follow-up routes
const requireQMAccess = async (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  const allowedRoles = ['SUPER_ADMIN', 'QUALITY_MANAGER', 'EXECUTIVE_DIRECTOR'];

  if (!allowedRoles.includes(user.role)) {
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
  async (req: Request, res: Response) => {
    try {
      const {
        year,
        month,
        status,
        departmentId,
        indicatorId,
        escalationLevel,
        page = '1',
        limit = '20',
      } = req.query;

      const where: any = {};
      if (year) where.year = parseInt(year as string);
      if (month) where.month = parseInt(month as string);
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (indicatorId) where.indicatorId = indicatorId;
      if (escalationLevel) where.escalationLevel = parseInt(escalationLevel as string);

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [followUps, total] = await Promise.all([
        prisma.kpiFollowUp.findMany({
          where,
          include: {
            indicator: { select: { id: true, code: true, nameAr: true } },
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
      res.status(500).json({ error: 'Failed to fetch KPI follow-ups' });
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
  async (req: Request, res: Response) => {
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
      res.status(500).json({ error: 'Failed to fetch follow-up record' });
    }
  }
);

/**
 * GET /api/kpi-followups/stats
 * Get dashboard statistics
 */
router.get(
  '/stats/summary',
  authenticate,
  requireQMAccess,
  async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const stats = await Promise.all([
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
        totalOverdue: stats[0],
        byStatus: stats[1],
        byEscalationLevel: stats[2],
        byDepartment: stats[3],
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
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
  async (req: Request, res: Response) => {
    try {
      const validated = createFollowUpSchema.parse(req.body);

      // Check if follow-up already exists for this period
      const existing = await prisma.kpiFollowUp.findUnique({
        where: {
          indicatorId_year_month: {
            indicatorId: validated.indicatorId,
            year: validated.year,
            month: validated.month,
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
          ...validated,
          dueDate: new Date(validated.dueDate),
        },
        include: {
          indicator: true,
          department: true,
          dataEntryUser: true,
        },
      });

      res.status(201).json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: 'Failed to create follow-up record' });
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
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validated = updateFollowUpSchema.parse(req.body);

      const followUp = await prisma.kpiFollowUp.update({
        where: { id },
        data: validated,
        include: {
          indicator: true,
          department: true,
          dataEntryUser: true,
        },
      });

      res.json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
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
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validated = escalateFollowUpSchema.parse(req.body);
      const user = (req as any).user;

      const followUp = await prisma.kpiFollowUp.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          escalationLevel: validated.escalationLevel,
          escalatedAt: new Date(),
          escalatedById: user.id,
          qmNotes: validated.notes
            ? `[${new Date().toISOString()}] Escalated: ${validated.notes}`
            : undefined,
        },
        include: {
          indicator: true,
          escalatedBy: true,
        },
      });

      res.json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
      res.status(500).json({ error: 'Failed to delete follow-up' });
    }
  }
);

export default router;
