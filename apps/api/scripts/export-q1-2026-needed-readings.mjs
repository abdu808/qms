/**
 * Export Q1 2026 due KPI readings according to each indicator frequency.
 * Uses Unicode escapes for static Arabic labels to avoid Windows shell encoding loss.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { frequencyLabel, isDueMonth } from '../src/lib/kpiFrequency.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

const AR = {
  title: '\u0642\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u0648\u0644 2026 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629',
  summary: '\u0627\u0644\u0645\u0644\u062e\u0635',
  totalDue: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0642\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0629',
  entered: '\u0627\u0644\u0645\u062f\u062e\u0644',
  remaining: '\u0627\u0644\u0645\u062a\u0628\u0642\u064a',
  month: '\u0627\u0644\u0634\u0647\u0631',
  due: '\u0627\u0644\u0645\u0633\u062a\u062d\u0642',
  list: '\u0627\u0644\u0642\u0627\u0626\u0645\u0629',
  code: '\u0627\u0644\u0643\u0648\u062f',
  indicator: '\u0627\u0644\u0645\u0624\u0634\u0631',
  frequency: '\u0627\u0644\u062a\u0631\u062f\u062f',
  owner: '\u0627\u0644\u0645\u0627\u0644\u0643',
  status: '\u0627\u0644\u062d\u0627\u0644\u0629',
  needed: '\u0645\u0637\u0644\u0648\u0628',
  hasEntry: '\u0645\u062f\u062e\u0644',
};

const MONTHS = {
  1: '\u064a\u0646\u0627\u064a\u0631',
  2: '\u0641\u0628\u0631\u0627\u064a\u0631',
  3: '\u0645\u0627\u0631\u0633',
};

async function main() {
  const indicators = await prisma.indicator.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      nameAr: true,
      frequency: true,
      seasonality: true,
      unit: true,
      owner: { select: { name: true, department: { select: { name: true } } } },
      kpiEntries: {
        where: { year: 2026, month: { in: [1, 2, 3] } },
        select: { month: true, actualValue: true, entryStatus: true },
      },
    },
  });

  const rows = [];
  for (const indicator of indicators) {
    for (const month of [1, 2, 3]) {
      if (!isDueMonth(indicator.frequency, month, indicator.seasonality)) continue;
      const entry = indicator.kpiEntries.find(e => e.month === month);
      rows.push({
        month,
        monthName: MONTHS[month],
        code: indicator.code,
        indicator: indicator.nameAr,
        frequency: frequencyLabel(indicator.frequency),
        unit: indicator.unit,
        owner: indicator.owner?.name || '',
        department: indicator.owner?.department?.name || '',
        status: entry ? AR.hasEntry : AR.needed,
        actualValue: entry?.actualValue ?? null,
      });
    }
  }

  const summary = {
    totalDue: rows.length,
    missing: rows.filter(r => r.status === AR.needed).length,
    entered: rows.filter(r => r.status === AR.hasEntry).length,
    byMonth: Object.fromEntries([1, 2, 3].map(month => [
      month,
      {
        due: rows.filter(r => r.month === month).length,
        missing: rows.filter(r => r.month === month && r.status === AR.needed).length,
      },
    ])),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'q1-2026-needed-readings.json');
  const mdPath = path.join(OUT_DIR, 'q1-2026-needed-readings.md');
  await fs.writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2), 'utf8');

  const lines = [
    `# ${AR.title}`,
    '',
    `## ${AR.summary}`,
    '',
    `- ${AR.totalDue}: ${summary.totalDue}`,
    `- ${AR.entered}: ${summary.entered}`,
    `- ${AR.remaining}: ${summary.missing}`,
    '',
    `| ${AR.month} | ${AR.due} | ${AR.remaining} |`,
    '|---|---:|---:|',
    ...[1, 2, 3].map(month => `| ${MONTHS[month]} | ${summary.byMonth[month].due} | ${summary.byMonth[month].missing} |`),
    '',
    `## ${AR.list}`,
    '',
    `| ${AR.month} | ${AR.code} | ${AR.indicator} | ${AR.frequency} | ${AR.owner} | ${AR.status} |`,
    '|---|---|---|---|---|---|',
    ...rows.map(row => `| ${row.monthName} | ${row.code} | ${row.indicator} | ${row.frequency} | ${row.owner} | ${row.status} |`),
    '',
  ];
  await fs.writeFile(mdPath, `\ufeff${lines.join('\n')}`, 'utf8');

  console.log(JSON.stringify({ ok: true, summary, mdPath, jsonPath }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
