import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

import { config } from './config.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authenticate, denyReadOnly } from './middleware/auth.js';
import { auditTrail } from './middleware/audit.js';
import { issueCsrfCookie, verifyCsrf } from './middleware/csrf.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import deptsRoutes from './routes/departments.js';
import objectivesRoutes from './routes/objectives.js';
import risksRoutes from './routes/risks.js';
import complaintsRoutes from './routes/complaints.js';
import ncrRoutes from './routes/ncr.js';
import capaRoutes from './routes/capa.js';
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
import chartsRoutes from './routes/charts.js';
import exportsRoutes from './routes/exports.js';
import strategicGoalsRoutes from './routes/strategicGoals.js';
import strategicPlansRoutes from './routes/strategicPlans.js';
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
import reportsRoutes from './routes/reports.js';
import operationalReportsRoutes from './routes/operationalReports.js';
import kpiRoutes from './routes/kpi.js';
import publicEvalRoutes from './routes/publicEval.js';
import publicSurveyRoutes from './routes/publicSurvey.js';
import publicAckRoutes from './routes/publicAck.js';
import policyAckRoutes from './routes/policyAck.js';
import performanceReviewsRoutes from './routes/performanceReviews.js';
import improvementProjectsRoutes from './routes/improvementProjects.js';
import auditChecklistsRoutes from './routes/auditChecklists.js';
import notificationsRoutes from './routes/notifications.js';
import alertsRoutes from './routes/alerts.js';
import stateMachinesRoutes from './routes/stateMachines.js';
import ackDocumentsRoutes from './routes/ackDocuments.js';
import dataHealthRoutes from './routes/dataHealth.js';
import slaRoutes from './routes/sla.js';
import importRoutes from './routes/import.js';
import myWorkRoutes from './routes/myWork.js';
import schedulerRoutes from './routes/scheduler.js';
import reportBuilderRoutes from './routes/reportBuilder.js';
import publicPortalRoutes from './routes/publicPortal.js';
import portalAdminRoutes from './routes/portalAdmin.js';
import metaRoutes from './routes/meta.js';
import webhookSettingsRoutes from './routes/webhookSettings.js';
import aiSettingsRoutes from './routes/aiSettings.js';
import consultantRoutes from './routes/consultant.js';
import consultSessionsRouter from './routes/consultSessions.js';
import automationRoutes from './routes/automation.js';
import progressReportsRoutes from './routes/progressReports.js';
import integrationRoutes from './routes/integration.js';
import axesRoutes          from './routes/axes.js';
import indicatorsRoutes    from './routes/indicators.js';
import annualTargetsRoutes from './routes/annual-targets.js';
import initiativesRoutes   from './routes/initiatives.js';
import fundingSourcesRoutes from './routes/funding-sources.js';
import fundingPlansRoutes  from './routes/funding-plans.js';
import planVersionsRoutes  from './routes/plan-versions.js';
import changeRequestsRoutes from './routes/change-requests.js';
import followUpTasksRoutes  from './routes/follow-up-tasks.js';
import auditFindingsRoutes  from './routes/audit-findings.js';
import { startScheduler } from './lib/scheduler.js';

// ── مُعالجات عالمية للأخطاء والإشارات ────────────────────────────────────
// Node.js v20+ يُنهي العملية عند أي rejected promise بدون handler.
// نُسجّل الخطأ ونبقى نشطين — الخادم يجب أن يعمل حتى في مواجهة الأخطاء غير المتوقعة.
// سياسة موصى بها: سجّل + أغلق بنعومة + اترك مديراً خارجياً (Docker/Coolify) يُعيد التشغيل.
// الحالة بعد استثناء غير ملتقَط قد تكون فاسدة — الاستمرار خطر.
let _shuttingDown = false;
function gracefulShutdown(reason, err) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.error(`[server] fatal ${reason} — graceful shutdown:`, err?.stack || err?.message || err);
  // امنح الطلبات الجارية 10 ثوانٍ للانتهاء قبل الخروج
  setTimeout(() => process.exit(1), 10_000).unref();
  try {
    if (typeof _httpServer?.close === 'function') _httpServer.close(() => process.exit(1));
  } catch {
    process.exit(1);
  }
}
process.on('unhandledRejection', (reason) => gracefulShutdown('unhandledRejection', reason));
process.on('uncaughtException',  (err)    => gracefulShutdown('uncaughtException',  err));

// ── تسجيل سبب الخروج (يساعد في تشخيص SIGTERM/SIGKILL) ──────────────────
process.on('exit', (code) => {
  console.error(`[server] process exiting — code=${code} uptime=${Math.round(process.uptime())}s`);
});
// SIGTERM: يُرسَل من Docker/Coolify عند إيقاف الحاوية — نُسجّل ونخرج بنعومة
process.on('SIGTERM', () => {
  console.error('[server] received SIGTERM — graceful shutdown');
  process.exit(0);
});
// SIGINT: Ctrl+C في التطوير
process.on('SIGINT', () => {
  console.error('[server] received SIGINT — graceful shutdown');
  process.exit(0);
});

