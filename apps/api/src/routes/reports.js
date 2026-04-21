/**
 * تقارير الطباعة — router رئيسي
 * ISO 9001:2015 — جمعية البر بصبيا
 */
import { Router } from 'express';
import complianceReportsRoutes from './reports/complianceReports.js';
import operationalReportsRoutes from './reports/operationalReports.js';

const router = Router();
router.use('/', complianceReportsRoutes);
router.use('/', operationalReportsRoutes);
export default router;
