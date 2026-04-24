/**
 * routes/automation.js — واجهة API لـ n8n والأتمتة الخارجية
 *
 * جميع الـ endpoints تستخدم مصادقة بسر Webhook (X-Webhook-Secret header)
 * قابلة للاستدعاء من n8n Workflows بدون جلسة مستخدم.
 *
 *  GET  /api/automation/status          — حالة النظام الكاملة (للتقرير الأسبوعي)
 *  GET  /api/automation/alerts          — التنبيهات والبنود المتأخرة
 *  GET  /api/automation/departments     — حالة كل قسم (للرسائل المخصصة)
 *  GET  /api/automation/kpi-summary     — ملخص مؤشرات الأداء
 *  POST /api/automation/weekly-report   — توليد التقرير الأسبوعي بـ AI
 *  POST /api/automation/send-alert      — إرسال تنبيه عبر n8n webhook
 */
import { Router }        from 'express';
import { asyncHandler }  from '../utils/asyncHandler.js';
import { prisma }        from '../db.js';
import { decrypt }       from '../lib/ai/crypto.js';
import { generateWeeklyReport } from '../services/automation/weeklyReport.js';
import { collectAlerts }        from '../services/automation/alertsCollector.js';
import { emitWebhookStrict }    from '../lib/webhookEmitter.js';

const router = Router();

// ── مصادقة webhook secret ──────────────────────────────────────────────────
async function getWebhookSecret() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'n8n_webhook_secret' } });
    if (!row?.value) return null;
    return row.value.startsWith('v1:') ? decrypt(row.value) : row.value;
  } catch { return null; }
}

