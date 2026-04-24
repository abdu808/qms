/**
 * aiAgent/tools.js — أدوات الوكيل الذكي (v2)
 *
 * ══════════════════════════════════════════════════════
 * الصلاحيات:
 *   ✅ جميع وحدات نظام الجودة
 *   ❌ الإعدادات (Settings) — محجوزة للمشرف فقط
 *   ❌ إدارة المستخدمين/المستفيدين — محجوزة للمشرف فقط
 * ══════════════════════════════════════════════════════
 *
 * 20 أداة موزَّعة على أقسام النظام:
 *
 * ── التخطيط الاستراتيجي (7 أدوات) ──
 *   1.  get_system_state
 *   2.  update_strategic_goal
 *   3.  delete_strategic_goal
 *   4.  update_operational_activity
 *   5.  delete_operational_activity
 *   6.  create_operational_activity
 *   7.  link_activity_to_goal
 *
 * ── الأهداف التشغيلية / KPI (5 أدوات) ──
 *   8.  create_objective
 *   9.  update_objective
 *   10. delete_objective
 *   11. assign_responsible
 *   12. assign_owner
 *   13. log_kpi_entry
 *
 * ── المخاطر والفرص (2 أداة) ──
 *   11. create_risk
 *   12. update_risk
 *
 * ── عدم المطابقة (2 أداة) ──
 *   13. create_ncr
 *   14. update_ncr
 *
 * ── الإجراءات التصحيحية CAPA (2 أداة) ──
 *   15. create_capa
 *   16. update_capa
 *
 * ── التدقيق (1 أداة) ──
 *   17. plan_audit
 */
import { prisma } from '../../db.js';
import {
  generateReport as svcGenerateReport,
  compareDepartments as svcCompareDepartments,
  detectTrends as svcDetectTrends,
  detectCrossContradictions as svcDetectCross,
} from '../progressReportService.js';

/** الأدوات التي تقرأ فقط (تُنفَّذ دائماً حتى في وضع المراجعة) */
export const READ_ONLY_TOOLS = new Set([
  'get_system_state',
  'scan_overdue',
  'compute_iso_maturity',
  'generate_management_report',
  'compare_departments',
  'detect_department_trends',
  'detect_distressed_departments',
  'list_investigation_flags',
  'read_progress_report',
]);

// ─────────────────────────────────────────────────────────────────────────────
//  تعريفات الأدوات (Anthropic tool_use format)
// ─────────────────────────────────────────────────────────────────────────────

// الأدوات الإدارية/الهيكلية — تبقى في executeTool لكن لا تُرسَل للوكيل افتراضياً.
// تُنجَز عبر واجهة النظام أو عند رفع الملفات.
const ADMIN_TOOL_NAMES = new Set([
  'update_strategic_goal',
  'delete_strategic_goal',
  'create_operational_activity',
  'update_operational_activity',
  'delete_operational_activity',
  'link_activity_to_goal',
  'create_objective',
  'update_objective',
  'delete_objective',
  'assign_responsible',
  'assign_owner',
  'create_swot_item',
  'update_swot_item',
]);

