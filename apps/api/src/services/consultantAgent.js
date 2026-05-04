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
import { buildPlanConnectivity } from '../lib/planConnectivity.js';

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
const buildSystemPrompt = (role = 'QUALITY_MANAGER', { includeKnowledge = false } = {}) => {
  const knowledgeSection = includeKnowledge && _orgKnowledge
    ? `\n\n━━━ قاعدة المعرفة المؤسسية ━━━\n${_orgKnowledge}`
    : '';
  const roleSection = role === 'SUPER_ADMIN' ? SUPER_ADMIN_PROMPT_SECTION : '';
  return BASE_SYSTEM_PROMPT + PLAN_OPERATING_MODEL_PROMPT + roleSection + knowledgeSection;
};

const PLAN_OPERATING_MODEL_PROMPT = `

━━━ نموذج الخطة المعتمد في جمعية البر بصبيا ━━━

النظام لا يعتمد طبقة الأهداف التشغيلية (Objective) كشرط إلزامي للحكم على صحة الخطة.
النموذج الرسمي الخفيف هو:
  المحور الاستراتيجي → الهدف الاستراتيجي → المؤشرات والأنشطة → قراءات الأداء والمتابعة.

قواعد التقييم:
  • عدم وجود Objective ليس مشكلة بذاته، ولا يخفض تقييم الخطة.
  • الهدف بلا مؤشر مباشر أو داعم = مشكلة حقيقية.
  • الهدف بلا نشاط = تنبيه تنفيذ، وليس فشلاً إذا كان الهدف يقاس بمؤشرات واضحة.
  • المؤشر بلا مالك أداء أو مالك بيانات أو مستهدف سنوي = مشكلة حقيقية.
  • القسم غير الظاهر في الخطة = تنبيه تغطية، وليس حكماً كارثياً إلا إذا كان القسم يملك دوراً تنفيذياً مطلوباً.
  • محاور الجمعية المخصصة مقبولة إذا غطت عملياً الأثر الاجتماعي، المال والاستدامة، التميز/العمليات، ورأس المال البشري والشراكات.

عند تقييم الخطة استخدم خريطة الترابط أو أداة evaluate_strategic_plan، ولا تستخدم معيار "0 Objective" كدليل ضعف.
`;

function latestUserText(messages = []) {
  return [...messages].reverse().find(m => m.role === 'user')?.content || '';
}

function isPlanEvaluationRequest(text = '') {
  const normalized = String(text).toLowerCase();
  const asksEvaluation = /(تقييم|تقيم|قيّم|قيم|قيمم|راجع|مراجعة|احكم|المنهجية|منهجية)/.test(normalized);
  const asksPlan = /(الخطة|خطة|استراتيجي|استراتيجية|الاستراتيجية|المؤشرات|الأهداف)/.test(normalized);
  return asksEvaluation && asksPlan;
}

function isPlanEvaluationConversation(messages = []) {
  const latest = latestUserText(messages);
  if (isPlanEvaluationRequest(latest)) return true;

  const isContinuation = /^(اكمل|كمل|تابع|واصل|استمر|هات|\?+)$/.test(String(latest).trim());
  if (!isContinuation) return false;

  const recent = messages.slice(-8).map(m => m.content || '').join('\n').toLowerCase();
  const hasEvaluationContext = /(التقييم الشامل|إعادة التقييم|اعادة التقييم|النتيجة الإجمالية|النتيجة الاجمالية|منهجية|score)/.test(recent);
  const hasPlanContext = /(الخطة|خطة|استراتيجي|استراتيجية|الاستراتيجية|المؤشرات|الأهداف)/.test(recent);
  return hasEvaluationContext && hasPlanContext;
}

