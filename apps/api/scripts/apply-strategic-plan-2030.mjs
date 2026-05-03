#!/usr/bin/env node
/**
 * apply-strategic-plan-2030.mjs
 *
 * Builds the approved 2026-2030 strategic plan hierarchy:
 *   Plan -> Axes -> Strategic Goals -> Operational Objectives -> Indicators -> Annual Targets -> Initiatives
 *
 * Safety:
 *   - Default mode is dry-run. Nothing is written unless --apply is passed.
 *   - Legacy records are preserved by default.
 *   - --archive-legacy soft-archives old strategic records by setting deletedAt/status, never hard-deletes them.
 *   - Role users are organizational placeholders only; they are inactive unless --activate-role-users is passed.
 *
 * Usage:
 *   node scripts/apply-strategic-plan-2030.mjs --dry-run
 *   node scripts/apply-strategic-plan-2030.mjs --rollback-test
 *   node scripts/apply-strategic-plan-2030.mjs --apply
 *   node scripts/apply-strategic-plan-2030.mjs --apply --archive-legacy
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const args = new Set(process.argv.slice(2));
const ROLLBACK_TEST = args.has('--rollback-test');
const APPLY = args.has('--apply') || ROLLBACK_TEST;
const DRY_RUN = !APPLY || args.has('--dry-run');
const ARCHIVE_LEGACY = args.has('--archive-legacy');
const CREATE_ROLE_USERS = !args.has('--skip-role-users');
const ACTIVATE_ROLE_USERS = args.has('--activate-role-users');

const PLAN_CODE = 'PLAN-2026-2030';
const CREATED_BY_EMAILS = ['admin@bir-sabia.org.sa', 'quality@bir-sabia.org.sa'];
const START = new Date('2026-01-01T00:00:00.000Z');
const END = new Date('2030-12-31T00:00:00.000Z');

const DEPARTMENTS = [
  { code: 'ADM', name: 'الإدارة التنفيذية العليا', nameEn: 'Executive Management', manager: 'المدير التنفيذي' },
  { code: 'SOC', name: 'قسم الرعاية الاجتماعية', nameEn: 'Social Care', manager: 'رئيس قسم الرعاية الاجتماعية' },
  { code: 'KAF', name: 'قسم الكفالات', nameEn: 'Sponsorships', manager: 'رئيس قسم الكفالات' },
  { code: 'EMP', name: 'قسم التمكين والتنمية', nameEn: 'Empowerment and Development', manager: 'رئيس قسم التمكين' },
  { code: 'RES', name: 'إدارة تنمية الموارد المالية', nameEn: 'Resource Development', manager: 'مدير تنمية الموارد' },
  { code: 'FIN', name: 'إدارة الشؤون المالية', nameEn: 'Finance', manager: 'المدير المالي' },
  { code: 'INV', name: 'وحدة الاستثمار والأصول', nameEn: 'Investment and Assets', manager: 'مسؤول الاستثمار' },
  { code: 'QM', name: 'وحدة التميز المؤسسي والجودة', nameEn: 'Quality and Excellence', manager: 'مدير الجودة' },
  { code: 'IT', name: 'وحدة تقنية المعلومات', nameEn: 'Information Technology', manager: 'مسؤول تقنية المعلومات' },
  { code: 'HR', name: 'إدارة الموارد البشرية', nameEn: 'Human Resources', manager: 'مدير الموارد البشرية' },
  { code: 'COM', name: 'إدارة الاتصال المؤسسي والتطوع', nameEn: 'Communications and Volunteering', manager: 'مدير الاتصال المؤسسي' },
];

const ROLE_USERS = {
  ADM: { email: 'role.executive-director@qms.local', name: 'المدير التنفيذي - دور تنظيمي', jobTitle: 'مالك اعتماد الخطة والمؤشرات', role: 'DEPT_MANAGER' },
  SOC: { email: 'role.social-care@qms.local', name: 'مالك الرعاية الاجتماعية - دور تنظيمي', jobTitle: 'مالك بيانات الرعاية الاجتماعية', role: 'DEPT_MANAGER' },
  KAF: { email: 'role.sponsorships@qms.local', name: 'مالك الكفالات - دور تنظيمي', jobTitle: 'مالك بيانات الكفالات', role: 'DEPT_MANAGER' },
  EMP: { email: 'role.empowerment@qms.local', name: 'مالك التمكين - دور تنظيمي', jobTitle: 'مالك بيانات التمكين', role: 'DEPT_MANAGER' },
  RES: { email: 'role.resource-development@qms.local', name: 'مالك تنمية الموارد - دور تنظيمي', jobTitle: 'مالك بيانات تنمية الموارد', role: 'DEPT_MANAGER' },
  FIN: { email: 'role.finance@qms.local', name: 'مالك المالية - دور تنظيمي', jobTitle: 'مالك بيانات المالية', role: 'DEPT_MANAGER' },
  INV: { email: 'role.investment@qms.local', name: 'مالك الاستثمار - دور تنظيمي', jobTitle: 'مالك بيانات الاستثمار والأصول', role: 'DEPT_MANAGER' },
  QM: { email: 'quality@bir-sabia.org.sa', name: 'مدير الجودة', jobTitle: 'مدير الجودة', role: 'QUALITY_MANAGER' },
  IT: { email: 'role.it@qms.local', name: 'مالك تقنية المعلومات - دور تنظيمي', jobTitle: 'مالك بيانات التقنية والتحول الرقمي', role: 'DEPT_MANAGER' },
  HR: { email: 'role.hr@qms.local', name: 'مالك الموارد البشرية - دور تنظيمي', jobTitle: 'مالك بيانات الموارد البشرية', role: 'DEPT_MANAGER' },
  COM: { email: 'role.communications@qms.local', name: 'مالك الاتصال والشراكات - دور تنظيمي', jobTitle: 'مالك بيانات الاتصال والشراكات والتطوع', role: 'DEPT_MANAGER' },
};

const AXES = [
  { code: 'CUSTOMER', nameAr: 'الأثر الاجتماعي والمستفيدون', nameEn: 'Social Impact and Beneficiaries', color: '#2563EB', weight: 35, order: 1 },
  { code: 'FINANCIAL', nameAr: 'الاستدامة المالية وتنمية الموارد', nameEn: 'Financial Sustainability and Resource Development', color: '#059669', weight: 25, order: 2 },
  { code: 'PROCESS', nameAr: 'التميز المؤسسي والجودة والتحول الرقمي', nameEn: 'Institutional Excellence, Quality, and Digital Transformation', color: '#7C3AED', weight: 25, order: 3 },
  { code: 'LEARNING', nameAr: 'رأس المال البشري والشراكات', nameEn: 'Human Capital and Partnerships', color: '#F59E0B', weight: 15, order: 4 },
];

const STRATEGIC_GOALS = [
  { code: 'STR-2030-01', axis: 'CUSTOMER', ownerDept: 'SOC', title: 'تحسين جودة وكفاية الخدمات المقدمة للأسر والأفراد الأشد حاجة', baseline: 'تغطية وجودة خدمة غير موحدة بالكامل', target: 'خدمات أساسية موثقة ومرضية للأسر المستحقة بحلول 2030' },
  { code: 'STR-2030-02', axis: 'CUSTOMER', ownerDept: 'KAF', title: 'تطوير منظومة الكفالات والرعاية المستدامة للأيتام والفئات ذات الأولوية', baseline: '850 يتيم مكفول تقريباً مع حاجة لفصل الاستبقاء والأثر', target: 'نمو مستدام في الكفالات واستبقاء الكافلين وتحسين أثر الكفالة' },
  { code: 'STR-2030-03', axis: 'CUSTOMER', ownerDept: 'EMP', title: 'تمكين المستفيدين القادرين وتحويلهم تدريجياً من الاحتياج إلى الاكتفاء', baseline: 'برامج تمكين قائمة مع حاجة لقياس أثر الخروج من الاحتياج', target: 'مسارات تمكين تقيس الإكمال والأثر وانخفاض الاعتماد على المساعدة' },
  { code: 'STR-2030-04', axis: 'FINANCIAL', ownerDept: 'RES', title: 'تنمية الإيرادات غير المقيدة وتعزيز استدامة التبرعات والمانحين', baseline: 'اعتماد مرتفع على مصادر محدودة وحاجة لاستبقاء المانحين', target: 'إيرادات غير مقيدة أكثر استدامة وحملات ذات عائد واضح' },
  { code: 'STR-2030-05', axis: 'FINANCIAL', ownerDept: 'INV', title: 'تعظيم العائد من الأصول والاستثمارات ضمن إطار حوكمة مالية واضح', baseline: 'عوائد واستثمارات تحتاج تثبيت ملكية وسياسة تخصيص', target: 'محفظة وعوائد استثمارية محكومة ومتصلة بالاستدامة' },
  { code: 'STR-2030-06', axis: 'FINANCIAL', ownerDept: 'FIN', title: 'رفع كفاءة الصرف والتخصيص المالي لخدمة الأولويات الاستراتيجية', baseline: 'الحاجة لربط الصرف بالأولويات الاستراتيجية والانحرافات', target: 'صرف منضبط وموجه للأولويات مع انحرافات مبررة ومعالجة' },
  { code: 'STR-2030-07', axis: 'PROCESS', ownerDept: 'QM', title: 'ترسيخ نظام جودة وامتثال مؤسسي يدعم ISO 9001 والحوكمة والمخاطر', baseline: 'نظام جودة قائم مع فجوات في إغلاق المتطلبات والملكية', target: 'نظام جودة وحوكمة ومخاطر يعمل بدورية وملكية واضحة' },
  { code: 'STR-2030-08', axis: 'PROCESS', ownerDept: 'IT', title: 'رفع كفاءة العمليات الداخلية والتحول الرقمي وجودة البيانات', baseline: 'رقمنة جزئية وجودة بيانات غير مكتملة في المؤشرات', target: 'عمليات ذات أولوية مرقمنة وبيانات مؤشراتها مكتملة وموثقة' },
  { code: 'STR-2030-09', axis: 'LEARNING', ownerDept: 'HR', title: 'تطوير رأس المال البشري والجاهزية المهنية والقيادية للعاملين', baseline: 'تدريب يقاس غالباً بالساعات لا بالأثر', target: 'كفاءات حرجة مغطاة وتدريب مرتبط بفجوات وأثر' },
  { code: 'STR-2030-10', axis: 'LEARNING', ownerDept: 'COM', title: 'تعزيز الشراكات والتطوع والاتصال المؤسسي لخدمة أثر الجمعية', baseline: 'شراكات واتصال تحتاج ربطاً أقوى بالأثر والقيمة', target: 'شراكات وتطوع واتصال مؤسسي تقاس بمخرجات وقيمة' },
];

const KPI_ROWS = [
  ['OBJ-2030-01-01', 'IND-2030-01-01', 'STR-2030-01', 'SOC', 'رفع تغطية الأسر المستحقة بالخدمات الأساسية وفق معايير الاستحقاق', 'نسبة الأسر المستحقة التي حصلت على خدمة أساسية واحدة على الأقل', '%', 75, 95, 'MONTHLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'رافد / سجل المستفيدين', 'SOC', 'SOC', 'ADM'],
  ['OBJ-2030-01-02', 'IND-2030-01-02', 'STR-2030-01', 'SOC', 'تحسين سرعة دراسة الحالات واعتماد الاستحقاق', 'متوسط مدة دراسة الحالة من الطلب إلى القرار', 'يوم', 10, 5, 'MONTHLY', 'PERIODIC', 'LEADING', 'LOWER_BETTER', 'نظام المستفيدين / سجل الحالات', 'SOC', 'SOC', 'ADM'],
  ['OBJ-2030-01-03', 'IND-2030-01-03', 'STR-2030-01', 'SOC', 'رفع جودة تجربة المستفيد مع الخدمات', 'معدل رضا المستفيدين عن الخدمة', '%', 75, 90, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'استبيانات دورية معتمدة من الجودة', 'SOC', 'SOC', 'QM'],

  ['OBJ-2030-02-01', 'IND-2030-02-01', 'STR-2030-02', 'KAF', 'المحافظة على تغطية الأيتام المكفولين واستدامة الكفالة', 'عدد الأيتام المكفولين النشطين', 'يتيم', 850, 930, 'MONTHLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'رافد / سجل الكفالات', 'KAF', 'KAF', 'ADM'],
  ['OBJ-2030-02-02', 'IND-2030-02-02', 'STR-2030-02', 'KAF', 'رفع استبقاء الكافلين الحاليين', 'نسبة استبقاء الكافلين', '%', 80, 90, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'سجل الكافلين والتحصيل', 'KAF', 'KAF', 'ADM'],
  ['OBJ-2030-02-03', 'IND-2030-02-03', 'STR-2030-02', 'KAF', 'تحسين كفاءة مصروف الكفالة ووصوله للمستفيد', 'نسبة صرف الكفالات في موعدها', '%', 90, 98, 'MONTHLY', 'PERIODIC', 'LEADING', 'HIGHER_BETTER', 'السجلات المالية / سجل الكفالات', 'KAF', 'FIN', 'ADM'],

  ['OBJ-2030-03-01', 'IND-2030-03-01', 'STR-2030-03', 'EMP', 'رفع عدد المستفيدين الداخلين في مسارات تمكين مناسبة', 'عدد المستفيدين الملتحقين بمسارات التمكين', 'مستفيد', 200, 500, 'MONTHLY', 'CUMULATIVE', 'LEADING', 'HIGHER_BETTER', 'سجل برامج التمكين', 'EMP', 'EMP', 'ADM'],
  ['OBJ-2030-03-02', 'IND-2030-03-02', 'STR-2030-03', 'EMP', 'تحسين نتائج التمكين وليس الاكتفاء بالتدريب', 'نسبة المستفيدين الذين أكملوا مسار التمكين بنجاح', '%', 55, 80, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'سجل المسارات / تقارير المتابعة', 'EMP', 'EMP', 'ADM'],
  ['OBJ-2030-03-03', 'IND-2030-03-03', 'STR-2030-03', 'EMP', 'قياس أثر التمكين على الاعتماد على المساعدة', 'نسبة الحالات التي انخفض اعتمادها على المساعدات بعد التمكين', '%', 10, 30, 'SEMI_ANNUALLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'رافد + تقارير التمكين', 'EMP', 'EMP', 'ADM'],

  ['OBJ-2030-04-01', 'IND-2030-04-01', 'STR-2030-04', 'RES', 'زيادة الإيرادات غير المقيدة من التبرعات والحملات', 'نسبة نمو الإيرادات غير المقيدة', '%', 10, 30, 'MONTHLY', 'CUMULATIVE', 'LAGGING', 'HIGHER_BETTER', 'السجلات المالية / الحملات', 'RES', 'RES', 'ADM'],
  ['OBJ-2030-04-02', 'IND-2030-04-02', 'STR-2030-04', 'RES', 'رفع كفاءة الحملات التسويقية', 'متوسط عائد الحملة مقابل تكلفتها', 'مرة', 1.5, 3, 'QUARTERLY', 'PERIODIC', 'LAGGING', 'HIGHER_BETTER', 'تقارير الحملات / المالية', 'RES', 'FIN', 'ADM'],
  ['OBJ-2030-04-03', 'IND-2030-04-03', 'STR-2030-04', 'RES', 'تحسين استبقاء المانحين والداعمين', 'نسبة استبقاء المانحين المتكررين', '%', 50, 75, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'قاعدة المانحين', 'RES', 'RES', 'ADM'],

  ['OBJ-2030-05-01', 'IND-2030-05-01', 'STR-2030-05', 'INV', 'زيادة العائد السنوي من الاستثمارات والأصول', 'نسبة نمو عائد الاستثمار', '%', 8, 15, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'تقارير الاستثمار / المالية', 'INV', 'INV', 'ADM'],
  ['OBJ-2030-05-02', 'IND-2030-05-02', 'STR-2030-05', 'INV', 'تخصيص جزء من الإيرادات غير المقيدة أو عوائد الاستثمار للمحفظة', 'نسبة المبالغ المحولة للمحفظة من الإيرادات غير المقيدة وعوائد الاستثمار', '%', 0, 5, 'QUARTERLY', 'PERIODIC', 'LEADING', 'HIGHER_BETTER', 'السجلات المالية', 'INV', 'FIN', 'ADM'],
  ['OBJ-2030-05-03', 'IND-2030-05-03', 'STR-2030-05', 'INV', 'ضبط مخاطر الاستثمار والالتزام بالسياسة', 'نسبة الالتزام بسياسة الاستثمار المعتمدة', '%', 70, 100, 'SEMI_ANNUALLY', 'SNAPSHOT', 'LEADING', 'HIGHER_BETTER', 'محاضر اللجنة / تقارير الاستثمار', 'INV', 'INV', 'ADM'],

  ['OBJ-2030-06-01', 'IND-2030-06-01', 'STR-2030-06', 'FIN', 'رفع الالتزام بالميزانية المعتمدة', 'نسبة الالتزام بالميزانية', '%', 80, 95, 'MONTHLY', 'PERIODIC', 'LAGGING', 'HIGHER_BETTER', 'النظام المالي', 'FIN', 'FIN', 'ADM'],
  ['OBJ-2030-06-02', 'IND-2030-06-02', 'STR-2030-06', 'FIN', 'تحسين توجيه المصروفات للأولويات الاستراتيجية', 'نسبة المصروفات المرتبطة بأهداف استراتيجية معتمدة', '%', 60, 85, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'الموازنة / الخطة', 'FIN', 'FIN', 'ADM'],
  ['OBJ-2030-06-03', 'IND-2030-06-03', 'STR-2030-06', 'FIN', 'تقليل الانحرافات المالية غير المبررة', 'عدد الانحرافات المالية غير المعالجة', 'عدد', 10, 2, 'MONTHLY', 'PERIODIC', 'LEADING', 'LOWER_BETTER', 'تقارير الانحراف المالي', 'FIN', 'FIN', 'ADM'],

  ['OBJ-2030-07-01', 'IND-2030-07-01', 'STR-2030-07', 'QM', 'رفع الالتزام بمتطلبات ISO 9001', 'نسبة إغلاق متطلبات ISO في موعدها', '%', 60, 100, 'MONTHLY', 'SNAPSHOT', 'LEADING', 'HIGHER_BETTER', 'سجل ISO / التدقيق الداخلي', 'QM', 'QM', 'ADM'],
  ['OBJ-2030-07-02', 'IND-2030-07-02', 'STR-2030-07', 'QM', 'تحسين فاعلية الإجراءات التصحيحية', 'نسبة الإجراءات التصحيحية المغلقة بفاعلية', '%', 55, 90, 'MONTHLY', 'PERIODIC', 'LAGGING', 'HIGHER_BETTER', 'CAPA', 'QM', 'QM', 'ADM'],
  ['OBJ-2030-07-03', 'IND-2030-07-03', 'STR-2030-07', 'QM', 'رفع نضج إدارة المخاطر والحوكمة', 'نسبة المخاطر عالية الأثر ذات خطط معالجة محدثة', '%', 50, 90, 'QUARTERLY', 'SNAPSHOT', 'LEADING', 'HIGHER_BETTER', 'سجل المخاطر', 'QM', 'QM', 'ADM'],

  ['OBJ-2030-08-01', 'IND-2030-08-01', 'STR-2030-08', 'IT', 'رقمنة العمليات ذات الأولوية', 'نسبة العمليات ذات الأولوية المرقمنة', '%', 40, 90, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'سجل العمليات / خطة التقنية', 'IT', 'IT', 'ADM'],
  ['OBJ-2030-08-02', 'IND-2030-08-02', 'STR-2030-08', 'IT', 'تحسين جودة البيانات في النظام', 'نسبة المؤشرات التي لها مالك بيانات ومصدر موثق', '%', 30, 100, 'MONTHLY', 'SNAPSHOT', 'LEADING', 'HIGHER_BETTER', 'تقرير صحة البيانات', 'QM', 'QM', 'ADM'],
  ['OBJ-2030-08-03', 'IND-2030-08-03', 'STR-2030-08', 'IT', 'تقليل التأخر في إدخال القراءات', 'نسبة القراءات الشهرية المدخلة في موعدها', '%', 50, 95, 'MONTHLY', 'PERIODIC', 'LEADING', 'HIGHER_BETTER', 'سجل KPI Follow-up', 'QM', 'QM', 'ADM'],

  ['OBJ-2030-09-01', 'IND-2030-09-01', 'STR-2030-09', 'HR', 'رفع جاهزية الموظفين للمهام الحرجة', 'نسبة إغلاق فجوات الكفاءة للوظائف الحرجة', '%', 40, 85, 'QUARTERLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'مصفوفة الكفاءات', 'HR', 'HR', 'ADM'],
  ['OBJ-2030-09-02', 'IND-2030-09-02', 'STR-2030-09', 'HR', 'تنفيذ خطة تدريب مرتبطة بالاحتياج', 'متوسط ساعات التدريب للفرد حسب الخطة', 'ساعة/موظف', 15, 40, 'QUARTERLY', 'CUMULATIVE', 'LEADING', 'HIGHER_BETTER', 'سجل التدريب', 'HR', 'HR', 'ADM'],
  ['OBJ-2030-09-03', 'IND-2030-09-03', 'STR-2030-09', 'HR', 'قياس أثر التدريب على الأداء', 'نسبة البرامج التدريبية التي لها تقييم أثر بعد التطبيق', '%', 20, 75, 'SEMI_ANNUALLY', 'SNAPSHOT', 'LAGGING', 'HIGHER_BETTER', 'تقييم التدريب / الأداء', 'HR', 'HR', 'ADM'],

  ['OBJ-2030-10-01', 'IND-2030-10-01', 'STR-2030-10', 'COM', 'بناء شراكات ذات أثر قابل للقياس', 'عدد الشراكات الفاعلة ذات مخرجات موثقة', 'شراكة', 5, 20, 'QUARTERLY', 'CUMULATIVE', 'LAGGING', 'HIGHER_BETTER', 'سجل الشراكات', 'COM', 'COM', 'ADM'],
  ['OBJ-2030-10-02', 'IND-2030-10-02', 'STR-2030-10', 'COM', 'رفع قيمة مساهمة الشراكات في خدمات الجمعية', 'قيمة الدعم أو الخدمات المحققة من الشراكات', 'ريال', 100000, 500000, 'QUARTERLY', 'CUMULATIVE', 'LAGGING', 'HIGHER_BETTER', 'اتفاقيات وتقارير مالية', 'COM', 'FIN', 'ADM'],
  ['OBJ-2030-10-03', 'IND-2030-10-03', 'STR-2030-10', 'COM', 'تفعيل التطوع في مسارات تخدم الخطة', 'عدد الساعات التطوعية المرتبطة بأهداف استراتيجية', 'ساعة', 1000, 5000, 'MONTHLY', 'CUMULATIVE', 'LEADING', 'HIGHER_BETTER', 'منصة التطوع / سجل داخلي', 'COM', 'COM', 'ADM'],
];

const INITIATIVES = [
  ['INI-2030-01', 'STR-2030-01', 'SOC', 'تطوير معايير الاستحقاق وتجربة المستفيد', 'توحيد معايير دراسة الحالة وربط الرضا والتحسين بالخدمة.'],
  ['INI-2030-02', 'STR-2030-02', 'KAF', 'برنامج استدامة الكفالات واستبقاء الكافلين', 'فصل المكفولين النشطين عن استبقاء الكافلين ومواعيد الصرف.'],
  ['INI-2030-03', 'STR-2030-03', 'EMP', 'مسارات التمكين المرتبطة بانخفاض الاعتماد على المساعدات', 'تحويل التمكين من نشاط تدريبي إلى أثر قابل للقياس.'],
  ['INI-2030-04', 'STR-2030-04', 'RES', 'إدارة المانحين والحملات ذات العائد', 'تنمية الإيرادات غير المقيدة وتحسين استبقاء المانحين.'],
  ['INI-2030-05', 'STR-2030-05', 'INV', 'حوكمة المحفظة وتخصيص موارد الاستدامة', 'تخصيص من الإيرادات غير المقيدة وعوائد الاستثمار وفق السيولة والسياسة.'],
  ['INI-2030-06', 'STR-2030-06', 'FIN', 'ربط الموازنة بالأهداف الاستراتيجية', 'ضبط الانحرافات المالية وربط الصرف بالأولويات.'],
  ['INI-2030-07', 'STR-2030-07', 'QM', 'نضج ISO والحوكمة والمخاطر وCAPA', 'رفع إغلاق المتطلبات وفاعلية الإجراءات التصحيحية وتحديث المخاطر.'],
  ['INI-2030-08', 'STR-2030-08', 'IT', 'رقمنة العمليات وجودة البيانات', 'رفع اكتمال ملكيات المؤشرات ومصادر البيانات وتقليل تأخر الإدخال.'],
  ['INI-2030-09', 'STR-2030-09', 'HR', 'إغلاق فجوات الكفاءة وقياس أثر التدريب', 'ربط التدريب بالاحتياج وقياس أثره بعد التطبيق.'],
  ['INI-2030-10', 'STR-2030-10', 'COM', 'شراكات وتطوع ذات مخرجات موثقة', 'ربط الشراكات والتطوع بقيمة وأثر واضح.'],
];

const report = {
  mode: DRY_RUN ? 'DRY_RUN' : 'APPLY',
  archiveLegacy: ARCHIVE_LEGACY,
  createRoleUsers: CREATE_ROLE_USERS,
  activateRoleUsers: ACTIVATE_ROLE_USERS,
  counts: {},
  actions: [],
  warnings: [],
};

function log(action, detail = '') {
  report.actions.push(detail ? `${action}: ${detail}` : action);
  console.log(detail ? `${action}: ${detail}` : action);
}

function targetForYear(baseline, target2030, year) {
  const ratio = (year - 2025) / 5;
  return Number((baseline + (target2030 - baseline) * ratio).toFixed(2));
}

function quarterTargets(value, kpiType) {
  if (kpiType === 'CUMULATIVE') {
    return {
      q1Target: Number((value * 0.25).toFixed(2)),
      q2Target: Number((value * 0.50).toFixed(2)),
      q3Target: Number((value * 0.75).toFixed(2)),
      q4Target: value,
    };
  }
  return { q1Target: value, q2Target: value, q3Target: value, q4Target: value };
}

async function getCreatedByUser(tx) {
  for (const email of CREATED_BY_EMAILS) {
    const user = await tx.user.findUnique({ where: { email } });
    if (user) return user;
  }
  const fallback = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!fallback) throw new Error('No SUPER_ADMIN or configured creator user found.');
  return fallback;
}

async function ensureDepartment(tx, dept) {
  const existing = await tx.department.findUnique({ where: { code: dept.code } });
  if (existing) {
    return tx.department.update({
      where: { code: dept.code },
      data: { name: dept.name, nameEn: dept.nameEn, manager: dept.manager, active: true },
    });
  }
  return tx.department.create({ data: { ...dept, active: true } });
}

async function ensureRoleUser(tx, deptCode, departmentId) {
  const cfg = ROLE_USERS[deptCode];
  if (!cfg) return null;

  const existing = await tx.user.findUnique({ where: { email: cfg.email } });
  if (existing) {
    return tx.user.update({
      where: { email: cfg.email },
      data: {
        name: cfg.name || existing.name,
        jobTitle: cfg.jobTitle,
        role: cfg.role,
        departmentId,
        mustChangePassword: true,
        active: ACTIVATE_ROLE_USERS ? true : existing.active,
      },
    });
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  return tx.user.create({
    data: {
      email: cfg.email,
      passwordHash,
      name: cfg.name,
      role: cfg.role,
      departmentId,
      jobTitle: cfg.jobTitle,
      active: ACTIVATE_ROLE_USERS,
      mustChangePassword: true,
    },
  });
}

async function archiveLegacy(tx, now) {
  if (!ARCHIVE_LEGACY) return;

  const [indicators, initiatives, objectives, activities, goals, plans, governanceAxis] = await Promise.all([
    tx.indicator.updateMany({
      where: { deletedAt: null, code: { not: { startsWith: 'IND-2030-' } } },
      data: { deletedAt: now },
    }),
    tx.initiative.updateMany({
      where: { deletedAt: null, code: { not: { startsWith: 'INI-2030-' } } },
      data: { deletedAt: now, status: 'CANCELLED', notes: 'أرشفة منطقية عند تطبيق خطة 2026-2030. لم يتم حذف السجل.' },
    }),
    tx.objective.updateMany({
      where: { deletedAt: null, code: { not: { startsWith: 'OBJ-2030-' } } },
      data: { deletedAt: now, status: 'CANCELLED' },
    }),
    tx.operationalActivity.updateMany({
      where: { deletedAt: null, code: { not: { startsWith: 'ACT-2030-' } } },
      data: { deletedAt: now, status: 'ARCHIVED' },
    }),
    tx.strategicGoal.updateMany({
      where: { deletedAt: null, code: { not: { startsWith: 'STR-2030-' } } },
      data: { deletedAt: now, status: 'ARCHIVED' },
    }),
    tx.strategicPlan.updateMany({
      where: { deletedAt: null, code: { not: PLAN_CODE } },
      data: { status: 'ARCHIVED', deletedAt: now },
    }),
    tx.axis.updateMany({
      where: { code: 'GOVERNANCE', deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);

  report.counts.archived = {
    indicators: indicators.count,
    initiatives: initiatives.count,
    objectives: objectives.count,
    activities: activities.count,
    goals: goals.count,
    plans: plans.count,
    governanceAxis: governanceAxis.count,
  };
}

async function applyPlan(tx) {
  const createdBy = await getCreatedByUser(tx);
  const now = new Date();

  const deptByCode = {};
  for (const dept of DEPARTMENTS) {
    const row = await ensureDepartment(tx, dept);
    deptByCode[dept.code] = row;
  }
  report.counts.departments = Object.keys(deptByCode).length;

  const userByDept = {};
  if (CREATE_ROLE_USERS) {
    for (const [code, dept] of Object.entries(deptByCode)) {
      userByDept[code] = await ensureRoleUser(tx, code, dept.id);
    }
  }
  userByDept.QM ||= await tx.user.findUnique({ where: { email: 'quality@bir-sabia.org.sa' } });
  report.counts.roleUsers = Object.values(userByDept).filter(Boolean).length;

  await archiveLegacy(tx, now);

  const plan = await tx.strategicPlan.upsert({
    where: { code: PLAN_CODE },
    update: {
      title: 'الخطة الاستراتيجية لجمعية البر الخيرية بصبيا 2026-2030',
      description: 'خطة خمسية مبنية على أربعة محاور: الأثر الاجتماعي، الاستدامة المالية، التميز المؤسسي والجودة والتحول الرقمي، رأس المال البشري والشراكات.',
      startYear: 2026,
      endYear: 2030,
      status: 'ACTIVE',
      deletedAt: null,
      notes: 'تم إنشاؤها عبر apply-strategic-plan-2030.mjs بناءً على إطار التقييم المعتمد بتاريخ 2026-05-03.',
    },
    create: {
      code: PLAN_CODE,
      title: 'الخطة الاستراتيجية لجمعية البر الخيرية بصبيا 2026-2030',
      description: 'خطة خمسية مبنية على أربعة محاور: الأثر الاجتماعي، الاستدامة المالية، التميز المؤسسي والجودة والتحول الرقمي، رأس المال البشري والشراكات.',
      startYear: 2026,
      endYear: 2030,
      status: 'ACTIVE',
      notes: 'تم إنشاؤها عبر apply-strategic-plan-2030.mjs بناءً على إطار التقييم المعتمد بتاريخ 2026-05-03.',
    },
  });

  const axisByCode = {};
  for (const axis of AXES) {
    axisByCode[axis.code] = await tx.axis.upsert({
      where: { code: axis.code },
      update: { ...axis, deletedAt: null },
      create: axis,
    });
  }

  const goalByCode = {};
  for (const goal of STRATEGIC_GOALS) {
    const owner = userByDept[goal.ownerDept] || null;
    const axis = axisByCode[goal.axis];
    goalByCode[goal.code] = await tx.strategicGoal.upsert({
      where: { code: goal.code },
      update: {
        title: goal.title,
        perspective: axis.nameAr,
        baseline: goal.baseline,
        target: goal.target,
        responsible: deptByCode[goal.ownerDept]?.name || goal.ownerDept,
        startYear: 2026,
        endYear: 2030,
        progress: 0,
        status: 'PLANNED',
        notes: 'هدف استراتيجي ضمن الخطة الخمسية 2026-2030.',
        planId: plan.id,
        axisId: axis.id,
        ownerUserId: owner?.id || null,
        deletedAt: null,
      },
      create: {
        code: goal.code,
        title: goal.title,
        perspective: axis.nameAr,
        baseline: goal.baseline,
        target: goal.target,
        responsible: deptByCode[goal.ownerDept]?.name || goal.ownerDept,
        startYear: 2026,
        endYear: 2030,
        progress: 0,
        status: 'PLANNED',
        notes: 'هدف استراتيجي ضمن الخطة الخمسية 2026-2030.',
        planId: plan.id,
        axisId: axis.id,
        ownerUserId: owner?.id || null,
      },
    });
  }

  const objectiveByCode = {};
  const indicatorByCode = {};
  const indicatorWeights = Number((100 / KPI_ROWS.length).toFixed(4));

  for (const row of KPI_ROWS) {
    const [
      objectiveCode,
      indicatorCode,
      goalCode,
      objectiveDept,
      objectiveTitle,
      indicatorName,
      unit,
      baseline,
      target2030,
      frequency,
      kpiType,
      indicatorType,
      direction,
      dataSource,
      ownerDept,
      dataDept,
      approverDept,
    ] = row;

    const goal = goalByCode[goalCode];
    const department = deptByCode[objectiveDept];
    const owner = userByDept[ownerDept] || null;
    const dataEntry = userByDept[dataDept] || owner || null;
    const approver = userByDept[approverDept] || userByDept.ADM || userByDept.QM || null;
    const target2026 = targetForYear(baseline, target2030, 2026);

    const objective = await tx.objective.upsert({
      where: { code: objectiveCode },
      update: {
        title: objectiveTitle,
        description: `هدف تشغيلي ضمن ${goal.title}. مصدر البيانات: ${dataSource}.`,
        departmentId: department?.id || null,
        kpi: indicatorName,
        baseline,
        target: target2030,
        unit,
        currentValue: baseline,
        startDate: START,
        dueDate: END,
        status: 'PLANNED',
        progress: 0,
        ownerId: owner?.id || null,
        strategicGoalId: goal.id,
        kpiType,
        seasonality: frequency === 'MONTHLY' ? 'MONTHLY_EVEN' : frequency,
        direction,
        deletedAt: null,
      },
      create: {
        code: objectiveCode,
        title: objectiveTitle,
        description: `هدف تشغيلي ضمن ${goal.title}. مصدر البيانات: ${dataSource}.`,
        departmentId: department?.id || null,
        kpi: indicatorName,
        baseline,
        target: target2030,
        unit,
        currentValue: baseline,
        startDate: START,
        dueDate: END,
        status: 'PLANNED',
        progress: 0,
        ownerId: owner?.id || null,
        createdById: createdBy.id,
        strategicGoalId: goal.id,
        kpiType,
        seasonality: frequency === 'MONTHLY' ? 'MONTHLY_EVEN' : frequency,
        direction,
      },
    });
    objectiveByCode[objectiveCode] = objective;

    const indicator = await tx.indicator.upsert({
      where: { code: indicatorCode },
      update: {
        nameAr: indicatorName,
        definition: `يقيس: ${indicatorName}. الهدف التشغيلي: ${objectiveTitle}.`,
        formula: 'تُحسب حسب تعريف مصدر البيانات المعتمد لكل مؤشر وتُراجع عند اعتماد بطاقة المؤشر التفصيلية.',
        unit,
        direction,
        frequency: frequency === 'SEMI_ANNUALLY' ? 'QUARTERLY' : frequency,
        kpiType,
        seasonality: frequency === 'MONTHLY' ? 'MONTHLY_EVEN' : frequency,
        indicatorType,
        dataSource,
        baseline,
        weight: indicatorWeights,
        greenThreshold: direction === 'LOWER_BETTER' ? 100 : 95,
        yellowThreshold: direction === 'LOWER_BETTER' ? 125 : 75,
        isoClause: goalCode === 'STR-2030-07' || goalCode === 'STR-2030-08' ? '9.1.1' : null,
        notes: `مالك الأداء: ${deptByCode[ownerDept]?.name || ownerDept}. مالك البيانات: ${deptByCode[dataDept]?.name || dataDept}. الاعتماد: ${deptByCode[approverDept]?.name || approverDept}.`,
        objectiveId: objective.id,
        axisId: goal.axisId,
        ownerId: owner?.id || null,
        dataEntryUserId: dataEntry?.id || null,
        approverUserId: approver?.id || null,
        deletedAt: null,
      },
      create: {
        code: indicatorCode,
        nameAr: indicatorName,
        definition: `يقيس: ${indicatorName}. الهدف التشغيلي: ${objectiveTitle}.`,
        formula: 'تُحسب حسب تعريف مصدر البيانات المعتمد لكل مؤشر وتُراجع عند اعتماد بطاقة المؤشر التفصيلية.',
        unit,
        direction,
        frequency: frequency === 'SEMI_ANNUALLY' ? 'QUARTERLY' : frequency,
        kpiType,
        seasonality: frequency === 'MONTHLY' ? 'MONTHLY_EVEN' : frequency,
        indicatorType,
        dataSource,
        baseline,
        weight: indicatorWeights,
        greenThreshold: direction === 'LOWER_BETTER' ? 100 : 95,
        yellowThreshold: direction === 'LOWER_BETTER' ? 125 : 75,
        isoClause: goalCode === 'STR-2030-07' || goalCode === 'STR-2030-08' ? '9.1.1' : null,
        notes: `مالك الأداء: ${deptByCode[ownerDept]?.name || ownerDept}. مالك البيانات: ${deptByCode[dataDept]?.name || dataDept}. الاعتماد: ${deptByCode[approverDept]?.name || approverDept}.`,
        objectiveId: objective.id,
        axisId: goal.axisId,
        ownerId: owner?.id || null,
        dataEntryUserId: dataEntry?.id || null,
        approverUserId: approver?.id || null,
      },
    });
    indicatorByCode[indicatorCode] = indicator;

    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const targetValue = targetForYear(baseline, target2030, year);
      await tx.annualTarget.upsert({
        where: { indicatorId_year: { indicatorId: indicator.id, year } },
        update: {
          targetValue,
          ...quarterTargets(targetValue, kpiType),
          modificationReason: 'ترحيل الخطة الاستراتيجية 2026-2030.',
        },
        create: {
          indicatorId: indicator.id,
          year,
          targetValue,
          ...quarterTargets(targetValue, kpiType),
          createdById: createdBy.id,
          modificationReason: 'ترحيل الخطة الاستراتيجية 2026-2030.',
        },
      });
    }
  }

  for (const [code, goalCode, deptCode, name, description] of INITIATIVES) {
    const goal = goalByCode[goalCode];
    const dept = deptByCode[deptCode];
    const owner = userByDept[deptCode] || null;
    await tx.initiative.upsert({
      where: { code },
      update: {
        name,
        description,
        goalId: goal.id,
        ownerId: owner?.id || null,
        departmentId: dept?.id || null,
        startDate: START,
        endDate: END,
        progress: 0,
        status: 'NOT_STARTED',
        notes: 'مبادرة داعمة للخطة الاستراتيجية 2026-2030.',
        deletedAt: null,
      },
      create: {
        code,
        name,
        description,
        goalId: goal.id,
        ownerId: owner?.id || null,
        departmentId: dept?.id || null,
        startDate: START,
        endDate: END,
        progress: 0,
        status: 'NOT_STARTED',
        notes: 'مبادرة داعمة للخطة الاستراتيجية 2026-2030.',
      },
    });
  }

  const snapshot = {
    plan: { code: PLAN_CODE, title: plan.title, startYear: 2026, endYear: 2030 },
    axes: AXES,
    goals: STRATEGIC_GOALS.map(g => ({ code: g.code, title: g.title, axis: g.axis, ownerDept: g.ownerDept })),
    indicators: KPI_ROWS.map(r => ({ objectiveCode: r[0], indicatorCode: r[1], goalCode: r[2], department: r[3], indicator: r[5], unit: r[6], baseline: r[7], target2030: r[8], frequency: r[9], ownerDept: r[14], dataDept: r[15], approverDept: r[16] })),
  };

  const existingVersion = await tx.strategicPlanVersion.findFirst({
    where: { planId: plan.id },
    orderBy: { version: 'desc' },
  });
  const version = (existingVersion?.version || 0) + 1;
  await tx.strategicPlanVersion.create({
    data: {
      planId: plan.id,
      version,
      snapshot,
      reason: 'تطبيق الخطة الاستراتيجية 2026-2030 بعد إعادة تقييم الهرم الاستراتيجي.',
      trigger: 'ACTIVATION',
      createdById: createdBy.id,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: createdBy.id,
      action: 'APPLY_STRATEGIC_PLAN_2030',
      entityType: 'StrategicPlan',
      entityId: plan.id,
      changesJson: JSON.stringify({
        planCode: PLAN_CODE,
        axes: AXES.length,
        goals: STRATEGIC_GOALS.length,
        objectives: KPI_ROWS.length,
        indicators: KPI_ROWS.length,
        annualTargets: KPI_ROWS.length * 5,
        initiatives: INITIATIVES.length,
        archiveLegacy: ARCHIVE_LEGACY,
        roleUsersActive: ACTIVATE_ROLE_USERS,
      }),
      userAgent: 'apply-strategic-plan-2030.mjs',
    },
  });

  report.counts.createdOrUpdated = {
    plan: 1,
    axes: AXES.length,
    goals: STRATEGIC_GOALS.length,
    objectives: KPI_ROWS.length,
    indicators: KPI_ROWS.length,
    annualTargets: KPI_ROWS.length * 5,
    initiatives: INITIATIVES.length,
    planVersion: version,
  };
}

async function verifyState() {
  const [
    plan,
    axes,
    goals,
    objectives,
    indicators,
    initiatives,
    annualTargets,
    missingObjectiveDept,
    missingObjectiveOwner,
    missingIndicatorOwner,
    missingIndicatorDataEntry,
    missingIndicatorApprover,
    zeroWeightIndicators,
    oldActiveGoals,
    oldActiveObjectives,
    oldActiveIndicators,
  ] = await Promise.all([
    prisma.strategicPlan.findUnique({ where: { code: PLAN_CODE } }),
    prisma.axis.count({ where: { deletedAt: null, code: { in: AXES.map(a => a.code) } } }),
    prisma.strategicGoal.count({ where: { deletedAt: null, code: { startsWith: 'STR-2030-' } } }),
    prisma.objective.count({ where: { deletedAt: null, code: { startsWith: 'OBJ-2030-' } } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { startsWith: 'IND-2030-' } } }),
    prisma.initiative.count({ where: { deletedAt: null, code: { startsWith: 'INI-2030-' } } }),
    prisma.annualTarget.count({ where: { indicator: { deletedAt: null, code: { startsWith: 'IND-2030-' } } } }),
    prisma.objective.count({ where: { deletedAt: null, code: { startsWith: 'OBJ-2030-' }, departmentId: null } }),
    prisma.objective.count({ where: { deletedAt: null, code: { startsWith: 'OBJ-2030-' }, ownerId: null } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { startsWith: 'IND-2030-' }, ownerId: null } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { startsWith: 'IND-2030-' }, dataEntryUserId: null } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { startsWith: 'IND-2030-' }, approverUserId: null } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { startsWith: 'IND-2030-' }, weight: 0 } }),
    prisma.strategicGoal.count({ where: { deletedAt: null, code: { not: { startsWith: 'STR-2030-' } } } }),
    prisma.objective.count({ where: { deletedAt: null, code: { not: { startsWith: 'OBJ-2030-' } } } }),
    prisma.indicator.count({ where: { deletedAt: null, code: { not: { startsWith: 'IND-2030-' } } } }),
  ]);

  const verification = {
    planActive: !!plan && plan.status === 'ACTIVE',
    axes,
    goals,
    objectives,
    indicators,
    initiatives,
    annualTargets,
    missingObjectiveDept,
    missingObjectiveOwner,
    missingIndicatorOwner,
    missingIndicatorDataEntry,
    missingIndicatorApprover,
    zeroWeightIndicators,
    oldActive: { goals: oldActiveGoals, objectives: oldActiveObjectives, indicators: oldActiveIndicators },
  };
  report.verification = verification;
  return verification;
}

async function dryRunSummary() {
  report.counts.planned = {
    departments: DEPARTMENTS.length,
    roleUsers: CREATE_ROLE_USERS ? Object.keys(ROLE_USERS).length : 0,
    plan: 1,
    axes: AXES.length,
    goals: STRATEGIC_GOALS.length,
    objectives: KPI_ROWS.length,
    indicators: KPI_ROWS.length,
    annualTargets: KPI_ROWS.length * 5,
    initiatives: INITIATIVES.length,
  };
  const existing = await verifyState().catch(() => null);
  if (existing) report.currentState = existing;
}

function printReport() {
  console.log('\n============================================================');
  console.log('Strategic Plan 2026-2030 Apply Report');
  console.log('============================================================');
  console.log(JSON.stringify(report, null, 2));
  console.log('============================================================\n');
}

async function main() {
  console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : (ROLLBACK_TEST ? 'ROLLBACK-TEST' : 'APPLY')}`);
  console.log(`Archive legacy: ${ARCHIVE_LEGACY ? 'yes' : 'no'}`);
  console.log(`Role users: ${CREATE_ROLE_USERS ? (ACTIVATE_ROLE_USERS ? 'create/activate' : 'create inactive') : 'skip'}\n`);

  if (DRY_RUN) {
    await dryRunSummary();
    printReport();
    return;
  }

  if (ROLLBACK_TEST) {
    try {
      await prisma.$transaction(async (tx) => {
        await applyPlan(tx);
        throw new Error('ROLLBACK_TEST_COMPLETE');
      }, { timeout: 60000 });
    } catch (error) {
      if (error.message !== 'ROLLBACK_TEST_COMPLETE') throw error;
      report.mode = 'ROLLBACK_TEST';
      report.actions.push('Rolled back all writes after full transaction validation.');
    }
  } else {
    await prisma.$transaction(async (tx) => {
      await applyPlan(tx);
    }, { timeout: 60000 });
  }

  await verifyState();
  printReport();
}

main()
  .catch((error) => {
    console.error('Failed to apply strategic plan 2030:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
