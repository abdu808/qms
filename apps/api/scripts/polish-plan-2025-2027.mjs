/**
 * Quality/planning polish pass for PLAN-2025-2027.
 *
 * This script does not rebuild the plan. It corrects measurement metadata after
 * import: weights, units, directions, milestone targets, and formal wording.
 *
 * Usage:
 *   node scripts/polish-plan-2025-2027.mjs --dry-run
 *   node scripts/polish-plan-2025-2027.mjs --apply
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

const AXIS_WEIGHTS = new Map([
  ['الأثر الاجتماعي والرعاية والتمكين', 35],
  ['التميز المؤسسي والجودة والتحول الرقمي', 25],
  ['الاستدامة المالية والاستثمار', 20],
  ['رأس المال البشري والشراكات والاتصال', 20],
]);

const NAME_RULES = [
  {
    match: 'نسبة رضا المستفيدين عن برامج الرعاية',
    nameAr: 'نسبة رضا المستفيدين عن تجربة برامج الرعاية',
    unit: '%',
    direction: 'HIGHER_BETTER',
    kpiType: 'SNAPSHOT',
    notesAppend: 'لا تحتسب القراءة إلا باستبيان موحد موثق ومعتمد من وحدة الجودة.',
  },
  {
    match: 'نسبة اكتمال توثيق الأدلة التنظيمية وإجراءات العمل',
    nameAr: 'نسبة اكتمال توثيق الأدلة التنظيمية وإجراءات العمل',
    unit: '%',
    direction: 'HIGHER_BETTER',
    kpiType: 'SNAPSHOT',
    target2027: 100,
  },
  {
    match: 'اجتياز التدقيق الخارجي ISO 9001 والحصول على الشهادة',
    nameAr: 'اجتياز التدقيق الخارجي ISO 9001 والحصول على الشهادة',
    unit: 'تحقق',
    direction: 'HIGHER_BETTER',
    kpiType: 'BINARY',
    baseline: 0,
    target2026: 1,
    target2027: 1,
    notesAppend: 'مؤشر تحقق سنوي: 0 = لم يتحقق، 1 = تحقق. المستهدف العملي للشهادة في الربع الثالث 2026.',
  },
  {
    match: 'نسبة المصاريف الإدارية من إجمالي الإنفاق',
    nameAr: 'نسبة المصاريف الإدارية من إجمالي الإنفاق',
    unit: '%',
    direction: 'LOWER_BETTER',
    kpiType: 'SNAPSHOT',
    notesAppend: 'الأقل أفضل. حد 2026 لا يتجاوز 15%، وحد 2027 لا يتجاوز 12%.',
  },
  {
    match: 'مدة الإقفال المالي الشهري',
    nameAr: 'مدة الإقفال المالي الشهري',
    unit: 'أيام عمل',
    direction: 'LOWER_BETTER',
    frequency: 'MONTHLY',
    kpiType: 'SNAPSHOT',
    target2026: 5,
    target2027: 5,
    notesAppend: 'الأقل أفضل. تقاس بعدد أيام العمل حتى إقفال الشهر مالياً.',
  },
  {
    match: 'عدد الاستثمارات الجديدة المنجزة',
    nameAr: 'عدد الاستثمارات الجديدة المنجزة',
    unit: 'عدد',
    direction: 'HIGHER_BETTER',
    kpiType: 'CUMULATIVE',
  },
  {
    match: 'عدد فرص التطوع التخصصي المنفذة',
    nameAr: 'عدد فرص التطوع التخصصي ذات القيمة السوقية الموثقة',
    unit: 'عدد',
    direction: 'HIGHER_BETTER',
    kpiType: 'CUMULATIVE',
    notesAppend: 'لا يحتسب التطوع العام ضمن هذا المؤشر. يجب توثيق نوع الخدمة والتخصص والمستفيد.',
  },
  {
    match: 'القيمة المالية التقديرية للتطوع التخصصي',
    nameAr: 'القيمة الاقتصادية الموثقة للتطوع التخصصي',
    unit: 'ريال',
    direction: 'HIGHER_BETTER',
    kpiType: 'CUMULATIVE',
    notesAppend: 'الاحتساب: عدد الساعات × متوسط الأجر السوقي للتخصص، بشرط وجود سجل موثق.',
  },
  {
    match: 'توثيق العائد المالي أو العيني من الشراكات',
    nameAr: 'توثيق العائد المالي أو العيني من الشراكات',
    unit: '%',
    direction: 'HIGHER_BETTER',
    kpiType: 'SNAPSHOT',
    notesAppend: 'الاتصال يملك إبرام الشراكة، وتنمية الموارد/المالية تثبتان العائد المالي أو العيني.',
  },
  {
    match: 'نسبة رقمنة العمليات الإدارية والمالية وعمليات الجودة ذات الأولوية',
    nameAr: 'نسبة رقمنة العمليات الإدارية والمالية وعمليات الجودة ذات الأولوية',
    unit: '%',
    direction: 'HIGHER_BETTER',
    kpiType: 'SNAPSHOT',
    notesAppend: 'النطاق لا يشمل جميع عمليات الجمعية الميدانية، بل العمليات ذات الأولوية المؤسسية.',
  },
  {
    match: 'نسبة أتمتة الدورات المستندية',
    nameAr: 'نسبة أتمتة الدورات المستندية ذات الأولوية',
    unit: '%',
    direction: 'HIGHER_BETTER',
    kpiType: 'SNAPSHOT',
  },
];

const ACTIVITY_RULES = [
  {
    match: 'اعتماد سياسة تخصيص الاستثمار',
    title: 'اعتماد سياسة تخصيص الاستثمار من الإيرادات غير المقيدة وعوائد الاستثمارات',
    targetValue: 1,
    targetUnit: 'سياسة',
    kpiType: 'BINARY',
    direction: 'HIGHER_BETTER',
    notesAppend: '2026: اعتماد السياسة وفتح بند مالي مستقل. 2027: تفعيل التخصيص وفق قرار الإدارة.',
  },
  {
    match: 'نسبة تحصيل مستحقات الأصول إلكترونياً',
    title: 'نسبة تحصيل مستحقات الأصول إلكترونياً',
    targetValue: 100,
    targetUnit: '%',
    kpiType: 'SNAPSHOT',
    direction: 'HIGHER_BETTER',
  },
  {
    match: 'تنفيذ تدقيق داخلي استعدادي',
    title: 'تنفيذ تدقيق داخلي استعدادي قبل التدقيق الخارجي',
    targetValue: 1,
    targetUnit: 'تدقيق',
    kpiType: 'BINARY',
    direction: 'HIGHER_BETTER',
    notesAppend: 'مؤشر تحقق: 0 = لم ينفذ، 1 = نفذ مع تقرير وملاحظات.',
  },
  {
    match: 'إجراء مراجعة إدارية رسمية',
    title: 'إجراء مراجعة إدارية رسمية بمحضر ISO',
    targetValue: 2,
    targetUnit: 'اجتماع',
    kpiType: 'CUMULATIVE',
    direction: 'HIGHER_BETTER',
  },
  {
    match: 'تفعيل سجل CAPA',
    title: 'تفعيل سجل عدم المطابقة والإجراءات التصحيحية CAPA',
    targetValue: 1,
    targetUnit: 'سجل',
    kpiType: 'BINARY',
    direction: 'HIGHER_BETTER',
    notesAppend: 'مؤشر تحقق: السجل يعتبر فعالاً عند وجود إجراء واحد على الأقل مكتمل الدورة عند ظهور عدم مطابقة.',
  },
  {
    match: 'عدد اجتماعات المراجعة الشهرية المنعقدة',
    title: 'عدد اجتماعات المراجعة الشهرية المنعقدة',
    targetValue: 12,
    targetUnit: 'اجتماع',
    kpiType: 'CUMULATIVE',
    direction: 'HIGHER_BETTER',
  },
  {
    match: 'إطلاق وتطوير موقع الجمعية الإلكتروني',
    delete: true,
    reason: 'الموقع قائم منذ سنوات ولا يصلح كهدف تطوير جديد ضمن الخطة الحالية.',
  },
];

function appendNote(existing, addition) {
  if (!addition) return existing ?? null;
  const text = String(existing || '').trim();
  if (text.includes(addition)) return text;
  return text ? `${text} | ضبط تدقيقي: ${addition}` : `ضبط تدقيقي: ${addition}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function writeReport(report) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `polish-plan-2025-2027-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

async function upsertTarget(tx, indicator, year, value, adminId, changes) {
  if (value == null || !adminId) return;
  const existing = indicator.annualTargets.find(t => t.year === year);
  if (!existing) {
    changes.push({ type: 'annualTarget.create', indicator: indicator.code, year, value });
    if (APPLY) {
      await tx.annualTarget.create({
        data: {
          indicatorId: indicator.id,
          year,
          targetValue: value,
          createdById: adminId,
          modificationReason: 'تصحيح تدقيقي لمستهدفات الخطة 2025-2027',
        },
      });
    }
    return;
  }
  if (Number(existing.targetValue) !== Number(value)) {
    changes.push({ type: 'annualTarget.update', indicator: indicator.code, year, from: existing.targetValue, to: value });
    if (APPLY) {
      await tx.annualTarget.update({
        where: { id: existing.id },
        data: {
          targetValue: value,
          modificationReason: 'تصحيح تدقيقي لمستهدفات الخطة 2025-2027',
        },
      });
    }
  }
}

async function main() {
  const [admin, axes, indicators, activities] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ email: 'admin@bir-sabia.org.sa' }, { role: 'SUPER_ADMIN' }], active: true },
      select: { id: true, email: true },
    }),
    prisma.axis.findMany({
      where: { deletedAt: null },
      include: { indicators: { where: { deletedAt: null }, orderBy: { code: 'asc' } } },
      orderBy: { order: 'asc' },
    }),
    prisma.indicator.findMany({
      where: { deletedAt: null },
      include: { annualTargets: { orderBy: { year: 'asc' } }, axis: true },
      orderBy: { code: 'asc' },
    }),
    prisma.operationalActivity.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    }),
  ]);

  const changes = [];

  await prisma.$transaction(async (tx) => {
    for (const axis of axes) {
      const desiredWeight = AXIS_WEIGHTS.get(axis.nameAr) ?? 0;
      if (axis.weight !== desiredWeight) {
        changes.push({ type: 'axis.weight', axis: axis.nameAr, from: axis.weight, to: desiredWeight });
        if (APPLY) await tx.axis.update({ where: { id: axis.id }, data: { weight: desiredWeight } });
      }

      const activeIndicators = axis.indicators || [];
      if (!activeIndicators.length || !desiredWeight) continue;
      const base = round2(desiredWeight / activeIndicators.length);
      let assigned = 0;
      for (let i = 0; i < activeIndicators.length; i += 1) {
        const item = activeIndicators[i];
        const desired = i === activeIndicators.length - 1 ? round2(desiredWeight - assigned) : base;
        assigned = round2(assigned + desired);
        if (Number(item.weight || 0) !== desired) {
          changes.push({ type: 'indicator.weight', indicator: item.code, axis: axis.nameAr, from: item.weight, to: desired });
          if (APPLY) await tx.indicator.update({ where: { id: item.id }, data: { weight: desired } });
        }
      }
    }

    for (const rule of NAME_RULES) {
      const matches = indicators.filter(i => i.nameAr.includes(rule.match));
      for (const indicator of matches) {
        const data = {};
        for (const field of ['nameAr', 'unit', 'direction', 'frequency', 'kpiType', 'seasonality', 'baseline']) {
          if (rule[field] !== undefined && indicator[field] !== rule[field]) data[field] = rule[field];
        }
        if (rule.notesAppend) data.notes = appendNote(indicator.notes, rule.notesAppend);

        if (Object.keys(data).length) {
          changes.push({ type: 'indicator.update', indicator: indicator.code, name: indicator.nameAr, data });
          if (APPLY) await tx.indicator.update({ where: { id: indicator.id }, data });
        }
        await upsertTarget(tx, indicator, 2026, rule.target2026, admin?.id, changes);
        await upsertTarget(tx, indicator, 2027, rule.target2027, admin?.id, changes);
      }
    }

    for (const activity of activities) {
      for (const rule of ACTIVITY_RULES) {
        if (!activity.title.includes(rule.match)) continue;
        if (rule.delete) {
          changes.push({ type: 'activity.delete', activity: activity.code, title: activity.title, reason: rule.reason });
          if (APPLY) {
            await tx.operationalActivity.update({
              where: { id: activity.id },
              data: { deletedAt: new Date(), notes: appendNote(activity.notes, rule.reason) },
            });
          }
          continue;
        }

        const data = {};
        for (const field of ['title', 'targetValue', 'targetUnit', 'kpiType', 'direction']) {
          if (rule[field] !== undefined && activity[field] !== rule[field]) data[field] = rule[field];
        }
        if (rule.notesAppend) data.notes = appendNote(activity.notes, rule.notesAppend);
        if (Object.keys(data).length) {
          changes.push({ type: 'activity.update', activity: activity.code, title: activity.title, data });
          if (APPLY) await tx.operationalActivity.update({ where: { id: activity.id }, data });
        }
      }
    }
  }, { timeout: 120_000 });

  const post = await prisma.indicator.groupBy({
    by: ['axisId'],
    where: { deletedAt: null },
    _sum: { weight: true },
  });

  const report = {
    ok: true,
    mode: APPLY ? 'apply' : 'dry-run',
    admin: admin?.email || null,
    changesCount: changes.length,
    changes,
    weightSumsByAxisId: post.map(p => ({ axisId: p.axisId, weight: round2(p._sum.weight || 0) })),
  };
  const file = await writeReport(report);
  console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
