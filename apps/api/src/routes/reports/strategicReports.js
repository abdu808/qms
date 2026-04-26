/**
 * strategicReports.js — تقارير الخطة الاستراتيجية وبطاقة الأداء المتوازن
 * جمعية البر بمحافظة صبيا — ISO 9001:2015
 *
 * Routes:
 *   GET /api/reports/bsc?planId=X&year=2026
 *   GET /api/reports/management-review-v2/:id
 *   GET /api/reports/strategic-plan/:id?year=2026
 */

import { Router } from 'express';
import { prisma } from '../../db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { BadRequest } from '../../utils/errors.js';
import { generateBscReport } from '../../services/reports/bsc.js';
import { generateManagementReviewReport } from '../../services/reports/managementReview.js';
import { generateStrategicPlanReport } from '../../services/reports/strategicPlan.js';

const router = Router();

// ─── BSC Report ─────────────────────────────────────────────────────────────
// GET /api/reports/bsc?planId=X&year=2026
router.get('/bsc', asyncHandler(async (req, res) => {
  const { planId, year } = req.query;
  if (!planId) throw BadRequest('planId مطلوب');

  const currentYear = Number(year) || new Date().getFullYear();
  const html = await generateBscReport(prisma, { planId, year: currentYear });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── Management Review Report (v2 — محسَّن بـ Noto Kufi + هجري) ─────────────
// GET /api/reports/management-review-v2/:id
// (v2 لتجنب التعارض مع /management-review/:id في complianceReports.js)
router.get('/management-review-v2/:id', asyncHandler(async (req, res) => {
  const html = await generateManagementReviewReport(prisma, { id: req.params.id });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── Strategic Plan Report ───────────────────────────────────────────────────
// GET /api/reports/strategic-plan/:id?year=2026
router.get('/strategic-plan/:id', asyncHandler(async (req, res) => {
  const planId = req.params.id;
  const year = Number(req.query.year) || new Date().getFullYear();
  const html = await generateStrategicPlanReport(prisma, { planId, year });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
