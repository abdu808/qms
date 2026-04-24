/**
 * services/consultantAgent.js — المستشار الاستراتيجي الذكي (v2)
 *
 * التغييرات عن v1:
 *   ✅ حساب خدمة مخصص للـ AI (AI_AGENT_USER_ID) — لتتبع الإجراءات في سجل المراجعة
 *   ✅ Native tool_use — AI يستدعي أدوات رسمية بدلاً من JSON في النص
 *   ✅ Agentic loop — AI يرى نتائج أدواته ويواصل تلقائياً دون "تابع"
 *   ✅ مسار واضح: AI → tool → Prisma → نتيجة → AI
 *   ✅ صلاحيات مفوَّضة: AI يستخدم صلاحيات QUALITY_MANAGER
 *
 * الواجهة العامة:
 *   buildContext()              — لقطة حالية للـ /context endpoint
 *   chat({ messages, callerUserId }) — محادثة مع AI + تنفيذ أدوات
 *   applyActions(actions, userId)   — مسار التوافق للأمام (legacy)
 */
import { prisma } from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runAgentLoop, applyPendingActions } from './aiAgent/loop.js';
import { executeTool }  from './aiAgent/tools.js';
import { getAiSettings } from '../lib/ai/settings.js';
import { routeRequest } from './aiAgent/router.js';

// ── تحميل ملف المعرفة المؤسسية (مرة واحدة عند الإقلاع) ────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
let _orgKnowledge = '';
try {
  _orgKnowledge = readFileSync(join(__dirname, 'aiAgent/org-knowledge.md'), 'utf8');
} catch {
  console.warn('⚠️  org-knowledge.md غير موجود — سيعمل المستشار بدون سياق مؤسسي');
}

/** حساب خدمة المستشار — يُحمَّل مرة واحدة ويُخزَّن */
let _aiAgentUserId = null;

/** مُصدَّرة للـ route (apply-pending) */
export async function getAiAgentUserIdInternal() { return getAiAgentUserId(); }

