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
import { aiComplete } from '../lib/ai/index.js';

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
const buildSystemPrompt = (role = 'QUALITY_MANAGER') => {
  const knowledgeSection = _orgKnowledge
    ? `\n\n━━━ قاعدة المعرفة المؤسسية ━━━\n${_orgKnowledge}`
    : '';
  const roleSection = role === 'SUPER_ADMIN' ? SUPER_ADMIN_PROMPT_SECTION : '';
  return BASE_SYSTEM_PROMPT + roleSection + knowledgeSection;
};

const BASE_SYSTEM_PROMPT = `أنت "المستشار الاستراتيجي للجودة" لجمعية بر خيرية تطبِّق ISO 9001:2015.

دورك: مستشار إداري خبير — لا تنتظر أوامر تفصيلية، بل تُبادر وتقترح وتُنفِّذ.

━━━ مبادئ العمل الأساسية ━━━

① اقرأ البيانات أولاً دائماً
  ابدأ بـ get_system_state قبل أي اقتراح أو تنفيذ.
  يدعم: plans, goals, activities, objectives, axes, indicators, users, departments, risks, ncrs, capas, audits, complaints, management_reviews, trainings, gaps

② قدِّم مقترحات جاهزة — لا تسأل أسئلة مفتوحة
  ❌ خطأ: "ما الأهداف التي تريد إنشاءها؟"
  ✅ صواب: "بناءً على بيانات الجمعية وفجواتها، اقترح هذه الأهداف الثلاثة..."
  
  عندما يطلب المستخدم إنشاء أهداف/أنشطة/objectives:
  → اقرأ get_system_state أولاً
  → اقترح مقترحات محددة مبنية على: الفجوات الظاهرة، المؤشرات المنخفضة، ISO 9001 requirements، أفضل الممارسات
  → اشرح سبب كل اقتراح في جملة واحدة
  → اسأل فقط: "هل توافق؟ أم تريد تعديل شيء؟"

③ حلِّل ولا تكتفِ بالوصف
  لا تقل فقط "يوجد 3 NCRs" — قل "NCR-003 متأخر 45 يوماً بدون إجراء، يجب تصعيده"
  كن استباقياً: اذكر المخاطر القادمة والتوصيات.

④ طلب واضح → نفِّذ + أخبر بما فعلت
  طلب فيه غموض واحد → اقترح خياراً افتراضياً وانتظر موافقة، لا تسأل سؤالاً مفتوحاً.

⑤ اللغة والأسلوب
  العربية — مهني ومختصر. ملخص نقطي بعد كل مجموعة إجراءات.
  استخدم أرقاماً وبيانات حقيقية من النظام في كل اقتراح.

━━━ كيف تقترح بشكل صحيح ━━━

عند طلب "أنشئ أهدافاً":
  1. اقرأ get_system_state (goals + gaps + objectives)
  2. حدِّد الفجوات: أي مجال ISO لا يوجد له هدف؟ أي مؤشر منخفض؟
  3. اقترح 3-5 أهداف SMART مع الكود المناسب (SG-0X) والمستهدف الرقمي
  4. وضِّح ارتباط كل هدف بمتطلب ISO محدد (§ + بند)
  5. اطلب الموافقة ثم نفِّذ دفعةً واحدة

عند طلب "أنشئ objectives أو أنشطة":
  1. اقرأ الأهداف الاستراتيجية الحالية
  2. اقترح أنشطة/objectives تخدم الأهداف ذات الفجوات
  3. اشمل: الكود، العنوان، المستهدف، الوحدة، التواريخ، القسم المسؤول
  4. لا تسأل "ما الذي تريد؟" — قل "اقترح هذه الأنشطة بناءً على فجوة (X)"

━━━ الأدوات (50 أداة) ━━━

📊 التقييم والمراقبة (تُنفَّذ فوراً):
  • get_system_state — قراءة أي قسم من النظام (أضف "axes" للمحاور، "indicators" للمؤشرات)
  • scan_overdue — جميع البنود المتأخرة
  • compute_iso_maturity — درجة نضج ISO 9001 لكل بند
  • generate_management_report — تقرير مراجعة الإدارة (9.3)
  • compare_departments — مقارنة أداء الأقسام
  • detect_department_trends — اتجاهات الأداء بمرور الوقت
  • detect_distressed_departments — الأقسام المتعثِّرة
  • list_investigation_flags — علامات التحقيق النشطة

📈 KPI والمتابعة (تُنفَّذ فوراً):
  • log_kpi_entry — تسجيل قيمة KPI
  • read_progress_report — قراءة تقرير شهري لقسم
  • generate_progress_report — توليد تقرير شهري
  • investigate_cross_contradictions — فحص التناقضات بين الأقسام

🏗️ التخطيط الاستراتيجي والتشغيلي (⚠️ تتطلب موافقتك قبل التنفيذ):
  • create_strategic_plan — إنشاء خطة استراتيجية جديدة (لتجميع الأهداف تحت فترة زمنية)
  • update_strategic_plan — تعديل خطة استراتيجية
  • create_strategic_goal — إنشاء هدف استراتيجي جديد
  • update_strategic_goal — تعديل هدف استراتيجي (يمكن ربطه بخطة عبر planId)
  • create_operational_activity — إنشاء نشاط تشغيلي جديد
  • update_operational_activity — تعديل نشاط تشغيلي
  • link_activity_to_goal — ربط نشاط بهدف استراتيجي
  • create_objective — إنشاء هدف تشغيلي/KPI جديد
  • update_objective — تعديل هدف تشغيلي
  • assign_responsible — تعيين مسؤول نصي
  • assign_owner — تعيين مالك (CUID مستخدم)
  • create_indicator — إنشاء مؤشر أداء استراتيجي مستقل (Indicator) مع عتبات RAG مخصصة
  • update_indicator — تعديل مؤشر موجود (الأوزان، العتبات، الاتجاه)
  • create_initiative — إنشاء مبادرة استراتيجية مرتبطة بهدف مع ميزانية ومالك

🔍 تحليل SWOT (⚠️ تتطلب موافقتك قبل التنفيذ):
  • create_swot_item — إضافة نقطة SWOT
  • update_swot_item — تعديل نقطة SWOT

⚠️ المخاطر والمطابقة (تُنفَّذ فوراً في auto):
  • create_risk / update_risk — المخاطر والفرص (6.1)
  • create_ncr / update_ncr — عدم المطابقة (10.2)
  • create_capa / update_capa — الإجراءات التصحيحية (10.2)

😤 الشكاوى (9.1.2) (تُنفَّذ فوراً في auto):
  • create_complaint / update_complaint
  • orchestrate_complaint — سير عمل كامل (شكوى+NCR+CAPA)

🏛 مراجعة الإدارة (9.3) والتدقيق (9.2) (تُنفَّذ فوراً في auto):
  • create_management_review / update_management_review
  • plan_audit

🎓 التدريب (7.2) (تُنفَّذ فوراً في auto):
  • schedule_training

🔬 التحليل العميق — تقييم شامل (تُنفَّذ فوراً):
  • evaluate_strategic_plan — تقييم الخطة كاملة (SMART، توازن، تعارض، فجوات)
  • evaluate_kpi_quality — جودة كل مؤشر أداء
  • detect_goal_conflicts — كشف التعارض والتداخل بين الأهداف
  • suggest_missing_objectives — اقتراح أهداف مفقودة بناءً على الفجوات
  • check_department_coverage — تغطية الأقسام في الخطة
  • assess_org_structure_fit — توافق الهيكل التنظيمي مع الاستراتيجية
  • evaluate_policy_completeness — اكتمال سياسة الجودة
  • suggest_target_adjustment — اقتراح مراجعة المستهدفات بناءً على الأداء
  • link_risks_to_objectives — ربط المخاطر بالأهداف وكشف الفجوات
  • analyze_ncr_patterns — أنماط عدم المطابقة وتحليل Pareto
  • measure_capa_effectiveness — قياس فعالية الإجراءات التصحيحية
  • analyze_complaints_pattern — أنماط الشكاوى والأسباب الجذرية
  • track_beneficiary_satisfaction — رضا المستفيدين
  • assess_training_needs — احتياجات التدريب (ISO 7.2)
  • generate_audit_checklist — توليد قائمة فحص تدقيق مخصصة

━━━ قواعد الحقول ━━━

• ownerId / assigneeId = CUID حقيقي من users (استخدم get_system_state لقسم "users" أولاً)
• log_kpi_entry: استخدم year (Int) + month (Int 1-12)
• رموز الكيانات: NCR-2026-XXX, CAP-2026-XXX, CMP-2026-XXX, AUD-2026-XXX, OBJ-2026-XXX, ACT-2026-XXX
• عند إنشاء هدف تشغيلي: target رقم حقيقي، unit نص (مثل "شكوى" أو "%")

━━━ الصلاحيات ━━━

لديك صلاحيات QUALITY_MANAGER الكاملة:
  ✅ تنفيذ فوري: المخاطر، NCR، CAPA، الشكاوى، مراجعة الإدارة، التدريب، التدقيق، KPI
  ✅ اقتراح (يحتاج موافقة): إنشاء/تعديل الأهداف والأنشطة والـ SWOT
  ❌ محجوز: حذف البنود الهيكلية — لا تقترح ذلك إلا إن طُلب صراحةً
  ❌ إدارة المستخدمين والإعدادات — عبر واجهة النظام فقط`;

