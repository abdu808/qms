/**
 * Backfill missing estimated 2025 foundation readings.
 *
 * Default mode is dry-run. Existing readings are never changed.
 *
 * Usage:
 *   node scripts/backfill-2025-estimated-quarter-readings.mjs
 *   node scripts/backfill-2025-estimated-quarter-readings.mjs --apply
 *   node scripts/backfill-2025-estimated-quarter-readings.mjs --factor=0.9
 *   node scripts/backfill-2025-estimated-quarter-readings.mjs --months=3,6,9,12
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outDir = path.join(repoRoot, 'outputs', 'plan-reset');

const APPLY = process.argv.includes('--apply');
const YEAR = 2025;
const TARGET_YEAR = 2026;
const DEFAULT_MONTHS = [3, 6, 9, 12];

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function parseMonths(value) {
  return String(value || '')
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => Number.isInteger(v) && v >= 1 && v <= 12);
}

const FACTOR = Number(argValue('factor', '0.9'));
const MONTHS = parseMonths(argValue('months', DEFAULT_MONTHS.join(',')));

if (!Number.isFinite(FACTOR) || FACTOR <= 0) {
  throw new Error('Invalid --factor. Use a positive number, e.g. --factor=0.9');
}
if (!MONTHS.length) {
  throw new Error('Invalid --months. Use comma-separated month numbers, e.g. --months=3,6,9,12');
}

function roundValue(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = String(unit || '').trim();
  if (/عدد|يتيم|أسرة|اسرة|مستفيد|موظف|شراكة|فرصة|فعالية|مشروع/.test(u)) return Math.round(n);
  if (u === '%' || u === 'نسبة') return Math.round(n * 10) / 10;
  if (Math.abs(n) >= 100) return Math.round(n);
  return Math.round(n * 100) / 100;
}

function isIntegerUnit(unit) {
  return /عدد|يتيم|أسرة|اسرة|مستفيد|موظف|شراكة|فرصة|فعالية|مشروع/.test(String(unit || '').trim());
}

function estimatedAnnualValue(indicator, targetValue) {
  const direction = indicator.direction || 'HIGHER_BETTER';
  const isLowerBetter = direction === 'LOWER_BETTER';
  return Number(targetValue) * (isLowerBetter ? (2 - FACTOR) : FACTOR);
}

function distributeIntegerTotal(total, months) {
  const cleanTotal = Math.max(0, Math.round(Number(total) || 0));
  const base = Math.floor(cleanTotal / months.length);
  let remainder = cleanTotal % months.length;
  return months.map((month) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { month, value: base + extra };
  });
}

function plannedValues(indicator, targetValue) {
  const annualEstimate = estimatedAnnualValue(indicator, targetValue);
  const kpiType = indicator.kpiType || 'SNAPSHOT';

  if (kpiType === 'BINARY') {
    return MONTHS.map(month => ({
      month,
      value: month === Math.max(...MONTHS) ? (annualEstimate >= 0.95 ? 1 : 0) : 0,
    }));
  }

  if (kpiType === 'CUMULATIVE') {
    if (isIntegerUnit(indicator.unit)) return distributeIntegerTotal(annualEstimate, MONTHS);
    return MONTHS.map(month => ({
      month,
      value: roundValue(annualEstimate / MONTHS.length, indicator.unit),
    }));
  }

  return MONTHS.map(month => ({
    month,
    value: roundValue(annualEstimate, indicator.unit),
  }));
}

async function writeSnapshot(payload) {
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `backfill-2025-estimated-quarter-readings-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
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
    where: {
      deletedAt: null,
      annualTargets: { some: { year: TARGET_YEAR } },
    },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      nameAr: true,
      unit: true,
      direction: true,
      frequency: true,
      kpiType: true,
      dataEntryUserId: true,
      approverUserId: true,
      annualTargets: {
        where: { year: TARGET_YEAR },
        select: { targetValue: true },
        take: 1,
      },
    },
  });

  const indicatorIds = indicators.map(i => i.id);
  const existing = await prisma.kpiEntry.findMany({
    where: {
      year: YEAR,
      month: { in: MONTHS },
      indicatorId: { in: indicatorIds },
    },
    select: { id: true, indicatorId: true, month: true, actualValue: true, entryStatus: true },
  });
  const existingKeys = new Set(existing.map(e => `${e.indicatorId}:${e.month}`));

  const planned = [];
  const skipped = [];
  for (const indicator of indicators) {
    const targetValue = indicator.annualTargets?.[0]?.targetValue;
    if (targetValue == null) {
      skipped.push({ code: indicator.code, nameAr: indicator.nameAr, reason: 'NO_2026_TARGET' });
      continue;
    }
    if (Number(targetValue) <= 0) {
      skipped.push({ code: indicator.code, nameAr: indicator.nameAr, reason: 'ZERO_2026_TARGET' });
      continue;
    }

    for (const item of plannedValues(indicator, targetValue)) {
      const { month, value } = item;
      const key = `${indicator.id}:${month}`;
      if (existingKeys.has(key)) {
        skipped.push({ code: indicator.code, nameAr: indicator.nameAr, month, reason: 'EXISTS' });
        continue;
      }
      if (value == null) {
        skipped.push({ code: indicator.code, nameAr: indicator.nameAr, month, reason: 'INVALID_VALUE' });
        continue;
      }
      planned.push({
        indicatorId: indicator.id,
        code: indicator.code,
        nameAr: indicator.nameAr,
        frequency: indicator.frequency,
        kpiType: indicator.kpiType,
        unit: indicator.unit,
        target2026: Number(targetValue),
        month,
        value,
        enteredById: indicator.dataEntryUserId || admin.id,
        approvedById: indicator.approverUserId || admin.id,
      });
    }
  }

  const summary = {
    ok: true,
    mode: APPLY ? 'apply' : 'dry-run',
    year: YEAR,
    targetYear: TARGET_YEAR,
    months: MONTHS,
    factor: FACTOR,
    activeIndicatorsWithTarget2026: indicators.length,
    existingRowsInScope: existing.length,
    plannedRows: planned.length,
    skippedRows: skipped.length,
    plannedByFrequency: Object.fromEntries(
      Object.entries(planned.reduce((acc, r) => {
        acc[r.frequency || 'UNKNOWN'] = (acc[r.frequency || 'UNKNOWN'] || 0) + 1;
        return acc;
      }, {})).sort(),
    ),
    planned,
    skipped,
  };

  if (!APPLY) {
    const snapshot = await writeSnapshot(summary);
    console.log(JSON.stringify({ ...summary, snapshot }, null, 2));
    return;
  }

  const now = new Date();
  const note = 'Estimated 2025 foundation reading. Added only for missing quarter-end periods; existing actual readings were preserved.';
  const evidenceUrl = 'Internal planning estimate: 2025 foundation backfill, based on 90% of 2026 target unless lower-is-better.';

  const results = [];
  for (const row of planned) {
    const created = await prisma.kpiEntry.create({
      data: {
        indicatorId: row.indicatorId,
        year: YEAR,
        month: row.month,
        actualValue: row.value,
        note,
        evidenceUrl,
        enteredById: row.enteredById,
        entryStatus: 'APPROVED',
        submittedAt: now,
        approvedById: row.approvedById,
        approvedAt: now,
      },
      select: { id: true, indicatorId: true, month: true, actualValue: true, entryStatus: true },
    });
    results.push({ code: row.code, nameAr: row.nameAr, entryId: created.id, month: created.month, value: created.actualValue });
  }

  const snapshot = await writeSnapshot({ ...summary, results });
  console.log(JSON.stringify({ ...summary, snapshot, writtenRows: results.length, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
