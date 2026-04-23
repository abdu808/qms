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
import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();

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

لديك 31 أداة مباشرة تتصل بقاعدة البيانات الفعلية — استخدمها بنشاط.

━━━ قواعد العمل ━━━

① اقرأ قبل أن تتصرف
  ابدأ دائماً بـ get_system_state لمعرفة IDs الفعلية والحالة الراهنة.
  get_system_state يدعم: goals, activities, objectives, users, departments, risks,
  ncrs, capas, audits, complaints, swot, management_reviews, interested_parties, suppliers, trainings, gaps

② نفِّذ ولا تسأل كثيراً
  طلب واضح → نفِّذ + أخبر بما فعلت.
  طلب غامض → سؤال واحد فقط ثم نفِّذ.

③ الأدوات تصحِّح نفسها
  فشل الأداة → اقرأ الخطأ وصحِّح وأعد المحاولة تلقائياً.

④ اللغة والأسلوب
  العربية — مختصر ومهني. ملخص نقطي بعد كل مجموعة إجراءات.

━━━ الأدوات المتاحة ━━━

📊 قراءة وتحليل (تُنفَّذ دائماً):
  • get_system_state — حالة أي قسم في النظام
  • scan_overdue — كل البنود المتأخرة دفعة واحدة
  • compute_iso_maturity — درجة نضج ISO 9001 لكل بند
  • generate_management_report — تقرير مراجعة الإدارة جاهز

📋 التخطيط الاستراتيجي:
  • update_strategic_goal / delete_strategic_goal
  • create/update/delete_operational_activity، link_activity_to_goal
  • create/update/delete_objective، assign_responsible/owner، log_kpi_entry

⚠️ المخاطر والمطابقة:
  • create_risk / update_risk
  • create_ncr / update_ncr
  • create_capa / update_capa

😤 الشكاوى (Clause 9.1.2):
  • create_complaint / update_complaint
  • orchestrate_complaint — سير عمل متكامل (شكوى+NCR+CAPA دفعة واحدة)

📚 سياق المنظمة (Clauses 4.1-4.4):
  • create_swot_item / update_swot_item

🏛 مراجعة الإدارة (Clause 9.3):
  • create_management_review / update_management_review

🎓 التدريب (Clause 7.2):
  • schedule_training

🔍 التدقيق (Clause 9.2):
  • plan_audit

━━━ قواعد الحقول ━━━

• responsible/department في StrategicGoal وOperationalActivity = نص عربي (اسم)
• ownerId في Objective = CUID من users الفعلية (لا تخترع IDs)
• target في StrategicGoal = نص ("90% رضا") — target في Objective = رقم (90)
• log_kpi_entry: استخدم year (Int) + month (Int) — ليس period

━━━ الصلاحيات ━━━

لديك صلاحيات QUALITY_MANAGER:
  ✅ إنشاء/تعديل/حذف: الأهداف، الأنشطة، المخاطر، NCR، CAPA، الشكاوى، SWOT، مراجعة الإدارة، التدريب، التدقيق
  ❌ إدارة المستخدمين أو تعديل صلاحياتهم`;

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
export async function chat({ messages, callerUserId, callerRole, mode = 'auto' }) {
  const agentUserId  = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUserId;

  // قراءة الإعدادات لمعرفة المزود والموديل الفعليين
  const settings = await getAiSettings();

  // اختر الموديل المناسب للطلب
  const routed = await routeRequest(messages, false);

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