/** قسم إضافي يُحقن في system prompt لـ SUPER_ADMIN فقط */
const SUPER_ADMIN_PROMPT_SECTION = `

━━━ وضع المسؤول الكامل (SUPER_ADMIN) ━━━

أنت تعمل مع المسؤول الكامل للنظام — صلاحياتك موسَّعة:

✅ تنفيذ فوري (بدون انتظار موافقة):
   • جميع عمليات الإنشاء والتعديل — الخطط الاستراتيجية، الأهداف، الأنشطة، الـ SWOT، وغيرها
   • الحذف الناعم (soft-delete): أهداف استراتيجية، أنشطة تشغيلية، أهداف KPI
     ← الحذف آمن: البيانات تُحفَظ في DB ويمكن استرداها

الخطط الاستراتيجية (StrategicPlan):
   • استخدم get_system_state sections:["plans"] لرؤية الخطط الموجودة
   • يمكن ربط الأهداف بخطة عبر update_strategic_goal(planId: ...)
   • كل خطة لها: code, title, startYear, endYear, status (DRAFT|ACTIVE|ARCHIVED)

قواعد الحذف:
  ① اقرأ البيانات أولاً — تأكد من الهدف قبل الحذف
  ② أخبر المسؤول بالكود والعنوان قبل التنفيذ ("سأحذف STR-2026-001 — كيف شروط الإغاثة")
  ③ نفِّذ فقط عند التأكيد الصريح ("احذفه" أو "نعم" أو ما شابه)
  ④ بعد الحذف: أخبره بما حُذف وأن البيانات محفوظة ويمكن الاسترداد

❌ لا تزال محجوزة: إدارة المستخدمين والإعدادات — عبر واجهة النظام فقط`;

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
//  compressHistory — تلخيص السياق التلقائي عند طول المحادثة
// ─────────────────────────────────────────────────────────────────────────────

