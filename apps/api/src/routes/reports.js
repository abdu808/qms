/**
 * تقارير الطباعة — router رئيسي
 * ISO 9001:2015 — جمعية البر بصبيا
 */
import { Router } from 'express';
import { requireAction } from '../lib/permissions.js';
import complianceReportsRoutes from './reports/complianceReports.js';
import operationalReportsRoutes from './reports/operationalReports.js';
import isoAuditReportRoutes from './reports/isoAuditReport.js';
import strategicReportsRoutes from './reports/strategicReports.js';

const router = Router();
router.use(requireAction('reports', 'read'));
router.use('/', complianceReportsRoutes);
router.use('/', operationalReportsRoutes);
router.use('/', isoAuditReportRoutes);
router.use('/', strategicReportsRoutes);
export default router;