const app = express();

app.set('trust proxy', 1);
const isProduction = config.env === 'production';
// ── Content-Security-Policy ──────────────────────────────────────────────
// نسمح فقط لنطاق الموقع + CDNs المستخدمة في الواجهة (Tailwind, Alpine, Chart.js, Google Fonts).
// report-only في التطوير كي لا تكسر التجربة، تنفيذ صارم في الإنتاج.
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  // 'unsafe-inline' لازمة دائماً لـ Alpine.js (x-data/x-init) + Tailwind play-CDN.
  // 'unsafe-eval' لازمة أيضاً — Alpine.js v3 يستخدم new AsyncFunction() داخلياً لتقييم
  // x-data/:class/@click وغيرها. حجبها في production يكسر الواجهة كلياً.
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",  // Alpine.js v3 requires AsyncFunction — cannot be removed
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net',
    'https://static.cloudflareinsights.com',  // Cloudflare Web Analytics (injected by proxy)
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net',
  ],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: isProduction ? [] : null,
};
// helmet يقبل null-removal تلقائياً لو حذفنا المفتاح
if (!CSP_DIRECTIVES.upgradeInsecureRequests) delete CSP_DIRECTIVES.upgradeInsecureRequests;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: CSP_DIRECTIVES,
    reportOnly: config.env !== 'production',
  },
  crossOriginEmbedderPolicy: false,  // نحتاج أصول من CDN
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // HSTS: يُجبر المتصفحات على HTTPS لمدة سنة + includeSubDomains — إنتاج فقط
  hsts: config.env === 'production' ? {
    maxAge: 31_536_000,
    includeSubDomains: true,
    preload: false,
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
// Body size: default 1MB — كافٍ لمعظم POST JSON. uploads المُلفات تذهب عبر multer بحدّها الخاص.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Request-ID middleware: يضيف X-Request-Id لكل طلب — يسهّل التتبّع عبر logs ──
// Regex validates client-supplied header to prevent log injection (CWE-117).
// Only alphanumeric + safe punctuation, max 80 chars. Invalid → server-generated UUID.
const SAFE_REQUEST_ID_RE = /^[a-zA-Z0-9._:\-]{1,80}$/;
app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.id = (incoming && SAFE_REQUEST_ID_RE.test(incoming)) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// morgan: أضف request-id إلى السجل
morgan.token('rid', (req) => req.id || '-');
const logFmt = config.env === 'production'
  ? ':remote-addr - :method :url :status :res[content-length] - :response-time ms rid=:rid'
  : 'dev';
app.use(morgan(logFmt));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', apiLimiter);

// ═══ Rate limiters for PUBLIC token-based endpoints (no auth) ═══
// These endpoints must be defended against: token enumeration, DoS, survey flooding.
// Kept moderately permissive to allow legitimate retries, strict enough to block brute force.
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,  // 4/min per IP — generous for retries but blocks enumeration
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'عدد كبير من الطلبات. حاول بعد قليل.' },
});
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,  // 10 submissions/hour per IP — sufficient for family/office shared IPs
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'تم تجاوز الحد المسموح. حاول بعد ساعة.' },
});
// Smaller body limit for public endpoints — block bloat-DoS
const publicBodyLimit = express.json({ limit: '100kb' });
const publicUrlEncoded = express.urlencoded({ extended: true, limit: '100kb' });

// Anti-clickjacking + no-referrer leak on public pages
function publicSecurityHeaders(_req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// ──────────────────────────────────────────────────────────────
// Slow-request observability — surfaces 1s+ endpoints in Logs
// so we spot latency regressions without an APM.
// ──────────────────────────────────────────────────────────────
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    if (ms >= SLOW_REQUEST_MS && req.url.startsWith('/api/')) {
      console.warn(`[slow-req] ${req.method} ${req.url} ${ms}ms → ${res.statusCode}`);
    }
  });
  next();
});

// robots.txt — منع فهرسة منطقة التطبيق الداخلي (/qms, /api). البوابة العامة '/' مفتوحة.
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    'User-agent: *',
    'Disallow: /qms',
    'Disallow: /api',
    'Disallow: /eval',
    'Disallow: /ack',
    'Allow: /',
  ].join('\n'));
});

// security.txt — RFC 9116. البريد والبوليسي من env لتجنّب hard-coding.
app.get(['/.well-known/security.txt', '/security.txt'], (_req, res) => {
  const contact = process.env.SECURITY_CONTACT || 'mailto:admin@bir-sabia.org.sa';
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  res.type('text/plain').send([
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    'Preferred-Languages: ar, en',
  ].join('\n'));
});