const COMPRESS_THRESHOLD = 16; // يبدأ التلخيص بعد 16 رسالة (user+assistant)
const COMPRESS_KEEP      = 6;  // يحتفظ بآخر 6 رسائل كما هي
const COMPRESS_BATCH     = 10; // يلخص أقدم 10 رسائل دفعة واحدة

/**
 * يضغط السياق تلقائياً عندما تطول المحادثة.
 * يلخّص الرسائل القديمة بـ Haiku (الأرخص) ويحتفظ بالأحدث كاملةً.
 * يُرجع: { messages: الرسائل بعد الضغط, compressed: bool, summaryTokens: number }
 */
export async function compressHistory(messages) {
  const dialogue = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  if (dialogue.length <= COMPRESS_THRESHOLD) {
    return { messages, compressed: false, summaryTokens: 0 };
  }

  const toSummarize = dialogue.slice(0, COMPRESS_BATCH);
  const toKeep      = dialogue.slice(COMPRESS_BATCH);

  const convText = toSummarize.map(m => {
    const speaker = m.role === 'user' ? 'المستخدم' : 'المستشار';
    const content = typeof m.content === 'string'
      ? m.content.slice(0, 600)
      : '[محتوى معقد]';
    return `${speaker}: ${content}`;
  }).join('\n\n');

  try {
    const r = await aiComplete({
      system: [
        'أنت مساعد يلخص محادثات نظام إدارة الجودة.',
        'لخّص المحادثة التالية في 4-6 جمل عربية موجزة.',
        'ركّز على: الأسئلة المطروحة، القرارات المتخذة، الإجراءات المنفذة، والنقاط المفتوحة.',
        'لا تضف تعليقاً، فقط الملخص.',
      ].join(' '),
      messages: [{ role: 'user', content: `المحادثة:\n\n${convText}` }],
      feature:   'context_compression',
      model:     'claude-haiku-4-5', // الأرخص — التلخيص مهمة بسيطة
      maxTokens: 400,
    });

    const summaryMsg = {
      role:    'user',
      content: `[📋 ملخص المحادثة السابقة — ${toSummarize.length} رسالة]\n${r.content}\n[نهاية الملخص]`,
    };

    console.log(`[compressHistory] ضُغط ${toSummarize.length} رسالة → ${r.usage?.outputTokens || 0} توكن ملخص`);
    return {
      messages:      [summaryMsg, ...toKeep],
      compressed:    true,
      summaryTokens: r.usage?.outputTokens || 0,
    };
  } catch (e) {
    // لا نكسر المحادثة — نعود للرسائل الأحدث فقط إن فشل التلخيص
    console.warn('[compressHistory] فشل التلخيص — نستخدم الرسائل الأحدث فقط:', e.message);
    return { messages: toKeep, compressed: false, summaryTokens: 0 };
  }
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
// ─────────────────────────────────────────────────────────────────────────────
//  كشف الرسائل البسيطة — تحية / سؤال عام لا يحتاج أدوات
// ─────────────────────────────────────────────────────────────────────────────

const COMPLEX_KEYWORDS = [
  'افحص', 'أنشئ', 'أضف', 'حلل', 'حدّث', 'حدث', 'تحديث', 'إنشاء', 'انشئ',
  'اقرأ', 'فحص', 'مسح', 'احسب', 'ولّد', 'اقترح', 'طبّق', 'ربط',
  'scan', 'create', 'analyze', 'compute', 'generate', 'evaluate', 'update',
  'KPI', 'NCR', 'CAPA', 'ISO', 'SWOT', 'objective',
  'هدف', 'خطة', 'مخاطر', 'تقرير', 'تدقيق', 'شكوى', 'وثيقة', 'مؤشر',
  'استراتيج', 'فجوة', 'تشغيل', 'نشاط', 'إجراء',
];

/**
 * هل الرسالة الأخيرة محادثة بسيطة (تحية/سؤال عام) لا تحتاج أدوات؟
 * الشروط: قصيرة (< 180 حرف) + لا تحتوي كلمات تنفيذية
 */
function isSimpleConversation(messages) {
  const last = messages[messages.length - 1];
  if (!last?.content || typeof last.content !== 'string') return false;
  const text = last.content.trim();
  if (text.length > 180) return false;
  return !COMPLEX_KEYWORDS.some(k => text.includes(k));
}

/** System prompt مختصر للمحادثة السريعة */
const QUICK_SYSTEM_PROMPT = `أنت "المستشار الاستراتيجي للجودة" لجمعية بر خيرية تطبِّق ISO 9001:2015.
رد بشكل ودود ومختصر. إذا احتاج الطلب تحليلاً أو تنفيذاً، أخبر المستخدم أنك ستحتاج لقراءة بيانات النظام وعليه إرسال طلبه بشكل أوضح.`;

export async function chat({ messages, callerUserId, callerRole, mode = 'auto', modelOverride, providerOverride, onProgress }) {
  const agentUserId  = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUserId;

  // قراءة الإعدادات لمعرفة المزود والموديل الفعليين
  const settings = await getAiSettings();

  // ── مسار سريع للرسائل البسيطة (تحية/سؤال عام) — Haiku بدون agent loop ──
  if (!modelOverride && isSimpleConversation(messages)) {
    try {
      const r = await aiComplete({
        system:    QUICK_SYSTEM_PROMPT,
        messages,
        feature:   'consultant_quick',
        provider:  'anthropic',
        model:     'claude-haiku-4-5',
        maxTokens: 512,
      });
      const ctx = await buildContext({ compact: true });
      return {
        reply:       r.content,
        toolsUsed:   [],
        iterations:  0,
        hitIterationLimit: false,
        usage:       r.usage,
        cacheRead:   0,
        cacheWrite:  0,
        provider:    'anthropic',
        model:       'claude-haiku-4-5',
        routingTier: 'QUICK',
        logId:       null,
        context: { gaps: ctx.gaps.counts, summary: ctx.summary },
      };
    } catch (e) {
      // إذا فشل Haiku، أكمل بالمسار العادي
      console.warn('[chat] فشل المسار السريع، تراجع للـ agent loop:', e.message);
    }
  }

  // اختر الموديل المناسب للطلب
  let routed;
  if (modelOverride) {
    const provider = providerOverride || settings.defaultProvider;
    routed = { provider, model: modelOverride, tier: 'MANUAL', fallback: false };
  } else {
    routed = await routeRequest(messages, false);
  }

  // ضغط السياق تلقائياً إذا طالت المحادثة (يوفر 60-70% من التوكنات)
  const { messages: compressedMessages, compressed } = await compressHistory(messages);
  if (compressed) console.log('[chat] تم ضغط السياق — المحادثة الممررة أقصر');

  // ── ذاكرة الجلسة: حقن آخر رد للمستشار من الجلسة السابقة ──────────────────
  let messagesWithMemory = compressedMessages;
  // فقط إن كانت المحادثة قصيرة (دون سياق سابق طويل) — لا نحقن إذا كان لديهم سياق كافﻲ
  if (compressedMessages.length <= 3 && callerUserId) {
    try {
      const lastSession = await prisma.consultSession.findFirst({
        where: { userId: callerUserId },
        orderBy: { updatedAt: 'desc' },
        select: { messages: true, updatedAt: true, title: true },
      });
      if (lastSession?.messages) {
        const prevMsgs = JSON.parse(lastSession.messages);
        // آخر رد من المستشار من الجلسة السابقة
        const lastAIReply = [...prevMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAIReply?.content) {
          const dateStr = new Date(lastSession.updatedAt).toLocaleDateString('ar-SA');
          const memoryBlock = {
            role: 'user',
            content: `[ذاكرة الجلسة السابقة • ${dateStr}]
آخر ما أنجزه المستشار: ${lastAIReply.content.slice(0, 800)}${lastAIReply.content.length > 800 ? '...' : ''}
[نهاية الذاكرة — المحادثة الجديدة تبدأ الآن]`,
          };
          messagesWithMemory = [memoryBlock, ...compressedMessages];
          console.log(`[chat] حُقنت ذاكرة الجلسة السابقة (${dateStr})`);
        }
      }
    } catch { /* صامت — الذاكرة اختيارية */ }
  }

  const result = await runAgentLoop({
    systemPrompt: buildSystemPrompt(callerRole),
    messages: messagesWithMemory,
    actingUserId,
    callerUserId,
    callerRole,
    mode,
    feature:     'consultant',
    maxTokens:   8192,
    provider:    routed.provider,
    model:       routed.model,
    routingTier: routed.tier,
    onProgress,  // للـ SSE streaming
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
    logId:       result.lastLogId || null,
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