const ALL_TOOLS = [

  // ══════════════════════════════════════════════════
  // 1. قراءة حالة النظام (دائماً متاحة)
  // ══════════════════════════════════════════════════
  {
    name: 'get_system_state',
    description: `اقرأ الحالة الحالية من قاعدة البيانات.
استخدمها دائماً أولاً لمعرفة:
- IDs الفعلية قبل أي تعديل
- الفجوات والمشاكل الحالية
- الرد على "تحقق" / "ماذا في النظام"

الخيارات: goals, activities, objectives, users, departments, risks, ncrs, capas, audits, complaints, swot, management_reviews, interested_parties, suppliers, trainings, gaps (أو كلها بـ "all")
limit: عدد السجلات لكل قسم (افتراضي 50، أقصى 200) — استخدم قيمة أصغر لتسريع الاستجابة
offset: للصفحات التالية (0, 50, 100...)`,
    input_schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['goals','activities','objectives','users','departments','risks','ncrs','capas','audits','complaints','swot','management_reviews','interested_parties','suppliers','trainings','gaps','all'],
          },
          description: 'الأقسام المطلوبة (افتراضي: goals, activities, objectives, gaps)',
        },
        limit:  { type: 'number', description: 'حد السجلات لكل قسم (افتراضي 50، أقصى 200)' },
        offset: { type: 'number', description: 'تخطي N سجل للصفحة التالية (افتراضي 0)' },
      },
    },
  },

  // ══════════════════════════════════════════════════
  // التخطيط الاستراتيجي
  // ══════════════════════════════════════════════════
  {
    name: 'update_strategic_goal',
    description: 'حدِّث حقول هدف استراتيجي. responsible = نص عربي (ليس user ID).',
    input_schema: {
      type: 'object',
      properties: {
        id:          { type: 'string', description: 'CUID الهدف (من get_system_state)' },
        target:      { type: 'string' },
        responsible: { type: 'string', description: 'اسم المسؤول نصياً' },
        kpi:         { type: 'string' },
        baseline:    { type: 'string' },
        initiatives: { type: 'string' },
        startYear:   { type: 'number' },
        endYear:     { type: 'number' },
        progress:    { type: 'number', minimum: 0, maximum: 100 },
        status:      { type: 'string', enum: ['PLANNED','ACTIVE','COMPLETED','CANCELLED'] },
        notes:       { type: 'string' },
      },
      required: ['id'],
    },
  },

  {
    name: 'delete_strategic_goal',
    description: 'احذف هدفاً استراتيجياً (حذف ناعم — يمكن الاسترداد). يُستخدم لتنظيف البيانات الخاطئة أو القديمة.',
    input_schema: {
      type: 'object',
      properties: {
        id:     { type: 'string', description: 'CUID الهدف (من get_system_state)' },
        reason: { type: 'string', description: 'سبب الحذف (للسجل)' },
      },
      required: ['id'],
    },
  },

  {
    name: 'update_operational_activity',
    description: 'حدِّث نشاطاً تشغيلياً. department و responsible = نص عربي.',
    input_schema: {
      type: 'object',
      properties: {
        id:              { type: 'string' },
        department:      { type: 'string' },
        responsible:     { type: 'string' },
        targetValue:     { type: 'number' },
        budget:          { type: 'number' },
        spent:           { type: 'number' },
        startDate:       { type: 'string', description: 'YYYY-MM-DD' },
        endDate:         { type: 'string', description: 'YYYY-MM-DD' },
        kpiType:         { type: 'string', enum: ['CUMULATIVE','PERIODIC','SNAPSHOT','BINARY'] },
        progress:        { type: 'number', minimum: 0, maximum: 100 },
        status:          { type: 'string', enum: ['PLANNED','ACTIVE','COMPLETED','CANCELLED','ON_HOLD'] },
        strategicGoalId: { type: 'string' },
        notes:           { type: 'string' },
      },
      required: ['id'],
    },
  },

  {
    name: 'delete_operational_activity',
    description: 'احذف نشاطاً تشغيلياً. يُستخدم لإزالة الأنشطة الخاطئة أو المكررة.',
    input_schema: {
      type: 'object',
      properties: {
        id:     { type: 'string', description: 'CUID النشاط (من get_system_state)' },
        reason: { type: 'string', description: 'سبب الحذف' },
      },
      required: ['id'],
    },
  },

  {
    name: 'create_operational_activity',
    description: 'أنشئ نشاطاً تشغيلياً جديداً. ربطه بهدف استراتيجي مهم.',
    input_schema: {
      type: 'object',
      properties: {
        code:            { type: 'string', description: 'كود فريد (ACT-2026-XXX)' },
        title:           { type: 'string' },
        description:     { type: 'string' },
        department:      { type: 'string' },
        responsible:     { type: 'string' },
        targetValue:     { type: 'number' },
        kpiType:         { type: 'string', enum: ['CUMULATIVE','PERIODIC','SNAPSHOT','BINARY'] },
        budget:          { type: 'number' },
        startDate:       { type: 'string', description: 'YYYY-MM-DD' },
        endDate:         { type: 'string', description: 'YYYY-MM-DD' },
        strategicGoalId: { type: 'string' },
        perspective:     { type: 'string' },
      },
      required: ['code', 'title'],
    },
  },

  {
    name: 'link_activity_to_goal',
    description: 'اربط نشاطاً تشغيلياً بهدف استراتيجي.',
    input_schema: {
      type: 'object',
      properties: {
        activityId:      { type: 'string' },
        strategicGoalId: { type: 'string' },
      },
      required: ['activityId', 'strategicGoalId'],
    },
  },

  // ══════════════════════════════════════════════════
  // الأهداف التشغيلية / KPI
  // ══════════════════════════════════════════════════
  {
    name: 'create_objective',
    description: 'أنشئ هدفاً تشغيلياً (Objective) مع مؤشر KPI. target = رقم.',
    input_schema: {
      type: 'object',
      properties: {
        code:            { type: 'string', description: 'OBJ-2026-XXX' },
        title:           { type: 'string' },
        kpi:             { type: 'string' },
        target:          { type: 'number' },
        unit:            { type: 'string', description: '%, مستفيد, ريال...' },
        baseline:        { type: 'number' },
        startDate:       { type: 'string', description: 'YYYY-MM-DD' },
        dueDate:         { type: 'string', description: 'YYYY-MM-DD' },
        description:     { type: 'string' },
        ownerId:         { type: 'string', description: 'CUID مستخدم من users' },
        departmentId:    { type: 'string', description: 'CUID قسم من departments' },
        strategicGoalId: { type: 'string' },
      },
      required: ['code', 'title', 'kpi', 'target'],
    },
  },

  {
    name: 'update_objective',
    description: 'حدِّث هدفاً تشغيلياً موجوداً.',
    input_schema: {
      type: 'object',
      properties: {
        id:              { type: 'string' },
        title:           { type: 'string' },
        kpi:             { type: 'string' },
        target:          { type: 'number' },
        unit:            { type: 'string' },
        baseline:        { type: 'number' },
        currentValue:    { type: 'number' },
        ownerId:         { type: 'string' },
        departmentId:    { type: 'string' },
        strategicGoalId: { type: 'string' },
        progress:        { type: 'number', minimum: 0, maximum: 100 },
        status:          { type: 'string', enum: ['PLANNED','IN_PROGRESS','ACHIEVED','DELAYED','CANCELLED'] },
      },
      required: ['id'],
    },
  },

  {
    name: 'delete_objective',
    description: 'احذف هدفاً تشغيلياً (حذف ناعم). يحذف قيم KPI المرتبطة تلقائياً.',
    input_schema: {
      type: 'object',
      properties: {
        id:     { type: 'string', description: 'CUID الهدف التشغيلي' },
        reason: { type: 'string', description: 'سبب الحذف' },
      },
      required: ['id'],
    },
  },

  {
    name: 'assign_responsible',
    description: 'عيِّن مسؤولاً نصياً لهدف استراتيجي أو نشاط تشغيلي.',
    input_schema: {
      type: 'object',
      properties: {
        entity:      { type: 'string', enum: ['StrategicGoal','OperationalActivity'] },
        id:          { type: 'string' },
        responsible: { type: 'string', description: 'اسم نصي عربي' },
      },
      required: ['entity', 'id', 'responsible'],
    },
  },

  {
    name: 'assign_owner',
    description: 'عيِّن مالكاً (مستخدم حقيقي بـ CUID) لهدف تشغيلي أو خطر أو CAPA.',
    input_schema: {
      type: 'object',
      properties: {
        entity:       { type: 'string', enum: ['Objective','Risk','Capa'], description: 'نوع الكيان' },
        id:           { type: 'string', description: 'CUID الكيان' },
        ownerId:      { type: 'string', description: 'CUID المستخدم' },
        departmentId: { type: 'string', description: 'CUID القسم (اختياري)' },
      },
      required: ['entity', 'id', 'ownerId'],
    },
  },

  {
    name: 'log_kpi_entry',
    description: 'سجِّل قيمة KPI فعلية لهدف تشغيلي أو نشاط تشغيلي. objectiveId أو activityId (أحدهما مطلوب).',
    input_schema: {
      type: 'object',
      properties: {
        objectiveId: { type: 'string', description: 'CUID الهدف التشغيلي (أو activityId)' },
        activityId:  { type: 'string', description: 'CUID النشاط التشغيلي (أو objectiveId)' },
        value:       { type: 'number', description: 'القيمة الفعلية' },
        year:        { type: 'number', description: 'السنة (مثل: 2026)' },
        month:       { type: 'number', description: 'الشهر 1-12' },
        note:        { type: 'string' },
      },
      required: ['value', 'year', 'month'],
    },
  },

  // ══════════════════════════════════════════════════
  // المخاطر والفرص (Clause 6.1)
  // ══════════════════════════════════════════════════
  {
    name: 'create_risk',
    description: `أنشئ خطراً أو فرصة جديدة.
type: RISK (خطر) | OPPORTUNITY (فرصة).
probability و impact: من 1 إلى 5.
score يُحسب تلقائياً (probability × impact).
level يُحدَّد تلقائياً: 1-4=منخفض, 5-9=متوسط, 10-14=مرتفع, 15+=حرج.
treatmentType: تجنب | تخفيف | نقل | قبول.`,
    input_schema: {
      type: 'object',
      properties: {
        code:            { type: 'string', description: 'RSK-2026-XXX أو OPP-2026-XXX' },
        type:            { type: 'string', enum: ['RISK','OPPORTUNITY'], description: 'خطر أم فرصة' },
        title:           { type: 'string' },
        description:     { type: 'string' },
        source:          { type: 'string', description: 'مصدر الخطر/الفرصة' },
        probability:     { type: 'number', minimum: 1, maximum: 5 },
        impact:          { type: 'number', minimum: 1, maximum: 5 },
        treatment:       { type: 'string', description: 'خطة المعالجة' },
        treatmentType:   { type: 'string', description: 'تجنب | تخفيف | نقل | قبول' },
        departmentId:    { type: 'string', description: 'CUID القسم' },
        ownerId:         { type: 'string', description: 'CUID المسؤول' },
        strategicGoalId: { type: 'string' },
        reviewDate:      { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['code', 'title', 'probability', 'impact'],
    },
  },

  {
    name: 'update_risk',
    description: 'حدِّث خطراً أو فرصة موجودة (الحالة، المعالجة، التقييم، المسؤول).',
    input_schema: {
      type: 'object',
      properties: {
        id:            { type: 'string' },
        status:        { type: 'string', enum: ['IDENTIFIED','UNDER_TREATMENT','MITIGATED','ACCEPTED','CLOSED'] },
        probability:   { type: 'number', minimum: 1, maximum: 5 },
        impact:        { type: 'number', minimum: 1, maximum: 5 },
        treatment:     { type: 'string' },
        treatmentType: { type: 'string' },
        ownerId:       { type: 'string' },
        reviewDate:    { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // عدم المطابقة NCR (Clause 10.2)
  // ══════════════════════════════════════════════════
  {
    name: 'create_ncr',
    description: `أنشئ تقرير عدم مطابقة (NCR).
severity: منخفضة | متوسطة | مرتفعة.
reporterId: CUID المُبلِّغ (من users) — يجب أن يكون مستخدماً حقيقياً.`,
    input_schema: {
      type: 'object',
      properties: {
        code:         { type: 'string', description: 'NCR-2026-XXX' },
        title:        { type: 'string' },
        description:  { type: 'string' },
        severity:     { type: 'string', enum: ['منخفضة','متوسطة','مرتفعة'] },
        departmentId: { type: 'string', description: 'CUID القسم' },
        reporterId:   { type: 'string', description: 'CUID المُبلِّغ (من users)' },
        assigneeId:   { type: 'string', description: 'CUID المسؤول عن المعالجة' },
        rootCause:    { type: 'string' },
        correction:   { type: 'string', description: 'التصحيح الفوري' },
        dueDate:      { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['code', 'title', 'description', 'severity', 'reporterId'],
    },
  },

  {
    name: 'update_ncr',
    description: 'حدِّث تقرير عدم مطابقة (الحالة، السبب الجذري، الإجراء، الإغلاق).',
    input_schema: {
      type: 'object',
      properties: {
        id:              { type: 'string' },
        status:          { type: 'string', enum: ['OPEN','ROOT_CAUSE','ACTION_PLANNED','IN_PROGRESS','VERIFICATION','CLOSED'] },
        rootCause:       { type: 'string' },
        correction:      { type: 'string' },
        correctiveAction:{ type: 'string' },
        assigneeId:      { type: 'string' },
        dueDate:         { type: 'string', description: 'YYYY-MM-DD' },
        verifiedNote:    { type: 'string' },
        effective:       { type: 'boolean' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // الإجراءات التصحيحية CAPA (Clause 10.2)
  // ══════════════════════════════════════════════════
  {
    name: 'create_capa',
    description: `أنشئ إجراءً تصحيحياً (CAPA).
type: CORRECTIVE (تصحيحي) | PREVENTIVE (وقائي).
يمكن ربطه بـ NCR (ncrId) أو شكوى (complaintId) أو خطر (riskId).`,
    input_schema: {
      type: 'object',
      properties: {
        code:               { type: 'string', description: 'CAP-2026-XXX' },
        type:               { type: 'string', enum: ['CORRECTIVE','PREVENTIVE'] },
        title:              { type: 'string' },
        description:        { type: 'string' },
        rootCauseAnalysis:  { type: 'string' },
        plannedAction:      { type: 'string' },
        dueDate:            { type: 'string', description: 'YYYY-MM-DD' },
        ownerId:            { type: 'string', description: 'CUID المسؤول' },
        ncrId:              { type: 'string', description: 'CUID NCR المرتبط' },
        complaintId:        { type: 'string', description: 'CUID الشكوى المرتبطة' },
        riskId:             { type: 'string', description: 'CUID الخطر المرتبط' },
      },
      required: ['code', 'title', 'type'],
    },
  },

  {
    name: 'update_capa',
    description: 'حدِّث إجراءً تصحيحياً (الحالة، التنفيذ، الفعالية، الدروس المستفادة).',
    input_schema: {
      type: 'object',
      properties: {
        id:                 { type: 'string' },
        status:             { type: 'string', enum: ['OPEN','IN_PROGRESS','VERIFICATION','CLOSED','CANCELLED'] },
        plannedAction:      { type: 'string' },
        implementedAction:  { type: 'string' },
        verificationNote:   { type: 'string' },
        effective:          { type: 'boolean' },
        lessonsLearned:     { type: 'string' },
        ownerId:            { type: 'string' },
        dueDate:            { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // التدقيق الداخلي (Clause 9.2)
  // ══════════════════════════════════════════════════
  {
    name: 'plan_audit',
    description: `أنشئ جلسة تدقيق مجدولة.
type: INTERNAL | EXTERNAL | SUPPLIER | FOLLOWUP.
leadAuditorId: CUID مستخدم من users (اختياري).`,
    input_schema: {
      type: 'object',
      properties: {
        code:           { type: 'string', description: 'AUD-2026-XXX' },
        title:          { type: 'string' },
        type:           { type: 'string', enum: ['INTERNAL','EXTERNAL','SUPPLIER','FOLLOWUP'] },
        scope:          { type: 'string', description: 'نطاق التدقيق' },
        criteria:       { type: 'string', description: 'بنود ISO 9001:2015 المعنية' },
        plannedDate:    { type: 'string', description: 'YYYY-MM-DD' },
        leadAuditorId:  { type: 'string', description: 'CUID المدقق الرئيسي' },
        team:           { type: 'string', description: 'أعضاء فريق التدقيق' },
      },
      required: ['code', 'title', 'scope', 'plannedDate'],
    },
  },

  // ══════════════════════════════════════════════════
  // المراقبة والرصد (أدوات قراءة — تُنفَّذ دائماً)
  // ══════════════════════════════════════════════════
  {
    name: 'scan_overdue',
    description: `ابحث عن جميع البنود المتأخرة أو المحتاجة انتباهاً عبر النظام.
تُعيد قائمة بـ: NCRs متأخرة، CAPAs متأخرة، أهداف تشغيلية متأخرة، أنشطة تشغيلية متأخرة، مخاطر لم تُراجَع منذ 90 يوماً، شكاوى مفتوحة قديمة.
استخدمها للمراقبة الدورية أو عند السؤال عن التأخيرات.`,
    input_schema: {
      type: 'object',
      properties: {
        thresholdDays: { type: 'number', description: 'عدد الأيام لاعتبار البند "قديماً" (افتراضي: 30)' },
      },
    },
  },

  {
    name: 'compute_iso_maturity',
    description: `احسب درجة نضج نظام الجودة لكل بند من بنود ISO 9001:2015.
تُعيد درجة (0-100) لكل بند بناءً على البيانات الفعلية في النظام:
4.1 سياق المنظمة، 4.2 الأطراف ذات العلاقة، 4.4 العمليات،
6.1 المخاطر، 6.2 الأهداف، 7.2 الكفاءة والتدريب، 7.5 المستندات،
8.4 الموردون، 9.1.2 الشكاوى، 9.2 التدقيق، 9.3 مراجعة الإدارة، 10.2 عدم المطابقة.`,
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'generate_management_report',
    description: `أنشئ تقرير مدخلات مراجعة الإدارة جاهزاً للاجتماع (ISO 9.3.2).
يجمع من قاعدة البيانات: أداء الأهداف، حالة المخاطر، NCRs وCAPAs، نتائج التدقيق، الشكاوى، SWOT — ويُنتج نصاً منظماً.
استخدمها قبل اجتماعات مراجعة الإدارة أو عند طلب "أعدّ تقرير الإدارة".`,
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'الفترة (مثل: الربع الأول 2026)' },
      },
    },
  },

  // ══════════════════════════════════════════════════
  // المحقق الشهري (Digital Quality Investigator)
  // ══════════════════════════════════════════════════
  {
    name: 'compare_departments',
    description: `قارن أداء جميع الأقسام لشهر محدَّد.
يُعيد لكل قسم: الدرجة، الشهر السابق، الفرق، التصنيف (EXCELLENT | STABLE | WARNING | DISTRESSED | MISSING).
استخدمها للإجابة على "أي قسم متعثِّر؟" أو "ترتيب الأقسام".`,
    input_schema: {
      type: 'object',
      properties: {
        year:  { type: 'number' },
        month: { type: 'number', minimum: 1, maximum: 12 },
      },
    },
  },

  {
    name: 'detect_department_trends',
    description: `اكتشف الاتجاهات الزمنية لأداء الأقسام عبر عدة شهور.
يُعيد لكل قسم: ميل الأداء (slope)، اتجاه (IMPROVING | STABLE | DECLINING)، آخر درجة.
استخدمها لسؤال "أي قسم في انحدار؟" أو "الاتجاه العام".`,
    input_schema: {
      type: 'object',
      properties: {
        months:       { type: 'number', description: 'عدد الأشهر للرجوع للخلف (افتراضي 6)' },
        departmentId: { type: 'string', description: 'اختياري: تحليل قسم واحد' },
      },
    },
  },

  {
    name: 'detect_distressed_departments',
    description: `أظهر فقط الأقسام المتعثِّرة (WARNING/DISTRESSED) مع أسباب التصنيف.
استخدمها لفلترة الاهتمام في "على ماذا يجب أن أركّز كمدير جودة؟"`,
    input_schema: {
      type: 'object',
      properties: {
        year:  { type: 'number' },
        month: { type: 'number', minimum: 1, maximum: 12 },
      },
    },
  },

  {
    name: 'list_investigation_flags',
    description: `اقرأ علامات التحقيق النشطة (تناقضات، وعود متأخرة، شذوذ، أنماط سلوكية).`,
    input_schema: {
      type: 'object',
      properties: {
        status:       { type: 'string', enum: ['OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED'] },
        type:         { type: 'string', enum: ['CONTRADICTION','OVERDUE_PROMISE','TREND_DROP','ANOMALY','MISSING_DATA','BEHAVIORAL'] },
        departmentId: { type: 'string' },
      },
    },
  },

  {
    name: 'read_progress_report',
    description: `اقرأ تقرير شهري لقسم (تلقائي + إدخالات رئيس القسم + أسئلة التحقيق + الدرجة).`,
    input_schema: {
      type: 'object',
      properties: {
        reportId:     { type: 'string' },
        departmentId: { type: 'string' },
        year:         { type: 'number' },
        month:        { type: 'number' },
      },
    },
  },

  {
    name: 'generate_progress_report',
    description: `ولِّد تقرير شهري لقسم (يجمع البيانات تلقائياً + يُولِّد أسئلة تحقيقية ديناميكية).
استخدمها عندما يطلب المستخدم "جهِّز تقرير قسم X لشهر Y".`,
    input_schema: {
      type: 'object',
      properties: {
        departmentId:    { type: 'string' },
        year:            { type: 'number' },
        month:           { type: 'number', minimum: 1, maximum: 12 },
        forceRegenerate: { type: 'boolean', description: 'إعادة التوليد حتى لو وُجد تقرير' },
      },
      required: ['departmentId', 'year', 'month'],
    },
  },

  {
    name: 'investigate_cross_contradictions',
    description: `شغِّل فحص التناقضات بين الأقسام لشهر محدَّد — ينشئ InvestigationFlags تلقائياً.`,
    input_schema: {
      type: 'object',
      properties: {
        year:  { type: 'number' },
        month: { type: 'number', minimum: 1, maximum: 12 },
      },
    },
  },

  // ══════════════════════════════════════════════════
  // الشكاوى (Clause 9.1.2)
  // ══════════════════════════════════════════════════
  {
    name: 'create_complaint',
    description: `أنشئ شكوى جديدة.
source: BENEFICIARY | DONOR | VOLUNTEER | EMPLOYEE | PARTNER | OTHER
channel: PHONE | EMAIL | WEBSITE | IN_PERSON | WHATSAPP | SOCIAL | OTHER
severity: منخفضة | متوسطة | مرتفعة`,
    input_schema: {
      type: 'object',
      properties: {
        code:             { type: 'string', description: 'CMP-2026-XXX' },
        source:           { type: 'string', enum: ['BENEFICIARY','DONOR','VOLUNTEER','EMPLOYEE','PARTNER','OTHER'] },
        channel:          { type: 'string', enum: ['PHONE','EMAIL','WEBSITE','IN_PERSON','WHATSAPP','SOCIAL','OTHER'] },
        subject:          { type: 'string', description: 'موضوع الشكوى' },
        description:      { type: 'string' },
        severity:         { type: 'string', description: 'منخفضة | متوسطة | مرتفعة' },
        complainantName:  { type: 'string' },
        complainantPhone: { type: 'string' },
        assigneeId:       { type: 'string', description: 'CUID المسؤول عن المعالجة' },
      },
      required: ['code', 'source', 'channel', 'subject', 'description', 'severity'],
    },
  },

  {
    name: 'update_complaint',
    description: 'حدِّث حالة شكوى (معالجة، إغلاق، سبب جذري، رضا المشتكي).',
    input_schema: {
      type: 'object',
      properties: {
        id:          { type: 'string' },
        status:      { type: 'string', enum: ['NEW','UNDER_REVIEW','IN_PROGRESS','RESOLVED','CLOSED','REJECTED'] },
        rootCause:   { type: 'string' },
        resolution:  { type: 'string' },
        satisfaction: { type: 'number', minimum: 1, maximum: 5, description: 'تقييم رضا المشتكي 1-5' },
        assigneeId:  { type: 'string' },
        relatedNcrId:{ type: 'string', description: 'ربط بـ NCR إن تطلب الأمر إجراءً تصحيحياً' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // SWOT (Clause 4.1)
  // ══════════════════════════════════════════════════
  {
    name: 'create_swot_item',
    description: `أنشئ عنصر SWOT لتحليل سياق المنظمة (ISO 4.1).
type: STRENGTH | WEAKNESS | OPPORTUNITY | THREAT`,
    input_schema: {
      type: 'object',
      properties: {
        code:        { type: 'string', description: 'SWOT-XXX' },
        type:        { type: 'string', enum: ['STRENGTH','WEAKNESS','OPPORTUNITY','THREAT'] },
        category:    { type: 'string', description: 'داخلي | خارجي | سياسي | اقتصادي | اجتماعي | تقني' },
        description: { type: 'string' },
        impact:      { type: 'string', description: 'منخفض | متوسط | مرتفع' },
        strategy:    { type: 'string', description: 'استراتيجية التعامل مع هذا العنصر' },
        reviewDate:  { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['code', 'type', 'description'],
    },
  },

  {
    name: 'update_swot_item',
    description: 'حدِّث عنصر SWOT (الاستراتيجية، التأثير، الحالة).',
    input_schema: {
      type: 'object',
      properties: {
        id:          { type: 'string' },
        description: { type: 'string' },
        impact:      { type: 'string' },
        strategy:    { type: 'string' },
        status:      { type: 'string', enum: ['ACTIVE','INACTIVE','RESOLVED'] },
        reviewDate:  { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // مراجعة الإدارة (Clause 9.3)
  // ══════════════════════════════════════════════════
  {
    name: 'create_management_review',
    description: `جدوِل اجتماع مراجعة إدارة جديد (ISO 9.3).
status: PLANNED | IN_PROGRESS | COMPLETED`,
    input_schema: {
      type: 'object',
      properties: {
        code:        { type: 'string', description: 'MR-2026-XXX' },
        title:       { type: 'string' },
        meetingDate: { type: 'string', description: 'YYYY-MM-DD' },
        period:      { type: 'string', description: 'مثل: الربع الأول 2026' },
        attendees:   { type: 'string', description: 'أسماء الحضور' },
      },
      required: ['code', 'title', 'meetingDate'],
    },
  },

  {
    name: 'update_management_review',
    description: `سجِّل مدخلات ومخرجات اجتماع مراجعة الإدارة (ISO 9.3.2 و 9.3.3).
استخدمها لتعبئة نتائج الاجتماع: أداء الأهداف، المخاطر، الشكاوى، قرارات الإدارة.`,
    input_schema: {
      type: 'object',
      properties: {
        id:                   { type: 'string' },
        status:               { type: 'string', enum: ['PLANNED','IN_PROGRESS','COMPLETED'] },
        // مدخلات (9.3.2)
        contextChanges:       { type: 'string', description: 'تغييرات في سياق المنظمة' },
        objectivesReview:     { type: 'string', description: 'مراجعة تحقق الأهداف' },
        processPerformance:   { type: 'string', description: 'أداء العمليات' },
        conformityStatus:     { type: 'string', description: 'حالة المطابقة' },
        auditResults:         { type: 'string', description: 'نتائج التدقيق الداخلي' },
        customerFeedback:     { type: 'string', description: 'تغذية راجعة من المستفيدين' },
        risksStatus:          { type: 'string', description: 'حالة المخاطر والفرص' },
        improvementOpps:      { type: 'string', description: 'فرص التحسين' },
        topManagementPresent: { type: 'boolean', description: 'هل حضرت الإدارة العليا؟' },
        // مخرجات (9.3.3)
        decisions:            { type: 'string', description: 'القرارات المتخذة' },
        resourceNeeds:        { type: 'string', description: 'احتياجات الموارد' },
        improvementActions:   { type: 'string', description: 'إجراءات التحسين المقررة' },
        systemChanges:        { type: 'string', description: 'التغييرات على نظام الجودة' },
        minutes:              { type: 'string', description: 'ملخص محضر الاجتماع' },
        nextReview:           { type: 'string', description: 'YYYY-MM-DD تاريخ المراجعة القادمة' },
      },
      required: ['id'],
    },
  },

  // ══════════════════════════════════════════════════
  // التدريب والكفاءة (Clause 7.2)
  // ══════════════════════════════════════════════════
  {
    name: 'schedule_training',
    description: `أنشئ برنامج تدريبي جديد (ISO 7.2).
يمكن إضافة المشاركين لاحقاً عبر النظام.`,
    input_schema: {
      type: 'object',
      properties: {
        code:             { type: 'string', description: 'TRN-2026-XXX' },
        title:            { type: 'string' },
        description:      { type: 'string' },
        trainer:          { type: 'string', description: 'اسم المدرب أو الجهة' },
        date:             { type: 'string', description: 'YYYY-MM-DD' },
        duration:         { type: 'number', description: 'المدة بالساعات' },
        location:         { type: 'string' },
        category:         { type: 'string', description: 'جودة | سلامة | تقنية | قيادية | خدمة' },
        competenceTarget: { type: 'string', description: 'الكفاءة المستهدفة (ISO 7.2)' },
      },
      required: ['code', 'title', 'date'],
    },
  },

  // ══════════════════════════════════════════════════
  // التنسيق والأتمتة
  // ══════════════════════════════════════════════════
  {
    name: 'orchestrate_complaint',
    description: `سير عمل متكامل لمعالجة الشكوى:
① أنشئ سجل الشكوى
② إذا كانت الشكوى مرتفعة الخطورة → أنشئ NCR تلقائياً
③ أنشئ CAPA مرتبطاً بالشكوى/NCR
يوفر الوقت عند استلام شكوى جدية تتطلب إجراءً تصحيحياً كاملاً.`,
    input_schema: {
      type: 'object',
      properties: {
        complaintCode:    { type: 'string', description: 'CMP-2026-XXX' },
        source:           { type: 'string', enum: ['BENEFICIARY','DONOR','VOLUNTEER','EMPLOYEE','PARTNER','OTHER'] },
        channel:          { type: 'string', enum: ['PHONE','EMAIL','WEBSITE','IN_PERSON','WHATSAPP','SOCIAL','OTHER'] },
        subject:          { type: 'string' },
        description:      { type: 'string' },
        severity:         { type: 'string', description: 'منخفضة | متوسطة | مرتفعة' },
        complainantName:  { type: 'string' },
        createNcr:        { type: 'boolean', description: 'إنشاء NCR مرتبط (افتراضي: true للمرتفعة)' },
        ncrCode:          { type: 'string', description: 'NCR-2026-XXX (إن أردت إنشاء NCR)' },
        capaCode:         { type: 'string', description: 'CAP-2026-XXX (إن أردت إنشاء CAPA)' },
        reporterId:       { type: 'string', description: 'CUID المُبلِّغ (للـ NCR)' },
        assigneeId:       { type: 'string', description: 'CUID المسؤول' },
        rootCause:        { type: 'string', description: 'السبب الجذري المبدئي' },
        plannedAction:    { type: 'string', description: 'الإجراء المقترح للـ CAPA' },
        dueDate:          { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['complaintCode', 'source', 'channel', 'subject', 'description', 'severity'],
    },
  },
];

// الوكيل يرى فقط الأدوات التشغيلية/التحليلية (22 أداة بدل 35)
// الأدوات الهيكلية (create/delete objectives, activities, goals...) تبقى في executeTool
// لكن لا تُرسَل للنموذج تجنباً للتعقيد وزيادة التوكنات
export const AGENT_TOOLS = ALL_TOOLS.filter(t => !ADMIN_TOOL_NAMES.has(t.name));

// الأدوات الإدارية — للاستخدام المستقبلي (agent إداري منفصل)
export const ADMIN_TOOLS = ALL_TOOLS.filter(t => ADMIN_TOOL_NAMES.has(t.name));

// ─────────────────────────────────────────────────────────────────────────────
//  منفِّذ الأدوات
// ─────────────────────────────────────────────────────────────────────────────

export async function executeTool(name, input, actingUserId) {
  switch (name) {

    // ══ 1. get_system_state ══════════════════════════════════════════════════
    case 'get_system_state': {
      const want = new Set(input.sections || ['goals','activities','objectives','gaps']);
      if (want.has('all')) ['goals','activities','objectives','users','departments','risks','ncrs','capas','audits','complaints','gaps'].forEach(s => want.add(s));

      // Pagination: حد أقصى 200، افتراضي 50
      const pgLimit  = Math.min(Math.max(Number(input.limit  || 50), 1), 200);
      const pgOffset = Math.max(Number(input.offset || 0), 0);
      const result = {};

      if (want.has('goals')) {
        const total = await prisma.strategicGoal.count({ where: { deletedAt: null } });
        const items = await prisma.strategicGoal.findMany({
          where: { deletedAt: null }, orderBy: { code: 'asc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, title:true, target:true, responsible:true, kpi:true,
            baseline:true, startYear:true, endYear:true, progress:true, status:true,
            activities: { select:{ id:true, code:true, title:true } } },
        });
        result.goals = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('activities')) {
        const total = await prisma.operationalActivity.count();
        const items = await prisma.operationalActivity.findMany({
          orderBy: { code: 'asc' }, take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, title:true, strategicGoalId:true, department:true,
            responsible:true, targetValue:true, kpiType:true, progress:true, status:true,
            startDate:true, endDate:true, budget:true },
        });
        result.activities = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('objectives')) {
        const total = await prisma.objective.count({ where: { deletedAt: null } });
        const items = await prisma.objective.findMany({
          where: { deletedAt: null }, orderBy: { code: 'asc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, title:true, kpi:true, target:true, unit:true,
            baseline:true, currentValue:true, progress:true, status:true,
            startDate:true, dueDate:true, ownerId:true, departmentId:true, strategicGoalId:true,
            owner:{ select:{ id:true, name:true } },
            department:{ select:{ id:true, name:true } },
            strategicGoal:{ select:{ id:true, code:true } } },
        });
        result.objectives = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('users')) {
        result.users = await prisma.user.findMany({
          where: { active:true, email:{ not:'ai-agent@qms.local' } },
          select: { id:true, name:true, role:true, jobTitle:true, departmentId:true },
        });
      }
      if (want.has('departments')) {
        result.departments = await prisma.department.findMany({
          select: { id:true, code:true, name:true },
        });
      }
      if (want.has('risks')) {
        const total = await prisma.risk.count({ where: { deletedAt: null } });
        const items = await prisma.risk.findMany({
          where: { deletedAt: null }, orderBy: { code: 'asc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, type:true, title:true, probability:true, impact:true,
            score:true, level:true, status:true, treatment:true, ownerId:true,
            owner:{ select:{ id:true, name:true } } },
        });
        result.risks = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('ncrs')) {
        const total = await prisma.nCR.count({ where: { deletedAt: null } });
        const items = await prisma.nCR.findMany({
          where: { deletedAt: null }, orderBy: { code: 'asc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, title:true, severity:true, status:true,
            rootCause:true, dueDate:true,
            assignee:{ select:{ id:true, name:true } } },
        });
        result.ncrs = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('capas')) {
        const total = await prisma.capa.count({ where: { deletedAt: null } });
        const items = await prisma.capa.findMany({
          where: { deletedAt: null }, orderBy: { code: 'asc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, type:true, title:true, status:true, dueDate:true,
            owner:{ select:{ id:true, name:true } } },
        });
        result.capas = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('audits')) {
        const total = await prisma.audit.count({ where: { deletedAt: null } });
        const items = await prisma.audit.findMany({
          where: { deletedAt: null }, orderBy: { plannedDate: 'desc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, title:true, type:true, status:true, plannedDate:true,
            leadAuditor:{ select:{ id:true, name:true } } },
        });
        result.audits = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('complaints')) {
        const total = await prisma.complaint.count({ where: { deletedAt: null } });
        const items = await prisma.complaint.findMany({
          where: { deletedAt: null }, orderBy: { receivedAt: 'desc' },
          take: pgLimit, skip: pgOffset,
          select: { id:true, code:true, subject:true, status:true, severity:true, receivedAt:true,
            assignee:{ select:{ id:true, name:true } } },
        });
        result.complaints = { items, total, limit: pgLimit, offset: pgOffset };
      }
      if (want.has('swot')) {
        result.swot = await prisma.swotItem.findMany({
          where: { deletedAt: null }, orderBy: { type: 'asc' },
          select: { id:true, code:true, type:true, category:true, description:true, impact:true, strategy:true, status:true },
        });
      }
      if (want.has('management_reviews')) {
        result.managementReviews = await prisma.managementReview.findMany({
          where: { deletedAt: null }, orderBy: { meetingDate: 'desc' }, take: 10,
          select: { id:true, code:true, title:true, meetingDate:true, period:true, status:true, decisions:true },
        });
      }
      if (want.has('interested_parties')) {
        result.interestedParties = await prisma.interestedParty.findMany({
          where: { deletedAt: null },
          select: { id:true, code:true, name:true, type:true, influence:true, needs:true, expectations:true, status:true },
        });
      }
      if (want.has('suppliers')) {
        result.suppliers = await prisma.supplier.findMany({
          where: { deletedAt: null },
          select: { id:true, code:true, name:true, type:true, status:true, overallRating:true },
        });
      }
      if (want.has('trainings')) {
        result.trainings = await prisma.training.findMany({
          where: { deletedAt: null }, orderBy: { date: 'desc' }, take: 20,
          select: { id:true, code:true, title:true, trainer:true, date:true, duration:true, category:true, competenceTarget:true,
            records:{ select:{ userId:true, attended:true, effective:true } } },
        });
      }
      if (want.has('gaps')) {
        const goals = result.goals || await prisma.strategicGoal.findMany({
          where:{ deletedAt:null },
          select:{ id:true, code:true, title:true, target:true, responsible:true,
            activities:{ select:{ id:true } } },
        });
        const acts = result.activities || await prisma.operationalActivity.findMany({
          select:{ id:true, code:true, strategicGoalId:true, responsible:true, targetValue:true },
        });
        const objs = result.objectives || await prisma.objective.findMany({
          where:{ deletedAt:null }, select:{ id:true, code:true, ownerId:true, strategicGoalId:true },
        });
        result.gaps = {
          goalsWithoutTarget:      goals.filter(g=>!g.target?.trim()).map(g=>`${g.code}: ${g.title}`),
          goalsWithoutResponsible: goals.filter(g=>!g.responsible).map(g=>`${g.code}: ${g.title}`),
          goalsWithoutActivities:  goals.filter(g=>!g.activities?.length).map(g=>`${g.code}: ${g.title}`),
          activitiesNotLinked:     acts.filter(a=>!a.strategicGoalId).map(a=>a.code),
          activitiesWithoutTarget: acts.filter(a=>a.targetValue==null).map(a=>a.code),
          objectivesWithoutOwner:  objs.filter(o=>!o.ownerId).map(o=>o.code),
          objectivesNotLinked:     objs.filter(o=>!o.strategicGoalId).map(o=>o.code),
        };
      }

      const lines = [];
      if (result.goals)      lines.push(`${result.goals.length} أهداف استراتيجية`);
      if (result.activities) lines.push(`${result.activities.length} أنشطة تشغيلية`);
      if (result.objectives) lines.push(`${result.objectives.length} أهداف تشغيلية`);
      if (result.risks)      lines.push(`${result.risks.length} مخاطر/فرص`);
      if (result.ncrs)       lines.push(`${result.ncrs.length} NCR`);
      if (result.capas)      lines.push(`${result.capas.length} CAPA`);
      if (result.audits)              lines.push(`${result.audits.length} تدقيق`);
      if (result.swot)               lines.push(`${result.swot.length} SWOT`);
      if (result.managementReviews)  lines.push(`${result.managementReviews.length} مراجعة إدارة`);
      if (result.interestedParties)  lines.push(`${result.interestedParties.length} طرف ذو علاقة`);
      if (result.suppliers)          lines.push(`${result.suppliers.length} مورد`);
      if (result.trainings)          lines.push(`${result.trainings.length} تدريب`);
      if (result.gaps) {
        const gapCount = Object.values(result.gaps).flat().length;
        lines.push(gapCount === 0 ? '✅ لا فجوات' : `⚠️ ${gapCount} فجوة`);
      }

      return { ok:true, data:result, summary:`النظام: ${lines.join(' | ')}` };
    }

    // ══ التخطيط الاستراتيجي ══════════════════════════════════════════════════

    case 'update_strategic_goal': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل: id مفقود' };
      const data = pickFields(fields, ['target','responsible','kpi','baseline','initiatives','startYear','endYear','progress','status','notes']);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول للتحديث', summary:'فشل: لا حقول' };
      const u = await prisma.strategicGoal.update({ where:{id}, data });
      return { ok:true, data:{id:u.id, code:u.code}, summary:`✅ حُدِّث الهدف ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    case 'delete_strategic_goal': {
      const { id, reason } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل: id مفقود' };
      const goal = await prisma.strategicGoal.findUnique({ where:{id}, select:{id:true,code:true,title:true,deletedAt:true} });
      if (!goal) return { ok:false, error:`الهدف ${id} غير موجود`, summary:'فشل: غير موجود' };
      if (goal.deletedAt) return { ok:false, error:`الهدف ${goal.code} محذوف مسبقاً`, summary:'فشل: محذوف مسبقاً' };
      // فك ربط الأنشطة والأهداف التشغيلية أولاً
      await prisma.$transaction([
        prisma.operationalActivity.updateMany({ where:{strategicGoalId:id}, data:{strategicGoalId:null} }),
        prisma.objective.updateMany({ where:{strategicGoalId:id}, data:{strategicGoalId:null} }),
        prisma.risk.updateMany({ where:{strategicGoalId:id}, data:{strategicGoalId:null} }),
        prisma.strategicGoal.update({ where:{id}, data:{deletedAt:new Date(), notes: reason ? `محذوف: ${reason}` : undefined} }),
      ]);
      return { ok:true, summary:`🗑 حُذف الهدف ${goal.code}: "${goal.title}"${reason ? ` — ${reason}` : ''}` };
    }

    case 'update_operational_activity': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['department','responsible','targetValue','budget','spent','startDate','endDate','kpiType','progress','status','strategicGoalId','notes']);
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate)   data.endDate   = new Date(data.endDate);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.operationalActivity.update({ where:{id}, data });
      return { ok:true, data:{id:u.id, code:u.code}, summary:`✅ حُدِّث النشاط ${u.code}` };
    }

    case 'delete_operational_activity': {
      const { id, reason } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const act = await prisma.operationalActivity.findUnique({ where:{id}, select:{id:true,code:true,title:true,deletedAt:true} });
      if (!act) return { ok:false, error:`النشاط ${id} غير موجود`, summary:'فشل: غير موجود' };
      if (act.deletedAt) return { ok:false, error:`النشاط ${act.code} محذوف مسبقاً`, summary:'فشل: محذوف مسبقاً' };
      // Soft delete — نحتفظ بالبيانات لمتطلبات ISO 9001
      await prisma.operationalActivity.update({
        where: { id },
        data: { deletedAt: new Date(), notes: reason ? `محذوف: ${reason}` : undefined },
      });
      return { ok:true, summary:`🗑 حُذف النشاط ${act.code}: "${act.title}"${reason ? ` — ${reason}` : ''}` };
    }

    case 'create_operational_activity': {
      const { code, title, description, department, responsible, targetValue, kpiType,
              budget, startDate, endDate, strategicGoalId, perspective } = input;
      if (!code || !title) return { ok:false, error:'code و title مطلوبان', summary:'فشل' };
      const resolvedGoal = strategicGoalId ? await resolveGoal(strategicGoalId) : null;
      try {
        const c = await prisma.operationalActivity.create({ data:{
          code, title, description:description||null, department:department||null,
          responsible:responsible||null, targetValue:targetValue!=null?parseFloat(targetValue):null,
          kpiType:kpiType||'CUMULATIVE', budget:budget!=null?parseFloat(budget):null,
          startDate:startDate?new Date(startDate):null, endDate:endDate?new Date(endDate):null,
          strategicGoalId:resolvedGoal, perspective:perspective||null, status:'PLANNED',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئ نشاط ${c.code}: "${c.title}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:`فشل: كود مكرر` };
        throw e;
      }
    }

    case 'link_activity_to_goal': {
      const { activityId, strategicGoalId } = input;
      if (!activityId||!strategicGoalId) return { ok:false, error:'activityId و strategicGoalId مطلوبان', summary:'فشل' };
      const u = await prisma.operationalActivity.update({ where:{id:activityId}, data:{strategicGoalId} });
      return { ok:true, summary:`✅ رُبط النشاط ${u.code} بالهدف الاستراتيجي` };
    }

    // ══ الأهداف التشغيلية ════════════════════════════════════════════════════

    case 'create_objective': {
      const { code, title, kpi, target, unit, baseline, startDate, dueDate, description,
              ownerId, departmentId, strategicGoalId } = input;
      if (!code||!title||!kpi||target==null) return { ok:false, error:'code, title, kpi, target مطلوبة', summary:'فشل' };
      const [resolvedOwner, resolvedDept, resolvedGoal] = await Promise.all([
        ownerId        ? resolveUser(ownerId)       : null,
        departmentId   ? resolveDept(departmentId)  : null,
        strategicGoalId? resolveGoal(strategicGoalId): null,
      ]);
      try {
        const c = await prisma.objective.create({ data:{
          code, title, kpi, target:parseFloat(target), unit:unit||null,
          baseline:baseline!=null?parseFloat(baseline):null, description:description||null,
          startDate:startDate?new Date(startDate):new Date(),
          dueDate:dueDate?new Date(dueDate):new Date(new Date().getFullYear(),11,31),
          ownerId:resolvedOwner, departmentId:resolvedDept, strategicGoalId:resolvedGoal,
          createdById:actingUserId, status:'PLANNED',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئ هدف تشغيلي ${c.code}: "${c.title}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر — غيِّره`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_objective': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['title','kpi','target','unit','baseline','currentValue','ownerId','departmentId','strategicGoalId','progress','status','description']);
      if (data.target!=null)       data.target       = parseFloat(data.target);
      if (data.baseline!=null)     data.baseline     = parseFloat(data.baseline);
      if (data.currentValue!=null) data.currentValue = parseFloat(data.currentValue);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.objective.update({ where:{id}, data });
      return { ok:true, data:{id:u.id, code:u.code}, summary:`✅ حُدِّث الهدف التشغيلي ${u.code}` };
    }

    case 'delete_objective': {
      const { id, reason } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const obj = await prisma.objective.findUnique({ where:{id}, select:{id:true,code:true,title:true,deletedAt:true} });
      if (!obj) return { ok:false, error:`الهدف ${id} غير موجود`, summary:'فشل: غير موجود' };
      if (obj.deletedAt) return { ok:false, error:`الهدف ${obj.code} محذوف مسبقاً`, summary:'فشل: محذوف مسبقاً' };
      await prisma.kpiEntry.deleteMany({ where:{objectiveId:id} });
      await prisma.objective.update({ where:{id}, data:{deletedAt:new Date()} });
      return { ok:true, summary:`🗑 حُذف الهدف التشغيلي ${obj.code}: "${obj.title}"${reason ? ` — ${reason}` : ''}` };
    }

    case 'assign_responsible': {
      const { entity, id, responsible } = input;
      if (!entity||!id||!responsible) return { ok:false, error:'entity, id, responsible مطلوبة', summary:'فشل' };
      if (entity==='StrategicGoal') {
        const u = await prisma.strategicGoal.update({ where:{id}, data:{responsible} });
        return { ok:true, summary:`✅ عُيِّن "${responsible}" مسؤولاً عن ${u.code}` };
      }
      if (entity==='OperationalActivity') {
        const u = await prisma.operationalActivity.update({ where:{id}, data:{responsible} });
        return { ok:true, summary:`✅ عُيِّن "${responsible}" مسؤولاً عن ${u.code}` };
      }
      return { ok:false, error:`entity غير مدعوم: ${entity}`, summary:'فشل' };
    }

    case 'assign_owner': {
      const { entity, id, ownerId, departmentId } = input;
      if (!entity||!id||!ownerId) return { ok:false, error:'entity, id, ownerId مطلوبة', summary:'فشل' };
      const user = await prisma.user.findUnique({ where:{id:ownerId}, select:{id:true,name:true} });
      if (!user) {
        const all = await prisma.user.findMany({ where:{active:true}, select:{id:true,name:true} });
        return { ok:false, error:`المستخدم ${ownerId} غير موجود. المتاحون: ${all.map(u=>`${u.name}(${u.id})`).join(', ')}`, summary:'فشل: مستخدم غير موجود' };
      }
      const data = { ownerId };
      if (departmentId) data.departmentId = departmentId;
      if (entity==='Objective') {
        const u = await prisma.objective.update({ where:{id}, data });
        return { ok:true, summary:`✅ عُيِّن "${user.name}" مالكاً للهدف ${u.code}` };
      }
      if (entity==='Risk') {
        await prisma.risk.update({ where:{id}, data:{ ownerId } });
        return { ok:true, summary:`✅ عُيِّن "${user.name}" مالكاً للخطر` };
      }
      if (entity==='Capa') {
        await prisma.capa.update({ where:{id}, data:{ ownerId } });
        return { ok:true, summary:`✅ عُيِّن "${user.name}" مالكاً لـ CAPA` };
      }
      return { ok:false, error:`entity غير مدعوم: ${entity}`, summary:'فشل' };
    }

    case 'log_kpi_entry': {
      const { objectiveId, activityId, value, year, month, note } = input;
      if (value==null||!year||!month) return { ok:false, error:'value, year, month مطلوبة', summary:'فشل' };
      if (!objectiveId && !activityId) return { ok:false, error:'objectiveId أو activityId مطلوب', summary:'فشل' };
      const yr = parseInt(year); const mo = parseInt(month);
      if (objectiveId) {
        const obj = await prisma.objective.findUnique({ where:{id:objectiveId}, select:{id:true,code:true,target:true} });
        if (!obj) return { ok:false, error:`الهدف ${objectiveId} غير موجود`, summary:'فشل' };
        await prisma.kpiEntry.upsert({
          where: { objectiveId_year_month: { objectiveId, year:yr, month:mo } },
          create: { objectiveId, year:yr, month:mo, actualValue:parseFloat(value), note:note||null, enteredById:actingUserId },
          update: { actualValue:parseFloat(value), note:note||null, enteredById:actingUserId },
        });
        // استعلم عن آخر قراءة زمنياً بعد الـ upsert (قد تكون الجديدة أو الأحدث)
        const latest = await prisma.kpiEntry.findFirst({
          where: { objectiveId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          select: { actualValue: true },
        });
        const latestVal = latest ? parseFloat(latest.actualValue) : parseFloat(value);
        await prisma.objective.update({ where:{id:objectiveId}, data:{
          currentValue: latestVal,
          progress: obj.target ? Math.min(100, Math.round((latestVal/obj.target)*100)) : undefined,
        }});
        return { ok:true, summary:`✅ سُجِّلت قيمة KPI للهدف ${obj.code}: ${value} (${yr}/${mo})` };
      } else {
        const act = await prisma.operationalActivity.findUnique({ where:{id:activityId}, select:{id:true,code:true,targetValue:true} });
        if (!act) return { ok:false, error:`النشاط ${activityId} غير موجود`, summary:'فشل' };
        await prisma.kpiEntry.upsert({
          where: { activityId_year_month: { activityId, year:yr, month:mo } },
          create: { activityId, year:yr, month:mo, actualValue:parseFloat(value), note:note||null, enteredById:actingUserId },
          update: { actualValue:parseFloat(value), note:note||null, enteredById:actingUserId },
        });
        if (act.targetValue) {
          const latestAct = await prisma.kpiEntry.findFirst({
            where: { activityId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            select: { actualValue: true },
          });
          const latestValA = latestAct ? parseFloat(latestAct.actualValue) : parseFloat(value);
          await prisma.operationalActivity.update({ where:{id:activityId}, data:{
            progress: Math.min(100, Math.round((latestValA/act.targetValue)*100)),
          }});
        }
        return { ok:true, summary:`✅ سُجِّلت قيمة KPI للنشاط ${act.code}: ${value} (${yr}/${mo})` };
      }
    }

    // ══ المخاطر ══════════════════════════════════════════════════════════════

    case 'create_risk': {
      const { code, title, description, source, probability, impact, type,
              treatment, treatmentType, departmentId, ownerId, strategicGoalId, reviewDate } = input;
      if (!code||!title||probability==null||impact==null) return { ok:false, error:'code, title, probability, impact مطلوبة', summary:'فشل' };
      const score = probability * impact;
      const level = score >= 15 ? 'حرج' : score >= 10 ? 'مرتفع' : score >= 5 ? 'متوسط' : 'منخفض';
      const [resolvedDept, resolvedOwner, resolvedGoal] = await Promise.all([
        departmentId   ? resolveDept(departmentId)   : null,
        ownerId        ? resolveUser(ownerId)         : null,
        strategicGoalId? resolveGoal(strategicGoalId) : null,
      ]);
      try {
        const c = await prisma.risk.create({ data:{
          code, title, description:description||null, source:source||null,
          type:(type||'RISK'), probability, impact, score, level,
          treatment:treatment||null, treatmentType:treatmentType||null,
          departmentId:resolvedDept, ownerId:resolvedOwner, strategicGoalId:resolvedGoal,
          reviewDate:reviewDate?new Date(reviewDate):null,
          createdById:actingUserId, status:'IDENTIFIED', workflowState:'DRAFT',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئ ${type==='OPPORTUNITY'?'فرصة':'خطر'} ${c.code}: "${c.title}" — مستوى: ${level}` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_risk': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['status','probability','impact','treatment','treatmentType','ownerId','reviewDate']);
      if (data.reviewDate) data.reviewDate = new Date(data.reviewDate);
      if (data.probability!=null && data.impact!=null) {
        data.score = data.probability * data.impact;
        data.level = data.score>=15?'حرج':data.score>=10?'مرتفع':data.score>=5?'متوسط':'منخفض';
      }
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.risk.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّث الخطر ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    // ══ عدم المطابقة NCR ═════════════════════════════════════════════════════

    case 'create_ncr': {
      const { code, title, description, severity, departmentId, reporterId, assigneeId, rootCause, correction, dueDate } = input;
      if (!code||!title||!description||!severity||!reporterId) return { ok:false, error:'code, title, description, severity, reporterId مطلوبة', summary:'فشل' };
      const resolvedDept     = departmentId ? await resolveDept(departmentId)  : null;
      const resolvedAssignee = assigneeId   ? await resolveUser(assigneeId)    : null;
      try {
        const c = await prisma.nCR.create({ data:{
          code, title, description, severity,
          departmentId:resolvedDept, reporterId, assigneeId:resolvedAssignee,
          rootCause:rootCause||null, correction:correction||null,
          dueDate:dueDate?new Date(dueDate):null,
          status:'OPEN', workflowState:'DRAFT',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئ NCR ${c.code}: "${c.title}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_ncr': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['status','rootCause','correction','correctiveAction','assigneeId','dueDate','verifiedNote','effective']);
      if (data.dueDate) data.dueDate = new Date(data.dueDate);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.nCR.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّث NCR ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    // ══ CAPA ═════════════════════════════════════════════════════════════════

    case 'create_capa': {
      const { code, type, title, description, rootCauseAnalysis, plannedAction, dueDate, ownerId, ncrId, complaintId, riskId } = input;
      if (!code||!title||!type) return { ok:false, error:'code, title, type مطلوبة', summary:'فشل' };
      const resolvedOwner = ownerId ? await resolveUser(ownerId) : null;
      try {
        const c = await prisma.capa.create({ data:{
          code, type, title, description:description||null,
          rootCauseAnalysis:rootCauseAnalysis||null, plannedAction:plannedAction||null,
          dueDate:dueDate?new Date(dueDate):null,
          ownerId:resolvedOwner, ncrId:ncrId||null, complaintId:complaintId||null, riskId:riskId||null,
          createdById:actingUserId, status:'OPEN', sourceType:'MANUAL',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئ CAPA ${c.code}: "${c.title}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_capa': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['status','plannedAction','implementedAction','verificationNote','effective','lessonsLearned','ownerId','dueDate']);
      if (data.dueDate) data.dueDate = new Date(data.dueDate);
      if (data.status==='CLOSED' && !data.closedAt) data.closedAt = new Date();
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.capa.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّث CAPA ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    // ══ التدقيق ══════════════════════════════════════════════════════════════

    case 'plan_audit': {
      const { code, title, type, scope, criteria, plannedDate, leadAuditorId, team } = input;
      if (!code||!title||!scope||!plannedDate) return { ok:false, error:'code, title, scope, plannedDate مطلوبة', summary:'فشل' };
      const resolvedLead = leadAuditorId ? await resolveUser(leadAuditorId) : null;
      try {
        const c = await prisma.audit.create({ data:{
          code, title, type:type||'INTERNAL', scope, criteria:criteria||null,
          plannedDate:new Date(plannedDate), leadAuditorId:resolvedLead, team:team||null,
          status:'PLANNED',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ جُدِّل تدقيق ${c.code}: "${c.title}" في ${plannedDate}` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    // ══ scan_overdue — مراقبة التأخيرات ════════════════════════════════════════

    case 'scan_overdue': {
      const days = input.thresholdDays || 30;
      const now  = new Date();
      const cutoff = new Date(now - days * 86400000);
      const oldCutoff = new Date(now - 90 * 86400000); // 90 يوماً للمخاطر

      const [overdueNcrs, overdueCapa, overdueObjs, overdueActs, staleRisks, oldComplaints] = await Promise.all([
        prisma.nCR.findMany({
          where: { deletedAt:null, status:{ notIn:['CLOSED'] }, dueDate:{ lt:now } },
          select: { id:true, code:true, title:true, severity:true, status:true, dueDate:true,
            assignee:{ select:{ name:true } } },
        }),
        prisma.capa.findMany({
          where: { deletedAt:null, status:{ notIn:['CLOSED','CANCELLED'] }, dueDate:{ lt:now } },
          select: { id:true, code:true, title:true, status:true, dueDate:true,
            owner:{ select:{ name:true } } },
        }),
        prisma.objective.findMany({
          where: { deletedAt:null, status:{ notIn:['ACHIEVED','CANCELLED'] }, dueDate:{ lt:now } },
          select: { id:true, code:true, title:true, progress:true, dueDate:true,
            owner:{ select:{ name:true } } },
        }),
        prisma.operationalActivity.findMany({
          where: { deletedAt:null, status:{ notIn:['COMPLETED','CANCELLED'] }, endDate:{ lt:now } },
          select: { id:true, code:true, title:true, progress:true, status:true, endDate:true, responsible:true },
        }),
        prisma.risk.findMany({
          where: { deletedAt:null, status:{ notIn:['CLOSED','MITIGATED','ACCEPTED'] },
            OR:[{ reviewDate:{ lt:oldCutoff } }, { reviewDate:null }] },
          select: { id:true, code:true, title:true, level:true, status:true, reviewDate:true },
        }),
        prisma.complaint.findMany({
          where: { deletedAt:null, status:{ notIn:['CLOSED','REJECTED','RESOLVED'] }, receivedAt:{ lt:cutoff } },
          select: { id:true, code:true, subject:true, severity:true, status:true, receivedAt:true },
        }),
      ]);

      const total = overdueNcrs.length + overdueCapa.length + overdueObjs.length +
                    overdueActs.length + staleRisks.length + oldComplaints.length;

      return {
        ok: true,
        data: { overdueNcrs, overdueCapa, overdueObjectives:overdueObjs,
                overdueActivities:overdueActs, staleRisks, oldComplaints },
        summary: total === 0
          ? `✅ لا بنود متأخرة — النظام في حالة جيدة`
          : `⚠️ ${total} بند يحتاج انتباهاً: NCR(${overdueNcrs.length}) CAPA(${overdueCapa.length}) أهداف(${overdueObjs.length}) أنشطة(${overdueActs.length}) مخاطر(${staleRisks.length}) شكاوى(${oldComplaints.length})`,
      };
    }

    // ══ compute_iso_maturity — نضج ISO ══════════════════════════════════════════

    case 'compute_iso_maturity': {
      const [swotCount, ipCount, procCount, risks, objs, trainRec, docs, suppliers,
             complaints, audits, mgmtRevs, ncrs, capas] = await Promise.all([
        prisma.swotItem.count({ where:{ deletedAt:null } }),
        prisma.interestedParty.count({ where:{ deletedAt:null } }),
        prisma.process.count({ where:{ deletedAt:null } }),
        prisma.risk.findMany({ where:{ deletedAt:null }, select:{ status:true, level:true, treatment:true } }),
        prisma.objective.findMany({ where:{ deletedAt:null }, select:{ status:true, progress:true, ownerId:true, kpi:true } }),
        prisma.trainingRecord.count({ where:{ attended:true } }),
        prisma.document.findMany({ where:{ deletedAt:null }, select:{ status:true } }),
        prisma.supplier.count({ where:{ deletedAt:null, status:'APPROVED' } }),
        prisma.complaint.findMany({ where:{ deletedAt:null }, select:{ status:true, resolution:true } }),
        prisma.audit.findMany({ where:{ deletedAt:null }, select:{ status:true } }),
        prisma.managementReview.findMany({ where:{ deletedAt:null }, select:{ status:true, decisions:true } }),
        prisma.nCR.findMany({ where:{ deletedAt:null }, select:{ status:true } }),
        prisma.capa.findMany({ where:{ deletedAt:null }, select:{ status:true, effective:true } }),
      ]);

      const score = (val, max) => Math.min(100, Math.round((val / Math.max(max, 1)) * 100));

      const clauses = {
        '4.1 سياق المنظمة':         score(swotCount, 8),
        '4.2 الأطراف ذات العلاقة':  score(ipCount, 6),
        '4.4 العمليات':             score(procCount, 5),
        '6.1 المخاطر والفرص':       score(risks.filter(r=>r.treatment).length, Math.max(risks.length, 1)),
        '6.2 أهداف الجودة':         score(objs.filter(o=>o.ownerId && o.kpi).length, Math.max(objs.length, 1)),
        '7.2 الكفاءة والتدريب':     score(Math.min(trainRec, 20), 20),
        '7.5 المستندات':            score(docs.filter(d=>['APPROVED','PUBLISHED'].includes(d.status)).length, Math.max(docs.length, 1)),
        '8.4 الموردون':             score(suppliers, 5),
        '9.1.2 رضا العملاء':        complaints.length > 0 ? score(complaints.filter(c=>['RESOLVED','CLOSED'].includes(c.status)).length, complaints.length) : 50,
        '9.2 التدقيق الداخلي':     score(audits.filter(a=>a.status==='COMPLETED').length, Math.max(audits.length, 1)),
        '9.3 مراجعة الإدارة':      score(mgmtRevs.filter(m=>m.status==='COMPLETED' && m.decisions).length, Math.max(mgmtRevs.length, 1)),
        '10.2 عدم المطابقة/CAPA':  (ncrs.length + capas.length) === 0 ? 30 :
          score(ncrs.filter(n=>n.status==='CLOSED').length + capas.filter(c=>c.status==='CLOSED').length,
                ncrs.length + capas.length),
      };

      const avg = Math.round(Object.values(clauses).reduce((a,b)=>a+b,0) / Object.keys(clauses).length);
      const level = avg >= 80 ? 'ممتاز' : avg >= 60 ? 'جيد' : avg >= 40 ? 'متوسط' : 'يحتاج تحسيناً';
      const weak  = Object.entries(clauses).filter(([,v])=>v<50).map(([k])=>k);

      return {
        ok: true,
        data: { clauses, overall: avg, level, weakClauses: weak },
        summary: `📊 نضج ISO: ${avg}% (${level}) — أضعف البنود: ${weak.slice(0,3).join('، ') || 'لا يوجد'}`,
      };
    }

    // ══ generate_management_report ═══════════════════════════════════════════════

    case 'generate_management_report': {
      const period = input.period || `الربع ${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`;
      const now = new Date();
      const since = new Date(now - 90 * 86400000);

      const [goals, objs, risks, ncrs, capas, complaints, audits, kpiCount, progReports, openFlags] = await Promise.all([
        prisma.strategicGoal.findMany({ where:{ deletedAt:null }, select:{ code:true, title:true, progress:true, status:true } }),
        prisma.objective.findMany({ where:{ deletedAt:null }, select:{ code:true, title:true, target:true, currentValue:true, progress:true, status:true, unit:true } }),
        prisma.risk.findMany({ where:{ deletedAt:null }, select:{ level:true, status:true, type:true } }),
        prisma.nCR.findMany({ where:{ deletedAt:null, createdAt:{ gte:since } }, select:{ severity:true, status:true } }),
        prisma.capa.findMany({ where:{ deletedAt:null }, select:{ status:true, effective:true, dueDate:true } }),
        prisma.complaint.findMany({ where:{ deletedAt:null, createdAt:{ gte:since } }, select:{ severity:true, status:true, resolution:true } }),
        prisma.audit.findMany({ where:{ deletedAt:null }, orderBy:{ plannedDate:'desc' }, take:5, select:{ code:true, title:true, status:true, plannedDate:true } }),
        prisma.kpiEntry.count({ where:{ enteredAt:{ gte:since } } }),
        // المحقق الشهري — آخر 3 أشهر
        prisma.progressReport.findMany({
          where: { deletedAt: null, status: { in: ['SUBMITTED', 'APPROVED'] },
                   createdAt: { gte: new Date(now - 90 * 86400000) } },
          select: { departmentId: true, score: true, year: true, month: true, status: true },
        }).catch(() => []),
        prisma.investigationFlag.findMany({
          where: { status: 'OPEN' },
          select: { type: true, severity: true, title: true },
        }).catch(() => []),
      ]);

      const lines = [
        `# تقرير مراجعة الإدارة — ${period}`,
        `تاريخ الإعداد: ${now.toLocaleDateString('ar-SA')}`,
        '',
        '## أولاً: أداء الأهداف الاستراتيجية',
        ...goals.map(g => `• ${g.code} — ${g.title}: ${g.progress}% (${g.status})`),
        '',
        '## ثانياً: مؤشرات الأداء الرئيسية (KPIs)',
        `• ${objs.length} هدف تشغيلي — ${objs.filter(o=>o.status==='ACHIEVED').length} محقق — ${objs.filter(o=>o.status==='DELAYED').length} متأخر`,
        `• إجمالي قيم KPI المُسجَّلة (آخر 90 يوم): ${kpiCount}`,
        ...objs.filter(o=>o.currentValue!=null).map(o => `  - ${o.code}: ${o.currentValue}/${o.target} ${o.unit||''} (${o.progress}%)`),
        '',
        '## ثالثاً: المخاطر والفرص',
        `• ${risks.filter(r=>r.type==='RISK').length} خطر — ${risks.filter(r=>r.level==='حرج').length} حرج — ${risks.filter(r=>r.level==='مرتفع').length} مرتفع`,
        `• ${risks.filter(r=>r.status==='CLOSED'||r.status==='MITIGATED').length} مُعالَج`,
        '',
        '## رابعاً: عدم المطابقة والإجراءات التصحيحية',
        `• NCR (آخر 90 يوم): ${ncrs.length} — مغلق: ${ncrs.filter(n=>n.status==='CLOSED').length}`,
        `• CAPA: ${capas.length} إجمالي — ${capas.filter(c=>c.status==='CLOSED').length} مغلق — ${capas.filter(c=>c.effective===true).length} فعّال`,
        `• CAPAs متأخرة: ${capas.filter(c=>c.dueDate && new Date(c.dueDate)<now && c.status!=='CLOSED').length}`,
        '',
        '## خامساً: الشكاوى ورضا المستفيدين',
        `• الشكاوى (آخر 90 يوم): ${complaints.length} — محلولة: ${complaints.filter(c=>['RESOLVED','CLOSED'].includes(c.status)).length}`,
        `• الشكاوى المرتفعة: ${complaints.filter(c=>c.severity==='مرتفعة').length}`,
        '',
        '## سادساً: التدقيق الداخلي',
        ...audits.map(a => `• ${a.code} — ${a.title}: ${a.status} (${new Date(a.plannedDate).toLocaleDateString('ar-SA')})`),
        '',
        '## سابعاً: تقارير الأقسام الشهرية (المحقق الشهري)',
        progReports.length
          ? `• ${progReports.length} تقرير شهري خلال آخر 90 يوماً — متوسط الدرجة: ${
              (progReports.reduce((s, r) => s + (r.score || 0), 0) / progReports.length).toFixed(1)
            }/100`
          : '• لا توجد تقارير شهرية مُرسلة خلال آخر 90 يوماً',
        ...(() => {
          const distressed = progReports.filter(r => (r.score || 0) < 50);
          return distressed.length
            ? [`🔴 ${distressed.length} تقرير بدرجة أقل من 50 (متعثِّر)`]
            : [];
        })(),
        openFlags.length > 0
          ? `• علامات تحقيق مفتوحة: ${openFlags.length} (منها ${openFlags.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length} حرجة/عالية)`
          : '',
        '',
        '## توصيات للمراجعة',
        goals.filter(g=>g.progress<30).length > 0 ? `⚠️ ${goals.filter(g=>g.progress<30).length} أهداف استراتيجية بتقدم أقل من 30%` : '',
        risks.filter(r=>r.level==='حرج').length > 0 ? `🔴 ${risks.filter(r=>r.level==='حرج').length} مخاطر حرجة تستوجب قرار الإدارة` : '',
        capas.filter(c=>c.dueDate && new Date(c.dueDate)<now && c.status!=='CLOSED').length > 0 ? `⏰ CAPAs متأخرة تحتاج متابعة عاجلة` : '',
      ].filter(l => l !== '');

      return {
        ok: true,
        data: { period, report: lines.join('\n') },
        summary: `📋 تقرير مراجعة الإدارة (${period}) — ${goals.length} هدف، ${objs.length} مؤشر، ${risks.length} خطر، ${ncrs.length} NCR، ${complaints.length} شكوى`,
      };
    }

    // ══ create_complaint ═════════════════════════════════════════════════════════

    case 'create_complaint': {
      const { code, source, channel, subject, description, severity, complainantName, complainantPhone, assigneeId } = input;
      if (!code||!source||!channel||!subject||!description||!severity) return { ok:false, error:'code, source, channel, subject, description, severity مطلوبة', summary:'فشل' };
      const resolvedAssignee = assigneeId ? await resolveUser(assigneeId) : null;
      try {
        const c = await prisma.complaint.create({ data:{
          code, source, channel, subject, description, severity,
          complainantName:complainantName||null, complainantPhone:complainantPhone||null,
          assigneeId:resolvedAssignee, status:'NEW',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُنشئت شكوى ${c.code}: "${c.subject}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_complaint': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['status','rootCause','resolution','satisfaction','assigneeId','relatedNcrId']);
      if (data.status === 'RESOLVED' && !data.resolvedAt) data.resolvedAt = new Date();
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.complaint.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّثت الشكوى ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    // ══ create_swot_item ════════════════════════════════════════════════════════

    case 'create_swot_item': {
      const { code, type, category, description, impact, strategy, reviewDate } = input;
      if (!code||!type||!description) return { ok:false, error:'code, type, description مطلوبة', summary:'فشل' };
      try {
        const c = await prisma.swotItem.create({ data:{
          code, type, category:category||null, description, impact:impact||null,
          strategy:strategy||null, reviewDate:reviewDate?new Date(reviewDate):null, status:'ACTIVE',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ أُضيف عنصر SWOT ${c.code} (${type}): "${description.slice(0,60)}"` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_swot_item': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, ['description','impact','strategy','status','reviewDate']);
      if (data.reviewDate) data.reviewDate = new Date(data.reviewDate);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.swotItem.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّث عنصر SWOT ${u.code}` };
    }

    // ══ create_management_review ════════════════════════════════════════════════

    case 'create_management_review': {
      const { code, title, meetingDate, period, attendees } = input;
      if (!code||!title||!meetingDate) return { ok:false, error:'code, title, meetingDate مطلوبة', summary:'فشل' };
      try {
        const c = await prisma.managementReview.create({ data:{
          code, title, meetingDate:new Date(meetingDate),
          period:period||null, attendees:attendees||null, status:'PLANNED',
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ جُدِّلت مراجعة إدارة ${c.code}: "${c.title}" في ${meetingDate}` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    case 'update_management_review': {
      const { id, ...fields } = input;
      if (!id) return { ok:false, error:'id مطلوب', summary:'فشل' };
      const data = pickFields(fields, [
        'status','contextChanges','objectivesReview','processPerformance','conformityStatus',
        'auditResults','customerFeedback','risksStatus','improvementOpps','topManagementPresent',
        'decisions','resourceNeeds','improvementActions','systemChanges','minutes','nextReview',
      ]);
      if (data.nextReview) data.nextReview = new Date(data.nextReview);
      if (!Object.keys(data).length) return { ok:false, error:'لا حقول', summary:'فشل' };
      const u = await prisma.managementReview.update({ where:{id}, data });
      return { ok:true, summary:`✅ حُدِّثت مراجعة الإدارة ${u.code}: ${Object.keys(data).join(', ')}` };
    }

    // ══ schedule_training ════════════════════════════════════════════════════════

    case 'schedule_training': {
      const { code, title, description, trainer, date, duration, location, category, competenceTarget } = input;
      if (!code||!title||!date) return { ok:false, error:'code, title, date مطلوبة', summary:'فشل' };
      try {
        const c = await prisma.training.create({ data:{
          code, title, description:description||null, trainer:trainer||null,
          date:new Date(date), duration:duration||null, location:location||null,
          category:category||null, competenceTarget:competenceTarget||null,
        }});
        return { ok:true, data:{id:c.id, code:c.code}, summary:`✅ جُدِّل تدريب ${c.code}: "${c.title}" في ${date}` };
      } catch(e) {
        if (e.code==='P2002') return { ok:false, error:`الكود ${code} مكرر`, summary:'فشل: كود مكرر' };
        throw e;
      }
    }

    // ══ orchestrate_complaint ════════════════════════════════════════════════════

    case 'orchestrate_complaint': {
      const {
        complaintCode, source, channel, subject, description, severity, complainantName,
        createNcr, ncrCode, capaCode, reporterId, assigneeId, rootCause, plannedAction, dueDate,
      } = input;

      const results = [];

      // 1️⃣ إنشاء الشكوى
      const resolvedAssignee = assigneeId ? await resolveUser(assigneeId).catch(()=>null) : null;
      let complaintId;
      try {
        const cmp = await prisma.complaint.create({ data:{
          code:complaintCode, source, channel, subject, description, severity,
          complainantName:complainantName||null, assigneeId:resolvedAssignee, status:'NEW',
        }});
        complaintId = cmp.id;
        results.push(`✅ شكوى ${cmp.code}: "${subject}"`);
      } catch(e) {
        return { ok:false, error:`فشل إنشاء الشكوى: ${e.message}`, summary:'فشل: الشكوى' };
      }

      // 2️⃣ إنشاء NCR إذا طُلب أو الخطورة مرتفعة
      const shouldNcr = createNcr !== false && (createNcr === true || severity === 'مرتفعة');
      let ncrId;
      if (shouldNcr && ncrCode && reporterId) {
        const resolvedReporter = await resolveUser(reporterId).catch(()=>null);
        if (resolvedReporter) {
          try {
            const ncr = await prisma.nCR.create({ data:{
              code:ncrCode, title:`NCR مرتبط بشكوى: ${subject}`, description,
              severity, reporterId:resolvedReporter, assigneeId:resolvedAssignee,
              rootCause:rootCause||null, dueDate:dueDate?new Date(dueDate):null,
              status:'OPEN', workflowState:'DRAFT',
            }});
            ncrId = ncr.id;
            // ربط الشكوى بالـ NCR
            await prisma.complaint.update({ where:{id:complaintId}, data:{ relatedNcrId:ncrId } });
            results.push(`✅ NCR ${ncr.code} مرتبط بالشكوى`);
          } catch(e) {
            results.push(`⚠️ NCR: ${e.message}`);
          }
        }
      }

      // 3️⃣ إنشاء CAPA
      if (capaCode) {
        const resolvedOwner = resolvedAssignee;
        try {
          const capa = await prisma.capa.create({ data:{
            code:capaCode, type:'CORRECTIVE', title:`CAPA: ${subject}`,
            description, rootCauseAnalysis:rootCause||null,
            plannedAction:plannedAction||null, dueDate:dueDate?new Date(dueDate):null,
            ownerId:resolvedOwner, complaintId, ncrId:ncrId||null,
            createdById:actingUserId, status:'OPEN', sourceType:'MANUAL',
          }});
          results.push(`✅ CAPA ${capa.code}`);
        } catch(e) {
          results.push(`⚠️ CAPA: ${e.message}`);
        }
      }

      return {
        ok: true,
        data: { complaintId, ncrId },
        summary: `🔗 سير عمل الشكوى مكتمل:\n${results.join('\n')}`,
      };
    }

    // ══ Quality Investigator Tools ══════════════════════════════════════════════

    case 'compare_departments': {
      const now = new Date();
      const year  = input.year  || now.getFullYear();
      const month = input.month || (now.getMonth() + 1);
      const rows  = await svcCompareDepartments({ year, month });
      const distressed = rows.filter(r => r.classification === 'DISTRESSED').length;
      const warning    = rows.filter(r => r.classification === 'WARNING').length;
      const missing    = rows.filter(r => r.classification === 'MISSING').length;
      return {
        ok: true,
        data: { year, month, rows },
        summary: `📊 ${rows.length} قسم — 🔴 ${distressed} متعثِّر، 🟠 ${warning} منذر، ⚪ ${missing} تقرير ناقص`,
      };
    }

    case 'detect_department_trends': {
      const months = input.months || 6;
      const trends = await svcDetectTrends({ months, departmentId: input.departmentId });
      const declining = trends.filter(t => t.direction === 'DECLINING').length;
      return {
        ok: true,
        data: { trends },
        summary: `📈 اتجاهات ${trends.length} قسم — ${declining} في انحدار`,
      };
    }

    case 'detect_distressed_departments': {
      const now = new Date();
      const year  = input.year  || now.getFullYear();
      const month = input.month || (now.getMonth() + 1);
      const rows  = await svcCompareDepartments({ year, month });
      const distressed = rows.filter(r => ['DISTRESSED', 'WARNING'].includes(r.classification));
      return {
        ok: true,
        data: { year, month, distressed },
        summary: distressed.length === 0
          ? `✅ لا أقسام متعثِّرة هذا الشهر`
          : `🚨 ${distressed.length} قسم يحتاج تدخل: ${distressed.map(d => d.name).join('، ')}`,
      };
    }

    case 'list_investigation_flags': {
      const where = {};
      if (input.status)       where.status       = input.status;
      else                    where.status       = 'OPEN';
      if (input.type)         where.type         = input.type;
      if (input.departmentId) where.departmentId = input.departmentId;
      const flags = await prisma.investigationFlag.findMany({
        where, orderBy: { createdAt: 'desc' }, take: 50,
      });
      return {
        ok: true,
        data: { flags },
        summary: `🚩 ${flags.length} علامة تحقيق (${where.status})`,
      };
    }

    case 'read_progress_report': {
      let report;
      if (input.reportId) {
        report = await prisma.progressReport.findUnique({
          where: { id: input.reportId },
          include: { flags: true },
        });
      } else if (input.departmentId && input.year && input.month) {
        report = await prisma.progressReport.findUnique({
          where: { departmentId_year_month: {
            departmentId: input.departmentId, year: input.year, month: input.month } },
          include: { flags: true },
        });
      }
      if (!report) return { ok: false, error: 'التقرير غير موجود', summary: '❌ لم يُعثر على التقرير' };

      return {
        ok: true,
        data: {
          id: report.id, status: report.status, score: report.score,
          year: report.year, month: report.month, departmentId: report.departmentId,
          autoFilled:     safeParseTool(report.autoFilled),
          deptFilled:     safeParseTool(report.deptFilled),
          aiQuestions:    safeParseTool(report.aiQuestions),
          scoreBreakdown: safeParseTool(report.scoreBreakdown),
          flags: report.flags,
        },
        summary: `📄 تقرير ${report.year}-${String(report.month).padStart(2,'0')} — الحالة: ${report.status}${report.score != null ? ` | الدرجة: ${report.score}/100` : ''}`,
      };
    }

    case 'generate_progress_report': {
      if (!input.departmentId || !input.year || !input.month) {
        return { ok: false, error: 'departmentId, year, month مطلوبة', summary: '❌ معاملات ناقصة' };
      }
      const r = await svcGenerateReport({
        departmentId:    input.departmentId,
        year:            input.year,
        month:           input.month,
        forceRegenerate: input.forceRegenerate || false,
      });
      const qCount = Array.isArray(r.aiQuestions) ? r.aiQuestions.length : 0;
      return {
        ok: true,
        data: { reportId: r.id, status: r.status, year: r.year, month: r.month, aiQuestions: r.aiQuestions },
        summary: `✅ تقرير جاهز لـ ${r.year}-${String(r.month).padStart(2,'0')} — ${qCount} سؤال تحقيقي`,
      };
    }

    case 'investigate_cross_contradictions': {
      const now = new Date();
      const year  = input.year  || now.getFullYear();
      const month = input.month || (now.getMonth() + 1);
      const contradictions = await svcDetectCross({ year, month });

      const created = [];
      for (const c of contradictions) {
        const flag = await prisma.investigationFlag.create({
          data: {
            type: 'CONTRADICTION',
            severity: ['LOW','MEDIUM','HIGH','CRITICAL'].includes(c.severity) ? c.severity : 'MEDIUM',
            status: 'OPEN',
            title: c.title || 'تناقض بين الأقسام',
            description: c.description || '',
            evidence: JSON.stringify(c.evidence || {}),
            aiGenerated: true,
          },
        });
        created.push(flag);
      }

      return {
        ok: true,
        data: { created, count: created.length },
        summary: created.length === 0
          ? `✅ لا تناقضات بين الأقسام هذا الشهر`
          : `🚩 ${created.length} تناقض مكتشَف — تمّ توثيقه في علامات التحقيق`,
      };
    }

    default:
      return { ok:false, error:`أداة غير معروفة: ${name}`, summary:`فشل: "${name}" غير موجودة` };
  }
}

function safeParseTool(s) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }

// ─────────────────────────────────────────────────────────────────────────────
//  دوال مساعدة
// ─────────────────────────────────────────────────────────────────────────────

function pickFields(obj, keys) {
  const r = {};
  for (const k of keys) if (obj?.[k] !== undefined) r[k] = obj[k];
  return r;
}

async function resolveUser(v) {
  if (!v) return null;
  const u = await prisma.user.findUnique({ where:{id:v}, select:{id:true} });
  if (u) return u.id;
  const all = await prisma.user.findMany({ where:{active:true}, select:{id:true,name:true} });
  throw new Error(`المستخدم "${v}" غير موجود. المتاحون: ${all.map(u=>`${u.name}(${u.id})`).join(', ')}`);
}

async function resolveDept(v) {
  if (!v) return null;
  const d = await prisma.department.findFirst({ where:{OR:[{id:v},{name:v},{code:v}]}, select:{id:true} });
  if (d) return d.id;
  const all = await prisma.department.findMany({ select:{id:true,name:true,code:true} });
  throw new Error(`القسم "${v}" غير موجود. المتاحة: ${all.map(d=>`${d.name}(${d.code})`).join(', ')}`);
}

async function resolveGoal(v) {
  if (!v) return null;
  const g = await prisma.strategicGoal.findFirst({ where:{deletedAt:null, OR:[{id:v},{code:v}]}, select:{id:true} });
  if (g) return g.id;
  const all = await prisma.strategicGoal.findMany({ where:{deletedAt:null}, select:{id:true,code:true} });
  throw new Error(`الهدف "${v}" غير موجود. المتاحة: ${all.map(g=>`${g.code}(${g.id})`).join(', ')}`);
}