// Health — shallow liveness (fast, used by Coolify/Docker healthcheck probes)
// يُرجع 503 أثناء startup.sh (قبل اكتمال migrate + seed)، ثم 200 بعدها.
app.get('/api/health', (req, res) => {
  if (!existsSync('/tmp/startup-complete')) {
    return res.status(503).json({ ok: false, status: 'starting' });
  }
  res.json({ ok: true, app: config.appName, time: new Date().toISOString() });
});

// Health — deep check. يُرجع 200 فقط إذا: (1) اكتمل startup، (2) DB تستجيب على SELECT 1.
// 503 = startup لم يكتمل بعد، 500 = فشل اتصال DB.
// هذا هو المسار المقترح لـ Coolify healthcheck بدلاً من /api/health السطحي.
app.get('/api/health/deep', async (req, res) => {
  if (!existsSync('/tmp/startup-complete')) {
    return res.status(503).json({ ok: false, status: 'starting', db: 'unknown' });
  }
  const t0 = Date.now();
  try {
    const { prisma } = await import('./db.js');
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({
      ok: true,
      status: 'ready',
      db: 'ok',
      ms: Date.now() - t0,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: 'db_error',
      db: 'error',
      error: err.message?.split('\n')[0] || 'unknown',
      ms: Date.now() - t0,
      time: new Date().toISOString(),
    });
  }
});

// Health — deep readiness. Verifies the DB actually responds.
// If this returns 503, Coolify's healthcheck should restart the container.
app.get('/api/health/ready', async (req, res) => {
  const t0 = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [{ prisma }] = await Promise.all([import('./db.js')]);
    await prisma.$queryRawUnsafe('SELECT 1');
    const mem = process.memoryUsage();
    res.json({
      ok: true,
      db: 'ok',
      ms: Date.now() - t0,
      uptime: Math.round(process.uptime()),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB:  Math.round(mem.rss / 1024 / 1024),
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: 'error',
      error: err.message?.split('\n')[0] || 'unknown',
      ms: Date.now() - t0,
      time: new Date().toISOString(),
    });
  }
});

// الصفحة الأساسية '/' تخدم SPA مباشرة (لا إعادة توجيه إلى /login)
// الـ SPA يعرض شاشة تسجيل الدخول داخلياً إن لم يكن المستخدم مصادَقاً، ثم يعرض التطبيق.

// Public
app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);

// Public evaluation form (no auth required — token-based)
app.use('/eval',
  publicSecurityHeaders,
  publicReadLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicEvalRoutes,
);
// Public survey form (no auth required — open by survey ID)
// Uses stricter submit limiter since no token guards it.
app.use('/survey',
  publicSecurityHeaders,
  publicSubmitLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicSurveyRoutes,
);
// Public acknowledgment page (token-based personal links sent via WhatsApp/SMS/email)
app.use('/ack',
  publicSecurityHeaders,
  publicReadLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicAckRoutes,
);
// Public portal — no auth, serves portal content (announcements, docs, surveys, policy)
app.use('/api/public',
  publicSecurityHeaders,
  publicReadLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicPortalRoutes,
);

// Authenticated — بعد authenticate نضمن أن طلبات mutations تحمل CSRF token صالح
app.use('/api', authenticate, denyReadOnly, issueCsrfCookie, verifyCsrf, auditTrail());
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/charts',        chartsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/departments',   deptsRoutes);
app.use('/api/objectives',    objectivesRoutes);
app.use('/api/risks',         risksRoutes);
app.use('/api/complaints',    complaintsRoutes);
app.use('/api/ncr',           ncrRoutes);
app.use('/api/capa',          capaRoutes);
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
app.use('/api/strategic-plans',          strategicPlansRoutes);
app.use('/api/strategic-goals',          strategicGoalsRoutes);
app.use('/api/operational-activities',   operationalActivitiesRoutes);
app.use('/api/swot',                     swotRoutes);
app.use('/api/interested-parties',       interestedPartiesRoutes);
app.use('/api/processes',                processesRoutes);
app.use('/api/quality-policy',           qualityPolicyRoutes);
app.use('/api/policy-ack',               policyAckRoutes);
app.use('/api/performance-reviews',      performanceReviewsRoutes);
app.use('/api/improvement-projects',     improvementProjectsRoutes);
app.use('/api/audit-checklists',         auditChecklistsRoutes);
app.use('/api/notifications',            notificationsRoutes);
app.use('/api/alerts',                   alertsRoutes);
app.use('/api/state-machines',           stateMachinesRoutes);
app.use('/api/ack-documents',            ackDocumentsRoutes);
app.use('/api/data-health',              dataHealthRoutes);
app.use('/api/sla',                       slaRoutes);
app.use('/api/import',                   importRoutes);
app.use('/api/my-work',                   myWorkRoutes);
app.use('/api/scheduler',                 schedulerRoutes);
app.use('/api/report-builder',            reportBuilderRoutes);
app.use('/api/portal',                   portalAdminRoutes);
app.use('/api/webhook-settings',         webhookSettingsRoutes);
app.use('/api/automation',              automationRoutes);
app.use('/api/ai-settings',              aiSettingsRoutes);
app.use('/api/consultant',               consultantRoutes);
app.use('/api/consult-sessions',         consultSessionsRouter);
app.use('/api/progress-reports',         progressReportsRoutes);
app.use('/api/management-review',        managementReviewRoutes);
app.use('/api/competence',               competenceRoutes);
app.use('/api/communication',            communicationRoutes);
app.use('/api/iso-readiness',            isoReadinessRoutes);
app.use('/api/eval-tokens',             evalTokensRoutes);
app.use('/api/reports',                 reportsRoutes);
app.use('/api/operational-reports',     operationalReportsRoutes);
app.use('/api/kpi',                     kpiRoutes);
app.use('/api/integration',             integrationRoutes);

