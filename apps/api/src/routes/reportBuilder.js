/**
 * routes/reportBuilder.js — واجهة Report Builder (MVP).
 *
 * نقاط النهاية:
 *   GET  /api/report-builder/datasets      — كتالوج الـ datasets + الحقول المسموح بها
 *   POST /api/report-builder/run           — تنفيذ تعريف تقرير → JSON (للمعاينة)
 *   POST /api/report-builder/export        — تنفيذ + CSV للتنزيل
 *
 * الصلاحية: SUPER_ADMIN / QUALITY_MANAGER / COMMITTEE_MEMBER / EXECUTIVE.
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { listDatasets, runReport, toCsv } from '../lib/reportBuilder.js';

const router = Router();

// Permissions are sourced from MATRIX['report-builder']:
//   read   → COMMITTEE_UP (COMMITTEE_MEMBER + QM + SA)
//   create → QM_UP        (running/exporting reports is a "create" action)
//   delete → SA           (delete templates if/when added)
// This mirrors the frontend PERMISSIONS table — single source of truth.

router.get('/datasets', requireAction('report-builder', 'read'), asyncHandler(async (_req, res) => {
  res.json({ ok: true, datasets: listDatasets() });
}));

router.post('/run', requireAction('report-builder', 'create'), asyncHandler(async (req, res) => {
  const result = await runReport(req.body || {});
  res.json({ ok: true, ...result });
}));

router.post('/export', requireAction('report-builder', 'create'), asyncHandler(async (req, res) => {
  const result = await runReport(req.body || {});
  const csv = toCsv(result);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = (req.body?.dataset || 'report') + '-' + stamp + '.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('X-Row-Count', String(result.total || 0));
  res.send(csv);
}));

export default router;
