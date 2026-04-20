/**
 * seed-strategic-plan.mjs
 *
 * يُعبِّئ قاعدة البيانات ببيانات حقيقية من:
 *   - الخطة الاستراتيجية جمعية البر بصبيا 2025-2027
 *   - الخطة التشغيلية 2026 (التنفيذ + الميزانية)
 *
 * الخصائص:
 *   - Idempotent: يتخطى ما هو موجود مسبقاً
 *   - يُشغَّل تلقائياً من startup.sh بعد seed-if-empty
 *   - آمن للتشغيل المتكرر
 *
 * تشغيل يدوي: node scripts/seed-strategic-plan.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─────────────────────────────────────────────────────────────────────────────
// 1. الأقسام التنظيمية الحقيقية (12 قسماً)
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { code: 'QM',  name: 'وحدة التميز المؤسسي والجودة',   nameEn: 'Quality & Excellence Unit',    manager: 'مدير الجودة' },
  { code: 'ADM', name: 'الإدارة التنفيذية العليا',       nameEn: 'Executive Management',          manager: 'المدير التنفيذي' },
  { code: 'SOC', name: 'قسم الرعاية الاجتماعية',        nameEn: 'Social Care Department',        manager: 'رئيس قسم الرعاية' },
  { code: 'KAF', name: 'قسم الكفالات',                  nameEn: 'Sponsorship Department',        manager: 'رئيس قسم الكفالات' },
  { code: 'EMP', name: 'قسم التمكين والتنمية',           nameEn: 'Empowerment Department',        manager: 'رئيس قسم التمكين' },
  { code: 'FIN', name: 'إدارة الشؤون المالية',           nameEn: 'Finance Department',            manager: 'المدير المالي' },
  { code: 'RES', name: 'إدارة تنمية الموارد المالية',    nameEn: 'Resource Development',          manager: 'مدير تنمية الموارد' },
  { code: 'INV', name: 'وحدة الاستثمار والأصول',         nameEn: 'Investment & Assets Unit',      manager: 'مسؤول الاستثمار' },
  { code: 'COM', name: 'إدارة الاتصال المؤسسي والتطوع',  nameEn: 'Communications & Volunteering', manager: 'مدير الاتصال' },
  { code: 'HR',  name: 'إدارة الموارد البشرية',          nameEn: 'Human Resources',               manager: 'مدير الموارد البشرية' },
  { code: 'IT',  name: 'وحدة تقنية المعلومات',           nameEn: 'Information Technology',        manager: 'مسؤول تقنية المعلومات' },
  { code: 'MKT', name: 'إدارة التسويق والحملات',         nameEn: 'Marketing & Campaigns',         manager: 'مدير التسويق' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. المحاور الاستراتيجية (4 محاور — Balanced Scorecard)
// ─────────────────────────────────────────────────────────────────────────────
const STRATEGIC_GOALS = [
  {
    code: 'STR-2026-001',
    title: 'التميز في خدمة المستفيدين وتوسيع الأثر الاجتماعي',
    perspective: 'مستفيدون',
    kpi: 'عدد المستفيدين المخدومين سنوياً',
    baseline: '3,500 مستفيد',
    target: '4,500 مستفيد بحلول 2027',
    initiatives: 'توسيع برنامج الكفالات - تطوير السلة الغذائية - برامج التمكين والتدريب',
    responsible: 'قسم الرعاية الاجتماعية / قسم الكفالات / قسم التمكين',
    startYear: 2025, endYear: 2027,
    progress: 35, status: 'IN_PROGRESS',
  },
  {
    code: 'STR-2026-002',
    title: 'تحقيق الاستدامة المالية وتنويع مصادر الإيرادات',
    perspective: 'مالي',
    kpi: 'إجمالي الإيرادات السنوية',
    baseline: '11,309,157 ريال (2025)',
    target: '14,000,000 ريال بحلول 2027',
    initiatives: 'تفعيل منصة إحسان - توسيع قاعدة المتبرعين - استثمار الأصول - ترشيد الإنفاق',
    responsible: 'إدارة تنمية الموارد / إدارة الشؤون المالية / وحدة الاستثمار',
    startYear: 2025, endYear: 2027,
    progress: 20, status: 'IN_PROGRESS',
  },
  {
    code: 'STR-2026-003',
    title: 'تطوير العمليات المؤسسية وتعزيز الحضور المجتمعي',
    perspective: 'داخلي',
    kpi: 'نسبة رضا أصحاب المصلحة',
    baseline: '35%',
    target: '85% بحلول 2027',
    initiatives: 'تأسيس إدارة الاتصال - توسيع الشراكات - تفعيل التطوع - تطوير الهوية البصرية',
    responsible: 'إدارة الاتصال المؤسسي / إدارة التسويق',
    startYear: 2025, endYear: 2027,
    progress: 15, status: 'IN_PROGRESS',
  },
  {
    code: 'STR-2026-004',
    title: 'بناء القدرات التنظيمية وتحقيق التميز المؤسسي',
    perspective: 'تعلم ونمو',
    kpi: 'نسبة استكمال متطلبات ISO 9001',
    baseline: '66%',
    target: 'اجتياز شهادة ISO 9001:2015 في Q3 2026',
    initiatives: 'تأهيل ISO 9001 - التحول التقني ورافد - تطوير الكوادر البشرية',
    responsible: 'وحدة الجودة / وحدة تقنية المعلومات / الموارد البشرية',
    startYear: 2025, endYear: 2027,
    progress: 40, status: 'IN_PROGRESS',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. الأهداف الاستراتيجية (12 هدفاً)
// ─────────────────────────────────────────────────────────────────────────────
function buildObjectives(admin, depts, goals) {
  const dept = (code) => depts[code]?.id;
  const goal = (code) => goals[code]?.id;

  return [
    // ── محور المستفيدين ──
    {
      code: 'OBJ-2026-001',
      title: 'تأمين الكفالة الشهرية للأيتام والأسر الأشد حاجة',
      description: 'توفير الكفالة النقدية للأيتام وأسر الكفالة بما يضمن الاستمرارية والتوسع السنوي نحو 900 يتيم بحلول 2027.',
      kpi: 'عدد الأيتام المكفولين شهرياً',
      baseline: 680, target: 870, unit: 'يتيم',
      currentValue: 870, progress: 100,
      status: 'IN_PROGRESS',
      departmentId: dept('KAF'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'SNAPSHOT', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-002',
      title: 'تقديم برامج الرعاية الاجتماعية للمستفيدين',
      description: 'السلة الغذائية الشهرية لـ 1500 أسرة + سداد إيجارات + تأثيث + مساعدات موسمية وطارئة.',
      kpi: 'عدد الأسر المستفيدة من السلة الغذائية شهرياً',
      baseline: 0, target: 1500, unit: 'أسرة',
      currentValue: 1500, progress: 100,
      status: 'IN_PROGRESS',
      departmentId: dept('SOC'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'SNAPSHOT', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-003',
      title: 'تقديم برامج التنمية والتمكين للمستفيدين',
      description: 'تدريب وتأهيل 350 شاباً وفتاة، تمويل 15 مشروعاً صغيراً، توظيف 20 مستفيداً.',
      kpi: 'عدد مستفيدي برامج التدريب والتمكين',
      baseline: 300, target: 350, unit: 'مستفيد',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('EMP'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'CUMULATIVE', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    // ── محور الاستدامة المالية ──
    {
      code: 'OBJ-2026-004',
      title: 'تحقيق الاستدامة المالية وتنويع مصادر الإيرادات',
      description: 'استهداف إيرادات 12,566,000 ريال بنمو 11.1% عن 2025، مع تفعيل 9 مصادر إيراد متنوعة.',
      kpi: 'إجمالي الإيرادات المحققة',
      baseline: 11309157, target: 12566000, unit: 'ريال',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('RES'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'CUMULATIVE', seasonality: 'RAMADAN_RELIEF', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-005',
      title: 'استثمار الأصول وزيادة العائد المالي',
      description: 'تنفيذ مشروع استثماري جديد، زيادة عائد الاستثمارات 10%، إعادة استثمار 25% من الفوائض.',
      kpi: 'نسبة نمو عائد الاستثمارات',
      baseline: 0, target: 10, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('INV'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'SNAPSHOT', seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-006',
      title: 'تحقيق الكفاءة المالية وترشيد الإنفاق',
      description: 'الإنفاق الإداري ≤15% من الإجمالي، ترشيد 5% من المصروفات التشغيلية، إقفال مالي شهري ≤5 أيام.',
      kpi: 'نسبة المصاريف الإدارية',
      baseline: 0, target: 15, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('FIN'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'PERIODIC', seasonality: 'MONTHLY_EVEN', direction: 'LOWER_BETTER',
    },
    // ── محور العمليات ──
    {
      code: 'OBJ-2026-007',
      title: 'تحسين الصورة الذهنية للجمعية وتعزيز الانتشار الرقمي',
      description: 'تأسيس إدارة الاتصال المؤسسي، تنفيذ 3 حملات إعلامية، رفع رضا أصحاب المصلحة إلى 80%.',
      kpi: 'نسبة رضا أصحاب المصلحة',
      baseline: 35, target: 80, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('COM'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-003'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'PERIODIC', seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-008',
      title: 'زيادة الشراكات المجتمعية وتفعيل التطوع',
      description: 'الوصول إلى 15 شراكة مع القطاع الخاص والجهات الحكومية، توفير 250 فرصة تطوعية بقيمة 250,000 ريال.',
      kpi: 'عدد الشراكات الفعّالة',
      baseline: 10, target: 15, unit: 'شراكة',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('COM'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-003'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'CUMULATIVE', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    // ── محور القدرات التنظيمية ──
    {
      code: 'OBJ-2026-009',
      title: 'اجتياز تدقيق ISO 9001:2015 والحصول على الشهادة',
      description: 'تأهيل الجمعية وتطوير العمليات والأدلة التنظيمية لاجتياز التدقيق الخارجي في Q3 2026.',
      kpi: 'نسبة استكمال متطلبات ISO 9001',
      baseline: 66, target: 100, unit: '%',
      currentValue: 85, progress: 55,
      status: 'IN_PROGRESS',
      departmentId: dept('QM'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-004'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-09-30'),
      kpiType: 'SNAPSHOT', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-010',
      title: 'تحقيق التحول التقني في العمليات والخدمات',
      description: 'تفعيل برنامج رافد، أتمتة 90% من الدورات المستندية، تطوير الموقع الإلكتروني.',
      kpi: 'نسبة تحقيق التحول التقني في العمليات',
      baseline: 60, target: 90, unit: '%',
      currentValue: 80, progress: 40,
      status: 'IN_PROGRESS',
      departmentId: dept('IT'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-004'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'SNAPSHOT', seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-011',
      title: 'تطوير الكادر البشري وبناء القدرات',
      description: '20 ساعة تدريب لكل موظف، 3 شهادات احترافية، البرنامج التدريبي الموحد.',
      kpi: 'ساعات التدريب السنوية للموظف',
      baseline: 1, target: 20, unit: 'ساعة',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('HR'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-004'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'CUMULATIVE', seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
    },
    {
      code: 'OBJ-2026-012',
      title: 'رفع رضا المستفيدين عن جودة الخدمات',
      description: 'رفع مستوى رضا المستفيدين إلى 85% عبر تحسين جودة البرامج وسرعة الاستجابة.',
      kpi: 'نسبة رضا المستفيدين عن برامج الرعاية',
      baseline: 70, target: 85, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: dept('SOC'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
      kpiType: 'PERIODIC', seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. المخاطر (من مصفوفة المخاطر التشغيلية 2026)
// ─────────────────────────────────────────────────────────────────────────────
function buildRisks(admin, depts, goals) {
  const dept = (code) => depts[code]?.id;
  const goal = (code) => goals[code]?.id;
  return [
    {
      code: 'RSK-2026-001',
      title: 'انخفاض الإيرادات عن المستهدف السنوي',
      description: 'خطر تراجع التبرعات أو المانحين عن مستويات 2025 مما يهدد الاستمرارية البرنامجية.',
      source: 'تنمية الموارد المالية',
      probability: 4, impact: 5, score: 20, level: 'حرج',
      treatment: 'الحفاظ على احتياطي نقدي لا يقل عن شهرين = 1.2 مليون ريال. تنويع 9 مصادر إيراد. تفعيل المتجر الإلكتروني وحملات رمضان.',
      treatmentType: 'تخفيف',
      status: 'UNDER_TREATMENT',
      departmentId: dept('RES'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      reviewDate: new Date('2026-03-31'),
    },
    {
      code: 'RSK-2026-002',
      title: 'ارتفاع أعداد المستفيدين فوق الطاقة الاستيعابية',
      description: 'زيادة الطلب على الخدمات بشكل يتجاوز الميزانية المخصصة للرعاية المعيشية.',
      source: 'الرعاية المعيشية والإغاثة',
      probability: 3, impact: 4, score: 12, level: 'مرتفع',
      treatment: 'تخصيص 10% من ميزانية الطوارئ. وضع حد أقصى للقبول مع قائمة انتظار. ربط القبول الجديد بحالة الإيرادات الشهرية.',
      treatmentType: 'تخفيف',
      status: 'IDENTIFIED',
      departmentId: dept('SOC'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      reviewDate: new Date('2026-06-30'),
    },
    {
      code: 'RSK-2026-003',
      title: 'عدم اجتياز تدقيق ISO 9001 الخارجي',
      description: 'إخفاق الجمعية في استيفاء متطلبات شهادة ISO 9001:2015 في الموعد المحدد Q3 2026.',
      source: 'التميز المؤسسي والجودة',
      probability: 3, impact: 4, score: 12, level: 'مرتفع',
      treatment: 'إجراء تدقيق داخلي تمهيدي في Q2. استكمال الأدلة التنظيمية يونيو 2026. اشتراك موظفين في تدريب ISO.',
      treatmentType: 'تخفيف',
      status: 'UNDER_TREATMENT',
      departmentId: dept('QM'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-004'),
      reviewDate: new Date('2026-06-30'),
    },
    {
      code: 'RSK-2026-004',
      title: 'تأخر تحصيل مستحقات الأصول العقارية',
      description: 'تأخر المستأجرين في السداد مما يؤثر على السيولة النقدية الشهرية.',
      source: 'تنمية الأصول والاستثمارات',
      probability: 3, impact: 3, score: 9, level: 'متوسط',
      treatment: 'تفعيل منصة التحصيل الإلكتروني. إشعارات تلقائية قبل 7 أيام من الاستحقاق. مراجعة شهرية لحالة التحصيل.',
      treatmentType: 'تخفيف',
      status: 'UNDER_TREATMENT',
      departmentId: dept('INV'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      reviewDate: new Date('2026-03-31'),
    },
    {
      code: 'RSK-2026-005',
      title: 'مخالفات أو ملاحظات من هيئة الزكاة ZATCA',
      description: 'عدم الامتثال لمتطلبات الرفع الضريبي الربعي لهيئة الزكاة والضريبة.',
      source: 'الإدارة المالية والامتثال',
      probability: 2, impact: 4, score: 8, level: 'متوسط',
      treatment: 'استشارة مكتب ضريبي متخصص. متابعة شهرية لمتطلبات ZATCA. تقديم الإقرارات قبل 15 يوم من الموعد.',
      treatmentType: 'تخفيف',
      status: 'IDENTIFIED',
      departmentId: dept('FIN'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      reviewDate: new Date('2026-03-31'),
    },
    {
      code: 'RSK-2026-006',
      title: 'انخفاض إقبال المستفيدين على برامج التمكين',
      description: 'ضعف التسجيل في برامج التدريب والتأهيل مما يؤثر على مؤشرات التمكين.',
      source: 'التمكين والتنمية',
      probability: 2, impact: 3, score: 6, level: 'منخفض',
      treatment: 'شراكة مع جهات توظيف لضمان مسار واضح بعد التدريب. تقديم حوافز مادية رمزية. حملة تسويق موجهة للفئة المستهدفة.',
      treatmentType: 'تخفيف',
      status: 'IDENTIFIED',
      departmentId: dept('EMP'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-001'),
      reviewDate: new Date('2026-06-30'),
    },
    {
      code: 'RSK-2026-007',
      title: 'ضعف التفاعل الرقمي وتراجع الانتشار',
      description: 'انخفاض مستوى التفاعل مع منصات التواصل الاجتماعي مما يؤثر على حملات التبرع.',
      source: 'الاتصال المؤسسي والتطوع',
      probability: 2, impact: 2, score: 4, level: 'منخفض',
      treatment: 'جدول محتوى شهري محدد مسبقاً. قصص نجاح المستفيدين أسبوعياً. إشراك متطوعين في إنتاج المحتوى.',
      treatmentType: 'تخفيف',
      status: 'IDENTIFIED',
      departmentId: dept('COM'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-003'),
      reviewDate: new Date('2026-06-30'),
    },
    // فرصة
    {
      code: 'OPP-2026-001',
      type: 'OPPORTUNITY',
      title: 'تفعيل منصة إحسان وزيادة التبرعات الرقمية',
      description: 'الاستفادة من منصة إحسان الحكومية لرفع التبرعات الرقمية إلى 2,000,000 ريال في 2026.',
      source: 'التحول الرقمي الحكومي',
      probability: 4, impact: 5, score: 20, level: 'حرج',
      treatment: 'تطوير الحضور على منصة إحسان. ربط المشاريع بأهداف رؤية 2030. تخصيص ملفات تمويلية لكل برنامج.',
      treatmentType: 'استغلال',
      status: 'UNDER_TREATMENT',
      departmentId: dept('RES'), createdById: admin.id,
      strategicGoalId: goal('STR-2026-002'),
      reviewDate: new Date('2026-03-31'),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. الأنشطة التشغيلية (من الخطة التشغيلية 2026)
// ─────────────────────────────────────────────────────────────────────────────
function buildActivities(goals) {
  const goal = (code) => goals[code]?.id;
  return [
    // ── محور المستفيدين ──────────────────────────────────────────────────────
    {
      code: 'ACT-2026-001',
      title: 'برنامج الكفالة الشهرية للأيتام وأسر الكفالة',
      description: 'صرف الكفالات الشهرية لـ 870 يتيماً بمتوسط 800 ريال/شهر، وأسر الكفالة الإضافية.',
      perspective: 'مستفيدون', department: 'قسم الكفالات', responsible: 'رئيس قسم الكفالات',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 8352000, spent: 2088000, progress: 25, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 870, targetUnit: 'يتيم',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-001'),
    },
    {
      code: 'ACT-2026-002',
      title: 'السلة الغذائية الشهرية للأسر المستفيدة',
      description: 'توزيع 1500 سلة غذائية شهرياً + مساعدات موسمية رمضان وعيد الأضحى.',
      perspective: 'مستفيدون', department: 'قسم الرعاية الاجتماعية', responsible: 'رئيس قسم الرعاية',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 1260000, spent: 315000, progress: 25, status: 'IN_PROGRESS',
      kpiType: 'SNAPSHOT', targetValue: 1500, targetUnit: 'أسرة/شهر',
      seasonality: 'RAMADAN_RELIEF', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-001'),
    },
    {
      code: 'ACT-2026-003',
      title: 'مساعدات إيجار المسكن وسداد الفواتير',
      description: 'سداد إيجارات 200 أسرة سنوياً + فواتير الكهرباء والمياه للحالات الطارئة.',
      perspective: 'مستفيدون', department: 'قسم الرعاية الاجتماعية', responsible: 'رئيس قسم الرعاية',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 480000, spent: 80000, progress: 17, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 200, targetUnit: 'أسرة',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-001'),
    },
    {
      code: 'ACT-2026-004',
      title: 'برامج التدريب والتمكين الاقتصادي',
      description: 'تنفيذ 8 دورات تدريبية + تمويل 15 مشروعاً صغيراً + برامج إيجاد وظائف.',
      perspective: 'مستفيدون', department: 'قسم التمكين والتنمية', responsible: 'رئيس قسم التمكين',
      year: 2026, startDate: new Date('2026-03-01'), endDate: new Date('2026-12-31'),
      budget: 350000, spent: 0, progress: 0, status: 'PLANNED',
      kpiType: 'CUMULATIVE', targetValue: 350, targetUnit: 'مستفيد',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-001'),
    },
    // ── محور الاستدامة المالية ───────────────────────────────────────────────
    {
      code: 'ACT-2026-005',
      title: 'حملات جمع التبرعات الموسمية والدورية',
      description: 'حملة رمضان + حملة عيد الأضحى + حملة نهاية العام + اشتراكات المتبرعين الشهرية.',
      perspective: 'مالي', department: 'إدارة تنمية الموارد', responsible: 'مدير تنمية الموارد',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 120000, spent: 15000, progress: 10, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 8000000, targetUnit: 'ريال',
      seasonality: 'RAMADAN_RELIEF', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-002'),
    },
    {
      code: 'ACT-2026-006',
      title: 'تفعيل منصة إحسان والتبرع الرقمي',
      description: 'تطوير صفحة الجمعية على إحسان، ربط 5 مشاريع، استهداف 2 مليون ريال رقمياً.',
      perspective: 'مالي', department: 'إدارة تنمية الموارد', responsible: 'مدير تنمية الموارد',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-06-30'),
      budget: 30000, spent: 5000, progress: 15, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 2000000, targetUnit: 'ريال',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-002'),
    },
    {
      code: 'ACT-2026-007',
      title: 'إدارة الأصول العقارية والاستثمارات',
      description: 'تحصيل إيجارات الأصول العقارية + مشروع استثماري جديد + إعادة استثمار الفوائض.',
      perspective: 'مالي', department: 'وحدة الاستثمار والأصول', responsible: 'مسؤول الاستثمار',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 50000, spent: 5000, progress: 10, status: 'IN_PROGRESS',
      kpiType: 'SNAPSHOT', targetValue: 10, targetUnit: '%',
      seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-002'),
    },
    {
      code: 'ACT-2026-008',
      title: 'ترشيد الإنفاق والرقابة المالية',
      description: 'الإقفال المالي الشهري خلال 5 أيام، مراجعة دورية للعقود، تدقيق داخلي ربعي.',
      perspective: 'مالي', department: 'إدارة الشؤون المالية', responsible: 'المدير المالي',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 20000, spent: 5000, progress: 25, status: 'IN_PROGRESS',
      kpiType: 'PERIODIC', targetValue: 15, targetUnit: '%',
      seasonality: 'MONTHLY_EVEN', direction: 'LOWER_BETTER',
      strategicGoalId: goal('STR-2026-002'),
    },
    // ── محور العمليات والاتصال ──────────────────────────────────────────────
    {
      code: 'ACT-2026-009',
      title: 'تطوير هوية الجمعية البصرية والموقع الإلكتروني',
      description: 'تحديث الهوية البصرية، إعادة تصميم الموقع، إنتاج محتوى مرئي احترافي.',
      perspective: 'داخلي', department: 'إدارة التسويق والحملات', responsible: 'مدير التسويق',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-06-30'),
      budget: 80000, spent: 0, progress: 0, status: 'PLANNED',
      kpiType: 'BINARY', targetValue: 1, targetUnit: 'مشروع',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-003'),
    },
    {
      code: 'ACT-2026-010',
      title: 'حملات التواصل الاجتماعي ومنصات الإعلام',
      description: '3 حملات إعلامية موسمية، منشور يومي على السوشيال ميديا، قصص المستفيدين أسبوعياً.',
      perspective: 'داخلي', department: 'إدارة الاتصال المؤسسي والتطوع', responsible: 'مدير الاتصال',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 120000, spent: 20000, progress: 15, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 80, targetUnit: '%',
      seasonality: 'RAMADAN_RELIEF', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-003'),
    },
    {
      code: 'ACT-2026-011',
      title: 'برنامج التطوع المجتمعي وإدارة الشراكات',
      description: 'توفير 250 فرصة تطوعية، توقيع 5 شراكات جديدة مع شركات وجهات حكومية.',
      perspective: 'داخلي', department: 'إدارة الاتصال المؤسسي والتطوع', responsible: 'مدير الاتصال',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 50000, spent: 5000, progress: 10, status: 'IN_PROGRESS',
      kpiType: 'CUMULATIVE', targetValue: 15, targetUnit: 'شراكة',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-003'),
    },
    // ── محور القدرات التنظيمية ──────────────────────────────────────────────
    {
      code: 'ACT-2026-012',
      title: 'مشروع تأهيل وشهادة ISO 9001:2015',
      description: 'تطوير نظام إدارة الجودة، إعداد الوثائق، التدقيق الداخلي، الحصول على الشهادة Q3 2026.',
      perspective: 'تعلم ونمو', department: 'وحدة التميز المؤسسي والجودة', responsible: 'مدير الجودة',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-09-30'),
      budget: 75000, spent: 25000, progress: 55, status: 'IN_PROGRESS',
      kpiType: 'SNAPSHOT', targetValue: 100, targetUnit: '%',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-004'),
    },
    {
      code: 'ACT-2026-013',
      title: 'التحول الرقمي — تفعيل رافد وأتمتة العمليات',
      description: 'تفعيل برنامج رافد لإدارة المستفيدين، أتمتة 90% من الدورات المستندية، تطوير التقارير التلقائية.',
      perspective: 'تعلم ونمو', department: 'وحدة تقنية المعلومات', responsible: 'مسؤول تقنية المعلومات',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 150000, spent: 30000, progress: 40, status: 'IN_PROGRESS',
      kpiType: 'SNAPSHOT', targetValue: 90, targetUnit: '%',
      seasonality: 'QUARTERLY', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-004'),
    },
    {
      code: 'ACT-2026-014',
      title: 'البرنامج التدريبي السنوي لتطوير الكوادر',
      description: '20 ساعة تدريب لكل موظف، 3 شهادات احترافية، برنامج التوجيه للموظفين الجدد.',
      perspective: 'تعلم ونمو', department: 'إدارة الموارد البشرية', responsible: 'مدير الموارد البشرية',
      year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      budget: 60000, spent: 0, progress: 0, status: 'PLANNED',
      kpiType: 'CUMULATIVE', targetValue: 20, targetUnit: 'ساعة/موظف',
      seasonality: 'UNIFORM', direction: 'HIGHER_BETTER',
      strategicGoalId: goal('STR-2026-004'),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. استبيانات الرضا
// ─────────────────────────────────────────────────────────────────────────────
const SURVEYS = [
  {
    code: 'SRV-2026-001',
    title: 'استبيان رضا المستفيدين عن برامج الرعاية الاجتماعية',
    target: 'BENEFICIARY',
    period: 'ربع أول 2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_overall',   label: 'كيف تُقيِّم جودة الخدمات المقدمة لك بشكل عام؟',              type: 'rating', required: true  },
      { key: 'q_speed',     label: 'كيف تُقيِّم سرعة الاستجابة لاحتياجاتك؟',                    type: 'rating', required: true  },
      { key: 'q_staff',     label: 'كيف تُقيِّم تعامل موظفي الجمعية معك؟',                      type: 'rating', required: true  },
      { key: 'q_food',      label: 'هل تُلبّي السلة الغذائية احتياجاتك الأساسية؟',               type: 'yesno',  required: true  },
      { key: 'q_recommend', label: 'هل تنصح الآخرين بالتواصل مع الجمعية للحصول على المساعدة؟',  type: 'yesno',  required: false },
      { key: 'q_improve',   label: 'ما الذي تقترح تحسينه في خدمات الجمعية؟',                    type: 'text',   required: false },
    ]),
  },
  {
    code: 'SRV-2026-002',
    title: 'استبيان رضا المتبرعين ومُقيّمي البرامج',
    target: 'DONOR',
    period: '2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_trust',    label: 'ما مستوى ثقتك بالجمعية في إدارة تبرعاتك بكفاءة وشفافية؟',  type: 'rating', required: true  },
      { key: 'q_impact',   label: 'كيف تُقيِّم الأثر المجتمعي لبرامج الجمعية؟',               type: 'rating', required: true  },
      { key: 'q_reports',  label: 'هل تجد تقارير الأثر التي تُرسلها الجمعية كافية وواضحة؟',   type: 'yesno',  required: false },
      { key: 'q_renew',    label: 'هل تنوي تجديد دعمك للجمعية في العام القادم؟',              type: 'yesno',  required: true  },
      { key: 'q_channels', label: 'ما القنوات التي تفضّل التواصل عبرها مع الجمعية؟',           type: 'text',   required: false },
      { key: 'q_notes',    label: 'أي ملاحظات أو اقتراحات تودّ مشاركتها مع الإدارة؟',         type: 'text',   required: false },
    ]),
  },
  {
    code: 'SRV-2026-003',
    title: 'استبيان رضا المتطوعين عن تجربة التطوع',
    target: 'VOLUNTEER',
    period: '2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_exp',      label: 'كيف تُقيِّم تجربتك التطوعية في الجمعية بشكل عام؟',          type: 'rating', required: true  },
      { key: 'q_support',  label: 'كيف تُقيِّم مستوى الدعم الذي تلقيته من فريق التنسيق؟',     type: 'rating', required: true  },
      { key: 'q_skills',   label: 'هل ساعدت تجربة التطوع في تطوير مهاراتك الشخصية والمهنية؟', type: 'yesno',  required: true  },
      { key: 'q_continue', label: 'هل تنوي الاستمرار في التطوع مع الجمعية؟',                   type: 'yesno',  required: true  },
      { key: 'q_improve',  label: 'ما الذي تقترح تحسينه في برنامج التطوع؟',                    type: 'text',   required: false },
    ]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function upsertCount(label, items, existsFn, createFn) {
  let created = 0, skipped = 0;
  for (const item of items) {
    if (await existsFn(item)) { skipped++; continue; }
    await createFn(item);
    created++;
  }
  console.log(`[seed-strategic] ${label}: أُنشئ ${created} | موجود ${skipped}`);
  return created;
}

async function main() {
  console.log('[seed-strategic] بدء تعبئة البيانات الاستراتيجية...\n');

  // ── 1. الأقسام ────────────────────────────────────────────────────────────
  const deptMap = {};
  let deptCreated = 0, deptSkipped = 0;
  for (const d of DEPARTMENTS) {
    const before = await prisma.department.findUnique({ where: { code: d.code } });
    const result = await prisma.department.upsert({
      where:  { code: d.code },
      update: { name: d.name, nameEn: d.nameEn, manager: d.manager },
      create: d,
    });
    deptMap[d.code] = result;
    if (!before) deptCreated++; else deptSkipped++;
  }
  console.log(`[seed-strategic] أقسام: أُنشئ ${deptCreated} | موجود ${deptSkipped}`);

  // ── 2. المستخدم المسؤول ───────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.warn('[seed-strategic] ⚠️ لم يُوجد مستخدم SUPER_ADMIN — شغّل seed.js أولاً');
    return;
  }

  // ── 3. المحاور الاستراتيجية ───────────────────────────────────────────────
  const goalMap = {};
  await upsertCount('محاور استراتيجية', STRATEGIC_GOALS,
    (g) => prisma.strategicGoal.findUnique({ where: { code: g.code } }),
    async (g) => {
      const r = await prisma.strategicGoal.create({ data: g });
      goalMap[g.code] = r;
    },
  );
  // تحميل جميع المحاور (بما فيها الموجودة سلفاً)
  const allGoals = await prisma.strategicGoal.findMany({ where: { code: { in: STRATEGIC_GOALS.map(g => g.code) } } });
  for (const g of allGoals) goalMap[g.code] = g;

  // ── 4. الأهداف الاستراتيجية ───────────────────────────────────────────────
  const objectives = buildObjectives(admin, deptMap, goalMap);
  await upsertCount('أهداف', objectives,
    (o) => prisma.objective.findUnique({ where: { code: o.code } }),
    (o) => prisma.objective.create({ data: o }),
  );

  // ── 5. المخاطر ────────────────────────────────────────────────────────────
  const risks = buildRisks(admin, deptMap, goalMap);
  await upsertCount('مخاطر', risks,
    (r) => prisma.risk.findUnique({ where: { code: r.code } }),
    (r) => prisma.risk.create({ data: r }),
  );

  // ── 6. الأنشطة التشغيلية ──────────────────────────────────────────────────
  const activities = buildActivities(goalMap);
  await upsertCount('أنشطة تشغيلية', activities,
    (a) => prisma.operationalActivity.findUnique({ where: { code: a.code } }),
    (a) => prisma.operationalActivity.create({ data: a }),
  );

  // ── 7. الاستبيانات ────────────────────────────────────────────────────────
  await upsertCount('استبيانات', SURVEYS,
    (s) => prisma.survey.findUnique({ where: { code: s.code } }),
    (s) => prisma.survey.create({ data: s }),
  );

  console.log('\n[seed-strategic] ✅ اكتملت تعبئة البيانات الاستراتيجية');
}

main()
  .catch(e => { console.error('[seed-strategic] خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
