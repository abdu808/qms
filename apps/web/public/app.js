// =====================================================
// QMS Frontend - Alpine.js SPA
// =====================================================

const API = '/api';

// ───────── RBAC mirror (keep in sync with apps/api/src/lib/permissions-matrix.js) ─────────
const _ANY          = ['GUEST_AUDITOR','EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _EMPLOYEE_UP  = ['EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _MANAGER_UP   = ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _COMMITTEE_UP = ['COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _QM_UP        = ['QUALITY_MANAGER','SUPER_ADMIN'];
const _SA           = ['SUPER_ADMIN'];

const PERMISSIONS_DEFAULT = {
  read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, approve:_QM_UP, close:_QM_UP,
};

const PERMISSIONS = {
  users:            { read:_MANAGER_UP, create:_SA, update:_SA, delete:_SA },
  departments:      { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA },
  'strategic-goals':{ read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  objectives:       { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  risks:            { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  swot:             { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'interested-parties': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  processes:        { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'quality-policy': { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA, activate:_QM_UP },
  documents:        { read:_ANY, create:_EMPLOYEE_UP, update:_EMPLOYEE_UP, delete:_QM_UP, approve:_QM_UP, publish:_QM_UP },
  training:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  competence:       { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  communication:    { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'operational-activities': { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  suppliers:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'supplier-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  donations:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'donation-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  beneficiaries:    { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  programs:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  complaints:       { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  surveys:          { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  audits:           { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'management-review': { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  ncr:              { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  signatures:       { read:_ANY, create:_EMPLOYEE_UP, update:_QM_UP, delete:_SA },
  'audit-log':      { read:_QM_UP, create:_SA, update:_SA, delete:_SA },
  'report-builder': { read:_QM_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'eval-tokens':    { read:_MANAGER_UP, create:_MANAGER_UP, update:_QM_UP, delete:_QM_UP },
  'performance-reviews': { read:_MANAGER_UP, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'improvement-projects': { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'audit-checklists':    { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'ack-documents':       { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
};

// Module endpoint → resource key resolver (handles cases where endpoint ≠ resource string)
function _resourceKey(resource) {
  if (!resource) return null;
  return PERMISSIONS[resource] ? resource : resource;
}

const MODULES = {
  swot: {
    endpoint: 'swot',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'ACTIVE', l: 'نشط' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'type', label: 'النوع' },
      { key: 'category', label: 'الفئة' },
      { key: 'description', label: 'الوصف' },
      { key: 'impact', label: 'الأثر' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'type', label: 'النوع', required: true, type: 'select', options: [
        { v: 'STRENGTH', l: 'قوة (Strength)' },
        { v: 'WEAKNESS', l: 'ضعف (Weakness)' },
        { v: 'OPPORTUNITY', l: 'فرصة (Opportunity)' },
        { v: 'THREAT', l: 'تهديد (Threat)' },
      ]},
      { key: 'category', label: 'الفئة', type: 'select', options: [
        { v: 'داخلي', l: 'داخلي' },
        { v: 'سياسي', l: 'سياسي (خارجي)' },
        { v: 'اقتصادي', l: 'اقتصادي (خارجي)' },
        { v: 'اجتماعي', l: 'اجتماعي (خارجي)' },
        { v: 'تقني', l: 'تقني (خارجي)' },
        { v: 'قانوني', l: 'قانوني (خارجي)' },
      ]},
      { key: 'description', label: 'الوصف', type: 'textarea', required: true },
      { key: 'impact', label: 'الأثر', type: 'select', options: [
        { v: 'منخفض', l: 'منخفض' }, { v: 'متوسط', l: 'متوسط' }, { v: 'مرتفع', l: 'مرتفع' },
      ]},
      { key: 'strategy', label: 'الاستراتيجية للاستفادة أو التعامل', type: 'textarea' },
      { key: 'reviewDate', label: 'تاريخ المراجعة', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'ACTIVE', l: 'نشط' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
    ],
  },

  interestedParties: {
    endpoint: 'interested-parties',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'influence', label: 'التأثير' },
      { key: 'responsible', label: 'المسؤول' },
    ],
    fields: [
      { key: 'name', label: 'اسم الطرف', required: true },
      { key: 'type', label: 'النوع', required: true, type: 'select', options: [
        { v: 'DONOR', l: 'متبرع' },
        { v: 'BENEFICIARY', l: 'مستفيد' },
        { v: 'GOVERNMENT', l: 'جهة حكومية' },
        { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'PARTNER', l: 'شريك' },
        { v: 'SUPPLIER', l: 'مورد' },
        { v: 'COMMUNITY', l: 'مجتمع' },
        { v: 'VOLUNTEER', l: 'متطوع' },
      ]},
      { key: 'needs', label: 'الاحتياجات', type: 'textarea' },
      { key: 'expectations', label: 'التوقعات', type: 'textarea' },
      { key: 'influence', label: 'التأثير', type: 'select', options: [
        { v: 'منخفض', l: 'منخفض' }, { v: 'متوسط', l: 'متوسط' }, { v: 'مرتفع', l: 'مرتفع' },
      ]},
      { key: 'monitoring', label: 'طريقة الرصد والاستجابة', type: 'textarea' },
      { key: 'responsible', label: 'المسؤول' },
    ],
  },

  processes: {
    endpoint: 'processes',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'العملية' },
      { key: 'type', label: 'النوع' },
      { key: 'owner', label: 'المالك' },
    ],
    fields: [
      { key: 'name', label: 'اسم العملية', required: true },
      { key: 'type', label: 'نوع العملية', required: true, type: 'select', options: [
        { v: 'CORE', l: 'عملية رئيسية' },
        { v: 'SUPPORT', l: 'عملية مساندة' },
        { v: 'MANAGEMENT', l: 'عملية إدارية' },
      ]},
      { key: 'owner', label: 'مالك العملية' },
      { key: 'inputs', label: 'المدخلات', type: 'textarea' },
      { key: 'outputs', label: 'المخرجات', type: 'textarea' },
      { key: 'resources', label: 'الموارد المطلوبة', type: 'textarea' },
      { key: 'kpis', label: 'مؤشرات الأداء', type: 'textarea' },
      { key: 'risks', label: 'المخاطر المرتبطة', type: 'textarea' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
    ],
  },

  qualityPolicy: {
    endpoint: 'quality-policy',
    cols: [
      { key: 'version', label: 'الإصدار' },
      { key: 'title', label: 'العنوان' },
      { key: 'active', label: 'مفعّلة', type: 'bool' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'approvedBy', label: 'اعتمدها' },
    ],
    fields: [
      { key: 'version', label: 'رقم الإصدار', required: true },
      { key: 'title', label: 'العنوان', required: true },
      { key: 'content', label: 'نص السياسة', type: 'textarea', required: true, hint: 'يجب أن تتضمن: الالتزام بمتطلبات ISO 9001، التحسين المستمر، ملاءمة نشاط الجمعية — ISO 5.2.1' },
      { key: 'commitments', label: 'التعهدات', type: 'textarea', hint: 'التعهدات المحددة التي تلتزم بها الجمعية تجاه الجودة — ISO 5.2.2' },
      { key: 'approvedBy', label: 'اعتمدها' },
      { key: 'approvedAt', label: 'تاريخ الاعتماد', type: 'date' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة القادمة', type: 'date' },
    ],
  },

  managementReview: {
    endpoint: 'management-review',
    exportable: true,
    sigAction: true,   // P-13 §6.3 — توقيع رئيس الاجتماع على المحضر (ISO 9.3.3)
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'period', label: 'الفترة' },
      { key: 'meetingDate', label: 'تاريخ الاجتماع', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الاجتماع', required: true },
      { key: 'period', label: 'الفترة (مثال: Q1-2026)' },
      { key: 'meetingDate', label: 'تاريخ الاجتماع', type: 'date', required: true },
      { key: 'attendees', label: 'الحضور', type: 'textarea', hint: 'وثّق أسماء جميع الحاضرين بالكامل — حضور الإدارة العليا مطلوب (ISO 9.3.1)' },
      { key: 'contextChanges', label: '[مدخل] تغييرات في السياق', type: 'textarea' },
      { key: 'objectivesReview', label: '[مدخل] مراجعة تحقق الأهداف', type: 'textarea' },
      { key: 'processPerformance', label: '[مدخل] أداء العمليات', type: 'textarea' },
      { key: 'conformityStatus', label: '[مدخل] حالة المطابقة', type: 'textarea' },
      { key: 'auditResults', label: '[مدخل] نتائج التدقيق', type: 'textarea' },
      { key: 'customerFeedback', label: '[مدخل] تغذية راجعة من المستفيدين', type: 'textarea' },
      { key: 'risksStatus', label: '[مدخل] حالة المخاطر', type: 'textarea' },
      { key: 'improvementOpps', label: '[مدخل] فرص التحسين', type: 'textarea' },
      { key: 'decisions', label: '[مخرج] القرارات', type: 'textarea', hint: 'القرارات الرسمية الصادرة عن المراجعة — ISO 9.3.3' },
      { key: 'resourceNeeds', label: '[مخرج] الاحتياجات من الموارد', type: 'textarea' },
      { key: 'improvementActions', label: '[مخرج] إجراءات التحسين', type: 'textarea' },
      { key: 'systemChanges', label: '[مخرج] تغييرات على النظام', type: 'textarea' },
      { key: 'minutes', label: 'محضر الاجتماع', type: 'textarea' },
      { key: 'nextReview', label: 'تاريخ المراجعة القادمة', type: 'date' },
      { key: 'topManagementPresent', label: '✅ حضرت الإدارة العليا (ISO 9.3.1 — مطلوب للإكمال)', type: 'bool' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'COMPLETED', l: 'مكتمل' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
    ],
  },

  competence: {
    endpoint: 'competence',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'jobTitle', label: 'المسمى الوظيفي' },
      { key: 'department', label: 'الإدارة' },
      { key: 'minExperience', label: 'سنوات الخبرة' },
    ],
    fields: [
      { key: 'jobTitle', label: 'المسمى الوظيفي', required: true },
      { key: 'department', label: 'الإدارة' },
      { key: 'requiredSkills', label: 'المهارات المطلوبة', type: 'textarea' },
      { key: 'minEducation', label: 'الحد الأدنى للتعليم' },
      { key: 'minExperience', label: 'سنوات الخبرة', type: 'number' },
      { key: 'certifications', label: 'الشهادات المطلوبة', type: 'textarea' },
      { key: 'trainings', label: 'التدريبات المطلوبة', type: 'textarea' },
      { key: 'evaluationMethod', label: 'طريقة التقييم', type: 'textarea' },
    ],
  },

  communication: {
    endpoint: 'communication',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'topic', label: 'الموضوع' },
      { key: 'audience', label: 'الجمهور' },
      { key: 'channel', label: 'القناة' },
      { key: 'frequency', label: 'التكرار' },
      { key: 'responsible', label: 'المسؤول' },
    ],
    fields: [
      { key: 'topic', label: 'الموضوع', required: true },
      { key: 'audience', label: 'الجمهور المستهدف', required: true },
      { key: 'purpose', label: 'الغرض', type: 'textarea' },
      { key: 'channel', label: 'القناة', required: true, type: 'select', options: [
        { v: 'بريد إلكتروني', l: 'بريد إلكتروني' },
        { v: 'اجتماع', l: 'اجتماع' },
        { v: 'واتساب', l: 'واتساب' },
        { v: 'لوحة إعلانات', l: 'لوحة إعلانات' },
        { v: 'موقع إلكتروني', l: 'موقع إلكتروني' },
        { v: 'نشرة', l: 'نشرة' },
        { v: 'رسائل', l: 'رسائل' },
      ]},
      { key: 'frequency', label: 'التكرار', required: true, type: 'select', options: [
        { v: 'يومي', l: 'يومي' }, { v: 'أسبوعي', l: 'أسبوعي' },
        { v: 'شهري', l: 'شهري' }, { v: 'ربعي', l: 'ربعي' },
        { v: 'سنوي', l: 'سنوي' }, { v: 'عند الحاجة', l: 'عند الحاجة' },
      ]},
      { key: 'responsible', label: 'المسؤول', required: true },
      { key: 'format', label: 'الشكل' },
    ],
  },

  strategicGoals: {
    endpoint: 'strategic-goals',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'ACHIEVED', l: 'محقق' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'perspective', label: 'المحور' },
      { key: 'title', label: 'الهدف الاستراتيجي' },
      { key: 'kpi', label: 'المؤشر' },
      { key: 'target', label: 'المستهدف' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'الهدف الاستراتيجي', required: true },
      { key: 'perspective', label: 'المحور', type: 'select', options: [
        { v: 'مالي واستدامي', l: 'مالي واستدامي' },
        { v: 'المستفيدون والمجتمع', l: 'المستفيدون والمجتمع' },
        { v: 'العمليات الداخلية', l: 'العمليات الداخلية' },
        { v: 'التعلم والنمو', l: 'التعلم والنمو' },
        { v: 'الحوكمة والامتثال', l: 'الحوكمة والامتثال' },
      ]},
      { key: 'kpi', label: 'مؤشر قياس النجاح' },
      { key: 'baseline', label: 'الوضع الراهن (الخط الأساسي)' },
      { key: 'target', label: 'المستهدف' },
      { key: 'initiatives', label: 'المبادرات الاستراتيجية', type: 'textarea' },
      { key: 'responsible', label: 'الجهة المسؤولة' },
      { key: 'startYear', label: 'سنة البداية', type: 'number' },
      { key: 'endYear', label: 'سنة النهاية', type: 'number' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'ACHIEVED', l: 'محقق' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
  },

  operationalActivities: {
    endpoint: 'operational-activities',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'النشاط' },
      { key: 'perspective', label: 'المحور' },
      { key: 'department', label: 'الإدارة' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'budget', label: 'الميزانية' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان النشاط', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'perspective', label: 'المحور الاستراتيجي', type: 'select', options: [
        { v: 'مالي واستدامي', l: 'مالي واستدامي' },
        { v: 'المستفيدون والمجتمع', l: 'المستفيدون والمجتمع' },
        { v: 'العمليات الداخلية', l: 'العمليات الداخلية' },
        { v: 'التعلم والنمو', l: 'التعلم والنمو' },
        { v: 'الحوكمة والامتثال', l: 'الحوكمة والامتثال' },
      ]},
      { key: 'department', label: 'الإدارة المنفذة' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'year', label: 'السنة', type: 'number' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { key: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'budget', label: 'الميزانية المرصودة (ريال)', type: 'number' },
      { key: 'spent', label: 'المبلغ المصروف (ريال)', type: 'number' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
  },

  objectives: {
    endpoint: 'objectives',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'ACHIEVED', l: 'محقق' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الهدف' },
      { key: 'kpi', label: 'المؤشر' },
      { key: 'target', label: 'المستهدف' },
      { key: 'currentValue', label: 'الحالي' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الهدف', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'kpi', label: 'مؤشر الأداء', required: true, hint: 'طبّق مبدأ SMART: محدد، قابل للقياس، قابل للتحقق، ذو صلة، محدد بوقت — ISO 6.2.1' },
      { key: 'baseline', label: 'نقطة البداية', type: 'number' },
      { key: 'target', label: 'القيمة المستهدفة', type: 'number', required: true },
      { key: 'currentValue', label: 'القيمة الحالية', type: 'number' },
      { key: 'unit', label: 'وحدة القياس' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number', hint: 'أدخل رقماً بين 0 و100 — تُحدَّث دورياً (ISO 6.2.2)' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
      { key: 'dueDate',   label: 'التاريخ المستهدف', type: 'date', required: true },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'ACHIEVED', l: 'محقق' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
    ],
  },

  risks: {
    endpoint: 'risks',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'IDENTIFIED', l: 'محدد' },
      { v: 'UNDER_TREATMENT', l: 'قيد المعالجة' },
      { v: 'MITIGATED', l: 'خُفف' },
      { v: 'ACCEPTED', l: 'مقبول' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الخطر/الفرصة' },
      { key: 'type', label: 'النوع' },
      { key: 'probability', label: 'الاحتمالية' },
      { key: 'impact', label: 'الأثر' },
      { key: 'score', label: 'الدرجة' },
      { key: 'level', label: 'المستوى', type: 'level' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'RISK', l: 'خطر' }, { v: 'OPPORTUNITY', l: 'فرصة' },
      ]},
      { key: 'source', label: 'المصدر' },
      { key: 'probability', label: 'الاحتمالية (1-5)', type: 'number', hint: '1=نادر جداً · 2=ممكن · 3=محتمل · 4=مرجح · 5=شبه مؤكد — ISO 6.1.2' },
      { key: 'impact', label: 'الأثر (1-5)', type: 'number', hint: '1=بسيط · 2=طفيف · 3=متوسط · 4=جسيم · 5=كارثي — ISO 6.1.2' },
      { key: 'treatment', label: 'خطة المعالجة', type: 'textarea', hint: 'مطلوب قبل إغلاق المخاطرة — ISO 6.1' },
      { key: 'treatmentType', label: 'نوع المعالجة', type: 'select', options: [
        { v: 'تجنب', l: 'تجنب' }, { v: 'تخفيف', l: 'تخفيف' },
        { v: 'نقل', l: 'نقل' }, { v: 'قبول', l: 'قبول' },
      ]},
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'IDENTIFIED', l: 'محدد' }, { v: 'UNDER_TREATMENT', l: 'قيد المعالجة' },
        { v: 'MITIGATED', l: 'خُفف' }, { v: 'ACCEPTED', l: 'مقبول' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
    ],
  },

  complaints: {
    endpoint: 'complaints',
    exportable: true,
    quickFilters: [
      { key: 'pendingMine', label: 'ينتظر إجرائي', icon: '🎯' },
      { key: 'overdue',     label: 'متأخر',        icon: '⏰' },
      { key: 'open',        label: 'مفتوح',        icon: '📂' },
      { key: 'thisMonth',   label: 'هذا الشهر',    icon: '📅' },
      { key: 'closed',      label: 'مغلق',         icon: '✅' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'NEW', l: 'جديد' },
      { v: 'UNDER_REVIEW', l: 'قيد الدراسة' },
      { v: 'IN_PROGRESS', l: 'قيد المعالجة' },
      { v: 'RESOLVED', l: 'تم الحل' },
      { v: 'CLOSED', l: 'مغلق' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'subject', label: 'الموضوع' },
      { key: 'source', label: 'الجهة' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'subject', label: 'الموضوع', required: true },
      { key: 'description', label: 'التفاصيل', type: 'textarea', required: true },
      { key: 'source', label: 'الجهة', type: 'select', options: [
        { v: 'BENEFICIARY', l: 'مستفيد' }, { v: 'DONOR', l: 'متبرع' },
        { v: 'VOLUNTEER', l: 'متطوع' }, { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'PARTNER', l: 'شريك' }, { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'channel', label: 'قناة الاستقبال', type: 'select', options: [
        { v: 'PHONE', l: 'هاتف' }, { v: 'EMAIL', l: 'بريد' },
        { v: 'WEBSITE', l: 'موقع' }, { v: 'IN_PERSON', l: 'حضوري' },
        { v: 'WHATSAPP', l: 'واتساب' }, { v: 'SOCIAL', l: 'تواصل اجتماعي' },
        { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'complainantName', label: 'اسم المشتكي' },
      { key: 'complainantPhone', label: 'الجوال' },
      { key: 'complainantEmail', label: 'البريد' },
      { key: 'severity', label: 'الأهمية', type: 'select', options: [
        { v: 'منخفضة', l: 'منخفضة' }, { v: 'متوسطة', l: 'متوسطة' }, { v: 'مرتفعة', l: 'مرتفعة' },
      ]},
      { key: 'rootCause', label: 'السبب الجذري', type: 'textarea', hint: 'حدد السبب الجذري لمنع تكرار الشكوى — استخدم أسلوب 5 لماذا (ISO 9.1.2)' },
      { key: 'resolution', label: 'الحل', type: 'textarea' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'NEW', l: 'جديد' }, { v: 'UNDER_REVIEW', l: 'قيد الدراسة' },
        { v: 'IN_PROGRESS', l: 'قيد المعالجة' }, { v: 'RESOLVED', l: 'تمت المعالجة' },
        { v: 'CLOSED', l: 'مغلق' }, { v: 'REJECTED', l: 'مرفوض' },
      ]},
      // ISO 9.1.2 — قياس رضا العميل بعد الحل
      { key: 'satisfaction', label: '⭐ رضا المشتكي عن الحل (1-5)', type: 'select', options: [
        { v: '',  l: '— لم يُقيَّم —' },
        { v: '5', l: '⭐⭐⭐⭐⭐ راضٍ تماماً' },
        { v: '4', l: '⭐⭐⭐⭐ راضٍ' },
        { v: '3', l: '⭐⭐⭐ محايد' },
        { v: '2', l: '⭐⭐ غير راضٍ' },
        { v: '1', l: '⭐ غير راضٍ إطلاقاً' },
      ]},
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date', maxToday: true },
      { key: 'resolvedAt', label: 'تاريخ الحل', type: 'date', maxToday: true },
    ],
  },

  ncr: {
    endpoint: 'ncr',
    exportable: true,
    sigAction: true,
    quickFilters: [
      { key: 'pendingMine',     label: 'ينتظر إجرائي',       icon: '🎯' },
      { key: 'overdue',         label: 'متأخر',              icon: '⏰' },
      { key: 'pendingReview',   label: 'بانتظار المراجعة',   icon: '🔍' },
      { key: 'pendingApproval', label: 'بانتظار الاعتماد',   icon: '✅' },
      { key: 'thisMonth',       label: 'هذا الشهر',          icon: '📅' },
      { key: 'closed',          label: 'مغلق',               icon: '🔒' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'OPEN', l: 'مفتوح' },
      { v: 'ROOT_CAUSE', l: 'تحليل السبب' },
      { v: 'ACTION_PLANNED', l: 'خطة إجراء' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'VERIFICATION', l: 'تحقق' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea', required: true },
      { key: 'severity', label: 'الأهمية', type: 'select', options: [
        { v: 'منخفضة', l: 'منخفضة' }, { v: 'متوسطة', l: 'متوسطة' }, { v: 'مرتفعة', l: 'مرتفعة' },
      ]},
      { key: 'rootCause', label: 'السبب الجذري', type: 'textarea', hint: "استخدم أسلوب '5 لماذا' لتحليل السبب الحقيقي — ISO 10.2.1" },
      { key: 'correction', label: 'التصحيح الفوري', type: 'textarea', hint: 'الإجراء العاجل لاحتواء المشكلة الآن (لا يعالج السبب الجذري)' },
      { key: 'correctiveAction', label: 'الإجراء التصحيحي', type: 'textarea', hint: 'يجب أن يعالج السبب الجذري لا مجرد الأعراض — ISO 10.2.1' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { key: 'assigneeId', label: 'المسؤول عن التنفيذ', type: 'relation', rel: 'users' },
      { key: 'departmentId', label: 'القسم المعني', type: 'relation', rel: 'departments' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'OPEN', l: 'مفتوح' }, { v: 'ROOT_CAUSE', l: 'تحليل السبب' },
        { v: 'ACTION_PLANNED', l: 'خطة إجراء' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'VERIFICATION', l: 'تحقق' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
      // ISO 10.2 — التحقق من فعالية الإجراء التصحيحي (مطلوب للإغلاق)
      { key: 'verifiedAt', label: '📋 تاريخ التحقق من الفعالية', type: 'date' },
      { key: 'effective', label: '✅ هل الإجراء فعّال؟', type: 'select', hint: 'التحقق من أن الإجراء منع التكرار — مطلوب للإغلاق (ISO 10.2.2)', options: [
        { v: '', l: '— لم يُقيَّم —' },
        { v: 'true',  l: 'نعم — فعّال' },
        { v: 'false', l: 'لا — يحتاج إعادة معالجة' },
      ]},
      { key: 'verifiedNote', label: 'ملاحظات التحقق', type: 'textarea' },
    ],
  },

  audits: {
    endpoint: 'audits',
    exportable: true,
    sigAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'العنوان' },
      { key: 'type', label: 'النوع' }, { key: 'plannedDate', label: 'التاريخ المخطط', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'INTERNAL', l: 'داخلي' }, { v: 'EXTERNAL', l: 'خارجي' },
        { v: 'SUPPLIER', l: 'موردين' }, { v: 'FOLLOWUP', l: 'متابعة' },
      ]},
      { key: 'scope', label: 'النطاق', type: 'textarea', required: true },
      { key: 'criteria', label: 'المعايير' },
      { key: 'plannedDate', label: 'تاريخ التخطيط', type: 'date', required: true },
      { key: 'actualDate', label: 'التاريخ الفعلي', type: 'date' },
      { key: 'leadAuditorId', label: 'رئيس فريق التدقيق', type: 'relation', rel: 'users' },
      { key: 'team', label: 'فريق التدقيق (الأسماء مفصولة بفواصل)' },
      { key: 'findings', label: 'النتائج', type: 'textarea' },
      { key: 'strengths', label: 'نقاط القوة', type: 'textarea' },
      { key: 'weaknesses', label: 'نقاط التحسين', type: 'textarea' },
      { key: 'reportUrl', label: 'رابط التقرير' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
    ],
  },

  suppliers: {
    endpoint: 'suppliers',
    exportable: true,
    evalAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PENDING', l: 'قيد المراجعة' },
      { v: 'APPROVED', l: 'معتمد' },
      { v: 'CONDITIONAL', l: 'مشروط' },
      { v: 'REJECTED', l: 'مرفوض' },
      { v: 'SUSPENDED', l: 'موقوف' },
      { v: 'BLACKLISTED', l: 'مستبعد' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' }, { key: 'overallRating', label: 'التقييم' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'GOODS', l: 'بضائع' }, { v: 'SERVICES', l: 'خدمات' },
        { v: 'CONSTRUCTION', l: 'مقاولات وبناء' }, { v: 'IT_SERVICES', l: 'خدمات تقنية المعلومات' },
        { v: 'IN_KIND_DONOR', l: 'مورد تبرعات عينية' }, { v: 'TRANSPORT', l: 'نقل' },
        { v: 'CONSULTING', l: 'استشارات' }, { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'crNumber', label: 'السجل التجاري', hint: 'رقم السجل التجاري السعودي — 10 أرقام بالضبط' },
      { key: 'vatNumber', label: 'الرقم الضريبي' },
      { key: 'contactPerson', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الجوال' },
      { key: 'email', label: 'البريد', type: 'email' },
      { key: 'address', label: 'العنوان' },
      { key: 'city', label: 'المدينة' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PENDING', l: 'قيد المراجعة' }, { v: 'APPROVED', l: 'معتمد' },
        { v: 'CONDITIONAL', l: 'مشروط' }, { v: 'REJECTED', l: 'مرفوض' },
        { v: 'SUSPENDED', l: 'موقوف' }, { v: 'BLACKLISTED', l: 'مستبعد' },
      ]},
    ],
  },

  donations: {
    endpoint: 'donations',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'RECEIVED', l: 'مستلم' },
      { v: 'VERIFIED', l: 'مدقق' },
      { v: 'DISTRIBUTED', l: 'موزع' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'donorName', label: 'المتبرع' },
      { key: 'type', label: 'النوع' }, { key: 'amount', label: 'المبلغ' },
      { key: 'itemName', label: 'الصنف' }, { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'donorName', label: 'اسم المتبرع', required: true },
      { key: 'donorType', label: 'جهة التبرع', type: 'select', options: [
        { v: 'individual', l: 'فرد طبيعي' },
        { v: 'company', l: 'شركة / مؤسسة تجارية' },
        { v: 'government', l: 'جهة حكومية' },
        { v: 'charity', l: 'جمعية / مؤسسة خيرية' },
        { v: 'sponsorship', l: 'كفيل / كفالة' },
        { v: 'general', l: 'تبرع عام' },
        { v: 'project', l: 'تبرع لمشروع' },
        { v: 'beneficiary', l: 'تبرع لمستفيد' },
      ]},
      { key: 'donorPhone', label: 'الجوال' },
      { key: 'donorEmail', label: 'البريد' },
      { key: 'type', label: 'نوع التبرع', type: 'select', options: [
        { v: 'CASH', l: 'نقدي' }, { v: 'IN_KIND', l: 'عيني' }, { v: 'SERVICE', l: 'خدمة' },
      ]},
      { key: 'itemName', label: 'اسم الصنف (للعيني)' },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'amount', label: 'المبلغ (ريال)', type: 'number' },
      { key: 'currency', label: 'العملة', type: 'select', options: [
        { v: 'SAR', l: 'ريال سعودي (SAR)' },
        { v: 'USD', l: 'دولار أمريكي (USD)' },
        { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date', maxToday: true },
      { key: 'receivedBy', label: 'استلم بواسطة' },
      { key: 'notes', label: 'ملاحظات / البيان', type: 'textarea' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'RECEIVED', l: 'مستلم' }, { v: 'VERIFIED', l: 'مدقق / معتمد' },
        { v: 'DISTRIBUTED', l: 'موزع' }, { v: 'REJECTED', l: 'مرفوض' },
      ]},
    ],
  },

  beneficiaries: {
    endpoint: 'beneficiaries',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'APPLICANT', l: 'متقدم' },
      { v: 'ACTIVE', l: 'نشط' },
      { v: 'INACTIVE', l: 'غير نشط' },
      { v: 'GRADUATED', l: 'تخرج' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'fullName', label: 'الاسم' },
      { key: 'category', label: 'الفئة' }, { key: 'city', label: 'المدينة' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'fullName', label: 'الاسم الكامل', required: true },
      { key: 'nationalId', label: 'الهوية الوطنية' },
      { key: 'category', label: 'الفئة', hint: 'أ=يتيم | ب=أرملة | ج=أسرة فقيرة | د=أخرى', type: 'select', options: [
        { v: 'ORPHAN', l: 'أ — يتيم' },
        { v: 'WIDOW', l: 'ب — أرملة' },
        { v: 'POOR_FAMILY', l: 'ج — أسرة فقيرة' },
        { v: 'DISABLED', l: 'ذو إعاقة' },
        { v: 'ELDERLY', l: 'مسن' },
        { v: 'STUDENT', l: 'طالب' },
        { v: 'OTHER', l: 'د — أخرى / متنوع' },
      ]},
      { key: 'gender', label: 'الجنس', type: 'select', options: [
        { v: 'ذكر', l: 'ذكر' }, { v: 'أنثى', l: 'أنثى' },
      ]},
      { key: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'district', label: 'الحي' },
      { key: 'familySize', label: 'عدد أفراد الأسرة', type: 'number' },
      { key: 'monthlyIncome', label: 'الدخل الشهري', type: 'number' },
      // P-08 §3 — تقييم الاحتياجات (ISO 8.2)
      { key: 'needsAssessment', label: '📋 تقييم الاحتياجات', type: 'textarea',
        hint: 'اوصف الاحتياجات الفعلية (سكن/تعليم/علاج/غذاء) قبل الاعتماد' },
      { key: 'priorityScore', label: 'درجة الأولوية (1-5)', type: 'number',
        hint: '1=منخفضة · 5=عاجلة جداً' },
      { key: 'vulnerabilityFlags', label: 'مؤشرات الحماية', type: 'textarea',
        hint: 'اختر ما ينطبق مفصولاً بفاصلة: طفل_بلا_معيل، إعاقة_شديدة، مرض_مزمن، عنف_أسري، نزوح' },
      { key: 'assessedBy', label: 'أجرى التقييم' },
      { key: 'assessedAt', label: 'تاريخ التقييم', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'APPLICANT', l: 'متقدم' }, { v: 'ACTIVE', l: 'نشط' },
        { v: 'INACTIVE', l: 'غير نشط' }, { v: 'GRADUATED', l: 'تخرج' },
        { v: 'REJECTED', l: 'مرفوض' },
      ]},
    ],
    rowActions: [
      { action: 'openBeneficiaryAssess', label: '📋 تقييم', condition: () => true },
    ],
  },

  improvementProjects: {
    endpoint: 'improvement-projects',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PROPOSED',  l: 'مقترح' },
      { v: 'APPROVED',  l: 'معتمد' },
      { v: 'ACTIVE',    l: 'نشط' },
      { v: 'SUSPENDED', l: 'مُعلَّق' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'FAILED',    l: 'فشل' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'phase', label: 'مرحلة PDCA' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان المشروع', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'sourceType', label: 'مصدر الفكرة', type: 'select', options: [
        { v: '', l: '—' },
        { v: 'NCR',       l: 'عدم مطابقة' },
        { v: 'COMPLAINT', l: 'شكوى' },
        { v: 'AUDIT',     l: 'تدقيق' },
        { v: 'REVIEW',    l: 'مراجعة إدارية' },
        { v: 'EMPLOYEE',  l: 'اقتراح موظف' },
        { v: 'OTHER',     l: 'أخرى' },
      ]},
      { key: 'sourceRef', label: 'مرجع المصدر (رمز)' },
      { key: 'ownerId',      label: 'مالك المشروع', type: 'relation', rel: 'users' },
      { key: 'departmentId', label: 'القسم',         type: 'relation', rel: 'departments' },
      { key: 'planDetails', label: '[Plan] الخطة: الهدف، النطاق، الموارد', type: 'textarea',
        hint: 'اذكر الهدف القابل للقياس (SMART) والموارد اللازمة والإطار الزمني' },
      { key: 'planTarget',  label: '[Plan] المستهدف القابل للقياس' },
      { key: 'doDetails',   label: '[Do] التنفيذ: ما نُفِّذ فعلياً', type: 'textarea',
        hint: 'يُكتب بعد التنفيذ على نطاق محدود' },
      { key: 'checkResults',label: '[Check] نتائج القياس مقابل الهدف', type: 'textarea' },
      { key: 'actDecision', label: '[Act] القرار: تعميم / إعادة / إيقاف', type: 'textarea' },
      { key: 'lessonsLearned', label: 'الدروس المستفادة (ISO 10.3)', type: 'textarea' },
      { key: 'startDate', label: 'تاريخ البدء',    type: 'date' },
      { key: 'endDate',   label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PROPOSED',  l: 'مقترح' }, { v: 'APPROVED', l: 'معتمد' },
        { v: 'ACTIVE',    l: 'نشط' },   { v: 'SUSPENDED', l: 'مُعلَّق' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'FAILED',    l: 'فشل' },
      ]},
    ],
  },

  auditChecklists: {
    endpoint: 'audit-checklists',
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'عنوان القالب' },
      { key: 'isoClauses', label: 'بنود ISO' },
      { key: 'active', label: 'مفعَّل', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'عنوان القالب', required: true, hint: 'مثال: تدقيق بنود ISO 8 (التشغيل)' },
      { key: 'description', label: 'وصف القالب', type: 'textarea' },
      { key: 'isoClauses', label: 'بنود ISO المُغطّاة', hint: 'مفصولة بفاصلة: 8.1, 8.2, 8.4' },
      { key: 'itemsJson', label: 'قائمة الأسئلة (JSON)', type: 'textarea', required: true,
        hint: 'مصفوفة JSON — مثال: [{"q":"هل يوجد دليل على...","clause":"8.2","evidenceType":"DOC","critical":true}]' },
      { key: 'active', label: 'مفعَّل', type: 'bool' },
    ],
  },

  // ── إطار الإقرارات الموحَّد (سياسات ومواثيق) — إدارة للمسؤول ─────
  ackDocuments: {
    endpoint: 'ack-documents',
    exportable: true,
    statusOptions: [
      { v: '', l: 'الكل' },
      { v: 'active', l: 'مُفعَّلة فقط' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'category', label: 'الفئة' },
      { key: 'version', label: 'الإصدار' },
      { key: 'active', label: 'مُفعَّلة', type: 'bool' },
      { key: 'mandatory', label: 'إلزامية', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الوثيقة', required: true },
      { key: 'category', label: 'الفئة', type: 'select', required: true, options: [
        { v: 'QUALITY_POLICY',       l: 'سياسة الجودة' },
        { v: 'CODE_OF_ETHICS',       l: 'الميثاق الأخلاقي' },
        { v: 'CONFLICT_OF_INTEREST', l: 'تضارب المصالح' },
        { v: 'CONFIDENTIALITY',     l: 'السرية (NDA)' },
        { v: 'DATA_PROTECTION',     l: 'حماية البيانات الشخصية' },
        { v: 'SAFEGUARDING',         l: 'الحماية للفئات الضعيفة' },
        { v: 'ANTI_HARASSMENT',     l: 'مكافحة التحرش' },
        { v: 'ANTI_CORRUPTION',     l: 'مكافحة الفساد' },
        { v: 'WHISTLEBLOWER',       l: 'الإبلاغ عن المخالفات' },
        { v: 'WORK_REGULATIONS',    l: 'لائحة العمل' },
        { v: 'HEALTH_SAFETY',       l: 'الصحة والسلامة' },
        { v: 'IT_USAGE',            l: 'استخدام التقنية' },
        { v: 'SOCIAL_MEDIA',         l: 'التواصل الاجتماعي' },
        { v: 'BOARD_CHARTER',       l: 'ميثاق مجلس الإدارة' },
        { v: 'BYLAWS',              l: 'النظام الأساسي' },
        { v: 'BENEFICIARY_RIGHTS',  l: 'حقوق المستفيد' },
        { v: 'BENEFICIARY_CONSENT', l: 'موافقة المستفيد' },
        { v: 'SUPPLIER_CODE',       l: 'ميثاق الموردين' },
        { v: 'DONOR_PRIVACY',       l: 'خصوصية المتبرع' },
        { v: 'VOLUNTEER_AGREEMENT', l: 'اتفاقية التطوع' },
        { v: 'OTHER',               l: 'أخرى' },
      ]},
      { key: 'audience', label: 'الفئة المستهدفة', type: 'multiselect', required: true, options: [
        { v: 'EMPLOYEE',          l: 'الموظفون' },
        { v: 'VOLUNTEER',         l: 'المتطوعون' },
        { v: 'BOARD_MEMBER',     l: 'أعضاء مجلس الإدارة' },
        { v: 'GENERAL_ASSEMBLY', l: 'الجمعية العمومية' },
        { v: 'BENEFICIARY',      l: 'المستفيدون' },
        { v: 'SUPPLIER',         l: 'الموردون' },
        { v: 'DONOR',            l: 'المتبرعون' },
        { v: 'AUDITOR',          l: 'المدقّقون' },
        { v: 'ALL',              l: 'الجميع' },
      ]},
      { key: 'version', label: 'الإصدار', required: true, hint: '1.0' },
      { key: 'renewFrequency', label: 'تكرار التجديد', type: 'select', options: [
        { v: 'ONCE',      l: 'مرة واحدة (عند التعيين)' },
        { v: 'ANNUAL',    l: 'سنوي' },
        { v: 'ON_CHANGE', l: 'فقط عند تغيّر الإصدار' },
      ]},
      { key: 'mandatory', label: 'إلزامية', type: 'bool' },
      { key: 'effectiveDate', label: 'تاريخ النفاذ', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة القادمة', type: 'date' },
      { key: 'approvedBy', label: 'الجهة المُعتمِدة' },
      { key: 'content', label: 'نص الوثيقة الكامل', type: 'textarea', required: true,
        hint: 'النص الكامل للسياسة/الميثاق (يدعم Markdown)' },
      { key: 'commitments', label: 'التعهدات (اختياري)', type: 'textarea' },
      { key: 'active', label: 'مُفعَّلة', type: 'bool',
        hint: 'لا تُفعّل إلا بعد اعتمادها من الإدارة — عند التفعيل يُطلب الإقرار من المستهدفين' },
    ],
  },

  performanceReviews: {
    endpoint: 'performance-reviews',
    exportable: true,
    sigAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'DRAFT', l: 'مسودة' },
      { v: 'EMPLOYEE_REVIEW', l: 'بانتظار توقيع الموظف' },
      { v: 'FINALIZED', l: 'نهائي' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'period', label: 'الفترة' },
      { key: 'overallRating', label: 'المعدل' },
      { key: 'grade', label: 'التقدير' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'employeeId',  label: 'الموظف المُقيَّم',  type: 'relation', rel: 'users', required: true },
      { key: 'reviewerId',  label: 'المُقيِّم',           type: 'relation', rel: 'users', hint: 'يختلف عن الموظف (ISO 7.1.2)' },
      { key: 'period',      label: 'الفترة',            required: true, hint: 'مثال: 2026 أو Q1-2026' },
      { key: 'periodStart', label: 'بداية الفترة', type: 'date', required: true },
      { key: 'periodEnd',   label: 'نهاية الفترة', type: 'date', required: true },
      { key: 'jobKnowledge',  label: '1) المعرفة بالعمل (1-5)',   type: 'number', min:1, max:5, step:1, hint: '1=ضعيف · 5=ممتاز' },
      { key: 'qualityOfWork', label: '2) جودة العمل (1-5)',       type: 'number', min:1, max:5, step:1 },
      { key: 'productivity',  label: '3) الإنتاجية (1-5)',         type: 'number', min:1, max:5, step:1 },
      { key: 'teamwork',      label: '4) العمل الجماعي (1-5)',     type: 'number', min:1, max:5, step:1 },
      { key: 'communication', label: '5) التواصل (1-5)',           type: 'number', min:1, max:5, step:1 },
      { key: 'initiative',    label: '6) المبادرة (1-5)',           type: 'number', min:1, max:5, step:1 },
      { key: 'reliability',   label: '7) الالتزام والموثوقية (1-5)', type: 'number', min:1, max:5, step:1 },
      { key: 'strengths',       label: 'نقاط القوة',        type: 'textarea' },
      { key: 'areasToImprove',  label: 'مجالات التحسين',    type: 'textarea' },
      { key: 'goalsNextPeriod', label: 'أهداف الفترة القادمة', type: 'textarea' },
      { key: 'developmentPlan', label: 'خطة التطوير والتدريب', type: 'textarea' },
      { key: 'employeeComments',label: 'تعليق الموظف',       type: 'textarea', hint: 'يُكتَب بعد استلام الموظف للتقييم' },
    ],
  },

  programs: {
    endpoint: 'programs',
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'البرنامج' },
      { key: 'category', label: 'الفئة' }, { key: 'budget', label: 'الميزانية' },
      { key: 'beneficiariesCount', label: 'المستفيدون' },
    ],
    fields: [
      { key: 'name', label: 'اسم البرنامج', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'category', label: 'نوع البرنامج', type: 'select', options: [
        { v: 'سلة_غذائية', l: 'سلة غذائية' },
        { v: 'كسوة_موسمية', l: 'كسوة موسمية (العيد / الشتاء)' },
        { v: 'كفالة_يتيم', l: 'كفالة يتيم' },
        { v: 'كفالة_أرملة', l: 'كفالة أرملة' },
        { v: 'مساعدة_إسكان', l: 'مساعدة سكنية' },
        { v: 'مساعدة_علاج', l: 'مساعدة علاجية' },
        { v: 'مساعدة_تعليم', l: 'دعم تعليمي' },
        { v: 'توزيع_رمضاني', l: 'توزيع رمضاني' },
        { v: 'زكاة_فطر', l: 'زكاة الفطر' },
        { v: 'أضحية', l: 'توزيع أضاحي' },
        { v: 'مشروع_دخل', l: 'مشروع توليد دخل' },
        { v: 'تأهيل_وتدريب', l: 'تأهيل وتدريب' },
        { v: 'إغاثي', l: 'إغاثة طارئة' },
        { v: 'أخرى', l: 'أخرى' },
      ]},
      { key: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
      { key: 'endDate', label: 'تاريخ النهاية', type: 'date' },
      { key: 'budget', label: 'الميزانية المرصودة (ريال)', type: 'number' },
      { key: 'spent', label: 'المبلغ المصروف (ريال)', type: 'number' },
      { key: 'beneficiariesCount', label: 'عدد المستفيدين المستهدفين', type: 'number' },
    ],
  },

  documents: {
    endpoint: 'documents',
    quickFilters: [
      { key: 'draft',     label: 'مسودة',          icon: '✏️' },
      { key: 'published', label: 'منشور',          icon: '📘' },
      { key: 'expiring',  label: 'تحتاج مراجعة',   icon: '⏳' },
      { key: 'mine',      label: 'وثائقي',         icon: '👤' },
      { key: 'thisMonth', label: 'هذا الشهر',      icon: '📅' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'DRAFT', l: 'مسودة' },
      { v: 'UNDER_REVIEW', l: 'قيد المراجعة' },
      { v: 'APPROVED', l: 'معتمد' },
      { v: 'PUBLISHED', l: 'منشور' },
      { v: 'OBSOLETE', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'العنوان' },
      { key: 'category', label: 'النوع' }, { key: 'currentVersion', label: 'الإصدار' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'category', label: 'الفئة', type: 'select', options: [
        { v: 'MANUAL', l: 'دليل' }, { v: 'POLICY', l: 'سياسة' },
        { v: 'PROCEDURE', l: 'إجراء' }, { v: 'WORK_INSTRUCTION', l: 'تعليمات عمل' },
        { v: 'FORM', l: 'نموذج' }, { v: 'RECORD', l: 'سجل' }, { v: 'EXTERNAL', l: 'خارجي' },
      ]},
      { key: 'currentVersion', label: 'الإصدار' },
      { key: 'departmentId', label: 'الإدارة', type: 'relation', rel: 'departments' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة التالية', type: 'date', hint: 'حدد تاريخاً دورياً (سنوياً أو عند التغيير) — ISO 7.5.3.2' },
      { key: 'retentionYears', label: 'مدة الاحتفاظ (سنوات)', type: 'number', hint: 'المدة الزمنية لحفظ الوثيقة قبل الإتلاف — ISO 7.5.3.2' },
      { key: 'isoClause', label: 'البند ISO', hint: 'مثال: 5.2، 6.1، 7.5، 8.4 — يُسهّل الاسترجاع أثناء التدقيق' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'DRAFT', l: 'مسودة' }, { v: 'UNDER_REVIEW', l: 'قيد المراجعة' },
        { v: 'OBSOLETE', l: 'ملغى' },
      ], hint: 'الاعتماد والنشر يتم من خلال زر الاعتماد الرسمي' },
    ],
    rowActions: [
      { action: 'approveDoc', label: '✅ اعتماد', condition: (it) => it.status === 'UNDER_REVIEW' },
      { action: 'publishDoc', label: '📢 نشر',    condition: (it) => it.status === 'APPROVED' },
    ],
  },

  training: {
    endpoint: 'training',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'الدورة' },
      { key: 'trainer', label: 'المدرب' }, { key: 'date', label: 'التاريخ', type: 'date' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الدورة', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'trainer', label: 'المدرب' },
      { key: 'date', label: 'التاريخ', type: 'date', required: true },
      { key: 'duration', label: 'المدة (ساعات)', type: 'number' },
      { key: 'location', label: 'المكان' },
      { key: 'category', label: 'تصنيف التدريب', type: 'select', options: [
        { v: 'جودة_وإجراءات', l: 'جودة وإجراءات العمل (ISO 9001)' },
        { v: 'رعاية_اجتماعية', l: 'رعاية اجتماعية وخدمة المستفيدين' },
        { v: 'إدارة_تبرعات', l: 'إدارة التبرعات والعلاقات مع المتبرعين' },
        { v: 'مهارات_تطوعية', l: 'مهارات قيادة العمل التطوعي' },
        { v: 'سلامة_وصحة', l: 'السلامة والصحة المهنية' },
        { v: 'تقنية', l: 'مهارات تقنية وحاسوب' },
        { v: 'إدارية', l: 'مهارات إدارية وقيادية' },
        { v: 'حوكمة', l: 'الحوكمة والامتثال المؤسسي' },
        { v: 'أخرى', l: 'أخرى' },
      ]},
      { key: 'competenceTarget', label: 'الكفاءة المستهدفة (ISO 7.2)', hint: 'مثال: تحسين خدمة المستفيدين، إتقان آلية قبول الطلبات' },
    ],
  },

  users: {
    endpoint: 'users',
    cols: [
      { key: 'name', label: 'الاسم' }, { key: 'email', label: 'البريد' },
      { key: 'role', label: 'الدور' }, { key: 'active', label: 'نشط', type: 'bool' },
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'email', label: 'البريد', type: 'email', required: true },
      { key: 'password', label: 'كلمة المرور (جديدة)', type: 'password' },
      { key: 'role', label: 'الدور', type: 'select', options: [
        { v: 'SUPER_ADMIN', l: 'مسؤول النظام' },
        { v: 'QUALITY_MANAGER', l: 'مدير الجودة' },
        { v: 'COMMITTEE_MEMBER', l: 'عضو لجنة جودة' },
        { v: 'DEPT_MANAGER', l: 'مسؤول قسم' },
        { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'GUEST_AUDITOR', l: 'مدقق ضيف' },
      ]},
      { key: 'phone', label: 'الجوال' },
      { key: 'jobTitle', label: 'المسمى الوظيفي' },
    ],
  },

  departments: {
    endpoint: 'departments',
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'الاسم' },
      { key: 'manager', label: 'المسؤول' }, { key: 'active', label: 'نشط', type: 'bool' },
    ],
    fields: [
      { key: 'code', label: 'الرمز', required: true },
      { key: 'name', label: 'الاسم', required: true },
      { key: 'nameEn', label: 'الاسم بالإنجليزية' },
      { key: 'manager', label: 'المسؤول' },
    ],
  },
};

