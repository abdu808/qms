// =====================================================
// QMS Frontend - Alpine.js SPA
// =====================================================

const API = '/api';

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
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date' },
      { key: 'resolvedAt', label: 'تاريخ الحل', type: 'date' },
    ],
  },

  ncr: {
    endpoint: 'ncr',
    exportable: true,
    sigAction: true,
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
      { key: 'donorPhone', label: 'الجوال' },
      { key: 'donorEmail', label: 'البريد' },
      { key: 'type', label: 'نوع التبرع', type: 'select', options: [
        { v: 'CASH', l: 'نقدي' }, { v: 'IN_KIND', l: 'عيني' }, { v: 'SERVICE', l: 'خدمة' },
      ]},
      { key: 'itemName', label: 'اسم الصنف (للعيني)' },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'amount', label: 'المبلغ (للنقدي)', type: 'number' },
      { key: 'receivedBy', label: 'استلم بواسطة' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'RECEIVED', l: 'مستلم' }, { v: 'VERIFIED', l: 'مدقق' },
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
      { key: 'category', label: 'الفئة', type: 'select', options: [
        { v: 'ORPHAN', l: 'يتيم' }, { v: 'WIDOW', l: 'أرملة' },
        { v: 'POOR_FAMILY', l: 'أسرة فقيرة' }, { v: 'DISABLED', l: 'ذو إعاقة' },
        { v: 'ELDERLY', l: 'مسن' }, { v: 'STUDENT', l: 'طالب' }, { v: 'OTHER', l: 'أخرى' },
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
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'APPLICANT', l: 'متقدم' }, { v: 'ACTIVE', l: 'نشط' },
        { v: 'INACTIVE', l: 'غير نشط' }, { v: 'GRADUATED', l: 'تخرج' },
        { v: 'REJECTED', l: 'مرفوض' },
      ]},
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
      { key: 'category', label: 'الفئة' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
      { key: 'endDate', label: 'تاريخ النهاية', type: 'date' },
      { key: 'budget', label: 'الميزانية', type: 'number' },
      { key: 'spent', label: 'المصروف', type: 'number' },
      { key: 'beneficiariesCount', label: 'عدد المستفيدين', type: 'number' },
    ],
  },

  documents: {
    endpoint: 'documents',
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
      { key: 'category', label: 'الفئة' },
      { key: 'competenceTarget', label: 'الكفاءة المستهدفة (ISO 7.2)', placeholder: 'مثال: مهارات السلامة المهنية، جودة الخدمة' },
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
    user: null,
    token: null,
    refreshToken: null,
    loginForm: { email: '', password: '' },
    loginError: '',
    loading: false,
    page: 'dashboard',
    search: '',
    items: [],
    auditLog: [],
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

    // Modals
    modal: { open: false, mode: 'create', data: {} },

    evalModal: {
      open: false,
      supplier: null,
      period: '',
      notes: '',
      recommendation: '',
      criteria: [
        { key: 'quality',       label: 'جودة المنتجات / الخدمات',    max: 30, score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',          max: 25, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',          max: 20, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',   max: 15, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',          max: 10, score: 0 },
      ],
    },

    sigModal: {
      open: false,
      entityType: '',
      entityId: '',
      purpose: 'approve',
    },

    _sigCanvas: null,
    _sigCtx: null,
    _sigInited: false,

    // Relation dropdowns cache (loaded on demand when opening form)
    relationOptions: {
      strategicGoals: [],
    },

    // ISO readiness report
    isoReport: null,

    // Eval link modal
    evalLinkModal: { open: false, url: '', supplier: null, copied: false },

    trainingRecords: { open: false, training: null, records: [], stats: null, users: [], newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' } },

    surveysList: [],
    surveyModal: {
      open: false, mode: 'create', id: null,
      title: '', target: 'BENEFICIARY', period: '', active: true,
      questions: [],
    },
    surveySummary: { open: false, data: null, survey: null },

    // ─── Toast notifications ─────────────────────────────────────────
    toasts: [],

    // ─── Setup Wizard ────────────────────────────────────────────────
    wizard: { open: false, step: 0 },

    menu: [
      { id: 'dashboard',              label: 'لوحة المعلومات',      icon: '📊' },
      { id: 'iso-readiness',          label: 'جاهزية الأيزو',       icon: '🎖️' },
      { id: 'swot',                   label: 'سياق المنظمة (SWOT)', icon: '🧭' },
      { id: 'interestedParties',      label: 'الأطراف ذات العلاقة', icon: '🤝' },
      { id: 'processes',              label: 'خريطة العمليات',      icon: '🔗' },
      { id: 'qualityPolicy',          label: 'سياسة الجودة',        icon: '📜' },
      { id: 'strategicGoals',         label: 'الخطة الاستراتيجية',  icon: '🏆' },
      { id: 'operationalActivities',  label: 'الخطة التشغيلية',     icon: '📅' },
      { id: 'objectives',             label: 'الأهداف والمؤشرات',   icon: '🎯' },
      { id: 'risks',                  label: 'المخاطر والفرص',      icon: '⚠️' },
      { id: 'managementReview',       label: 'مراجعة الإدارة',       icon: '🗣️' },
      { id: 'competence',             label: 'مصفوفة الكفاءات',      icon: '🧑\u200d🎓' },
      { id: 'communication',          label: 'خطة الاتصال',          icon: '📣' },
      { id: 'complaints',   label: 'الشكاوى',             icon: '📢' },
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
    ],

    // ─── Toast notification system ────────────────────────────────────
    toast(msg, type = 'success', duration = 4500) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, msg: String(msg ?? '').split('\n')[0].slice(0, 120), type });
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, duration);
    },

    // ─── Setup Wizard ─────────────────────────────────────────────────
    wizardSteps: [
      { icon: '📜', title: 'سياسة الجودة',      iso: 'ISO 5.2',   page: 'qualityPolicy',  desc: 'حدد التزامات الجمعية بالجودة. يجب أن تتضمن الالتزام بمتطلبات ISO 9001 والتحسين المستمر.' },
      { icon: '🎯', title: 'الأهداف والمؤشرات',  iso: 'ISO 6.2',   page: 'objectives',     desc: 'حدد أهدافاً قابلة للقياس لكل إدارة باستخدام مبدأ SMART (محدد، قابل للقياس، محدد بوقت).' },
      { icon: '⚠️', title: 'المخاطر والفرص',     iso: 'ISO 6.1',   page: 'risks',          desc: 'سجّل المخاطر المحيطة بنشاط الجمعية وقيّم احتمالية وأثر كل منها (1-5).' },
      { icon: '🏭', title: 'الموردون',            iso: 'ISO 8.4',   page: 'suppliers',      desc: 'أضف أول مورد وأرسل له رابط التقييم الإلكتروني. الاعتماد يتطلب تقييماً ناجحاً.' },
      { icon: '📄', title: 'الوثائق والسجلات',   iso: 'ISO 7.5',   page: 'documents',      desc: 'أضف دليل الجودة والإجراءات الرئيسية. حدد دورة مراجعة لكل وثيقة.' },
    ],
    showWizard() {
      this.wizard = { open: true, step: 0 };
    },
    closeWizard() {
      this.wizard.open = false;
      localStorage.setItem('qms_wizard_done', '1');
    },
    wizardGoto(pg) {
      this.closeWizard();
      this.goto(pg);
    },

    // ------ lifecycle ------
    async init() {
      // ── تحويل window.alert إلى toast ─────────────────────────────
      window._qmsApp = this;
      window.alert = (msg) => {
        const m = String(msg ?? '');
        const isOk = /^✅|تم |تم\b|نجح/.test(m);
        window._qmsApp.toast(m.replace(/^[✅⚠️❌🔔]\s*/, ''), isOk ? 'success' : 'error');
      };

      this.token = localStorage.getItem('qms_token');
      this.refreshToken = localStorage.getItem('qms_refresh');
      if (this.token) {
        try {
          const me = await this.api('GET', '/auth/me');
          this.user = me.user;
          this.goto('dashboard');
          // عرض مساعد البداية للمستخدمين الجدد
          if (!localStorage.getItem('qms_wizard_done')) {
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
        this.goto('dashboard');
      } catch (e) {
        this.loginError = e.message || 'فشل تسجيل الدخول';
      } finally { this.loading = false; }
    },

    async logout() {
      try { await this.api('POST', '/auth/logout', { refreshToken: this.refreshToken }); } catch {}
      localStorage.removeItem('qms_token'); localStorage.removeItem('qms_refresh');
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
      else if (id === 'iso-readiness') await this.loadIsoReadiness();
      else if (id === 'surveys') await this.loadSurveys();
      else await this.loadList();
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

    // ─── Document workflow ─────────────────────────────────────────────
    async approveDoc(item, publish) {
      const action = publish ? 'نشر' : 'اعتماد';
      if (!confirm(`تأكيد ${action} الوثيقة "${item.title}"؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/approve`, { publish: !!publish });
        alert(`✅ تم ${action} الوثيقة بنجاح`);
        await this.loadList();
      } catch (e) { alert(e.message || `فشل ${action} الوثيقة`); }
    },
    async obsoleteDoc(item) {
      if (!confirm(`سحب الوثيقة "${item.title}" (سحبها يلغي إقرارات المستخدمين)؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/obsolete`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل السحب'); }
    },

    // ─── Training records (attendance & effectiveness) ─────────────────
    async openTrainingRecords(training) {
      try {
        const [recs, users] = await Promise.all([
          this.api('GET', `/training/${training.id}/records`),
          this.api('GET', '/users?limit=200'),
        ]);
        this.trainingRecords = {
          open: true,
          training,
          records: recs.records || [],
          stats: recs.stats,
          users: users.items || [],
          newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' },
        };
      } catch (e) { alert(e.message || 'فشل تحميل السجلات'); }
    },
    async saveTrainingRecord(rec) {
      const payload = {
        userId: rec.userId || rec.user?.id,
        attended: !!rec.attended,
        score: rec.score === '' ? null : rec.score,
        effective: rec.effective === '' ? null : rec.effective,
        certUrl: rec.certUrl || null,
      };
      if (!payload.userId) return alert('اختر الموظف أولاً');
      try {
        await this.api('POST', `/training/${this.trainingRecords.training.id}/records`, payload);
        // Refresh
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
        this.trainingRecords.newRecord = { userId: '', attended: false, score: null, effective: '', certUrl: '' };
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async deleteTrainingRecord(userId) {
      if (!confirm('حذف هذا السجل؟')) return;
      try {
        await this.api('DELETE', `/training/${this.trainingRecords.training.id}/records/${userId}`);
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    // ─── Document version history (ISO 7.5.3) ─────────────────────────
    docVersions: { open: false, document: null, versions: [] },
    async viewDocVersions(item) {
      try {
        const res = await this.api('GET', `/documents/${item.id}/versions`);
        this.docVersions = { open: true, document: res.document, versions: res.versions };
      } catch (e) { alert(e.message || 'فشل تحميل الإصدارات'); }
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

    // ─── Quality Policy activation ─────────────────────────────────────
    async activatePolicy(item) {
      if (!confirm(`تفعيل سياسة الجودة إصدار ${item.version}؟\nسيتم إيقاف الإصدارات السابقة تلقائياً.`)) return;
      try {
        await this.api('POST', `/quality-policy/${item.id}/activate`);
        alert('✅ تم تفعيل السياسة');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    // ─── Surveys (custom module) ───────────────────────────────────────
    async loadSurveys() {
      try {
        const r = await this.api('GET', '/surveys');
        this.surveysList = r.items || [];
      } catch (e) { alert(e.message || 'فشل تحميل الاستبيانات'); }
    },
    openSurveyCreate() {
      this.surveyModal = {
        open: true, mode: 'create', id: null,
        title: '', target: 'BENEFICIARY', period: '', active: true,
        questions: [
          { key: 'overall', label: 'تقييمك العام للخدمة', type: 'rating' },
        ],
      };
    },
    async openSurveyEdit(s) {
      const questions = (() => { try { return JSON.parse(s.questionsJson || '[]'); } catch { return []; } })();
      this.surveyModal = {
        open: true, mode: 'edit', id: s.id,
        title: s.title, target: s.target, period: s.period || '', active: s.active,
        questions,
      };
    },
    addSurveyQuestion() {
      const i = this.surveyModal.questions.length + 1;
      this.surveyModal.questions.push({ key: `q${i}`, label: 'سؤال جديد', type: 'rating' });
    },
    removeSurveyQuestion(idx) {
      this.surveyModal.questions.splice(idx, 1);
    },
    async saveSurvey() {
      const m = this.surveyModal;
      if (!m.title) return alert('أدخل عنوان الاستبيان');
      if (!m.questions.length) return alert('أضف سؤالاً واحداً على الأقل');
      for (const [i, q] of m.questions.entries()) {
        if (!q.key || !q.label) return alert(`السؤال رقم ${i + 1} ينقصه المفتاح أو النص`);
      }
      const payload = {
        title: m.title, target: m.target, period: m.period || null, active: !!m.active,
        questionsJson: JSON.stringify(m.questions),
      };
      try {
        if (m.mode === 'create') await this.api('POST', '/surveys', payload);
        else await this.api('PUT', `/surveys/${m.id}`, payload);
        this.surveyModal.open = false;
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async deleteSurvey(s) {
      if (!confirm(`حذف الاستبيان "${s.title}"؟`)) return;
      try {
        await this.api('DELETE', `/surveys/${s.id}`);
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },
    async viewSurveySummary(s) {
      try {
        const r = await this.api('GET', `/surveys/${s.id}/summary`);
        this.surveySummary = { open: true, data: r, survey: s };
      } catch (e) { alert(e.message || 'فشل جلب النتائج'); }
    },
    copySurveyLink(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`✅ تم نسخ الرابط\n${url}`);
      }).catch(() => {
        prompt('انسخ الرابط:', url);
      });
    },
    shareWhatsappSurvey(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      const msg = encodeURIComponent(`مرحباً، نرجو مشاركتنا رأيك عبر الاستبيان:\n${s.title}\n${url}`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    },

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
      this.$nextTick(() => this.renderChart());
    },

    async loadAuditLog() {
      const r = await this.api('GET', '/audit-log?limit=100');
      this.auditLog = r.items || [];
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
      const el = document.getElementById('dashChart');
      if (!el || !this.dashKpis) return;
      if (this.dashChart) this.dashChart.destroy();
      const k = this.dashKpis;
      const rc = k.risks.byCriticality || {};
      this.dashChart = new Chart(el, {
        type: 'doughnut',
        data: {
          labels: ['حرج', 'مرتفع', 'متوسط', 'منخفض'],
          datasets: [{
            data: [rc['حرج']||0, rc['مرتفع']||0, rc['متوسط']||0, rc['منخفض']||0],
            backgroundColor: ['#dc2626','#f97316','#eab308','#22c55e'],
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Segoe UI, Tahoma, sans-serif' } } },
          },
        },
      });
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

    // ------ CRUD ------
    async openCreate() {
      await this.loadRelations();
      this.modal = { open: true, mode: 'create', data: {} };
    },
    async openEdit(item) {
      await this.loadRelations();
      const data = { ...item };
      for (const f of this.currentFields) {
        if (f.type === 'date' && data[f.key]) data[f.key] = data[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'edit', data };
    },
    async save() {
      const mod = this.currentModule;
      const payload = { ...this.modal.data };
      for (const f of this.currentFields) {
        if (f.type === 'number' && payload[f.key] != null && payload[f.key] !== '') payload[f.key] = Number(payload[f.key]);
        if (f.type === 'date' && payload[f.key]) payload[f.key] = new Date(payload[f.key]).toISOString();
        // Convert empty relation/select/date/number to null so Prisma accepts
        if (payload[f.key] === '') payload[f.key] = null;
      }
      try {
        if (this.modal.mode === 'edit') {
          await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
        } else {
          await this.api('POST', `/${mod.endpoint}`, payload);
        }
        this.modal.open = false;
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

    // ------ External Eval Link ------
    async requestEvalLink(supplier) {
      try {
        const r = await this.api('POST', '/eval-tokens', { supplierId: supplier.id, daysValid: 30 });
        this.evalLinkModal = { open: true, url: r.url, supplier, copied: false };
      } catch (e) { alert(e.message || 'فشل إنشاء الرابط'); }
    },

    copyEvalLink() {
      navigator.clipboard.writeText(this.evalLinkModal.url).then(() => {
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      }).catch(() => {
        // fallback for older browsers
        const el = document.createElement('textarea');
        el.value = this.evalLinkModal.url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      });
    },

    // ------ Supplier Evaluation ------
    openEval(supplier) {
      this.evalModal.supplier = supplier;
      this.evalModal.period = '';
      this.evalModal.notes = '';
      this.evalModal.recommendation = '';
      // Load criteria based on supplier type
      this.evalModal.criteria = this.criteriaForType(supplier.type);
      this.evalModal.criteria.forEach(c => { c.score = 0; c.note = ''; });
      this.evalModal.open = true;
    },

    criteriaForType(type) {
      // Common criteria — applied to all supplier types
      const common = [
        { key: 'transparency',   label: 'الشفافية ومكافحة الفساد',        max: 8, critical: true,  score: 0 },
        { key: 'saudization',    label: 'نسبة السعودة وتوطين الوظائف',    max: 5, critical: false, score: 0 },
        { key: 'sustainability', label: 'الاستدامة والمسؤولية الاجتماعية', max: 5, critical: false, score: 0 },
        { key: 'financial_stab', label: 'الاستقرار المالي وموثوقية المورد', max: 5, critical: false, score: 0 },
      ];
      const core = {
        GOODS: [
          { key: 'product_quality', label: 'جودة المنتجات ومطابقة المواصفات', max: 25, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بمواعيد التسليم',         max: 18, critical: false, score: 0 },
          { key: 'packaging',       label: 'التعبئة والتغليف والحفظ',          max: 10, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والشروط التجارية',         max: 12, critical: false, score: 0 },
          { key: 'communication',   label: 'الاستجابة والتواصل',               max: 7,  critical: false, score: 0 },
          { key: 'after_sale',      label: 'خدمات ما بعد البيع والضمان',       max: 5,  critical: false, score: 0 },
        ],
        SERVICES: [
          { key: 'service_quality', label: 'جودة الخدمة المقدمة',             max: 22, critical: true,  score: 0 },
          { key: 'professionalism', label: 'الكفاءة والاحترافية للفريق',       max: 18, critical: false, score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',          max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',               max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',          max: 10, critical: false, score: 0 },
        ],
        CONSTRUCTION: [
          { key: 'spec_compliance', label: 'الالتزام بالمواصفات الفنية والمخططات', max: 14, critical: true,  score: 0 },
          { key: 'work_quality',    label: 'جودة التنفيذ ومطابقة المعايير الهندسية', max: 13, critical: true,  score: 0 },
          { key: 'schedule',        label: 'الالتزام بالجدول الزمني ومراحل التسليم', max: 12, critical: false, score: 0 },
          { key: 'hse_safety',      label: 'السلامة المهنية وتطبيق اشتراطات HSE',  max: 12, critical: true,  score: 0 },
          { key: 'workforce',       label: 'كفاءة العمالة والكوادر الفنية',         max: 8,  critical: false, score: 0 },
          { key: 'materials',       label: 'جودة المواد المستخدمة',                max: 8,  critical: false, score: 0 },
          { key: 'warranty',        label: 'فترة الضمان وخدمات ما بعد التسليم',    max: 5,  critical: false, score: 0 },
          { key: 'permits',         label: 'الالتزام بالأنظمة البلدية والتراخيص',   max: 5,  critical: true,  score: 0 },
        ],
        IT_SERVICES: [
          { key: 'solution_quality',label: 'جودة الحل التقني ومطابقة المتطلبات', max: 18, critical: true,  score: 0 },
          { key: 'sla_response',    label: 'وقت الاستجابة والالتزام بـ SLA',      max: 15, critical: true,  score: 0 },
          { key: 'support',         label: 'الدعم الفني وتوفره عند الحاجة',       max: 12, critical: false, score: 0 },
          { key: 'data_security',   label: 'أمن المعلومات وحماية البيانات',       max: 12, critical: true,  score: 0 },
          { key: 'compatibility',   label: 'التوافقية مع الأنظمة القائمة',        max: 8,  critical: false, score: 0 },
          { key: 'documentation',   label: 'التوثيق والتدريب',                   max: 7,  critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',            max: 5,  critical: false, score: 0 },
        ],
        TRANSPORT: [
          { key: 'safety',           label: 'سلامة النقل وحماية البضاعة',       max: 22, critical: true,  score: 0 },
          { key: 'delivery',         label: 'الالتزام بالمواعيد',               max: 22, critical: false, score: 0 },
          { key: 'vehicle_condition',label: 'حالة المركبات والمعدات',           max: 15, critical: false, score: 0 },
          { key: 'driver_conduct',   label: 'سلوك وكفاءة السائقين',             max: 10, critical: false, score: 0 },
          { key: 'communication',    label: 'التواصل والاستجابة',               max: 5,  critical: false, score: 0 },
          { key: 'pricing',          label: 'الأسعار والتنافسية',               max: 3,  critical: false, score: 0 },
        ],
        CONSULTING: [
          { key: 'output_quality',  label: 'جودة التقارير والمخرجات',           max: 22, critical: true,  score: 0 },
          { key: 'expertise',       label: 'الخبرة والكفاءة التخصصية',          max: 18, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',           max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',                max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقابلة',          max: 10, critical: false, score: 0 },
        ],
        IN_KIND_DONOR: [
          { key: 'spec_conformity', label: 'مطابقة المواصفات المطلوبة',         max: 28, critical: true,  score: 0 },
          { key: 'product_quality', label: 'جودة المواد / البضائع',             max: 22, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالمواعيد',               max: 15, critical: false, score: 0 },
          { key: 'compliance',      label: 'الامتثال والوثائق (صلاحية - شهادات)', max: 12, critical: true,  score: 0 },
        ],
      };
      const fallback = [
        { key: 'quality',       label: 'جودة المنتج / الخدمة',              max: 22, critical: true,  score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',                max: 18, critical: false, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',                max: 15, critical: false, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',          max: 12, critical: false, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',                 max: 10, critical: false, score: 0 },
      ];
      return [ ...(core[type] || fallback), ...common ];
    },

    evalTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + Math.min(c.max, Math.max(0, Number(c.score) || 0)), 0);
    },
    evalMaxTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + c.max, 0);
    },
    evalPct() {
      const max = this.evalMaxTotal();
      return max > 0 ? Math.round((this.evalTotal() / max) * 100) : 0;
    },
    evalGrade() {
      const p = this.evalPct();
      if (p >= 90) return 'ممتاز ⭐⭐⭐⭐⭐';
      if (p >= 80) return 'جيد جداً ⭐⭐⭐⭐';
      if (p >= 70) return 'جيد ⭐⭐⭐';
      if (p >= 60) return 'مقبول ⭐⭐';
      return 'ضعيف ⭐';
    },
    evalCriticalFailed() {
      return this.evalModal.criteria.some(c => c.critical && (Number(c.score) || 0) < (c.max * 0.5));
    },
    evalDecision() {
      if (this.evalCriticalFailed()) return 'مرفوض (فشل معيار حرج) ⛔';
      const p = this.evalPct();
      if (p >= 85) return 'معتمد ✅';
      if (p >= 70) return 'معتمد مشروط ⚠️';
      if (p >= 50) return 'قيد المراقبة 🔄';
      return 'مرفوض ❌';
    },

    async submitEval() {
      const total = this.evalTotal();
      const criteriaPayload = {
        criteria: Object.fromEntries(this.evalModal.criteria.map(c => [c.key, {
          label: c.label, max: c.max, score: Number(c.score) || 0,
          critical: !!c.critical, note: (c.note || '').trim() || null,
        }])),
        criticalFailed: this.evalCriticalFailed(),
        recommendation: this.evalModal.recommendation || null,
      };
      const criteriaJson = JSON.stringify(criteriaPayload);
      try {
        const maxTotal = this.evalMaxTotal();
        const pct = this.evalPct();
        await this.api('POST', '/supplier-evals', {
          supplierId: this.evalModal.supplier.id,
          totalScore: total,
          maxScore: maxTotal,
          percentage: pct,
          criteriaJson,
          period: this.evalModal.period,
          notes: this.evalModal.notes,
        });
        this.evalModal.open = false;
        alert(`✅ تم حفظ التقييم\nالنتيجة: ${total}/${maxTotal} (${pct}%) — ${this.evalGrade()}\nالقرار: ${this.evalDecision()}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل حفظ التقييم'); }
    },

    // ------ Digital Signature ------
    openSig(item) {
      const typeMap = { ncr: 'NCR', audits: 'Audit', 'supplier-evals': 'SupplierEval' };
      this.sigModal.entityType = typeMap[this.page] || this.page;
      this.sigModal.entityId = item.id;
      this.sigModal.purpose = 'approve';
      this.sigModal.open = true;
      this.$nextTick(() => this.initSigCanvas());
    },

    initSigCanvas() {
      const canvas = document.getElementById('sigCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (this._sigInited) { this._sigCanvas = canvas; this._sigCtx = ctx; return; }
      this._sigInited = true;

      let drawing = false, lx = 0, ly = 0;
      const getXY = (e) => {
        const r = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return [(cx - r.left) * canvas.width / r.width, (cy - r.top) * canvas.height / r.height];
      };

      canvas.addEventListener('mousedown', e => { drawing = true; [lx, ly] = getXY(e); });
      canvas.addEventListener('mousemove', e => {
        if (!drawing) return;
        const [x, y] = getXY(e);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
        [lx, ly] = [x, y];
      });
      ['mouseup', 'mouseleave'].forEach(ev => canvas.addEventListener(ev, () => drawing = false));
      canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; [lx, ly] = getXY(e); }, { passive: false });
      canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!drawing) return;
        const [x, y] = getXY(e);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
        [lx, ly] = [x, y];
      }, { passive: false });
      canvas.addEventListener('touchend', () => drawing = false);

      this._sigCanvas = canvas;
      this._sigCtx = ctx;
    },

    clearSig() {
      if (this._sigCanvas && this._sigCtx) {
        this._sigCtx.clearRect(0, 0, this._sigCanvas.width, this._sigCanvas.height);
      }
    },

    async submitSig() {
      if (!this._sigCanvas) return;
      const data = this._sigCanvas.toDataURL('image/png');
      const blank = document.createElement('canvas');
      blank.width = this._sigCanvas.width; blank.height = this._sigCanvas.height;
      if (data === blank.toDataURL('image/png')) { alert('الرجاء رسم توقيعك أولاً'); return; }
      try {
        await this.api('POST', '/signatures', {
          entityType: this.sigModal.entityType,
          entityId: this.sigModal.entityId,
          purpose: this.sigModal.purpose,
          signatureData: data,
        });
        this.sigModal.open = false;
        alert('✅ تم حفظ التوقيع بنجاح');
      } catch (e) { alert(e.message || 'فشل حفظ التوقيع'); }
    },

    // ------ rendering helpers ------
    renderCell(item, col) {
      let v = item[col.key];
      if (v === null || v === undefined || v === '') return '<span class="text-gray-300">—</span>';
      if (col.type === 'date')   v = this.fmtDate(v);
      if (col.type === 'bool')   return v ? '<span class="text-green-600">✓</span>' : '<span class="text-gray-400">✗</span>';
      if (col.type === 'status') return `<span class="px-2 py-0.5 rounded text-xs ${this.statusColor(v)}">${this.statusLabel(v)}</span>`;
      if (col.type === 'level')  return `<span class="px-2 py-0.5 rounded text-xs ${this.levelColor(v)}">${v}</span>`;
      return this.escape(String(v));
    },
    escape(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
    fmtDate(v) { try { return new Date(v).toLocaleDateString('ar-SA'); } catch { return v; } },
    today() { return new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },

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
