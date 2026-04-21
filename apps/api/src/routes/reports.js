/**
 * تقارير الطباعة — router رئيسي
 * ISO 9001:2015 — جمعية البر بصبيا
 */
import { Router } from 'express';
import complianceReportsRoutes from './reports/complianceReports.js';
import operationalReportsRoutes from './reports/operationalReports.js';
import isoAuditReportRoutes from './reports/isoAuditReport.js';

const router = Router();
router.use('/', complianceReportsRoutes);
router.use('/', operationalReportsRoutes);
router.use('/', isoAuditReportRoutes);
export default router;
