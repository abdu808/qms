/**
 * Link operational activities to supporting KPIs for PLAN-2025-2027.
 *
 * This preserves the light execution model:
 * Strategic Goal -> Initiative/Activity -> Supporting Indicator.
 *
 * Usage:
 *   node scripts/link-activities-to-indicators-2025-2027.mjs --dry-run
 *   node scripts/link-activities-to-indicators-2025-2027.mjs --apply
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

const LINKS = [
  ['إيصال الدعم للأسر العاجزة عن الحضور', 'أوامر الصرف والتوزيع'],
  ['اعتماد سياسة تخصيص الاستثمار', 'عدد الاستثمارات الجديدة المنجزة'],
  ['تحصيل مستحقات الأصول إلكترونياً', 'عائد الاستثمارات القائمة'],
  ['ترشيد الإنفاق التشغيلي', 'المصاريف الإدارية'],
  ['تدقيق داخلي استعدادي', 'توثيق الأدلة التنظيمية'],
  ['مراجعة إدارية رسمية', 'تقرير الحوكمة السنوي'],
  ['CAPA', 'اكتمال تطوير السياسات والإجراءات'],
  ['تقارير الأثر الشهرية', 'رضا المستفيدين'],
  ['اجتماعات المراجعة الشهرية', 'عدد الفعاليات الكبرى'],
];

async function hasActivityIndicatorColumn() {
  const rows = await prisma.$queryRaw`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'OperationalActivity'
      AND column_name = 'indicatorId'
    LIMIT 1
  `;
  return rows.length > 0;
}

async function writeReport(report) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `link-activities-to-indicators-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

async function main() {
  const [canLink, activities, indicators] = await Promise.all([
    hasActivityIndicatorColumn(),
    prisma.$queryRaw`
      SELECT id, code, title
      FROM "OperationalActivity"
      WHERE "deletedAt" IS NULL
      ORDER BY code ASC
    `,
    prisma.indicator.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } }),
  ]);

  const changes = [];
  const unresolved = [];
  const decisionsRequired = [];

  if (!canLink) {
    decisionsRequired.push({
      type: 'schema-migration-required',
      message: 'OperationalActivity.indicatorId is present in Prisma schema but missing in the connected database. Apply migration 20260504042000_add_activity_indicator_link before activity-to-indicator links can be written.',
    });
  }

  for (const [activityNeedle, indicatorNeedle] of LINKS) {
    const activity = activities.find(a => a.title.includes(activityNeedle));
    const indicator = indicators.find(i => i.nameAr.includes(indicatorNeedle));
    if (!activity || !indicator) {
      unresolved.push({ activityNeedle, indicatorNeedle, activityFound: !!activity, indicatorFound: !!indicator });
      continue;
    }
    if (!canLink) {
      changes.push({
        pending: true,
        activity: activity.code,
        activityTitle: activity.title,
        indicator: indicator.code,
        indicatorName: indicator.nameAr,
      });
      continue;
    }
    const current = await prisma.$queryRaw`SELECT "indicatorId" FROM "OperationalActivity" WHERE id = ${activity.id}`;
    if (current[0]?.indicatorId === indicator.id) continue;
    changes.push({
      activity: activity.code,
      activityTitle: activity.title,
      indicator: indicator.code,
      indicatorName: indicator.nameAr,
    });
    if (APPLY) {
      await prisma.$executeRaw`UPDATE "OperationalActivity" SET "indicatorId" = ${indicator.id}, "updatedAt" = NOW() WHERE id = ${activity.id}`;
    }
  }

  const report = {
    ok: unresolved.length === 0 && decisionsRequired.length === 0,
    mode: APPLY ? 'apply' : 'dry-run',
    changesCount: changes.length,
    unresolved,
    decisionsRequired,
    changes,
  };
  const file = await writeReport(report);
  console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
