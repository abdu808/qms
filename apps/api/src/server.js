import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { config } from './config.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authenticate, denyReadOnly } from './middleware/auth.js';
import { auditTrail } from './middleware/audit.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import deptsRoutes from './routes/departments.js';
import objectivesRoutes from './routes/objectives.js';
import risksRoutes from './routes/risks.js';
import complaintsRoutes from './routes/complaints.js';
import ncrRoutes from './routes/ncr.js';
import auditsRoutes from './routes/audits.js';
import suppliersRoutes from './routes/suppliers.js';
import supplierEvalsRoutes from './routes/supplierEvals.js';
import donationsRoutes from './routes/donations.js';
import donationEvalsRoutes from './routes/donationEvals.js';
import beneficiariesRoutes from './routes/beneficiaries.js';
import programsRoutes from './routes/programs.js';
import surveysRoutes from './routes/surveys.js';
import documentsRoutes from './routes/documents.js';
import trainingRoutes from './routes/training.js';
import signaturesRoutes from './routes/signatures.js';
import auditLogRoutes from './routes/auditLog.js';
import dashboardRoutes from './routes/dashboard.js';
import exportsRoutes from './routes/exports.js';
import strategicGoalsRoutes from './routes/strategicGoals.js';
import operationalActivitiesRoutes from './routes/operationalActivities.js';
import swotRoutes from './routes/swot.js';
import interestedPartiesRoutes from './routes/interestedParties.js';
import processesRoutes from './routes/processes.js';
import qualityPolicyRoutes from './routes/qualityPolicy.js';
import managementReviewRoutes from './routes/managementReview.js';
import competenceRoutes from './routes/competence.js';
import communicationRoutes from './routes/communication.js';
import isoReadinessRoutes from './routes/isoReadiness.js';
import evalTokensRoutes from './routes/evalTokens.js';
import publicEvalRoutes from './routes/publicEval.js';
import publicSurveyRoutes from './routes/publicSurvey.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', apiLimiter);

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: config.appName, time: new Date().toISOString() });
});

// Redirect root to frontend login (Coolify may route / to this service)
app.get('/', (req, res) => res.redirect('/login'));

// Public
app.use('/api/auth', authRoutes);

// Public evaluation form (no auth required — token-based)
app.use('/eval', publicEvalRoutes);
// Public survey form (no auth required — open by survey ID)
app.use('/survey', publicSurveyRoutes);

// Authenticated
app.use('/api', authenticate, denyReadOnly, auditTrail());
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/departments',   deptsRoutes);
app.use('/api/objectives',    objectivesRoutes);
app.use('/api/risks',         risksRoutes);
app.use('/api/complaints',    complaintsRoutes);
app.use('/api/ncr',           ncrRoutes);
app.use('/api/audits',        auditsRoutes);
app.use('/api/suppliers',     suppliersRoutes);
app.use('/api/supplier-evals', supplierEvalsRoutes);
app.use('/api/donations',     donationsRoutes);
app.use('/api/donation-evals', donationEvalsRoutes);
app.use('/api/beneficiaries', beneficiariesRoutes);
app.use('/api/programs',      programsRoutes);
app.use('/api/surveys',       surveysRoutes);
app.use('/api/documents',     documentsRoutes);
app.use('/api/training',      trainingRoutes);
app.use('/api/signatures',    signaturesRoutes);
app.use('/api/audit-log',     auditLogRoutes);
app.use('/api/exports',                  exportsRoutes);
app.use('/api/strategic-goals',          strategicGoalsRoutes);
app.use('/api/operational-activities',   operationalActivitiesRoutes);
app.use('/api/swot',                     swotRoutes);
app.use('/api/interested-parties',       interestedPartiesRoutes);
app.use('/api/processes',                processesRoutes);
app.use('/api/quality-policy',           qualityPolicyRoutes);
app.use('/api/management-review',        managementReviewRoutes);
app.use('/api/competence',               competenceRoutes);
app.use('/api/communication',            communicationRoutes);
app.use('/api/iso-readiness',            isoReadinessRoutes);
app.use('/api/eval-tokens',             evalTokensRoutes);

// Serve frontend statically in development (for local testing)
if (config.env !== 'production') {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const webPath = join(__dir, '..', '..', 'web', 'public');
  app.use(express.static(webPath));
  app.get('/login', (req, res) => res.sendFile(join(webPath, 'index.html')));
  console.log(`[qms-api] serving frontend from ${webPath}`);
}

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[qms-api] listening on :${config.port} (${config.env})`);
});
