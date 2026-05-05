/**
 * ensure-iso-support-items.mjs
 *
 * Adds the practical ISO support layer without changing the approved strategy:
 * - Operational activities that help close ISO gaps.
 * - Draft form/template document records for checklist items that are better
 *   handled as controlled templates.
 *
 * Usage:
 *   node scripts/ensure-iso-support-items.mjs --dry-run
 *   node scripts/ensure-iso-support-items.mjs --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const now = new Date();
const date = (value) => new Date(value);

const activities = [
  {
    code: 'ACT-ISO-2026-001',
    title: 'اعتماد ونشر الهيكل التنظيمي داخل النظام',
    description: 'رفع ملف الهيكل التنظيمي المعتمد وربطه بصفحة الهيكل التنظيمي ومتطلب ISO 5.3.',
    perspective: 'التميز المؤسسي والجودة والتحول الرقمي',
    departmentHint: ['QM', 'ADM', 'HR'],
    responsibleFallback: 'وحدة الاستراتيجية والتميز المؤسسي والجودة',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    targetValue: 1,
    targetUnit: 'ملف معتمد',
    kpiType: 'BINARY',
  },
  {
    code: 'ACT-ISO-2026-002',
    title: 'إعداد خطة التدريب السنوية بناءً على فجوات الكفاءة',
    description: 'تحويل فجوات الكفاءة والاحتياج التدريبي إلى خطة تدريب واقعية مرتبطة بالموظفين والمؤشرات.',
    perspective: 'رأس المال البشري والشراكات والاتصال',
    departmentHint: ['HR', 'QM', 'ADM'],
    responsibleFallback: 'الموارد البشرية',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-04-30',
    targetValue: 1,
    targetUnit: 'خطة',
    kpiType: 'BINARY',
  },
  {
    code: 'ACT-ISO-2026-003',
    title: 'تطبيق نموذج تقييم فعالية التدريب',
    description: 'قياس أثر التدريب على المعرفة أو الأداء بعد التنفيذ، وليس الاكتفاء بسجل حضور.',
    perspective: 'رأس المال البشري والشراكات والاتصال',
    departmentHint: ['HR', 'QM'],
    responsibleFallback: 'الموارد البشرية',
    year: 2026,
    startDate: '2026-04-01',
    endDate: '2026-12-31',
    targetValue: 80,
    targetUnit: '%',
    kpiType: 'PERIODIC',
  },
  {
    code: 'ACT-ISO-2026-004',
    title: 'تحسين خطة أهداف الجودة وربطها بالمؤشرات',
    description: 'مراجعة أهداف الجودة داخل الخطة وربط كل هدف بمؤشر ومالك وقراءات متابعة دورية.',
    perspective: 'التميز المؤسسي والجودة والتحول الرقمي',
    departmentHint: ['QM'],
    responsibleFallback: 'وحدة الاستراتيجية والتميز المؤسسي والجودة',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    targetValue: 100,
    targetUnit: '%',
    kpiType: 'CUMULATIVE',
  },
  {
    code: 'ACT-ISO-2026-005',
    title: 'تجهيز واعتماد النماذج الأساسية المطلوبة للأيزو',
    description: 'تجهيز النماذج التي تسد ملاحظات قائمة التحقق مثل فعالية التدريب، استلام الوثائق، فحص الموردين، ومقترحات التحسين.',
    perspective: 'التميز المؤسسي والجودة والتحول الرقمي',
    departmentHint: ['QM'],
    responsibleFallback: 'وحدة الاستراتيجية والتميز المؤسسي والجودة',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-05-31',
    targetValue: 6,
    targetUnit: 'نماذج',
    kpiType: 'CUMULATIVE',
  },
];

const documentTemplates = [
  { code: 'ISO-FRM-ORG-001', title: 'نموذج مراجعة واعتماد الهيكل التنظيمي', isoClause: '5.3' },
  { code: 'ISO-FRM-TRN-001', title: 'نموذج خطة التدريب السنوية', isoClause: '7.2' },
  { code: 'ISO-FRM-TRN-002', title: 'نموذج تقييم فعالية التدريب', isoClause: '7.2' },
  { code: 'ISO-FRM-DOC-001', title: 'نموذج استلام والتدريب على الوثائق', isoClause: '7.5' },
  { code: 'ISO-FRM-SUP-001', title: 'نموذج فحص واستلام المواد والخدمات الموردة', isoClause: '8.6' },
  { code: 'ISO-FRM-IMP-001', title: 'نموذج مقترح تحسين ومتابعة الأثر', isoClause: '10.3' },
];

async function pickDepartment(hints) {
  for (const code of hints) {
    const dept = await prisma.department.findFirst({
      where: { active: true, OR: [{ code }, { code: { contains: code, mode: 'insensitive' } }] },
      select: { id: true, name: true, manager: true },
    });
    if (dept) return dept;
  }
  return null;
}

async function pickAdmin() {
  return prisma.user.findFirst({
    where: { active: true, role: { in: ['SUPER_ADMIN', 'QUALITY_MANAGER'] } },
    select: { id: true, name: true },
    orderBy: { role: 'desc' },
  });
}

async function pickStrategicGoal(perspective) {
  return prisma.strategicGoal.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { perspective: { contains: perspective, mode: 'insensitive' } },
        { title: { contains: 'الجودة', mode: 'insensitive' } },
        { title: { contains: 'التميز', mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true, title: true },
    orderBy: { code: 'asc' },
  });
}

async function ensureActivities() {
  const rows = [];
  for (const item of activities) {
    const existing = await prisma.operationalActivity.findUnique({
      where: { code: item.code },
      select: { id: true, code: true, progress: true, status: true },
    });
    const dept = await pickDepartment(item.departmentHint);
    const goal = await pickStrategicGoal(item.perspective);
    const data = {
      title: item.title,
      description: item.description,
      perspective: item.perspective,
      department: dept?.name || item.responsibleFallback,
      responsible: dept?.manager || item.responsibleFallback,
      year: item.year,
      startDate: date(item.startDate),
      endDate: date(item.endDate),
      budget: 0,
      spent: 0,
      progress: existing?.progress ?? 0,
      status: existing?.status || 'PLANNED',
      notes: 'نشاط داعم لإغلاق متطلبات ISO 9001 داخل الخطة التشغيلية.',
      strategicGoalId: goal?.id || null,
      deptId: dept?.id || null,
      targetValue: item.targetValue,
      targetUnit: item.targetUnit,
      kpiType: item.kpiType,
      seasonality: 'UNIFORM',
      direction: 'HIGHER_BETTER',
    };

    rows.push({ type: 'activity', code: item.code, action: existing ? 'update' : 'create', title: item.title });
    if (APPLY) {
      await prisma.operationalActivity.upsert({
        where: { code: item.code },
        create: { code: item.code, ...data },
        update: data,
      });
    }
  }
  return rows;
}

async function ensureDocuments() {
  const admin = await pickAdmin();
  if (!admin) throw new Error('No active SUPER_ADMIN or QUALITY_MANAGER user found for createdById.');

  const qmDept = await pickDepartment(['QM', 'ADM']);
  const rows = [];
  for (const tpl of documentTemplates) {
    const existing = await prisma.document.findUnique({ where: { code: tpl.code } });
    rows.push({ type: 'document', code: tpl.code, action: existing ? 'skip' : 'create', title: tpl.title });
    if (APPLY && !existing) {
      await prisma.document.create({
        data: {
          code: tpl.code,
          title: tpl.title,
          category: 'FORM',
          status: 'DRAFT',
          currentVersion: '0.1',
          isoClause: tpl.isoClause,
          departmentId: qmDept?.id || null,
          createdById: admin.id,
          retentionYears: 5,
          isPublic: false,
        },
      });
    }
  }
  return rows;
}

async function main() {
  const [activityRows, documentRows] = await Promise.all([ensureActivities(), ensureDocuments()]);
  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    generatedAt: now.toISOString(),
    activities: activityRows,
    documents: documentRows,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[ensure-iso-support-items] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