function formatPlanEvaluationReply(planMap) {
  const s = planMap.summary;
  const label = s.score >= 85 ? 'جيد جداً'
    : s.score >= 75 ? 'جيد'
    : s.score >= 65 ? 'مقبول يحتاج ضبط'
    : s.score >= 50 ? 'يحتاج تحسين واضح'
    : 'حرج ويحتاج تدخل';
  const topIssues = (planMap.issues || []).slice(0, 8);
  const issueLines = topIssues.length
    ? topIssues.map((i, idx) => `${idx + 1}. ${i.severity === 'ERROR' ? 'مشكلة' : 'تنبيه'}: ${i.message}`).join('\n')
    : 'لا توجد مشكلات جوهرية ظاهرة في خريطة الترابط.';

  return `أعدت تقييم الخطة وفق المنهجية المعتمدة في النظام، لا وفق معيار الأهداف التشغيلية القديم.

**النتيجة: ${s.score}/100 - ${label}**

منهجية الحكم:
- لا أعاقب الخطة بسبب غياب Objective؛ هذه طبقة اختيارية/قديمة.
- الحكم يكون على ترابط: المحور، الهدف الاستراتيجي، المؤشرات، الأنشطة، المالك، مدخل البيانات، والمستهدف السنوي.

الملخص الرقمي:
- الأهداف الاستراتيجية: ${s.goals}
- المحاور: ${s.axes}
- المؤشرات: ${s.indicators}
- الأنشطة: ${s.activities}
- مشكلات حقيقية: ${s.errors}
- تنبيهات تحسين: ${s.warnings}

أهم الملاحظات:
${issueLines}

الخلاصة: التقييم السابق الذي حكم على الخطة بأنها ضعيفة بسبب 0 Objective غير معتمد الآن. إن أردنا رفع الدرجة، فالعمل يكون على سد المشكلات أعلاه: ربط المؤشرات، تثبيت المالكين، استكمال المستهدفات، وربط الأنشطة حيث يلزم.`;
}