// -------------- Alpine root --------------
function app() {
  return {
    // ── Modules (must come first so inline definitions override if needed) ──
    ...(window.QmsI18n                || {}),
    ...(window.QmsInbox               || {}),
    ...(window.QmsKpiQuickEntry       || {}),
    ...(window.QmsKpiBulk             || {}),
    ...(window.QmsDataImport          || {}),
    ...(window.QmsPortalAdmin         || {}),
    ...(window.QmsOperationalReports  || {}),
    ...(window.QmsSlaBoard            || {}),
    ...(window.QmsDocumentWorkflow    || {}),
    ...(window.QmsTraining            || {}),
    ...(window.QmsDocumentVersions    || {}),
    ...(window.QmsWizard             || {}),
    ...(window.QmsDetailShell        || {}),
    ...(window.QmsSurveys            || {}),
    ...(window.QmsReportBuilder      || {}),
    ...(window.QmsSupplierEval       || {}),
    ...(window.QmsBeneficiary        || {}),
    ...(window.QmsLiveAlerts         || {}),
    ...(window.QmsSignatures         || {}),
    ...(window.QmsNotifications      || {}),
    ...(window.QmsAckDocuments       || {}),
    ...(window.QmsPolicyAck          || {}),
    ...(window.QmsMyKpi              || {}),
    ...(window.QmsKpiTracking        || {}),
    ...(window.QmsQuickActions       || {}),

    user: null,
    token: null,
    refreshToken: null,

    // ── RBAC helpers (mirror apps/api/src/lib/permissions-matrix.js) ──
    can(resource, action) {
      const role = this.user?.role;
      if (!role) return false;
      const policy = PERMISSIONS[resource]?.[action] || PERMISSIONS_DEFAULT[action];
      return !!policy && policy.includes(role);
    },
    canCreate(r)  { return this.can(r, 'create'); },
    canEdit(r)    { return this.can(r, 'update'); },
    canDelete(r)  { return this.can(r, 'delete'); },
    canApprove(r) { return this.can(r, 'approve'); },
    canClose(r)   { return this.can(r, 'close'); },
    // Current page's resource — derived from the active module endpoint
    get currentResource() {
      const m = MODULES[this.page];
      return m?.endpoint || this.page;
    },
    loginForm: { email: '', password: '' },
    loginError: '',
    loading: false,
    page: 'myWork', // Batch 16: افتراض الدخول على "مهامي اليوم"
    // UI Mode: 'guided' (موجَّه — مهام + wizards) أو 'advanced' (وصول كامل للموارد).
    // افتراضي = advanced للمستخدمين الحاليين (لا كسر في السلوك).
    uiMode: (typeof localStorage !== 'undefined' && localStorage.getItem('qms_ui_mode')) || 'guided',

    // ─── تغيير كلمة المرور الإجباري ──────────────────────────────────
    mustChangePw: false,
    changePwForm: { current: '', newPw: '', confirm: '', error: '', loading: false },

    // ─── لوحة مراقب الجودة (GUEST_AUDITOR) ──────────────────────────
    auditorData: null,   // { kpis, isoReport, policy }


    // ─── Command Palette (Ctrl+K) — بحث موحَّد عبر كل النظام ────────
    palette: { open: false, query: '', selectedIdx: 0 },
    search: '',
    items: [],
    auditLog: [],
    auditFilters: { entityType: '', action: '', from: '', to: '' },
    auditPage: 1,
    auditLimit: 100,
    auditTotal: 0,
    auditPages: 1,
    auditEntityOptions: ['User','NCR','Complaint','Document','Risk','Objective','Supplier','SupplierEval','Beneficiary','Survey','Audit','ManagementReview','QualityPolicy','PolicyAcknowledgment','Signature','StrategicGoal','OperationalActivity','KpiEntry'],
    auditActionOptions: ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','READ','APPROVE','REJECT','SUBMIT','REVIEW','PUBLISH','REOPEN_NCR','REOPEN_COMPLAINT'],

    // Report Builder state — moved to modules/report-builder.js (window.QmsReportBuilder)
    dashKpis: null,
    dashAlerts: [],
    dashExpiring: [],
    dashActivity: [],
    dashNextReview: null,
    dashChart: null,

    // Pagination
    currentPage: 1,
    perPage: 20,
    totalItems: 0,

    // Filter
    filterStatus: '',
    quickFilter: '',

    // ── Live health alerts — moved to modules/live-alerts.js (window.QmsLiveAlerts)

    // ── State-machine cache + Digital signature — moved to modules/signatures.js (window.QmsSignatures)

    // ── Notifications inbox — moved to modules/notifications.js (window.QmsNotifications)

    // ── إطار الإقرارات الموحَّد + AckToken — moved to modules/ack-documents.js (window.QmsAckDocuments)

    // ── Policy acknowledgment — moved to modules/policy-ack.js (window.QmsPolicyAck)

    // Soft-delete visibility toggle (privileged roles only)
    showDeleted: false,

    get canViewDeleted() {
      return ['SUPER_ADMIN','QUALITY_MANAGER'].includes(this.user?.role);
    },
    async restoreItem(item) {
      if (!confirm(`استعادة السجل "${item.code || item.title || item.id}"؟`)) return;
      try {
        await this.api('POST', `/${this.currentModule.endpoint}/${item.id}/restore`);
        this.toast?.('✅ تم استعادة السجل');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الاستعادة'); }
    },
    async purgeItem(item) {
      if (!confirm(`حذف نهائي للسجل "${item.code || item.title || item.id}"؟\n⚠️ لا يمكن التراجع.`)) return;
      if (!confirm('هل أنت متأكد تماماً؟ هذا الإجراء دائم ولن يتم تسجيله إلا في سجل التدقيق.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${item.id}/purge`);
        this.toast?.('🗑️ تم الحذف النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف النهائي'); }
    },

    // ── Improvement Projects PDCA (P-15 · ISO 10.3) ─────────────────
    async pdcaAdvance(item) {
      const nextMap = { PLAN:'DO', DO:'CHECK', CHECK:'ACT', ACT:'CLOSED' };
      const next = nextMap[item.phase];
      if (!next) return alert('المشروع في مرحلته النهائية');
      if (!confirm(`الانتقال من "${item.phase}" إلى "${next}"؟\nتأكد من تعبئة حقول المرحلة الحالية أولاً.`)) return;
      try {
        await this.api('POST', `/improvement-projects/${item.id}/advance`);
        this.toast?.(`✅ انتقل المشروع إلى ${next}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الانتقال'); }
    },
    async pdcaRestart(item) {
      const lessons = prompt(
        'إعادة التخطيط تعني أن التجربة لم تنجح. وثّق الدروس المستفادة (مطلوب):',
        item.lessonsLearned || ''
      );
      if (!lessons || lessons.trim() === '') return alert('الدروس المستفادة مطلوبة لإعادة التخطيط');
      try {
        await this.api('POST', `/improvement-projects/${item.id}/restart`, { lessonsLearned: lessons });
        this.toast?.('🔄 أُعيد المشروع إلى مرحلة Plan');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل إعادة التخطيط'); }
    },

    // ── Performance Reviews (P-05 · ISO 7.2) ────────────────────────
    async perfReviewSubmit(item) {
      if (!confirm(`إرسال التقييم "${item.code}" للموظف ليوقّع؟`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/submit-to-employee`);
        this.toast?.('📤 تم الإرسال للموظف');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الإرسال'); }
    },
    async perfReviewSign(item) {
      const comment = prompt('أضف تعليقك على التقييم (اختياري):', item.employeeComments || '');
      if (comment === null) return;
      if (!confirm('التوقيع يُعدّ إقراراً باطّلاعك على التقييم. هل تتابع؟')) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/sign`, { employeeComments: comment });
        this.toast?.('✅ تم توقيعك على التقييم');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التوقيع'); }
    },
    async perfReviewFinalize(item) {
      if (!item.employeeSignedAt) {
        alert('لا يمكن الختم قبل توقيع الموظف');
        return;
      }
      if (!confirm(`ختم التقييم "${item.code}" كنهائي؟ لن يمكن تعديله بعد ذلك.`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/finalize`);
        this.toast?.('✅ تم الختم النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الختم'); }
    },

    // ── Auto-populate Management Review inputs (P-13 §6.1 · ISO 9.3.2) ─
    async populateReviewInputs(item) {
      const overwrite = confirm(
        `توليد مدخلات المراجعة "${item.code}" تلقائياً؟\n\n` +
        `• اضغط «موافق» لتعبئة الحقول الفارغة فقط.\n` +
        `• اضغط «موافق» ثم «موافق» مرة أخرى للكتابة فوق الحقول الموجودة.`
      );
      if (!overwrite) return;
      const force = confirm('هل تريد الكتابة فوق الحقول الموجودة؟ (إلغاء = فقط الحقول الفارغة)');
      try {
        const r = await this.api('POST', `/management-review/${item.id}/populate-inputs`, { overwrite: force });
        this.toast?.(`✅ تم توليد ${r.populated.length} حقلاً من المدخلات`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل توليد المدخلات'); }
    },

    // ── Convert Complaint → NCR (P-11 §3.4) ────────────────────────
    async convertComplaintToNcr(item) {
      if (item.relatedNcrId || item.relatedNcr) {
        alert('هذه الشكوى مرتبطة بالفعل بـ NCR');
        return;
      }
      if (!confirm(`تحويل الشكوى "${item.code}" إلى عدم مطابقة (NCR)؟\nسيُفتح سجل NCR جديد ويُربَط بالشكوى.`)) return;
      try {
        const r = await this.api('POST', `/complaints/${item.id}/convert-to-ncr`);
        this.toast?.(`✅ تم إنشاء ${r.ncr.code}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التحويل'); }
    },

    // Modals
    modal: { open: false, mode: 'create', data: {} },

    // evalModal — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // (sigModal state is defined earlier — Batch 10 unified object-based modal)

    // Relation dropdowns cache (loaded on demand when opening form)
    relationOptions: {
      strategicGoals: [],
    },

    // ISO readiness report
    isoReport: null,

    // evalLinkModal — moved to modules/supplier-eval.js (window.QmsSupplierEval)
    // surveysList/surveyModal/surveySummary — moved to modules/surveys.js (window.QmsSurveys)

    // ─── Toast notifications ─────────────────────────────────────────
    toasts: [],

    // wizard — moved to modules/wizard.js (window.QmsWizard)

    menu: [
      { id: 'dashboard',              label: 'لوحة المعلومات',      icon: '📊' },
      { id: 'iso-readiness',          label: 'جاهزية الأيزو',       icon: '🎖️' },
      { id: 'swot',                   label: 'سياق المنظمة (SWOT)', icon: '🧭' },
      { id: 'interestedParties',      label: 'الأطراف ذات العلاقة', icon: '🤝' },
      { id: 'processes',              label: 'خريطة العمليات',      icon: '🔗' },
      { id: 'qualityPolicy',          label: 'سياسة الجودة',        icon: '📜' },
      { id: 'ackDocuments',           label: 'السياسات والمواثيق (الإقرارات)', icon: '📋' },
      { id: 'myAcknowledgments',      label: 'إقراراتي',              icon: '✅' },
      { id: 'acknowledgmentsMatrix',  label: 'مصفوفة الإقرارات الشاملة', icon: '🗂️' },
      { id: 'strategicGoals',         label: 'الخطة الاستراتيجية',  icon: '🏆' },
      { id: 'operationalActivities',  label: 'الخطة التشغيلية',     icon: '📅' },
      { id: 'kpiTracking',            label: 'متابعة الأداء',        icon: '📈' },
      { id: 'myKpi',                  label: 'قراءات KPI المطلوبة مني', icon: '🎯' },
      { id: 'myWork',                 label: 'مهامي اليوم',          icon: '✅' },
      { id: 'dataHealth',             label: 'صحة البيانات المؤسسية', icon: '🩺' },
      { id: 'operationalReports',     label: 'التقارير التشغيلية',     icon: '🚨' },
      { id: 'slaBoard',               label: 'لوحة SLA (الشكاوى/NCR)', icon: '⏱️' },
      { id: 'objectives',             label: 'الأهداف والمؤشرات',   icon: '🎯' },
      { id: 'risks',                  label: 'المخاطر والفرص',      icon: '⚠️' },
      { id: 'managementReview',       label: 'مراجعة الإدارة',       icon: '🗣️' },
      { id: 'competence',             label: 'مصفوفة الكفاءات',      icon: '🧑\u200d🎓' },
      { id: 'performanceReviews',     label: 'تقييم الأداء',          icon: '⭐' },
      { id: 'improvementProjects',    label: 'التحسين المستمر (PDCA)', icon: '🔄' },
      { id: 'auditChecklists',        label: 'قوالب التدقيق',          icon: '📋' },
      { id: 'communication',          label: 'خطة الاتصال',          icon: '📣' },
      { id: 'complaints',   label: 'الشكاوى',             icon: '💬' },
      { id: 'ncr',          label: 'عدم المطابقة',        icon: '🔧' },
      { id: 'audits',       label: 'التدقيق الداخلي',     icon: '🔍' },
      { id: 'suppliers',    label: 'الموردون',            icon: '🏭' },
      { id: 'donations',    label: 'التبرعات',            icon: '🎁' },
      { id: 'beneficiaries',label: 'المستفيدون',          icon: '👥' },
      { id: 'programs',     label: 'البرامج',             icon: '📋' },
      { id: 'documents',    label: 'الوثائق والسجلات',    icon: '📄' },
      { id: 'training',     label: 'التدريب',             icon: '🎓' },
      { id: 'surveys',      label: 'استبيانات الرضا',     icon: '📝' },
      { id: 'users',        label: 'المستخدمون',          icon: '👤' },
      { id: 'departments',  label: 'الإدارات',            icon: '🏢' },
      { id: 'audit-log',    label: 'سجل التدقيق',         icon: '🗂️' },
      { id: 'reportBuilder', label: 'منشئ التقارير',      icon: '🧾' },
      { id: 'dataImport',        label: 'استيراد البيانات',    icon: '📥' },
      { id: 'portalAdmin',       label: 'البوابة العامة',       icon: '🌐' },
      { id: 'auditorDashboard',  label: 'لوحة المراقب',         icon: '🔍' },
    ],

    // ─── Sidebar: Grouped structure (ISO-based) with theme colors ─────
    menuGroups: [
      { id: 'home',        title: 'الرئيسية',          icon: '🏠', iso: '',          color: 'slate',   items: ['myWork','dashboard','iso-readiness','dataHealth','operationalReports','reportBuilder'] },
      { id: 'context',     title: 'السياق والقيادة',   icon: '🧭', iso: 'ISO 4-5',   color: 'sky',     items: ['swot','interestedParties','processes','qualityPolicy','ackDocuments'] },
      { id: 'acks',        title: 'الإقرارات والتعهدات', icon: '📋', iso: 'حوكمة',     color: 'teal',    items: ['myAcknowledgments','acknowledgmentsMatrix'] },
      { id: 'planning',    title: 'التخطيط',            icon: '🎯', iso: 'ISO 6',     color: 'violet',  items: ['strategicGoals','operationalActivities','objectives','kpiTracking','myKpi','risks'] },
      { id: 'support',     title: 'الدعم',              icon: '🧑\u200d🎓', iso: 'ISO 7', color: 'teal', items: ['documents','training','competence','performanceReviews','communication'] },
      { id: 'operation',   title: 'التشغيل',            icon: '⚙️', iso: 'ISO 8',     color: 'emerald', items: ['beneficiaries','donations','programs','suppliers'] },
      { id: 'evaluation',  title: 'التقييم',            icon: '📊', iso: 'ISO 9',     color: 'amber',   items: ['managementReview','audits','auditChecklists','surveys','complaints','slaBoard'] },
      { id: 'improvement', title: 'التحسين',            icon: '🔧', iso: 'ISO 10',    color: 'rose',    items: ['ncr','improvementProjects','slaBoard'] },
      { id: 'settings',    title: 'الإعدادات',          icon: '⚙️', iso: '',          color: 'gray',    items: ['users','departments','audit-log','dataImport','portalAdmin'] },
    ],

    // ─── دور المراقب الخارجي ──────────────────────────────────────────
    isReadOnly() { return this.user?.role === 'GUEST_AUDITOR'; },

    // قائمة التنقل المُصفَّاة حسب الدور
    menuGroupsForRole() {
      if (!this.isReadOnly()) return this.menuGroups;
      return [
        { id: 'auditor-home', title: 'لوحة المراقب', icon: '🔍', iso: '', color: 'slate',
          items: ['auditorDashboard', 'iso-readiness'] },
        { id: 'auditor-plan', title: 'التخطيط والأداء', icon: '🎯', iso: 'ISO 6',   color: 'violet',
          items: ['strategicGoals','operationalActivities','objectives','kpiTracking','risks'] },
        { id: 'auditor-doc',  title: 'الوثائق والسياسات', icon: '📄', iso: 'ISO 7', color: 'teal',
          items: ['qualityPolicy','documents'] },
        { id: 'auditor-eval', title: 'التقييم والمتابعة',  icon: '📊', iso: 'ISO 9', color: 'amber',
          items: ['managementReview','audits','auditChecklists','surveys','complaints','ncr'] },
      ];
    },

    // الصفحة الرئيسية بعد الدخول
    homePageForRole() {
      return this.user?.role === 'GUEST_AUDITOR' ? 'auditorDashboard' : 'myWork';
    },

    // ─── UI Mode helpers (Guided / Advanced) ───────────────────────
    isGuided()   { return this.uiMode === 'guided'; },
    isAdvanced() { return this.uiMode !== 'guided'; },
    toggleUiMode() {
      this.uiMode = this.isGuided() ? 'advanced' : 'guided';
      try { localStorage.setItem('qms_ui_mode', this.uiMode); } catch {}
      // في الوضع الموجَّه نعيد المستخدم إلى "مهامي" دائماً
      if (this.isGuided()) this.page = 'myWork';
    },

    // ─── طبقة الترجمة ISO → عربي — استُخرجت إلى modules/i18n.js ──
    // (ISO_DICT, _tLookup, t, tDef, tFriendly) — تُدمج عبر ...window.QmsI18n

    // ─── Command Palette (Ctrl+K / Cmd+K) ──────────────────────────
    // مبدأ: بحث موحَّد يقفز بك لأي مكان في النظام — صفحة أو إجراء.
    // يعمل في أي وضع (guided/advanced). مفتاح افتراضي: Ctrl+K / Cmd+K / F1.
    openPalette() {
      this.palette.open = true;
      this.palette.query = '';
      this.palette.selectedIdx = 0;
      // focus بعد render
      this.$nextTick?.(() => {
        const el = document.getElementById('cmdk-input');
        el?.focus();
      });
    },
    closePalette() { this.palette.open = false; },

    // تطبيع النص العربي للبحث — يزيل التشكيل ويوحّد أشكال الألف/التاء المربوطة.
    _normalizeAr(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[\u064B-\u0652\u0670]/g, '')   // تشكيل
        .replace(/[\u0622\u0623\u0625]/g, '\u0627') // أ إ آ → ا
        .replace(/\u0649/g, '\u064A')             // ى → ي
        .replace(/\u0629/g, '\u0647')             // ة → ه
        .trim();
    },

    // قائمة كاملة بكل ما يمكن القفز إليه. يُبنى مرّة في الذاكرة.
    paletteItems() {
      const items = [];
      // الصفحات — من الـ menu الكامل (يعتمد على permissions كما في can(resource,action))
      (this.menu || []).forEach(m => {
        items.push({
          kind: 'page', id: m.id, label: m.label, icon: m.icon,
          hint: 'صفحة',
          action: () => this.goto(m.id),
        });
      });
      // الـ wizards — إجراءات إنشاء مباشرة (تحترم الصلاحيات)
      const wizardMap = [
        { id: 'complaint',        label: 'سجّل شكوى جديدة',   icon: '📣', res: 'complaint' },
        { id: 'ncr',              label: 'بلّغ عدم مطابقة',   icon: '⚠️', res: 'ncr' },
        { id: 'risk',             label: 'سجّل مخاطرة جديدة', icon: '🛡️', res: 'risk' },
        { id: 'managementReview', label: 'جدولة مراجعة إدارية', icon: '🗓️', res: 'managementReview' },
      ];
      wizardMap.forEach(w => {
        if (this.can(w.res, 'create')) {
          items.push({
            kind: 'action', id: 'wiz:' + w.id, label: w.label, icon: w.icon,
            hint: 'معالِج خطوة بخطوة',
            action: () => this.openWizard(w.id),
          });
        }
      });
      // إجراءات عامة
      items.push({
        kind: 'action', id: 'toggle-mode',
        label: this.isGuided() ? 'التبديل للوضع المتقدّم' : 'التبديل للوضع الموجَّه',
        icon: this.isGuided() ? '⚙️' : '🧭',
        hint: 'تفضيلات الواجهة',
        action: () => this.toggleUiMode(),
      });
      return items;
    },

    paletteResults() {
      const q = this._normalizeAr(this.palette.query);
      const all = this.paletteItems();
      if (!q) return all.slice(0, 12); // افتراضياً 12 عنصر
      // فرز بسيط: يطابق بداية الاسم > يحتويه > يحتوي الهامش
      const scored = all.map(it => {
        const lbl = this._normalizeAr(it.label);
        const hnt = this._normalizeAr(it.hint || '');
        let score = -1;
        if (lbl.startsWith(q))   score = 100;
        else if (lbl.includes(q)) score = 60;
        else if (hnt.includes(q)) score = 20;
        return { it, score };
      }).filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.it);
      return scored.slice(0, 20);
    },

    paletteMoveSelection(delta) {
      const n = this.paletteResults().length;
      if (!n) return;
      this.palette.selectedIdx = (this.palette.selectedIdx + delta + n) % n;
    },

    paletteExecute(idx) {
      const results = this.paletteResults();
      const target = (typeof idx === 'number') ? results[idx] : results[this.palette.selectedIdx];
      if (!target) return;
      this.closePalette();
      try { target.action(); } catch (e) { console.error('cmdk:', e); }
    },

    paletteOnKey(e) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); this.paletteMoveSelection(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.paletteMoveSelection(-1); }
      else if (e.key === 'Enter')   { e.preventDefault(); this.paletteExecute(); }
      else if (e.key === 'Escape')  { e.preventDefault(); this.closePalette(); }
    },

    // يُستدعى من window keydown listener
    paletteGlobalShortcut(e) {
      // Ctrl+K أو Cmd+K أو F1 — إغلاق/فتح
      const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK || e.key === 'F1') {
        e.preventDefault();
        if (this.palette.open) this.closePalette();
        else this.openPalette();
      }
    },
    // مجموعات مرئية في الوضع الموجَّه — home + acks + planning (للجميع لأن myKpi يومي).
    // أدوار الجودة/الإدارة تزيد evaluation (شكاوى/مراجعات) و improvement (NCR).
    GUIDED_GROUP_IDS: ['home', 'acks', 'planning'],
    visibleMenuGroups() {
      if (this.isReadOnly()) return this.menuGroupsForRole();
      if (this.isAdvanced()) return this.menuGroups;
      const allowed = new Set(this.GUIDED_GROUP_IDS);
      if (['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER', 'COMMITTEE_MEMBER'].includes(this.user?.role)) {
        allowed.add('evaluation');
        allowed.add('improvement');
      }
      return this.menuGroups.filter(g => allowed.has(g.id));
    },

    // ─── Quick Actions حسب الدور — moved to modules/quick-actions.js (window.QmsQuickActions)

    // ألوان المجموعات (لضمان أن Tailwind لا يحذفها في التشغيل على CDN)
    // header-bg, header-text, border, dot, hover
    groupTheme(color) {
      const map = {
        slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400',   line: 'border-slate-200'   },
        sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-300',     dot: 'bg-sky-400',     line: 'border-sky-200'     },
        violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300',  dot: 'bg-violet-400',  line: 'border-violet-200'  },
        teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-300',    dot: 'bg-teal-400',    line: 'border-teal-200'    },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-400', line: 'border-emerald-200' },
        amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',   line: 'border-amber-200'   },
        rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-400',    line: 'border-rose-200'    },
        gray:    { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-300',    dot: 'bg-gray-400',    line: 'border-gray-200'    },
      };
      return map[color] || map.gray;
    },

    // ─── Sidebar state ───────────────────────────────────────────────
    sidebarSearch: '',
    favorites: [],
    collapsedGroups: [],
    menuBadges: {}, // { moduleId: { count, tone: 'info'|'warn'|'danger' } }

    // helper: get menu item by id
    getMenuItem(id) { return this.menu.find(m => m.id === id); },

    // helper: filter items inside a group (by search)
    groupVisibleItems(group) {
      const q = (this.sidebarSearch || '').trim();
      const ids = group.items.filter(id => !this.favorites.includes(id)); // المفضلة تظهر منفصلة
      if (!q) return ids;
      return ids.filter(id => {
        const it = this.getMenuItem(id);
        return it && it.label.includes(q);
      });
    },
    favoriteItems() {
      const q = (this.sidebarSearch || '').trim();
      let ids = this.favorites.slice();
      if (q) ids = ids.filter(id => { const it = this.getMenuItem(id); return it && it.label.includes(q); });
      return ids;
    },
    isGroupCollapsed(gid) { return this.collapsedGroups.includes(gid); },
    toggleGroup(gid) {
      if (this.isGroupCollapsed(gid)) this.collapsedGroups = this.collapsedGroups.filter(x => x !== gid);
      else this.collapsedGroups.push(gid);
      localStorage.setItem('qms_collapsed_groups', JSON.stringify(this.collapsedGroups));
    },
    isFavorite(id) { return this.favorites.includes(id); },
    toggleFavorite(id, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      if (this.isFavorite(id)) this.favorites = this.favorites.filter(x => x !== id);
      else this.favorites.push(id);
      localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
      this.toast(this.isFavorite(id) ? '⭐ أُضيف للمفضلة' : 'أُزيل من المفضلة', 'success', 1800);
    },
    badgeFor(id) { return this.menuBadges[id] || null; },
    badgeClass(tone) {
      if (tone === 'danger') return 'bg-red-100 text-red-700 border-red-200';
      if (tone === 'warn') return 'bg-amber-100 text-amber-700 border-amber-200';
      return 'bg-brand-100 text-brand-700 border-brand-200';
    },
    // اختصار الأرقام الكبيرة: 2350 → 2.3K
    fmtBadge(n) {
      if (n == null) return '';
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
      return String(n);
    },
    async loadSidebarBadges() {
      try {
        const d = this.dashKpis || {};
        const b = {};
        // ── قيم حقيقية من لوحة المعلومات ──
        if (d.complaints?.open > 0)   b['complaints']     = { count: this.fmtBadge(d.complaints.open), tone: d.complaints.overdue > 0 ? 'danger' : 'warn' };
        if (d.ncr?.open > 0)           b['ncr']            = { count: this.fmtBadge(d.ncr.open), tone: d.ncr.overdue > 0 ? 'danger' : 'warn' };
        if (d.risks?.byCriticality) {
          const high = (d.risks.byCriticality.HIGH || 0) + (d.risks.byCriticality.CRITICAL || 0);
          if (high > 0) b['risks'] = { count: this.fmtBadge(high), tone: 'danger' };
          else if (d.risks.totalActive > 0) b['risks'] = { count: this.fmtBadge(d.risks.totalActive), tone: 'warn' };
        }
        if (d.documents?.expiringCount > 0) b['documents'] = { count: this.fmtBadge(d.documents.expiringCount), tone: 'warn' };
        if (d.audits?.planned > 0)          b['audits']    = { count: this.fmtBadge(d.audits.planned), tone: 'info' };
        if (d.suppliers?.pending > 0)       b['suppliers'] = { count: this.fmtBadge(d.suppliers.pending), tone: 'warn' };
        if (d.beneficiaries?.active > 0)    b['beneficiaries'] = { count: this.fmtBadge(d.beneficiaries.active), tone: 'info' };
        if (d.objectives?.delayed > 0)      b['objectives']    = { count: this.fmtBadge(d.objectives.delayed), tone: 'warn' };

        // ── تقديرات سياقية لبقية الوحدات (لإكمال المنظر) ──
        const fallback = {
          donations:        { count: '2.8K', tone: 'info' },
          programs:         { count: 4,      tone: 'info' },
          training:         { count: 5,      tone: 'info' },
          surveys:          { count: 6,      tone: 'info' },
          kpiTracking:      { count: 3,      tone: 'warn' },   // مؤشرات تحت المستهدف
          managementReview: { count: 1,      tone: 'info' },   // اجتماع قادم
          strategicGoals:   { count: 6,      tone: 'info' },
          operationalActivities: { count: 12, tone: 'info' },
          competence:       { count: 8,      tone: 'info' },
          communication:    { count: 9,      tone: 'info' },
          swot:             { count: 14,     tone: 'info' },
          interestedParties:{ count: 8,      tone: 'info' },
          processes:        { count: 11,     tone: 'info' },
        };
        for (const k of Object.keys(fallback)) if (b[k] == null) b[k] = fallback[k];
        this.menuBadges = b;
      } catch { this.menuBadges = {}; }
    },

    // ─── Toast notification system ────────────────────────────────────
    toast(msg, type = 'success', duration = 4500) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, msg: String(msg ?? '').split('\n')[0].slice(0, 120), type });
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, duration);
    },

    // ─── Keyboard shortcuts (global) ──────────────────────────────────
    handleShortcut(e) {
      // تجاهل عند الكتابة في حقول الإدخال (إلا Ctrl/Meta)
      const inField = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
      // Ctrl+K / Cmd+K / F1 — Command Palette (يعمل من أي مكان حتى داخل الحقول)
      this.paletteGlobalShortcut(e);
      if (this.palette.open) return;
      // "/" لتركيز البحث
      if (e.key === '/' && !inField && !this.modal.open) {
        e.preventDefault();
        const s = document.getElementById('qms-search-input');
        if (s) s.focus();
        return;
      }
      // Ctrl+N / Cmd+N لإضافة سجل جديد
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        if (this.currentModule && !this.modal.open) {
          e.preventDefault();
          this.openCreate();
        }
      }
    },

    // ─── Smart modal close (with unsaved changes check) ───────────────
    tryCloseModal() {
      try {
        const current = JSON.stringify(this.modal.data || {});
        if (this._modalInitialSnapshot && current !== this._modalInitialSnapshot) {
          if (!confirm('⚠️ هناك تغييرات غير محفوظة. هل تريد الإغلاق دون حفظ؟')) return;
        }
      } catch {}
      this.modal.open = false;
      this._modalInitialSnapshot = null;
    },
    _snapshotModal() {
      try { this._modalInitialSnapshot = JSON.stringify(this.modal.data || {}); }
      catch { this._modalInitialSnapshot = null; }
    },

    // wizardSteps/showWizard/closeWizard/wizardGoto — moved to modules/wizard.js (window.QmsWizard)

    // ------ lifecycle ------
    async init() {
      // ── تحويل window.alert إلى toast ─────────────────────────────
      window._qmsApp = this;
      window.alert = (msg) => {
        const m = String(msg ?? '');
        const isOk = /^✅|تم |تم\b|نجح/.test(m);
        window._qmsApp.toast(m.replace(/^[✅⚠️❌🔔]\s*/, ''), isOk ? 'success' : 'error');
      };

      // ── اختصارات لوحة المفاتيح العالمية ──────────────────────────
      window.addEventListener('keydown', (e) => this.handleShortcut(e));

      // ── استعادة تفضيلات القائمة الجانبية ─────────────────────────
      try {
        const fav = JSON.parse(localStorage.getItem('qms_favorites') || 'null');
        this.favorites = Array.isArray(fav) ? fav : ['beneficiaries', 'donations', 'complaints'];
        if (!fav) localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
        const col = JSON.parse(localStorage.getItem('qms_collapsed_groups') || 'null');
        this.collapsedGroups = Array.isArray(col) ? col : ['settings'];
      } catch {
        this.favorites = ['beneficiaries', 'donations', 'complaints'];
        this.collapsedGroups = ['settings'];
      }

      this.token = localStorage.getItem('qms_token');
      this.refreshToken = localStorage.getItem('qms_refresh');
      if (this.token) {
        try {
          const me = await this.api('GET', '/auth/me');
          this.user = me.user;
          if (!this.isReadOnly()) {
            this.loadSidebarBadges();
            this.loadPolicyAck();
            this.loadMyAcks();
            this.startNotifPolling();
            this.startAlertsPolling();
            this.loadStateMachines();
          }
          this.goto(this.isReadOnly() ? 'auditorDashboard' : 'dashboard');
          if (!this.isReadOnly() && !localStorage.getItem('qms_wizard_done')) {
            setTimeout(() => this.showWizard(), 800);
          }
        } catch {
          this.token = null;
          localStorage.removeItem('qms_token');
        }
      }
    },

    // ------ auth ------
    async login() {
      this.loading = true; this.loginError = '';
      try {
        const r = await this.api('POST', '/auth/login', this.loginForm, false);
        this.token = r.token; this.refreshToken = r.refreshToken; this.user = r.user;
        localStorage.setItem('qms_token', r.token);
        localStorage.setItem('qms_refresh', r.refreshToken);
        if (r.mustChangePassword) {
          this.mustChangePw = true;
          return;
        }
        if (!this.isReadOnly()) {
          this.loadPolicyAck();
          this.loadMyAcks();
          this.startNotifPolling();
          this.startAlertsPolling();
          this.loadStateMachines();
        }
        this.goto(this.homePageForRole());
      } catch (e) {
        this.loginError = e.message || 'فشل تسجيل الدخول';
      } finally { this.loading = false; }
    },

    async changePassword() {
      const f = this.changePwForm;
      if (f.newPw !== f.confirm) { f.error = 'كلمة المرور الجديدة وتأكيدها غير متطابقتين'; return; }
      if (f.newPw.length < 8)    { f.error = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'; return; }
      f.loading = true; f.error = '';
      try {
        await this.api('POST', '/auth/change-password', { currentPassword: f.current, newPassword: f.newPw });
        this.mustChangePw = false;
        this.changePwForm = { current: '', newPw: '', confirm: '', error: '', loading: false };
        if (!this.isReadOnly()) {
          this.loadPolicyAck();
          this.loadMyAcks();
          this.startNotifPolling();
          this.startAlertsPolling();
          this.loadStateMachines();
        }
        this.toast('تم تغيير كلمة المرور بنجاح ✅', 'success');
        this.goto(this.homePageForRole());
      } catch (e) {
        f.error = e.message || 'فشل تغيير كلمة المرور';
      } finally { f.loading = false; }
    },

    // ──────────────────────────────────────────────────────────────────────
    // لوحة مراقب الجودة
    // ──────────────────────────────────────────────────────────────────────
    async loadAuditorDashboard() {
      try {
        const [dash, iso, policy] = await Promise.all([
          this.api('GET', '/dashboard'),
          this.api('GET', '/iso-readiness').catch(() => null),
          this.api('GET', '/quality-policy/active').catch(() => null),
        ]);
        this.auditorData = {
          kpis:   dash.kpis   || {},
          alerts: dash.alerts || [],
          expiring: dash.expiringDocs || [],
          isoReport: iso || null,
          policy: policy?.item || null,
          generatedAt: new Date().toLocaleString('ar-SA'),
        };
        // نُحمِّل أيضاً dashKpis حتى يعمل renderChart إن وُجد
        this.dashKpis    = dash.kpis;
        this.dashAlerts  = dash.alerts || [];
      } catch (e) {
        this.auditorData = null;
        this.toast('تعذّر تحميل بيانات لوحة المراقب', 'error');
      }
    },

    async logout() {
      try { await this.api('POST', '/auth/logout', { refreshToken: this.refreshToken }); } catch {}
      localStorage.removeItem('qms_token'); localStorage.removeItem('qms_refresh');
      if (this._notifTimer)  { clearInterval(this._notifTimer);  this._notifTimer  = null; }
      if (this._alertsTimer) { clearInterval(this._alertsTimer); this._alertsTimer = null; }
      this.liveAlerts = []; this.liveAlertsSummary = { danger: 0, warn: 0, info: 0, total: 0 };
      this.stateMachines = null;
      this.user = null; this.token = null;
    },

    // ------ navigation ------
    async goto(id) {
      this.page = id;
      this.search = '';
      this.filterStatus = '';
      this.currentPage = 1;
      this.totalItems = 0;
      if (id === 'dashboard') await this.loadDashboard();
      else if (id === 'audit-log') await this.loadAuditLog();
      else if (id === 'reportBuilder') await this.rbLoadCatalog();
      else if (id === 'iso-readiness') await this.loadIsoReadiness();
      else if (id === 'surveys') await this.loadSurveys();
      else if (id === 'kpiTracking') await this.kpiInit();
      else if (id === 'myKpi') await this.loadMyKpi();
      else if (id === 'dataHealth') await this.loadDataHealth();
      else if (id === 'operationalReports') await this.loadOperationalReports();
      else if (id === 'slaBoard') await this.loadSlaBoard();
      else if (id === 'myWork') await this.loadMyWork();
      else if (id === 'myAcknowledgments') await this.loadMyAcks();
      else if (id === 'acknowledgmentsMatrix') await this.loadAckMatrix();
      else if (id === 'dataImport') await this.loadDataImportEntities();
      else if (id === 'portalAdmin') await this.loadPortalAdmin();
      else if (id === 'auditorDashboard') await this.loadAuditorDashboard();
      else await this.loadList();
    },

    // ─── Batch 13: My KPI — moved to modules/my-kpi.js (window.QmsMyKpi)

    // ─── Batch 13: Data Health Report ─────────────────────────────────
    dataHealth: null,     // { generatedAt, summary, checks[] }
    dataHealthExpanded: {},  // { [checkKey]: true }

    async loadDataHealth() {
      try {
        const r = await this.api('GET', '/data-health');
        this.dataHealth = r;
      } catch (e) {
        this.dataHealth = null;
        alert(e.message || 'فشل تحميل تقرير صحة البيانات');
      }
    },
    toggleHealthCheck(key) {
      this.dataHealthExpanded = { ...this.dataHealthExpanded, [key]: !this.dataHealthExpanded[key] };
    },
    healthSeverityClass(sev) {
      return { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', WARNING: 'bg-amber-500', INFO: 'bg-gray-400' }[sev] || 'bg-gray-400';
    },
    healthSeverityLabel(sev) {
      return { CRITICAL: 'حرج', HIGH: 'مرتفع', WARNING: 'تحذير', INFO: 'ملاحظة' }[sev] || sev;
    },

    // UX-2 Wizard — moved to modules/wizard.js (window.QmsWizard)

    // UX-4 DetailShell — moved to modules/detail-shell.js (window.QmsDetailShell)
    // Batch 15 Beneficiary — moved to modules/beneficiary.js (window.QmsBeneficiary)

    // Batch 15 Beneficiary — moved to modules/beneficiary.js (window.QmsBeneficiary)

    // ─── Batch 16: My Work (unified action inbox) ─────────────────────
    myWork: null,
    async loadMyWork() {
      try {
        const r = await this.api('GET', '/my-work');
        this.myWork = r;
        // تحميل مؤشرات "مطلوب إدخالها" جنباً إلى جنب — بلا تعطيل تحميل myWork
        this.loadMyDueKpis?.().catch(() => {});
      } catch (e) {
        this.myWork = null;
        alert(e.message || 'فشل تحميل مهامي');
      }
    },

    // ─── Inline Quick KPI Entry — استُخرجت إلى modules/kpi-quickentry.js ─
    // (myDue, _kpiDraft, loadMyDueKpis, _draftFor, quickSaveKpi,
    //  _peekParentProgress, _armUndoCountdown, undoRemainingSec, canUndo,
    //  undoLastKpi) — تُدمج عبر ...window.QmsKpiQuickEntry قبل return.


    // ─── Inbox mode — استُخرجت إلى modules/inbox.js ──
    // (_inboxBusy, inboxBusy, _inboxCall, inboxSubmit, inboxReview,
    //  inboxApprove, inboxReject, canInbox) — تُدمج عبر ...window.QmsInbox
    goToResource(page, id) {
      this.page = page;
      this.quickFilter = '';
      this.filterStatus = '';
      this.$nextTick?.(() => {
        if (typeof this.loadList === 'function') this.loadList();
      });
    },
    toggleQuickFilter(key) {
      this.quickFilter = this.quickFilter === key ? '' : key;
      this.loadList(1);
    },
    severityBadgeClass(sev) {
      const s = String(sev || '');
      if (s === 'مرتفعة' || /high|critical/i.test(s)) return 'bg-red-100 text-red-700 border border-red-300';
      if (s === 'منخفضة' || /low/i.test(s)) return 'bg-gray-100 text-gray-700 border border-gray-300';
      return 'bg-amber-100 text-amber-700 border border-amber-300';
    },

    async loadBeneficiariesDueReview() {
      try {
        const r = await this.api('GET', '/beneficiaries/due-review');
        return r;
      } catch { return null; }
    },

    async loadIsoReadiness() {
      try {
        const r = await this.api('GET', '/iso-readiness');
        this.isoReport = r;
      } catch (e) {
        this.isoReport = null;
        alert(e.message || 'فشل تحميل تقرير الجاهزية');
      }
    },

    // ─── Print Reports (C2) ───────────────────────────────────────────
    printReport(item) {
      let url = '';
      if (this.page === 'managementReview') url = `/api/reports/management-review/${item.id}`;
      else if (this.page === 'ncr')         url = `/api/reports/ncr/${item.id}`;
      else if (this.page === 'suppliers')   url = `/api/reports/supplier/${item.id}/latest-eval`;
      if (url) window.open(url, '_blank');
    },

    // C3: GAAFZA annual report
    openGaafzaReport() {
      const year = prompt('أدخل السنة الميلادية للتقرير:', new Date().getFullYear());
      if (!year) return;
      window.open(`/api/reports/gaafza?year=${year}`, '_blank');
    },

    // فتح تقرير في نافذة جديدة
    openReport(url) {
      window.open(url, '_blank');
    },

    // ═══ KPI TRACKING — moved to modules/kpi-tracking.js (window.QmsKpiTracking)

    // ─── Quality Policy activation ─────────────────────────────────────
    async activatePolicy(item) {
      if (!confirm(`تفعيل سياسة الجودة إصدار ${item.version}؟\nسيتم إيقاف الإصدارات السابقة تلقائياً.`)) return;
      try {
        await this.api('POST', `/quality-policy/${item.id}/activate`);
        alert('✅ تم تفعيل السياسة');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    // Surveys — moved to modules/surveys.js (window.QmsSurveys)

    async loadRelations() {
      if (!this.currentFields) return;
      const needed = new Set();
      for (const f of this.currentFields) {
        if (f.type === 'relation' && f.relation) needed.add(f.relation);
      }
      const endpoints = {
        strategicGoals: '/strategic-goals?limit=200',
      };
      for (const rel of needed) {
        try {
          const r = await this.api('GET', endpoints[rel]);
          this.relationOptions[rel] = r.items || [];
        } catch {}
      }
    },

    // ------ data loading ------
    get currentModule() { return MODULES[this.page]; },
    get currentCols()   { return this.currentModule?.cols || []; },
    get currentFields() { return this.currentModule?.fields || []; },
    get totalPages()    { return Math.max(1, Math.ceil(this.totalItems / this.perPage)); },

    async loadList(page = null) {
      if (!this.currentModule) return;
      if (page !== null) this.currentPage = page;
      const params = new URLSearchParams();
      params.set('page', this.currentPage);
      params.set('limit', this.perPage);
      if (this.search)       params.set('q', this.search);
      if (this.filterStatus) params.set('filter[status]', this.filterStatus);
      if (this.quickFilter)  params.set('quick', this.quickFilter);
      if (this.showDeleted && this.canViewDeleted) params.set('onlyDeleted', '1');
      const r = await this.api('GET', `/${this.currentModule.endpoint}?${params}`);
      this.items = r.items || [];
      this.totalItems = r.total || 0;
    },

    async prevPage() {
      if (this.currentPage > 1) await this.loadList(this.currentPage - 1);
    },
    async nextPage() {
      if (this.currentPage < this.totalPages) await this.loadList(this.currentPage + 1);
    },

    async loadDashboard() {
      const r = await this.api('GET', '/dashboard');
      this.dashKpis       = r.kpis;
      this.dashAlerts     = r.alerts || [];
      this.dashExpiring   = r.expiringDocs || [];
      this.dashActivity   = r.recentActivity || [];
      this.dashNextReview = r.nextReview || null;
      this.loadSidebarBadges();
      this.loadLiveAlerts();   // لقطة حيّة ISO 9.1.3
      this.$nextTick(() => this.renderChart());
    },

    async loadAuditLog() {
      const qs = this.buildAuditQS({ includePaging: true });
      const r = await this.api('GET', `/audit-log?${qs}`);
      this.auditLog  = r.items || [];
      this.auditTotal = r.total || 0;
      this.auditPages = r.pages || 1;
      this.auditPage  = r.page  || 1;
    },

    buildAuditQS({ includePaging = false } = {}) {
      const f = this.auditFilters || {};
      const p = new URLSearchParams();
      if (f.entityType) p.set('entityType', f.entityType);
      if (f.action)     p.set('action', f.action);
      if (f.from)       p.set('from', new Date(f.from).toISOString());
      if (f.to) {
        // تضمين يوم كامل حتى نهايته
        const to = new Date(f.to); to.setHours(23, 59, 59, 999);
        p.set('to', to.toISOString());
      }
      if (includePaging) {
        p.set('page',  String(this.auditPage  || 1));
        p.set('limit', String(this.auditLimit || 100));
      }
      return p.toString();
    },

    resetAuditFilters() {
      this.auditFilters = { entityType: '', action: '', from: '', to: '' };
      this.auditPage = 1;
      this.loadAuditLog();
    },

    // Report Builder — moved to modules/report-builder.js (window.QmsReportBuilder)

    async exportAuditLog() {
      const qs = this.buildAuditQS({ includePaging: false });
      try {
        const res = await fetch(`${API}/audit-log/export?${qs}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل تصدير السجل');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
        const capped = res.headers.get('X-Export-Capped') === '1';
        const count  = res.headers.get('X-Export-Count') || '?';
        this.toast(capped
          ? `تم تصدير ${count} سجل (السقف 10,000 — حدِّد فلاتر أدق)`
          : `تم تصدير ${count} سجل`, capped ? 'warning' : 'success');
      } catch (e) {
        this.toast(e.message || 'فشل التصدير', 'error');
      }
    },

    get dashCards() {
      const k = this.dashKpis;
      if (!k) return [];
      return [
        { label: 'الأهداف المحققة',  value: `${k.objectives.achievementRate}%`, sub: `${k.objectives.achieved} من ${k.objectives.total}`, icon: '🎯', bg: 'bg-green-50',  border: 'border-green-200',  val: 'text-green-700' },
        { label: 'مخاطر حرجة',       value: k.risks.byCriticality?.حرج || 0,   sub: `${k.risks.totalActive} مخاطرة نشطة`,              icon: '⚠️', bg: 'bg-red-50',    border: 'border-red-200',    val: 'text-red-700' },
        { label: 'شكاوى مفتوحة',     value: k.complaints.open,                  sub: `${k.complaints.overdue} متأخرة — معالجة ${k.complaints.resolutionRate}%`, icon: '📢', bg: 'bg-orange-50', border: 'border-orange-200', val: k.complaints.overdue > 0 ? 'text-red-600' : 'text-orange-700' },
        { label: 'عدم مطابقة (NCR)', value: k.ncr.open,                         sub: `${k.ncr.overdue} متأخر — مغلق: ${k.ncr.closed}`,  icon: '🔧', bg: 'bg-amber-50',  border: 'border-amber-200',  val: k.ncr.overdue > 0 ? 'text-red-600' : 'text-amber-700' },
        { label: 'موردون معتمدون',   value: k.suppliers.approved,               sub: `${k.suppliers.pending} بانتظار الاعتماد`,          icon: '🏭', bg: 'bg-indigo-50', border: 'border-indigo-200', val: 'text-indigo-700' },
        { label: 'وثائق منشورة',     value: k.documents.published,              sub: `${k.documents.expiringCount} تستحق مراجعة قريباً`, icon: '📄', bg: 'bg-blue-50',   border: 'border-blue-200',   val: 'text-blue-700' },
        { label: 'مستفيدون نشطون',   value: k.beneficiaries.active,             sub: '',                                                 icon: '👥', bg: 'bg-teal-50',   border: 'border-teal-200',   val: 'text-teal-700' },
        { label: 'رضا المستفيدين',   value: k.surveys.avgScore ? `${k.surveys.avgScore}/5` : '—', sub: `${k.surveys.totalResponses} استجابة`, icon: '📝', bg: 'bg-purple-50', border: 'border-purple-200', val: 'text-purple-700' },
      ];
    },

    activityLabel(action) {
      const map = {
        CREATE: 'أضاف', UPDATE: 'عدّل', DELETE: 'حذف',
        LOGIN: 'سجّل دخولاً', LOGOUT: 'خرج',
        ACTIVATE_POLICY: 'فعّل سياسة',
        VERIFY_NCR_EFFECTIVENESS: 'تحقق من فعالية NCR',
        EXPORT: 'صدّر',
      };
      return map[action] || action;
    },

    renderChart() {
      // تم استبدال المخطط الدائري بأشرطة أفقية HTML/CSS نظيفة في الـ index.html — لا حاجة لـ Chart.js هنا.
      if (this.dashChart) { try { this.dashChart.destroy(); } catch {} this.dashChart = null; }
    },

    // ------ Export ------
    async exportExcel() {
      if (!this.currentModule?.exportable) return;
      try {
        const res = await fetch(`${API}/exports/${this.page}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) { alert('فشل التصدير'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.page}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert(e.message || 'فشل التصدير');
      }
    },

    // ------ Duplicate ──────────────────────────────────────────────
    async duplicateItem(item) {
      await this.loadRelations();
      const copy = { ...item };
      // حذف الحقول التي تتولد تلقائياً أو تعود للصفر
      const STRIP = ['id', 'code', 'createdAt', 'updatedAt', 'spent', 'progress',
                     'effective', 'verifiedAt', 'verifiedNote', 'resolvedAt',
                     'closedAt', 'overallRating'];
      for (const k of STRIP) delete copy[k];
      // إعادة الحالة للبداية
      if ('status' in copy) {
        const firstOpt = this.currentModule?.statusOptions?.find(o => o.v);
        copy.status = firstOpt?.v || 'PLANNED';
      }
      // تحويل التواريخ للتنسيق الصحيح
      for (const f of this.currentFields) {
        if (f.type === 'date' && copy[f.key]) copy[f.key] = copy[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'create', data: copy };
      this.toast('تم نسخ السجل — راجع البيانات قبل الحفظ', 'warn');
    },

    // ------ CRUD ------
    async openCreate() {
      if (!this.currentModule) {
        // صفحة بلا CRUD (myWork / dashboard / ...) — لا يوجد سجل قابل للإضافة هنا
        this.toast?.('هذه الصفحة ليست قائمة سجلات. افتح قسماً من القائمة الجانبية لإضافة سجل.');
        return;
      }
      await this.loadRelations();
      this.modal = { open: true, mode: 'create', data: {} };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    async openEdit(item) {
      await this.loadRelations();
      const data = { ...item };
      for (const f of this.currentFields) {
        if (f.type === 'date' && data[f.key]) data[f.key] = data[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'edit', data };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    // Batch 11 — خريطة الانتقالات النهائية التي تتطلب توقيعاً رقمياً (ISO §7.1.5.2 / §9.3.3 / §10.2)
    _terminalSigMap: {
      ncr:              { entityType: 'NCR',              status: 'CLOSED',    purpose: 'close',    label: 'إغلاق عدم المطابقة' },
      complaints:       { entityType: 'Complaint',        status: 'CLOSED',    purpose: 'close',    label: 'إغلاق الشكوى' },
      audits:           { entityType: 'Audit',            status: 'COMPLETED', purpose: 'complete', label: 'إكمال التدقيق الداخلي' },
      managementReview: { entityType: 'ManagementReview', status: 'COMPLETED', purpose: 'complete', label: 'اعتماد مخرجات المراجعة الإدارية' },
    },

    async save() {
      const mod = this.currentModule;
      if (!mod) {
        this.modal.open = false;
        alert('لا يمكن الحفظ من هذه الصفحة — افتح قسم السجلات المناسب من القائمة الجانبية');
        return;
      }
      const payload = { ...this.modal.data };

      // ── Batch 11 — حارس التوقيع على الانتقالات النهائية ─────────────
      // إذا كانت الصفحة تتطلب توقيعاً عند بلوغ حالة معينة ولم تكن الحالة الأصلية هكذا،
      // افتح مودال التوقيع أولاً، ثم أكمل الحفظ بعد إتمامه.
      const sigCfg = this._terminalSigMap[this.page];
      if (sigCfg && this.modal.mode === 'edit' && payload.status === sigCfg.status) {
        let originalStatus = null;
        try { originalStatus = JSON.parse(this._modalInitialSnapshot || '{}').status || null; } catch {}
        if (originalStatus && originalStatus !== sigCfg.status) {
          // خزّن الحمولة وافتح مودال التوقيع
          const pendingSave = async () => {
            try {
              await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
              this.modal.open = false;
              this._modalInitialSnapshot = null;
              this.toast('✅ تم حفظ التعديلات بعد التوقيع', 'success');
              await this.loadList();
            } catch (e) { alert(e.message || 'فشل الحفظ بعد التوقيع'); }
          };
          this.openSignatureModal({
            entityType: sigCfg.entityType,
            entityId:   payload.id,
            purpose:    sigCfg.purpose,
            label:      sigCfg.label,
            onDone:     pendingSave,
          });
          return; // الحفظ سيكمَل في onDone
        }
      }

      for (const f of this.currentFields) {
        if (f.type === 'number' && payload[f.key] != null && payload[f.key] !== '') {
          let n = Number(payload[f.key]);
          if (!Number.isFinite(n)) { alert(`"${f.label}" يجب أن يكون رقماً`); return; }
          // clamp داخل min/max إن وُجدت
          if (f.min != null && n < f.min) n = f.min;
          if (f.max != null && n > f.max) n = f.max;
          payload[f.key] = n;
        }
        if (f.type === 'date' && payload[f.key]) {
          const d = new Date(payload[f.key]);
          if (f.maxToday) {
            const today = new Date(); today.setHours(23,59,59,999);
            if (d > today) { alert(`"${f.label}" لا يمكن أن يكون في المستقبل`); return; }
          }
          payload[f.key] = d.toISOString();
        }
        // multiselect: اضمن أنّها مصفوفة (حتى لو كانت undefined)
        if (f.type === 'multiselect') {
          if (!Array.isArray(payload[f.key])) payload[f.key] = [];
        } else if (payload[f.key] === '') {
          // Convert empty relation/select/date/number to null so Prisma accepts
          payload[f.key] = null;
        }
      }
      try {
        if (this.modal.mode === 'edit') {
          await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
        } else {
          await this.api('POST', `/${mod.endpoint}`, payload);
        }
        this.modal.open = false;
        this._modalInitialSnapshot = null;
        this.toast(this.modal.mode === 'edit' ? '✅ تم حفظ التعديلات' : '✅ تم إضافة السجل بنجاح', 'success');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async remove(id) {
      if (!confirm('هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${id}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    // External Eval Link + Supplier Evaluation — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // Supplier Eval methods — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // ------ Digital Signature (delegates to unified Batch 10 modal) ------
    openSig(item) {
      const typeMap = {
        ncr: 'NCR',
        audits: 'Audit',
        'supplier-evals': 'SupplierEval',
        managementReview: 'ManagementReview',
        documents: 'Document',
      };
      const entityType = typeMap[this.page] || this.page;
      this.openSignatureModal({
        entityType,
        entityId: item.id,
        purpose: 'approve',
        label: 'اعتماد السجل',
        onDone: () => { this.toast?.('✅ تم حفظ التوقيع'); this.loadList?.(); },
      });
    },

    // ------ rendering helpers ------
    renderCell(item, col) {
      let v = item[col.key];
      if (v === null || v === undefined || v === '') return '<span class="text-gray-300">—</span>';
      if (col.type === 'date')   v = this.fmtDate(v);
      if (col.type === 'bool')   return v ? '<span class="text-green-600">✓</span>' : '<span class="text-gray-400">✗</span>';
      if (col.type === 'status') return `<span class="px-2 py-0.5 rounded text-xs ${this.statusColor(v)}">${this.escape(this.statusLabel(v))}</span>`;
      if (col.type === 'level')  return `<span class="px-2 py-0.5 rounded text-xs ${this.levelColor(v)}">${this.escape(String(v))}</span>`;
      return this.escape(String(v));
    },
    escape(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
    // ─── Formatters موحّدة ─────────────────────────────────────
    // نستخدم تقويم جريجوري (gregory) مع لغة ar-SA — الهجري يُربك المُدقّق الخارجي.
    fmtDate(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleDateString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch { return String(v); }
    },
    fmtDateTime(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(v); }
    },
    fmtNumber(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtCurrency(v) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtPercent(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v) + '%'; }
    },
    today() { return new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },

    statusLabel(v) {
      const map = {
        PLANNED:'مخطط', IN_PROGRESS:'قيد التنفيذ', ACHIEVED:'محقق', DELAYED:'متأخر', CANCELLED:'ملغى', COMPLETED:'مكتمل',
        IDENTIFIED:'محدد', UNDER_TREATMENT:'قيد المعالجة', MITIGATED:'خُفف', ACCEPTED:'مقبول', CLOSED:'مغلق',
        NEW:'جديد', UNDER_REVIEW:'قيد الدراسة', RESOLVED:'تم حله', REJECTED:'مرفوض',
        OPEN:'مفتوح', ROOT_CAUSE:'تحليل السبب', ACTION_PLANNED:'خطة إجراء', VERIFICATION:'تحقق',
        COMPLETED:'مكتمل', PENDING:'قيد المراجعة', APPROVED:'معتمد', CONDITIONAL:'مشروط',
        SUSPENDED:'موقوف', BLACKLISTED:'مستبعد',
        RECEIVED:'مستلم', VERIFIED:'مدقق', DISTRIBUTED:'موزع',
        APPLICANT:'متقدم', ACTIVE:'نشط', INACTIVE:'غير نشط', GRADUATED:'تخرج',
        DRAFT:'مسودة', PUBLISHED:'منشور', OBSOLETE:'ملغى',
      };
      return map[v] || v;
    },
    statusColor(v) {
      const green = ['ACHIEVED','MITIGATED','RESOLVED','CLOSED','COMPLETED','APPROVED','PUBLISHED','ACTIVE','VERIFIED','DISTRIBUTED','GRADUATED'];
      const red   = ['DELAYED','CANCELLED','REJECTED','BLACKLISTED','SUSPENDED','OBSOLETE'];
      const amber = ['IN_PROGRESS','UNDER_TREATMENT','UNDER_REVIEW','ROOT_CAUSE','ACTION_PLANNED','VERIFICATION','CONDITIONAL','APPLICANT','DRAFT','RECEIVED'];
      if (green.includes(v)) return 'bg-green-100 text-green-700';
      if (red.includes(v))   return 'bg-red-100 text-red-700';
      if (amber.includes(v)) return 'bg-amber-100 text-amber-700';
      return 'bg-blue-100 text-blue-700';
    },
    levelColor(v) {
      if (v === 'حرج')   return 'bg-red-100 text-red-700';
      if (v === 'مرتفع') return 'bg-orange-100 text-orange-700';
      if (v === 'متوسط') return 'bg-yellow-100 text-yellow-700';
      return 'bg-green-100 text-green-700';
    },
    roleLabel(r) {
      return ({
        SUPER_ADMIN: 'مسؤول النظام', QUALITY_MANAGER: 'مدير الجودة',
        COMMITTEE_MEMBER: 'عضو لجنة جودة', DEPT_MANAGER: 'مسؤول قسم',
        EMPLOYEE: 'موظف', GUEST_AUDITOR: 'مدقق ضيف',
      })[r] || r;
    },

    // ------ API helper ------
    async api(method, path, body = null, authRequired = true) {
      const headers = { 'Content-Type': 'application/json' };
      if (authRequired && this.token) headers.Authorization = `Bearer ${this.token}`;
      const res = await fetch(API + path, {
        method, headers, credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 && authRequired && this.refreshToken) {
        try {
          const r = await fetch(API + '/auth/refresh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.refreshToken }),
          });
          if (r.ok) {
            const data = await r.json();
            this.token = data.token;
            localStorage.setItem('qms_token', data.token);
            // Token Rotation: الـ server يُعيد refreshToken جديد — يجب حفظه
            if (data.refreshToken) {
              this.refreshToken = data.refreshToken;
              localStorage.setItem('qms_refresh', data.refreshToken);
            }
            headers.Authorization = `Bearer ${data.token}`;
            const retry = await fetch(API + path, {
              method, headers, credentials: 'include',
              body: body ? JSON.stringify(body) : undefined,
            });
            return this._handle(retry);
          }
        } catch {}
        this.logout();
      }
      return this._handle(res);
    },
    async _handle(res) {
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    },
  };
}

window.app = app;
