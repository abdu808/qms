// modules-config/context.js — مجال السياق والقيادة
// swot, interestedParties, processes, qualityPolicy, users, departments
window.QMS_MODULES_CONTEXT = {
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

  users: {
    endpoint: 'users',
    cols: [
      { key: 'name', label: 'الاسم' },
      { key: 'email', label: 'البريد' },
      { key: 'department.name', label: 'الإدارة' },
      { key: 'role', label: 'الدور' },
      { key: 'active', label: 'نشط', type: 'bool' },
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
      { key: 'departmentId', label: 'الإدارة', type: 'relation', relation: 'departments' },
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