const BASE_SYSTEM_PROMPT = `أنت "المستشار الاستراتيجي للجودة" لجمعية بر خيرية تطبِّق ISO 9001:2015.

دورك: مستشار إداري خبير — لا تنتظر أوامر تفصيلية، بل تُبادر وتقترح وتُنفِّذ.

━━━ مبادئ العمل الأساسية ━━━

① اقرأ البيانات أولاً دائماً
  ابدأ بـ get_system_state قبل أي اقتراح أو تنفيذ.
  يدعم: plans, goals, activities, objectives, axes, indicators, annualTargets, initiatives, users, departments, risks, ncrs, capas, audits, complaints, management_reviews, trainings, gaps

② قدِّم مقترحات جاهزة — لا تسأل أسئلة مفتوحة
  ❌ خطأ: "ما الأهداف التي تريد إنشاءها؟"
  ✅ صواب: "بناءً على بيانات الجمعية وفجواتها، اقترح هذه الأهداف الثلاثة..."
  
  عندما يطلب المستخدم إنشاء أهداف/أنشطة:
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

عند طلب "قيّم الخطة":
  1. استخدم evaluate_strategic_plan أولاً.
  2. إن لم تعمل الأداة، استخدم get_system_state مع planConnectivity.
  3. لا تعتمد على معيار 0 Objective ولا تكتب أن الترابط معطل إلا إذا أظهرت الخريطة ذلك.
  4. اعرض الدرجة مع أسبابها من المشكلات والتنبيهات الفعلية في الخريطة.

عند طلب "أنشئ أهدافاً":
  1. اقرأ get_system_state مع goals وaxes وindicators وannualTargets وplanConnectivity.
  2. حدِّد الفجوات: هدف بلا مؤشر، مؤشر بلا مالك، مستهدف مفقود، قسم لا يظهر في التنفيذ.
  3. اقترح 3-5 أهداف SMART فقط إذا كانت الفجوة على مستوى استراتيجي، وإلا اقترح نشاطاً أو مؤشراً.
  4. وضِّح ارتباط كل اقتراح بمتطلب ISO أو رسالة الجمعية.
  5. اطلب الموافقة ثم نفِّذ دفعةً واحدة.

عند طلب "أنشئ أنشطة":
  1. اقرأ الأهداف الاستراتيجية الحالية وخريطة الترابط.
  2. اقترح أنشطة تخدم الأهداف ذات الفجوات التنفيذية.
  3. اشمل: الكود، العنوان، الوصف، الإدارة، المسؤول، التاريخ، والمؤشر الداعم إن وجد.
  4. لا تنشئ Objective إلا إذا طلب المستخدم ذلك صراحة.

━━━ الأدوات (50 أداة) ━━━

📊 التقييم والمراقبة (تُنفَّذ فوراً):
  • get_system_state — قراءة أي قسم من النظام (أضف "axes" للمحاور، "indicators" للمؤشرات، "annualTargets" للمستهدفات، "initiatives" للمبادرات)
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
  • create_objective — إنشاء هدف تشغيلي قديم/اختياري فقط عند طلب المستخدم صراحة
  • update_objective — تعديل هدف تشغيلي قديم/اختياري
  • assign_responsible — تعيين مسؤول نصي
  • assign_owner — تعيين مالك (CUID مستخدم)
  • create_indicator — إنشاء مؤشر أداء استراتيجي مستقل (Indicator) مع عتبات RAG مخصصة
  • update_indicator — تعديل مؤشر موجود (الأوزان، العتبات، الاتجاه)
  • create_annual_target — إنشاء مستهدف سنوي لمؤشر (يُكمل السلسلة: Indicator → AnnualTarget → KpiEntry)
  • update_annual_target — تعديل مستهدف سنوي موجود (يتطلب modificationReason)
  • create_initiative — إنشاء مبادرة استراتيجية مرتبطة بهدف مع ميزانية ومالك
  • update_initiative — تعديل مبادرة موجودة (التقدم، الإنفاق، الحالة)

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
  • evaluate_strategic_plan — التقييم الرسمي للخطة حسب النموذج الخفيف المعتمد وخريطة الترابط
  • evaluate_kpi_quality — جودة كل مؤشر أداء
  • detect_goal_conflicts — كشف التعارض والتداخل بين الأهداف
  • suggest_missing_objectives — اسم قديم؛ عملياً يقترح مؤشرات/أنشطة/مالكين مفقودين لا Objectives إلزامية
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

━━━ السلسلة المعتمدة للخطة والمتابعة ━━━

النموذج التشغيلي المعتمد حالياً خفيف ومناسب لمرحلة الجمعية:

  خطة استراتيجية (StrategicPlan)
    └── محور استراتيجي (Axis)
          └── هدف استراتيجي (StrategicGoal)
                ├── مؤشرات أداء (Indicator) + مستهدفات سنوية (AnnualTarget)
                ├── أنشطة تشغيلية (OperationalActivity) تقود التنفيذ
                └── مبادرات (Initiative) عند وجود مشروع أو حزمة عمل واضحة

قواعد العمل:
  • Objective طبقة اختيارية/قديمة؛ لا تنشئها ولا تعاقب الخطة بسبب غيابها إلا إذا طلب المستخدم صراحة.
  • عند تقييم الخطة شغّل evaluate_strategic_plan أو استخدم planConnectivity من get_system_state.
  • لا تصدر درجة رقمية للخطة من الانطباع العام أو من عدد Objectives.
  • المؤشر يمكن أن يرتبط بمحور، أو بنشاط، أو بهدف تشغيلي قديم؛ الربط المباشر بالهدف ليس شرطاً وحيداً.
  • النشاط يشرح كيف يتحقق الهدف، والمؤشر يقيس هل تحقق.
  • AnnualTarget يعطي سياق القياس: actualValue مقابل targetValue.
  • عتبات RAG محسوبة من greenThreshold/yellowThreshold على Indicator.

━━━ قواعد الحقول ━━━

• ownerId / assigneeId = CUID حقيقي من users (استخدم get_system_state لقسم "users" أولاً)
• log_kpi_entry: استخدم year (Int) + month (Int 1-12) + actualValue (Float)
• عند تسجيل KpiEntry بـ indicatorId → استخدم actualValue (وليس actual)
• رموز الكيانات: NCR-2026-XXX, CAP-2026-XXX, CMP-2026-XXX, AUD-2026-XXX, OBJ-2026-XXX, ACT-2026-XXX, IND-2026-XXX, INI-2026-XXX
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

/**
 * @param {object} opts
 * @param {boolean} [opts.compact]
 * @param {string}  [opts.callerRole] — لتقييد البيانات الحساسة (users/departments)
 *                                       لـ QM+ فقط. لو غير مُمرَّر، نُرجع كل شيء (توافق خلفي).
 */
export async function buildContext({ compact = false, callerRole = null } = {}) {
  const isQmUp      = callerRole === 'QUALITY_MANAGER' || callerRole === 'SUPER_ADMIN';
  const isManagerUp = isQmUp || callerRole === 'DEPT_MANAGER' || callerRole === 'COMMITTEE_MEMBER';
  const [goals, activities, objectives, kpiEntries, users, departments, activePolicy, docsCount, planConnectivity] =
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
      buildPlanConnectivity(),
    ]);

  const gaps = analyzeGaps({ goals, activities, objectives, planConnectivity });

  // SECURITY: users قائمة PII. departments قائمة هيكلية للمنظمة.
  // عند تمرير callerRole، نُرجع فقط ما يحق لهذا الدور رؤيته. للتوافق العكسي
  // (إذا لم يُمرَّر callerRole) نُرجع الكل — استدعاؤنا الجديد من /context يمرّره.
  const exposeUsers       = (callerRole === null) || isQmUp;
  const exposeDepartments = (callerRole === null) || isManagerUp;

  return {
    summary: {
      strategicGoals: goals.length,
      operationalActivities: activities.length,
      objectives: objectives.length,
      objectiveLayer: 'اختيارية/قديمة وليست شرطاً للحكم على الخطة',
      planHealthScore: planConnectivity.summary.score,
      planHealthErrors: planConnectivity.summary.errors,
      planHealthWarnings: planConnectivity.summary.warnings,
      indicators: planConnectivity.summary.indicators,
      kpiEntries,
      users: exposeUsers ? users.length : null,
      departments: exposeDepartments ? departments.length : null,
      documents: docsCount,
      activePolicy: activePolicy ? `${activePolicy.title} (v${activePolicy.version})` : null,
    },
    gaps,
    planConnectivity: {
      operatingModel: planConnectivity.operatingModel,
      summary: planConnectivity.summary,
      issues: planConnectivity.issues.slice(0, compact ? 12 : 40),
      goals: compact ? [] : planConnectivity.goals,
    },
    goals:       compact ? goals.map(g => ({ id: g.id, code: g.code, title: g.title })) : goals,
    activities:  compact ? activities.map(a => ({ id: a.id, code: a.code, title: a.title })) : activities,
    objectives,
    users:       exposeUsers
      ? users.map(u => ({ id: u.id, name: u.name, role: u.role, departmentId: u.departmentId }))
      : [],
    departments: exposeDepartments ? departments : [],
  };
}

function analyzeGaps({ goals, activities, objectives, planConnectivity }) {
  const goalsNoTarget      = goals.filter(g => !g.target?.trim());
  const goalsNoResponsible = goals.filter(g => !g.responsible);
  const goalsNoActivities  = planConnectivity?.goals?.filter(g => !g.activities?.length) || goals.filter(g => !g.activities?.length);
  const goalsNoIndicators  = planConnectivity?.goals?.filter(g => !g.indicators?.length && !g.supportingAxisIndicators?.length) || [];
  const actsNoGoal         = activities.filter(a => !a.strategicGoalId);
  const actsNoResponsible  = activities.filter(a => !a.responsible);
  const actsNoTarget       = activities.filter(a => a.targetValue == null);
  const objsNoOwner        = objectives.filter(o => !o.ownerId);
  const planIssues         = planConnectivity?.issues || [];
  const planErrors         = planIssues.filter(i => i.severity === 'ERROR');
  const planWarnings       = planIssues.filter(i => i.severity === 'WARNING');

  const toItem = (x) => ({ id: x.id, code: x.code, title: x.title });

  return {
    operatingModel:           planConnectivity?.operatingModel || null,
    planHealth:               planConnectivity?.summary || null,
    goalsWithoutTarget:        goalsNoTarget.map(toItem),
    goalsWithoutResponsible:   goalsNoResponsible.map(toItem),
    goalsWithoutActivities:    goalsNoActivities.map(toItem),
    goalsWithoutIndicators:    goalsNoIndicators.map(toItem),
    activitiesNotLinkedToGoal: actsNoGoal.map(toItem),
    activitiesWithoutResponsible: actsNoResponsible.map(toItem),
    activitiesWithoutTarget:   actsNoTarget.map(toItem),
    legacyObjectivesWithoutOwner: objsNoOwner.map(o => ({ id: o.id, code: o.code, title: o.title })),
    planErrors,
    planWarnings,
    counts: {
      goalsWithoutTarget:        goalsNoTarget.length,
      goalsWithoutResponsible:   goalsNoResponsible.length,
      goalsWithoutActivities:    goalsNoActivities.length,
      goalsWithoutIndicators:    goalsNoIndicators.length,
      activitiesNotLinkedToGoal: actsNoGoal.length,
      activitiesWithoutResponsible: actsNoResponsible.length,
      activitiesWithoutTarget:   actsNoTarget.length,
      legacyObjectivesWithoutOwner: objsNoOwner.length,
      planErrors:                planErrors.length,
      planWarnings:              planWarnings.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  compressHistory — تلخيص السياق التلقائي عند طول المحادثة
// ─────────────────────────────────────────────────────────────────────────────

const COMPRESS_THRESHOLD = 8; // يبدأ التلخيص مبكراً لتقليل تكلفة الشات الطويل
const COMPRESS_KEEP      = 4; // يحتفظ بآخر 4 رسائل كما هي فقط

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

  const toSummarize = dialogue.slice(0, Math.max(0, dialogue.length - COMPRESS_KEEP));
  const toKeep      = dialogue.slice(-COMPRESS_KEEP);

  const convText = toSummarize.map(m => {
    const speaker = m.role === 'user' ? 'المستخدم' : 'المستشار';
    const content = typeof m.content === 'string'
      ? m.content.slice(0, 350)
      : '[محتوى معقد]';
    return `${speaker}: ${content}`;
  }).join('\n\n');

  try {
    const r = await aiComplete({
      system: [
        'أنت مساعد يلخص محادثات نظام إدارة الجودة.',
        'لخّص المحادثة التالية في 3-4 جمل عربية موجزة.',
        'ركّز على: الأسئلة المطروحة، القرارات المتخذة، الإجراءات المنفذة، والنقاط المفتوحة.',
        'لا تضف تعليقاً، فقط الملخص.',
      ].join(' '),
      messages: [{ role: 'user', content: `المحادثة:\n\n${convText}` }],
      feature:   'context_compression',
      model:     'claude-haiku-4-5', // الأرخص — التلخيص مهمة بسيطة
      maxTokens: 250,
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
    return { messages: dialogue.slice(-6), compressed: false, summaryTokens: 0 };
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

export async function chat({ messages, callerUserId, callerRole, callerUser, mode = 'auto', modelOverride, providerOverride, onProgress }) {
  if (providerOverride && providerOverride !== 'anthropic') {
    const err = new Error('المستشار وأدوات التنفيذ يعملان حالياً على Claude فقط. استخدم OpenAI/Gemini من Playground كاحتياط يدوي.');
    err.code = 'AI_PROVIDER_MANUAL_ONLY';
    err.status = 400;
    throw err;
  }

  const agentUserId  = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUserId;
  // SECURITY: نضمن أن callerUser يحمل sub/role/departmentId ليُفحص ضد المصفوفة.
  // AI_AGENT_USER_ID للتتبع فقط، لا للصلاحيات.
  const effectiveCaller = callerUser || (callerUserId ? { sub: callerUserId, role: callerRole } : null);

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
          // لا نحقن الذاكرة إلا كملخص صغير جداً حتى لا تتحول كل رسالة إلى إعادة
          // إرسال جلسة سابقة كاملة. هذا كان أحد أسباب ارتفاع التكلفة.
          memoryBlock.content = memoryBlock.content.slice(0, 450);
          messagesWithMemory = [memoryBlock, ...compressedMessages.slice(-4)];
          console.log(`[chat] حُقنت ذاكرة الجلسة السابقة (${dateStr})`);
        }
      }
    } catch { /* صامت — الذاكرة اختيارية */ }
  }

  const directText = latestUserText(messagesWithMemory);
  if (isPlanEvaluationConversation(messagesWithMemory)) {
    const yearMatch = String(directText).match(/\b(20\d{2})\b/);
    const planMap = await buildPlanConnectivity({
      year: yearMatch ? Number(yearMatch[1]) : null,
    });
    const ctx = await buildContext({ compact: true, callerRole });
    return {
      reply: formatPlanEvaluationReply(planMap),
      toolsUsed: ['evaluate_strategic_plan'],
      iterations: 0,
      hitIterationLimit: false,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      cacheRead: 0,
      cacheWrite: 0,
      provider: routed.provider || settings.defaultProvider,
      model: routed.model || settings.defaultModel,
      routingTier: routed.tier,
      logId: null,
      context: {
        gaps: ctx.gaps.counts,
        summary: ctx.summary,
      },
    };
  }

  const result = await runAgentLoop({
    systemPrompt: buildSystemPrompt(callerRole, { includeKnowledge: routed.tier === 'DEEP' }),
    messages: messagesWithMemory,
    actingUserId,
    callerUserId,
    callerRole,
    callerUser: effectiveCaller, // ⚠️ لفحص الصلاحيات داخل executeTool
    mode,
    feature:     'consultant',
    maxTokens:   routed.tier === 'DEEP' ? 3200 : 1600,
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

export async function applyActions(actions, callerUser) {
  // Backward compat: لو نُودي بـ string قديم (callerUserId)، نحوِّله لكائن
  // ضعيف بدون role — كل الأدوات سترفض، وهو السلوك الآمن المقصود.
  if (typeof callerUser === 'string') callerUser = { sub: callerUser };
  const agentUserId = await getAiAgentUserId();
  const actingUserId = agentUserId || callerUser?.sub || null;

  const results = [];
  for (const a of actions) {
    try {
      // حوِّل صيغة actions القديمة لاستدعاء executeTool
      const toolName  = legacyActionToToolName(a.type);
      const toolInput = legacyActionToToolInput(a);
      const r = await executeTool(toolName, toolInput, { callerUser, actingUserId });
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