// ── Strategic Planning v2 ─────────────────────────────────────────────
app.use('/api/axes',            axesRoutes);
app.use('/api/indicators',      indicatorsRoutes);
app.use('/api/annual-targets',  annualTargetsRoutes);
app.use('/api/initiatives',     initiativesRoutes);
app.use('/api/funding-sources', fundingSourcesRoutes);
app.use('/api/funding-plans',   fundingPlansRoutes);
app.use('/api/plan-versions',   planVersionsRoutes);
app.use('/api/change-requests', changeRequestsRoutes);
app.use('/api/follow-up-tasks', followUpTasksRoutes);
app.use('/api/audit-findings',  auditFindingsRoutes);

// ── فحص تفعيل البوابة العامة (cached 60s لتخفيف ضغط DB) ───────────────────
let _portalEnabledCache = null;
let _portalCacheAt = 0;
async function isPortalEnabled() {
  const now = Date.now();
  if (_portalEnabledCache !== null && now - _portalCacheAt < 60_000) return _portalEnabledCache;
  try {
    const { prisma } = await import('./db.js');
    const s = await prisma.portalSettings.findUnique({ where: { id: 'default' } });
    _portalEnabledCache = s?.portalEnabled ?? false;
  } catch { _portalEnabledCache = false; }
  _portalCacheAt = Date.now();
  return _portalEnabledCache;
}
/** يبطل الـ cache فور تغيير الإعداد من لوحة الإدارة */
export function invalidatePortalCache() { _portalEnabledCache = null; }

// Serve frontend statically in all environments.
// Coolify قد يُوجّه الترافيك مباشرة إلى الـ API بدل nginx — لذا نخدم الـ SPA هنا أيضاً.
{
  const __dir = dirname(fileURLToPath(import.meta.url));
  const webPath = join(__dir, '..', '..', 'web', 'public');
  if (existsSync(webPath)) {
    app.use(express.static(webPath, {
      setHeaders: (res, path) => {
        if (/\.(html|js|css)$/.test(path)) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
      },
    }));
    // البوابة العامة: مفعَّلة/معطَّلة حسب portalSettings.portalEnabled
    app.get('/', async (req, res) => {
      try {
        const enabled = await isPortalEnabled();
        if (enabled && existsSync(join(webPath, 'portal.html'))) {
          return res.sendFile(join(webPath, 'portal.html'));
        }
      } catch { /* fallthrough to redirect */ }
      res.redirect(302, '/qms');
    });
    // النظام الداخلي على /qms
    app.get(['/qms', '/qms/*'], (req, res) => res.sendFile(join(webPath, 'index.html')));
    // Backward-compat: روابط قديمة /login و /app → redirect دائم → /qms
    app.get(['/login', '/app'], (req, res) => res.redirect(301, '/qms'));
    console.log(`[qms-api] serving frontend from ${webPath}`);
  } else {
    console.log(`[qms-api] frontend path not found (${webPath}) — skipping static serving`);
  }
}

app.use(notFound);
app.use(errorHandler);

// Export the app for integration tests (supertest). In production this file
// is the main entry — it starts listening only when NOT imported as a module
// test (NODE_ENV='test' or QMS_NO_LISTEN='1' suppress listen).
export { app };

let _httpServer = null;
if (process.env.NODE_ENV !== 'test' && process.env.QMS_NO_LISTEN !== '1') {
  _httpServer = app.listen(config.port, () => {
    console.log(`[qms-api] listening on :${config.port} (${config.env})`);
    startScheduler();
  });
}
