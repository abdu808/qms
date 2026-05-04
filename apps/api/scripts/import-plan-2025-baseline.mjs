/**
 * Import approved 2025 baseline values as closing KPI readings.
 *
 * Default mode is dry-run. Use:
 *   node scripts/import-plan-2025-baseline.mjs --dry-run
 *   node scripts/import-plan-2025-baseline.mjs --apply
 *   node scripts/import-plan-2025-baseline.mjs --apply --include-zero
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

const APPLY = process.argv.includes('--apply');
const INCLUDE_ZERO = process.argv.includes('--include-zero');
const YEAR = 2025;
const MONTH = 12;

async function writeSnapshot(payload) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `import-2025-baseline-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: {
      active: true,
      OR: [
        { email: 'admin@bir-sabia.org.sa' },
        { role: 'SUPER_ADMIN' },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new Error('No active admin user found.');

  const indicators = await prisma.indicator.findMany({
    where: { deletedAt: null, baseline: { not: null } },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      nameAr: true,
      baseline: true,
      frequency: true,
      unit: true,
      dataEntryUserId: true,
      approverUserId: true,
    },
  });

  const positiveRows = indicators.filter(i => Number(i.baseline) > 0);
  const zeroRows = indicators.filter(i => Number(i.baseline) === 0);
  const rows = INCLUDE_ZERO ? [...positiveRows, ...zeroRows] : positiveRows;

  const existing = await prisma.kpiEntry.findMany({
    where: { year: YEAR, month: MONTH, indicatorId: { in: rows.map(r => r.id) } },
    select: { id: true, indicatorId: true, actualValue: true, entryStatus: true },
  });
  const existingByIndicator = new Map(existing.map(e => [e.indicatorId, e]));

  const planned = rows.map(indicator => ({
    code: indicator.code,
    indicatorId: indicator.id,
    nameAr: indicator.nameAr,
    value: Number(indicator.baseline),
    frequency: indicator.frequency,
    unit: indicator.unit,
    existingEntryId: existingByIndicator.get(indicator.id)?.id || null,
  }));

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    year: YEAR,
    month: MONTH,
    includeZero: INCLUDE_ZERO,
    activeIndicatorsWithBaseline: indicators.length,
    positiveBaselineRows: positiveRows.length,
    skippedZeroBaselineRows: INCLUDE_ZERO ? 0 : zeroRows.length,
    plannedRows: planned.length,
    existingRows: existing.length,
    planned,
  };

  if (!APPLY) {
    const snapshot = await writeSnapshot(summary);
    console.log(JSON.stringify({ ok: true, snapshot, ...summary }, null, 2));
    return;
  }

  const now = new Date();
  const results = [];
  for (const row of rows) {
    const enteredById = row.dataEntryUserId || admin.id;
    const approvedById = row.approverUserId || admin.id;
    const entry = await prisma.kpiEntry.upsert({
      where: { indicatorId_year_month: { indicatorId: row.id, year: YEAR, month: MONTH } },
      update: {
        actualValue: Number(row.baseline),
        note: 'قراءة إغلاق تأسيسية لعام 2025 من خط الأساس المعتمد في الخطة المحسّنة 2025-2027.',
        evidenceUrl: 'الخطة المحسّنة 2025-2027 / خط الأساس 2025',
        enteredById,
        entryStatus: 'APPROVED',
        submittedAt: now,
        approvedById,
        approvedAt: now,
        rejectionReason: null,
      },
      create: {
        indicatorId: row.id,
        year: YEAR,
        month: MONTH,
        actualValue: Number(row.baseline),
        note: 'قراءة إغلاق تأسيسية لعام 2025 من خط الأساس المعتمد في الخطة المحسّنة 2025-2027.',
        evidenceUrl: 'الخطة المحسّنة 2025-2027 / خط الأساس 2025',
        enteredById,
        entryStatus: 'APPROVED',
        submittedAt: now,
        approvedById,
        approvedAt: now,
      },
      select: { id: true, indicatorId: true, actualValue: true, entryStatus: true },
    });
    results.push({ code: row.code, nameAr: row.nameAr, entryId: entry.id, value: entry.actualValue, status: entry.entryStatus });
  }

  const verifyCount = await prisma.kpiEntry.count({ where: { year: YEAR, month: MONTH, indicatorId: { not: null } } });
  const snapshot = await writeSnapshot({ ...summary, results, verifyCount });
  console.log(JSON.stringify({ ok: true, snapshot, written: results.length, verifyCount, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