async function getAiAgentUserId() {
  if (_aiAgentUserId) return _aiAgentUserId;

  // أولاً: من متغير البيئة
  if (process.env.AI_AGENT_USER_ID) {
    _aiAgentUserId = process.env.AI_AGENT_USER_ID;
    return _aiAgentUserId;
  }

  // ثانياً: من قاعدة البيانات (fallback)
  const agent = await prisma.user.findUnique({
    where: { email: 'ai-agent@qms.local' },
    select: { id: true },
  });

  if (agent) {
    _aiAgentUserId = agent.id;
    return _aiAgentUserId;
  }

  // لا يوجد — استخدم null (سيُسجَّل بدون userId)
  console.warn('⚠️  AI_AGENT_USER_ID غير مُعيَّن — شغِّل: node scripts/seed-ai-agent.mjs');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  System Prompt — شخصية المستشار (v2: نص أقصر وأوضح — الأدوات تتكلم عن نفسها)
// ─────────────────────────────────────────────────────────────────────────────

// ملف المعرفة يُضاف إلى نهاية الـ system prompt عند البناء
const buildSystemPrompt = () => {
  const knowledgeSection = _orgKnowledge
    ? `\n\n━━━ قاعدة المعرفة المؤسسية ━━━\n${_orgKnowledge}`
    : '';
  return BASE_SYSTEM_PROMPT + knowledgeSection;
};

const BASE_SYSTEM_PROMPT = `أنت "المستشار الاستراتيجي للجودة" لجمعية بر خيرية تطبِّق ISO 9001:2015.

دورك: مدير عمليات افتراضي — تُراقب الخطة، تُقيِّم الأداء، تتابع المؤشرات، تكشف النقائص، وتتخذ الإجراءات اللازمة.

━━━ قواعد العمل ━━━

① اقرأ أولاً
  ابدأ بـ get_system_state لمعرفة الوضع الراهن قبل أي إجراء.
  يدعم: goals, activities, objectives, users, departments, risks, ncrs, capas, audits, complaints, management_reviews, trainings, gaps

② حلِّل ولا تكتفِ بالوصف
  لا تقل فقط "يوجد 3 NCRs" — قل "NCR-003 متأخر 45 يوماً بدون إجراء، يجب تصعيده".
  كن استباقياً: اذكر المخاطر القادمة والتوصيات.

③ نفِّذ عندما يُطلَب
  طلب واضح → نفِّذ + أخبر بما فعلت.
  طلب غامض → سؤال واحد فقط ثم نفِّذ.

④ اللغة والأسلوب
  العربية — مهني ومختصر. ملخص نقطي بعد كل مجموعة إجراءات.

━━━ الأدوات (22 أداة) ━━━

📊 التقييم والمراقبة:
  • get_system_state — قراءة أي قسم من النظام
  • scan_overdue — جميع البنود المتأخرة
  • compute_iso_maturity — درجة نضج ISO 9001 لكل بند
  • generate_management_report — تقرير مراجعة الإدارة (9.3)
  • compare_departments — مقارنة أداء الأقسام
  • detect_department_trends — اتجاهات الأداء بمرور الوقت
  • detect_distressed_departments — الأقسام المتعثِّرة
  • list_investigation_flags — علامات التحقيق النشطة

📈 KPI والمتابعة:
  • log_kpi_entry — تسجيل قيمة KPI
  • read_progress_report — قراءة تقرير شهري لقسم
  • generate_progress_report — توليد تقرير شهري
  • investigate_cross_contradictions — فحص التناقضات بين الأقسام

⚠️ المخاطر والمطابقة:
  • create_risk / update_risk — المخاطر والفرص (6.1)
  • create_ncr / update_ncr — عدم المطابقة (10.2)
  • create_capa / update_capa — الإجراءات التصحيحية (10.2)

😤 الشكاوى (9.1.2):
  • create_complaint / update_complaint
  • orchestrate_complaint — سير عمل كامل (شكوى+NCR+CAPA)

🏛 مراجعة الإدارة (9.3) والتدقيق (9.2):
  • create_management_review / update_management_review
  • plan_audit

🎓 التدريب (7.2):
  • schedule_training

━━━ قواعد الحقول ━━━

• ownerId في Objective = CUID حقيقي من users (لا تخترع IDs)
• log_kpi_entry: استخدم year (Int) + month (Int 1-12)
• رموز الكيانات: NCR-2026-XXX, CAP-2026-XXX, CMP-2026-XXX, AUD-2026-XXX

━━━ الصلاحيات ━━━

لديك صلاحيات QUALITY_MANAGER:
  ✅ تعديل: المخاطر، NCR، CAPA، الشكاوى، مراجعة الإدارة، التدريب، التدقيق، KPI
  ❌ تعديل هيكل الخطة الاستراتيجية أو الأهداف أو المستخدمين (تُنجَز عبر واجهة النظام)`;

// ─────────────────────────────────────────────────────────────────────────────
//  buildContext — لقطة موجزة لعرضها في /context endpoint
// ─────────────────────────────────────────────────────────────────────────────

export async function buildContext({ compact = false } = {}) {
  const [goals, activities, objectives, kpiEntries, users, departments, activePolicy, docsCount] =
    await Promise.all([
      prisma.strategicGoal.findMany({
        where: { deletedAt: null }, orderBy: { code: 'asc' },
        include: { activities: { select: { id: true, code: true, title: true } } },
      }),
      prisma.operationalActivity.findMany({ orderBy: { code: 'asc' } }),
      prisma.objective.findMany({
        orderBy: { code: 'asc' },
        include: {
          owner: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.kpiEntry.count(),
      prisma.user.findMany({
        where: { active: true, email: { not: 'ai-agent@qms.local' } },
        select: { id: true, name: true, email: true, role: true, departmentId: true },
      }),
      prisma.department.findMany({ select: { id: true, name: true, code: true } }),
      prisma.qualityPolicy.findFirst({ where: { active: true }, select: { id: true, title: true, version: true } }),
      prisma.document.count({ where: { deletedAt: null } }),
    ]);

  const gaps = analyzeGaps({ goals, activities, objectives });

  return {
    summary: {
      strategicGoals: goals.length,
      operationalActivities: activities.length,
      objectives: objectives.length,
      kpiEntries,
      users: users.length,
      departments: departments.length,
      documents: docsCount,
      activePolicy: activePolicy ? `${activePolicy.title} (v${activePolicy.version})` : null,
    },
    gaps,
    goals:       compact ? goals.map(g => ({ id: g.id, code: g.code, title: g.title })) : goals,
    activities:  compact ? activities.map(a => ({ id: a.id, code: a.code, title: a.title })) : activities,
    objectives,
    users:       users.map(u => ({ id: u.id, name: u.name, role: u.role, departmentId: u.departmentId })),
    departments,
  };
}

function analyzeGaps({ goals, activities, objectives }) {
  const goalsNoTarget      = goals.filter(g => !g.target?.trim());
  const goalsNoResponsible = goals.filter(g => !g.responsible);
  const goalsNoActivities  = goals.filter(g => !g.activities?.length);
  const actsNoGoal         = activities.filter(a => !a.strategicGoalId);
  const actsNoResponsible  = activities.filter(a => !a.responsible);
  const actsNoTarget       = activities.filter(a => a.targetValue == null);
  const objsNoOwner        = objectives.filter(o => !o.ownerId);

  const toItem = (x) => ({ id: x.id, code: x.code, title: x.title });

  return {
    goalsWithoutTarget:        goalsNoTarget.map(toItem),
    goalsWithoutResponsible:   goalsNoResponsible.map(toItem),
    goalsWithoutActivities:    goalsNoActivities.map(toItem),
    activitiesNotLinkedToGoal: actsNoGoal.map(toItem),
    activitiesWithoutResponsible: actsNoResponsible.map(toItem),
    activitiesWithoutTarget:   actsNoTarget.map(toItem),
    objectivesWithoutOwner:    objsNoOwner.map(o => ({ id: o.id, code: o.code, title: o.title })),
    counts: {
      goalsWithoutTarget:        goalsNoTarget.length,
      goalsWithoutResponsible:   goalsNoResponsible.length,
      goalsWithoutActivities:    goalsNoActivities.length,
      activitiesNotLinkedToGoal: actsNoGoal.length,
      activitiesWithoutResponsible: actsNoResponsible.length,
      activitiesWithoutTarget:   actsNoTarget.length,
      objectivesWithoutOwner:    objsNoOwner.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  chat — نقطة الدخول الرئيسية للمحادثة
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {Array}  params.messages      — تاريخ المحادثة [{role, content}]
 * @param {string} params.callerUserId  — userId المستخدم الذي يطلب المحادثة
 * @returns {{ reply, toolsUsed, iterations, usage, model, context }}
 */
/**
 * @param {object} params
 * @param {Array}  params.messages
 * @param {string} params.callerUserId
 * @param {string} [params.callerRole]  — دور المستخدم الأصلي
 * @param {string} [params.mode]  — 'auto' | 'review'
 */
export async function chat({ messages, callerUserId, callerRole, mode = 'auto', modelOverride, providerOverride }) {
  const agentUserId  = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUserId;

  // قراءة الإعدادات لمعرفة المزود والموديل الفعليين
  const settings = await getAiSettings();

  // اختر الموديل المناسب للطلب
  let routed;
  if (modelOverride) {
    const provider = providerOverride || settings.defaultProvider;
    routed = { provider, model: modelOverride, tier: 'MANUAL', fallback: false };
  } else {
    routed = await routeRequest(messages, false);
  }

  const result = await runAgentLoop({
    systemPrompt: buildSystemPrompt(),
    messages,
    actingUserId,
    callerUserId,
    callerRole,   // دور المستخدم الأصلي (لمنطق صلاحيات الحذف)
    mode,
    feature:     'consultant',
    maxTokens:   8192,
    provider:    routed.provider,   // override المزود
    model:       routed.model,       // override الموديل
    routingTier: routed.tier,        // للـ logging
  });

  // لقطة حالية بعد انتهاء الحلقة (لتحديث الـ UI)
  const ctx = await buildContext({ compact: true });

  return {
    reply:       result.reply,
    toolsUsed:   result.toolsUsed,
    iterations:  result.iterations,
    hitIterationLimit: result.hitIterationLimit,
    usage:       result.usage,
    cacheRead:   result.usage?.cacheReadTokens  || 0,
    cacheWrite:  result.usage?.cacheWriteTokens || 0,
    provider:    result.provider || settings.defaultProvider,
    model:       result.model    || settings.defaultModel,
    routingTier: result.routingTier,
    context: {
      gaps:    ctx.gaps.counts,
      summary: ctx.summary,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  applyActions — مسار التوافق للخلف (legacy)
//  يُستخدَم من /api/consultant/apply إن أرسل client actions قديمة الصيغة
// ─────────────────────────────────────────────────────────────────────────────

export async function applyActions(actions, callerUserId) {
  const agentUserId = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUserId;

  const results = [];
  for (const a of actions) {
    try {
      // حوِّل صيغة actions القديمة لاستدعاء executeTool
      const toolName  = legacyActionToToolName(a.type);
      const toolInput = legacyActionToToolInput(a);
      const r = await executeTool(toolName, toolInput, actingUserId);
      results.push({ ok: r.ok, message: r.summary, error: r.error, action: a });
    } catch (e) {
      results.push({ ok: false, error: e.message, action: a });
    }
  }
  return results;
}

/** يُحوِّل نوع action القديم لاسم الأداة الجديد */
function legacyActionToToolName(type) {
  const map = {
    'update_strategic_goal':       'update_strategic_goal',
    'update_operational_activity': 'update_operational_activity',
    'create_objective':            'create_objective',
    'update_objective':            'update_objective',
    'link_activity_to_goal':       'link_activity_to_goal',
    'assign_owner':                'assign_owner',
  };
  if (!map[type]) throw new Error(`نوع action غير معروف: ${type}`);
  return map[type];
}

/** يُحوِّل صيغة action القديمة لمدخلات الأداة الجديدة */
function legacyActionToToolInput(action) {
  if (action.type === 'link_activity_to_goal') return action.data;
  if (action.type === 'assign_owner') {
    const { entity, id, responsible, ownerId } = action.data || {};
    if (entity === 'Objective') return { objectiveId: id, ownerId };
    return { entity, id, responsible };
  }
  return { id: action.id, ...action.data };
}
