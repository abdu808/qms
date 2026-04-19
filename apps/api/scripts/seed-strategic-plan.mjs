/**
 * seed-strategic-plan.mjs
 *
 * يُعبِّئ قاعدة البيانات ببيانات حقيقية من:
 *   - الخطة الاستراتيجية جمعية البر بصبيا 2025-2027
 *   - الخطة التشغيلية 2026 (التنفيذ + الميزانية)
 *
 * الخصائص:
 *   - Idempotent: يتخطى ما هو موجود مسبقاً (upsert)
 *   - يُشغَّل تلقائياً من startup.sh بعد seed-if-empty
 *   - آمن للتشغيل المتكرر
 *
 * تشغيل يدوي: node scripts/seed-strategic-plan.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─────────────────────────────────────────────────────────────────────────────
// 1. الأقسام التنظيمية الحقيقية
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
// 2. الأهداف الاستراتيجية (من الخطة الاستراتيجية 2025-2027)
// ─────────────────────────────────────────────────────────────────────────────
function buildObjectives(admin, depts) {
  const get = (code) => depts[code]?.id;

  return [
    // ── محور 1: الخدمات والمستفيدون ──
    {
      code: 'OBJ-2026-001',
      title: 'تأمين الكفالة الشهرية للأيتام والأسر الأشد حاجة',
      description: 'توفير الكفالة النقدية للأيتام وأسر الكفالة بما يضمن الاستمرارية والتوسع السنوي نحو 900 يتيم بحلول 2027.',
      kpi: 'عدد الأيتام المكفولين شهرياً',
      baseline: 680, target: 870, unit: 'يتيم',
      currentValue: 870, progress: 100,
      status: 'IN_PROGRESS',
      departmentId: get('KAF'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-002',
      title: 'تقديم برامج الرعاية الاجتماعية للمستفيدين',
      description: 'السلة الغذائية الشهرية لـ 1500 أسرة + سداد إيجارات + تأثيث + مساعدات موسمية وطارئة.',
      kpi: 'عدد الأسر المستفيدة من السلة الغذائية شهرياً',
      baseline: 0, target: 1500, unit: 'أسرة',
      currentValue: 1500, progress: 100,
      status: 'IN_PROGRESS',
      departmentId: get('SOC'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-003',
      title: 'تقديم برامج التنمية والتمكين للمستفيدين',
      description: 'تدريب وتأهيل 350 شاباً وفتاة، تمويل 15 مشروعاً صغيراً، توظيف 20 مستفيداً.',
      kpi: 'عدد مستفيدي برامج التدريب والتمكين',
      baseline: 300, target: 350, unit: 'مستفيد',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('EMP'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    // ── محور 2: الاستدامة المالية ──
    {
      code: 'OBJ-2026-004',
      title: 'تحقيق الاستدامة المالية وتنويع مصادر الإيرادات',
      description: 'استهداف إيرادات 12,566,000 ريال بنمو 11.1% عن 2025، مع تفعيل 9 مصادر إيراد متنوعة.',
      kpi: 'إجمالي الإيرادات المحققة',
      baseline: 11309157, target: 12566000, unit: 'ريال',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('RES'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-005',
      title: 'استثمار الأصول وزيادة العائد المالي',
      description: 'تنفيذ مشروع استثماري جديد، زيادة عائد الاستثمارات 10%، إعادة استثمار 25% من الفوائض.',
      kpi: 'نسبة نمو عائد الاستثمارات',
      baseline: 0, target: 10, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('INV'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-006',
      title: 'تحقيق الكفاءة المالية وترشيد الإنفاق',
      description: 'الإنفاق الإداري ≤15% من الإجمالي، ترشيد 5% من المصروفات التشغيلية، إقفال مالي شهري ≤5 أيام.',
      kpi: 'نسبة المصاريف الإدارية',
      baseline: 0, target: 15, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('FIN'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    // ── محور 3: العمليات ──
    {
      code: 'OBJ-2026-007',
      title: 'تحسين الصورة الذهنية للجمعية وتعزيز الانتشار الرقمي',
      description: 'تأسيس إدارة الاتصال المؤسسي، تنفيذ 3 حملات إعلامية، رفع رضا أصحاب المصلحة إلى 80%.',
      kpi: 'نسبة رضا أصحاب المصلحة',
      baseline: 35, target: 80, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('COM'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-008',
      title: 'زيادة الشراكات المجتمعية وتفعيل التطوع',
      description: 'الوصول إلى 15 شراكة مع القطاع الخاص والجهات الحكومية، توفير 250 فرصة تطوعية بقيمة مالية 250,000 ريال.',
      kpi: 'عدد الشراكات الفعّالة',
      baseline: 10, target: 15, unit: 'شراكة',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('COM'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    // ── محور 4: القدرات التنظيمية ──
    {
      code: 'OBJ-2026-009',
      title: 'اجتياز تدقيق ISO 9001:2015 والحصول على الشهادة',
      description: 'تأهيل الجمعية وتطوير العمليات والأدلة التنظيمية لاجتياز التدقيق الخارجي في Q3 2026.',
      kpi: 'نسبة استكمال متطلبات ISO 9001',
      baseline: 66, target: 100, unit: '%',
      currentValue: 85, progress: 55,
      status: 'IN_PROGRESS',
      departmentId: get('QM'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-09-30'),
    },
    {
      code: 'OBJ-2026-010',
      title: 'تحقيق التحول التقني في العمليات والخدمات',
      description: 'تفعيل برنامج رافد، أتمتة 90% من الدورات المستندية، تطوير الموقع الإلكتروني، رفع نسبة التحول إلى 90%.',
      kpi: 'نسبة تحقيق التحول التقني في العمليات',
      baseline: 60, target: 90, unit: '%',
      currentValue: 80, progress: 40,
      status: 'IN_PROGRESS',
      departmentId: get('IT'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-011',
      title: 'تطوير الكادر البشري وبناء القدرات',
      description: '20 ساعة تدريب لكل موظف، 3 شهادات احترافية، البرنامج التدريبي الموحد.',
      kpi: 'ساعات التدريب السنوية للموظف',
      baseline: 1, target: 20, unit: 'ساعة',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('HR'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
    {
      code: 'OBJ-2026-012',
      title: 'رفع رضا المستفيدين عن جودة الخدمات',
      description: 'رفع مستوى رضا المستفيدين إلى 85% عبر تحسين جودة البرامج وسرعة الاستجابة.',
      kpi: 'نسبة رضا المستفيدين عن برامج الرعاية',
      baseline: 70, target: 85, unit: '%',
      currentValue: 0, progress: 0,
      status: 'PLANNED',
      departmentId: get('SOC'), createdById: admin.id,
      startDate: new Date('2026-01-01'), dueDate: new Date('2026-12-31'),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. المخاطر (من مصفوفة المخاطر التشغيلية 2026)
// ─────────────────────────────────────────────────────────────────────────────
function buildRisks(admin, depts) {
  const get = (code) => depts[code]?.id;
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
      departmentId: get('RES'), createdById: admin.id,
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
      departmentId: get('SOC'), createdById: admin.id,
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
      departmentId: get('QM'), createdById: admin.id,
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
      departmentId: get('INV'), createdById: admin.id,
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
      departmentId: get('FIN'), createdById: admin.id,
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
      departmentId: get('EMP'), createdById: admin.id,
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
      departmentId: get('COM'), createdById: admin.id,
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
      departmentId: get('RES'), createdById: admin.id,
      reviewDate: new Date('2026-03-31'),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. استبيانات الرضا (جاهزة للنشر)
// ─────────────────────────────────────────────────────────────────────────────
const SURVEYS = [
  {
    code: 'SRV-2026-001',
    title: 'استبيان رضا المستفيدين عن برامج الرعاية الاجتماعية',
    target: 'BENEFICIARY',
    period: 'ربع أول 2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_overall',    label: 'كيف تُقيِّم جودة الخدمات المقدمة لك بشكل عام؟',             type: 'rating',  required: true  },
      { key: 'q_speed',      label: 'كيف تُقيِّم سرعة الاستجابة لاحتياجاتك؟',                   type: 'rating',  required: true  },
      { key: 'q_staff',      label: 'كيف تُقيِّم تعامل موظفي الجمعية معك؟',                     type: 'rating',  required: true  },
      { key: 'q_food',       label: 'هل تُلبّي السلة الغذائية احتياجاتك الأساسية؟',              type: 'yesno',   required: true  },
      { key: 'q_recommend',  label: 'هل تنصح الآخرين بالتواصل مع الجمعية للحصول على المساعدة؟', type: 'yesno',   required: false },
      { key: 'q_improve',    label: 'ما الذي تقترح تحسينه في خدمات الجمعية؟',                   type: 'text',    required: false },
    ]),
  },
  {
    code: 'SRV-2026-002',
    title: 'استبيان رضا المتبرعين ومُقيّمي البرامج',
    target: 'DONOR',
    period: '2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_trust',      label: 'ما مستوى ثقتك بالجمعية في إدارة تبرعاتك بكفاءة وشفافية؟', type: 'rating',  required: true  },
      { key: 'q_impact',     label: 'كيف تُقيِّم الأثر المجتمعي لبرامج الجمعية؟',              type: 'rating',  required: true  },
      { key: 'q_reports',    label: 'هل تجد تقارير الأثر التي تُرسلها الجمعية كافية وواضحة؟',  type: 'yesno',   required: false },
      { key: 'q_renew',      label: 'هل تنوي تجديد دعمك للجمعية في العام القادم؟',             type: 'yesno',   required: true  },
      { key: 'q_channels',   label: 'ما القنوات التي تفضّل التواصل عبرها مع الجمعية؟',          type: 'text',    required: false },
      { key: 'q_notes',      label: 'أي ملاحظات أو اقتراحات تودّ مشاركتها مع الإدارة؟',        type: 'text',    required: false },
    ]),
  },
  {
    code: 'SRV-2026-003',
    title: 'استبيان رضا المتطوعين عن تجربة التطوع',
    target: 'VOLUNTEER',
    period: '2026',
    active: true,
    questionsJson: JSON.stringify([
      { key: 'q_exp',        label: 'كيف تُقيِّم تجربتك التطوعية في الجمعية بشكل عام؟',        type: 'rating',  required: true  },
      { key: 'q_support',    label: 'كيف تُقيِّم مستوى الدعم الذي تلقيته من فريق التنسيق؟',   type: 'rating',  required: true  },
      { key: 'q_skills',     label: 'هل ساعدت تجربة التطوع في تطوير مهاراتك الشخصية والمهنية؟', type: 'yesno', required: true  },
      { key: 'q_continue',   label: 'هل تنوي الاستمرار في التطوع مع الجمعية؟',                 type: 'yesno',   required: true  },
      { key: 'q_improve',    label: 'ما الذي تقترح تحسينه في برنامج التطوع؟',                  type: 'text',    required: false },
    ]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[seed-strategic] بدء تعبئة البيانات الاستراتيجية...\n');

  // ── أقسام ──
  const deptMap = {};
  let deptCreated = 0, deptSkipped = 0;
  for (const d of DEPARTMENTS) {
    const result = await prisma.department.upsert({
      where:  { code: d.code },
      update: { name: d.name, nameEn: d.nameEn, manager: d.manager },
      create: d,
    });
    deptMap[d.code] = result;
    if (result.createdAt > new Date(Date.now() - 5000)) deptCreated++;
    else deptSkipped++;
  }
  console.log(`[seed-strategic] أقسام: أُنشئ ${deptCreated} | موجود ${deptSkipped}`);

  // ── المستخدم المسؤول ──
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.warn('[seed-strategic] ⚠️ لم يُوجد مستخدم SUPER_ADMIN — شغّل seed.js أولاً');
    return;
  }

  // ── أهداف ──
  const objectives = buildObjectives(admin, deptMap);
  let objCreated = 0, objSkipped = 0;
  for (const obj of objectives) {
    const existing = await prisma.objective.findUnique({ where: { code: obj.code } });
    if (existing) { objSkipped++; continue; }
    await prisma.objective.create({ data: obj });
    objCreated++;
  }
  console.log(`[seed-strategic] أهداف: أُنشئ ${objCreated} | موجود ${objSkipped}`);

  // ── مخاطر ──
  const risks = buildRisks(admin, deptMap);
  let riskCreated = 0, riskSkipped = 0;
  for (const risk of risks) {
    const existing = await prisma.risk.findUnique({ where: { code: risk.code } });
    if (existing) { riskSkipped++; continue; }
    await prisma.risk.create({ data: risk });
    riskCreated++;
  }
  console.log(`[seed-strategic] مخاطر: أُنشئ ${riskCreated} | موجود ${riskSkipped}`);

  // ── استبيانات ──
  let srvCreated = 0, srvSkipped = 0;
  for (const srv of SURVEYS) {
    const existing = await prisma.survey.findUnique({ where: { code: srv.code } });
    if (existing) { srvSkipped++; continue; }
    await prisma.survey.create({ data: srv });
    srvCreated++;
  }
  console.log(`[seed-strategic] استبيانات: أُنشئ ${srvCreated} | موجود ${srvSkipped}`);

  console.log('\n[seed-strategic] ✅ اكتملت تعبئة البيانات الاستراتيجية');
  console.log(`  الإجمالي: ${objCreated + riskCreated + srvCreated} سجل جديد`);
}

main()
  .catch(e => { console.error('[seed-strategic] خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