async function requireWebhookAuth(req, res, next) {
  const provided = req.headers['x-webhook-secret'] || req.query.secret;
  const expected = await getWebhookSecret();

  // إذا لم يُعيَّن سر → reject (لا نسمح بوصول مفتوح)
  if (!expected) {
    return res.status(503).json({ ok: false, error: 'Webhook secret not configured — set it in AI Settings' });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing X-Webhook-Secret header' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /status — لقطة شاملة للنظام (للتقرير الأسبوعي)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', requireWebhookAuth, asyncHandler(async (_req, res) => {
  const [
    goalsTotal, goalsActive,
    activitiesTotal, activitiesCompleted,
    ncrsOpen, ncrsOverdue,
    capasOpen, capasOverdue,
    complaintsOpen, complaintsResolved,
    auditsPlanned, risksHigh,
    kpiCount,
  ] = await Promise.all([
    prisma.strategicGoal.count({ where: { deletedAt: null } }),
    prisma.strategicGoal.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.operationalActivity.count(),
    prisma.operationalActivity.count({ where: { status: 'COMPLETED' } }),
    prisma.nCR.count({ where: { status: { not: 'CLOSED' } } }),
    prisma.nCR.count({ where: { status: { not: 'CLOSED' }, dueDate: { lt: new Date() } } }),
    prisma.capa.count({ where: { status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
    prisma.capa.count({ where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, dueDate: { lt: new Date() } } }),
    prisma.complaint.count({ where: { status: { notIn: ['CLOSED', 'REJECTED'] } } }),
    prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.audit.count({ where: { status: 'PLANNED' } }),
    prisma.risk.count({ where: { level: { in: ['مرتفع', 'حرج'] }, status: { not: 'CLOSED' } } }),
    prisma.kpiEntry.count(),
  ]);

  // أهداف تشغيلية متأخرة
  const objectivesOverdue = await prisma.objective.count({
    where: {
      status: { notIn: ['ACHIEVED', 'CANCELLED'] },
      dueDate: { lt: new Date() },
    },
  });

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    data: {
      goals:       { total: goalsTotal, active: goalsActive },
      activities:  { total: activitiesTotal, completed: activitiesCompleted, rate: activitiesTotal ? Math.round(activitiesCompleted / activitiesTotal * 100) : 0 },
      ncrs:        { open: ncrsOpen, overdue: ncrsOverdue },
      capas:       { open: capasOpen, overdue: capasOverdue },
      complaints:  { open: complaintsOpen, resolved: complaintsResolved },
      audits:      { planned: auditsPlanned },
      risks:       { highCritical: risksHigh },
      objectives:  { overdue: objectivesOverdue },
      kpiEntries:  kpiCount,
      health: computeHealthScore({ ncrsOverdue, capasOverdue, complaintsOpen, objectivesOverdue, risksHigh }),
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  GET /alerts — التنبيهات النشطة المصنَّفة حسب الأولوية
// ─────────────────────────────────────────────────────────────────────────────
router.get('/alerts', requireWebhookAuth, asyncHandler(async (req, res) => {
  const thresholdDays = Number(req.query.thresholdDays) || 7;
  const alerts = await collectAlerts({ thresholdDays });
  res.json({ ok: true, timestamp: new Date().toISOString(), data: alerts });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  GET /departments — حالة كل قسم (للرسائل المخصصة لمديري الأقسام)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/departments', requireWebhookAuth, asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true },
  });

  const now = new Date();

  const results = await Promise.all(departments.map(async (dept) => {
    const [
      activitiesOverdue,
      ncrsOpen,
      capasOverdue,
      objectivesOverdue,
      manager,
    ] = await Promise.all([
      prisma.operationalActivity.count({
        where: { department: { contains: dept.name }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, endDate: { lt: now } },
      }),
      prisma.nCR.count({
        where: { departmentId: dept.id, status: { not: 'CLOSED' } },
      }),
      prisma.capa.count({
        where: {
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          dueDate: { lt: now },
          // CAPAs linked to NCRs in this dept
        },
      }),
      prisma.objective.count({
        where: { departmentId: dept.id, status: { notIn: ['ACHIEVED', 'CANCELLED'] }, dueDate: { lt: now } },
      }),
      prisma.user.findFirst({
        where: { departmentId: dept.id, role: { in: ['DEPT_MANAGER', 'QUALITY_MANAGER'] } },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const urgency = activitiesOverdue + ncrsOpen + capasOverdue + objectivesOverdue;
    return {
      id:   dept.id,
      name: dept.name,
      code: dept.code,
      manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
      status: {
        activitiesOverdue,
        ncrsOpen,
        capasOverdue,
        objectivesOverdue,
      },
      urgencyScore: urgency,
      priority: urgency > 5 ? 'CRITICAL' : urgency > 2 ? 'HIGH' : urgency > 0 ? 'MEDIUM' : 'OK',
    };
  }));

  // ترتيب حسب الأولوية
  results.sort((a, b) => b.urgencyScore - a.urgencyScore);

  res.json({ ok: true, timestamp: new Date().toISOString(), data: results });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  GET /kpi-summary — ملخص مؤشرات الأداء (للوحة القيادة الأسبوعية)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kpi-summary', requireWebhookAuth, asyncHandler(async (req, res) => {
  const now = new Date();
  const objectives = await prisma.objective.findMany({
    where: { status: { notIn: ['CANCELLED'] } },
    select: {
      id: true, code: true, title: true, kpi: true,
      target: true, currentValue: true, unit: true, status: true, dueDate: true,
      department: { select: { name: true } },
    },
    orderBy: { code: 'asc' },
  });

  const summary = objectives.map(o => {
    const achievement = o.target > 0 ? Math.round((o.currentValue || 0) / o.target * 100) : null;
    const isOverdue   = o.dueDate && o.dueDate < now && o.status !== 'ACHIEVED';
    return {
      code:        o.code,
      title:       o.title,
      kpi:         o.kpi,
      target:      o.target,
      current:     o.currentValue || 0,
      unit:        o.unit,
      achievement: achievement,
      status:      o.status,
      isOverdue,
      department:  o.department?.name || null,
      flag: achievement === null ? 'NO_DATA' :
            achievement >= 100   ? 'ACHIEVED' :
            achievement >= 80    ? 'ON_TRACK' :
            achievement >= 60    ? 'AT_RISK'  : 'CRITICAL',
    };
  });

  const stats = {
    total:    summary.length,
    achieved: summary.filter(o => o.flag === 'ACHIEVED').length,
    onTrack:  summary.filter(o => o.flag === 'ON_TRACK').length,
    atRisk:   summary.filter(o => o.flag === 'AT_RISK').length,
    critical: summary.filter(o => o.flag === 'CRITICAL').length,
    noData:   summary.filter(o => o.flag === 'NO_DATA').length,
    overdue:  summary.filter(o => o.isOverdue).length,
  };

  res.json({ ok: true, timestamp: new Date().toISOString(), stats, data: summary });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  POST /weekly-report — توليد التقرير الأسبوعي بـ AI (يُستدعى من n8n كل أحد)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/weekly-report', requireWebhookAuth, asyncHandler(async (req, res) => {
  const { targetAudience = 'management', language = 'ar' } = req.body || {};

  const report = await generateWeeklyReport({ targetAudience, language });

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    report,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  POST /send-alert — إرسال تنبيه عبر n8n webhook (يُستدعى من خدمات داخلية)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-alert', requireWebhookAuth, asyncHandler(async (req, res) => {
  const { type, severity, title, details, departmentId, targetEmail } = req.body || {};
  if (!type || !title) {
    return res.status(400).json({ ok: false, error: 'type و title مطلوبان' });
  }

  const result = await emitWebhookStrict('automation.alert', {
    type,
    severity:   severity || 'MEDIUM',
    title,
    details:    details || '',
    departmentId,
    targetEmail,
    timestamp:  new Date().toISOString(),
  });

  res.json({ ok: true, sent: result.ok, status: result.status });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  دالة مساعدة: حساب درجة صحة النظام
// ─────────────────────────────────────────────────────────────────────────────
function computeHealthScore({ ncrsOverdue, capasOverdue, complaintsOpen, objectivesOverdue, risksHigh }) {
  let score = 100;
  score -= Math.min(ncrsOverdue    * 5, 25);
  score -= Math.min(capasOverdue   * 5, 25);
  score -= Math.min(complaintsOpen * 2, 20);
  score -= Math.min(objectivesOverdue * 3, 15);
  score -= Math.min(risksHigh      * 3, 15);
  score = Math.max(0, score);
  return {
    score,
    label: score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : score >= 40 ? 'POOR' : 'CRITICAL',
  };
}

export default router;
