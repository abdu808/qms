/**
 * packages/shared/enums.js
 *
 * مصدر واحد للحقيقة لكل القيم المعدودة (enum) بين API و UI.
 * القيم canonical دايماً إنجليزية (UPPER_SNAKE_CASE أو معرّفات ثابتة)،
 * والتسميات العربية في `labels` للعرض فقط.
 *
 * الهدف: منع تكرار "السكيما عربي، الواجهة إنجليزي" (اللي قابلناها في
 * risk.treatmentType و beneficiary.status وغيرها).
 *
 * الاستعمال:
 *   ▸ في API (Zod):
 *       import { RISK_TREATMENT_TYPES } from '@qms/shared/enums';
 *       treatmentType: z.enum(RISK_TREATMENT_TYPES.values)
 *   ▸ في UI:
 *       import { RISK_TREATMENT_TYPES } from '/static/shared/enums.js';
 *       RISK_TREATMENT_TYPES.labels[val]  // "تخفيف"
 *
 * قواعد:
 *   1) لا تضف قيمة هنا بدون تحديث schema.prisma المقابلة (إن وُجدت enum).
 *   2) لا تستبدل قيمة موجودة — دي migration DB.
 *   3) الترتيب في `values` = ترتيب العرض المقترح في dropdowns.
 */

const def = (values, labels) => ({ values, labels });

// —— المخاطر (ISO 6.1) ——
export const RISK_TREATMENT_TYPES = def(
  ['AVOID', 'MITIGATE', 'TRANSFER', 'ACCEPT'],
  { AVOID: 'تجنّب', MITIGATE: 'تخفيف', TRANSFER: 'نقل', ACCEPT: 'قبول' },
);

export const RISK_STATUSES = def(
  ['IDENTIFIED', 'UNDER_TREATMENT', 'MITIGATED', 'ACCEPTED', 'CLOSED'],
  {
    IDENTIFIED:      'مُحدّد',
    UNDER_TREATMENT: 'تحت المعالجة',
    MITIGATED:       'مُعالَج',
    ACCEPTED:        'مقبول',
    CLOSED:          'مغلق',
  },
);

export const RISK_LEVELS = def(
  // ملاحظة: هذه عربية في DB (لا enum في Prisma — حقل String?) للتوافق التاريخي.
  // لا تُغيَّر بدون migration للسجلات الموجودة.
  ['منخفض', 'متوسط', 'مرتفع', 'حرج'],
  { منخفض: 'منخفض', متوسط: 'متوسط', مرتفع: 'مرتفع', حرج: 'حرج' },
);

// —— عدم المطابقة (ISO 10.2) ——
export const NCR_STATUSES = def(
  ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED'],
  {
    OPEN:            'مفتوحة',
    ROOT_CAUSE:      'تحليل السبب',
    ACTION_PLANNED:  'خطة الإجراء',
    IN_PROGRESS:     'قيد التنفيذ',
    VERIFICATION:    'تحقق الفعالية',
    CLOSED:          'مغلقة',
  },
);

export const NCR_SEVERITIES = def(
  // عربية في DB (String، لا enum Prisma) — تاريخية.
  ['منخفضة', 'متوسطة', 'مرتفعة'],
  { منخفضة: 'منخفضة', متوسطة: 'متوسطة', مرتفعة: 'مرتفعة' },
);

// —— المستفيدون (ISO 8.2) ——
export const BENEFICIARY_CATEGORIES = def(
  ['ORPHAN', 'WIDOW', 'POOR_FAMILY', 'DISABLED', 'ELDERLY', 'STUDENT', 'OTHER'],
  {
    ORPHAN:      'يتيم',
    WIDOW:       'أرملة',
    POOR_FAMILY: 'أسرة فقيرة',
    DISABLED:    'ذو إعاقة',
    ELDERLY:     'مسن',
    STUDENT:     'طالب',
    OTHER:       'أخرى',
  },
);

export const BENEFICIARY_STATUSES = def(
  ['APPLICANT', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'REJECTED'],
  {
    APPLICANT:  'متقدم',
    ACTIVE:     'نشط',
    INACTIVE:   'غير نشط',
    GRADUATED:  'مُتخرج',
    REJECTED:   'مرفوض',
  },
);

// —— الموردون (ISO 8.4) ——
export const SUPPLIER_TYPES = def(
  ['GOODS', 'SERVICES', 'CONSTRUCTION', 'IT_SERVICES',
   'IN_KIND_DONOR', 'TRANSPORT', 'CONSULTING', 'OTHER'],
  {
    GOODS:         'سلع',
    SERVICES:      'خدمات',
    CONSTRUCTION:  'مقاولات وبناء',
    IT_SERVICES:   'خدمات تقنية',
    IN_KIND_DONOR: 'مورد تبرعات عينية',
    TRANSPORT:     'نقل',
    CONSULTING:    'استشارات',
    OTHER:         'أخرى',
  },
);

export const SUPPLIER_STATUSES = def(
  ['PENDING', 'APPROVED', 'CONDITIONAL', 'REJECTED', 'SUSPENDED', 'BLACKLISTED'],
  {
    PENDING:      'قيد الاعتماد',
    APPROVED:     'معتمد',
    CONDITIONAL:  'مشروط',
    REJECTED:     'مرفوض',
    SUSPENDED:    'موقوف',
    BLACKLISTED:  'محظور',
  },
);

// —— التبرعات (ISO 8.2 / P-09) ——
export const DONATION_TYPES = def(
  ['CASH', 'IN_KIND', 'SERVICE'],
  { CASH: 'نقدي', IN_KIND: 'عيني', SERVICE: 'خدمة' },
);

export const DONATION_STATUSES = def(
  ['RECEIVED', 'VERIFIED', 'DISTRIBUTED', 'REJECTED'],
  {
    RECEIVED:    'مستلم',
    VERIFIED:    'مُتحقق منه',
    DISTRIBUTED: 'موزّع',
    REJECTED:    'مرفوض',
  },
);

// —— Workflow (Maker/Checker/Approver — ISO 7.1.2) ——
export const WORKFLOW_STATES = def(
  ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  {
    DRAFT:        'مسودة',
    SUBMITTED:    'مُقدَّمة',
    UNDER_REVIEW: 'قيد المراجعة',
    APPROVED:     'معتمدة',
    REJECTED:     'مرفوضة',
  },
);

/** Helper: يرجع تسمية عربية أو القيمة نفسها لو مش موجودة. */
export function labelFor(enumDef, value) {
  return enumDef?.labels?.[value] ?? value ?? '—';
}
