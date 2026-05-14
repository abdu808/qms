#!/usr/bin/env node
/**
 * Audit all KPI entries against the same rules used by the application.
 *
 * Read-only by default:
 *   node scripts/audit-kpi-entries.mjs
 *   node scripts/audit-kpi-entries.mjs --json
 *
 * The script intentionally does not delete or move readings. A reading may be
 * historically useful even when it is in the wrong period; the report makes
 * those cases visible for controlled cleanup.
 */

import { PrismaClient } from '@prisma/client';

import { evaluateKpi } from '../src/lib/kpi-engine.js';
import { frequencyLabel, isDueMonth } from '../src/lib/kpiFrequency.js';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

function targetFieldsFromAnnualTarget(annualTarget) {
  return {
    targetValue: annualTarget?.targetValue ?? 0,
    q1Target: annualTarget?.q1Target ?? null,
    q2Target: annualTarget?.q2Target ?? null,
    q3Target: annualTarget?.q3Target ?? null,
    q4Target: annualTarget?.q4Target ?? null,
  };
}

function buildKpi(entry) {
  if (entry.indicatorId) {
    const annualTarget = entry.indicator?.annualTargets?.find(t => t.year === entry.year);
    return {
      parent: entry.indicator,
      parentKind: 'indicator',
      parentCode: entry.indicator?.code,
      parentTitle: entry.indicator?.nameAr,
      annualTarget,
      kpi: entry.indicator ? {
        kpiType: entry.indicator.kpiType,
        seasonality: entry.indicator.seasonality,
        direction: entry.indicator.direction,
        unit: entry.indicator.unit,
        ...targetFieldsFromAnnualTarget(annualTarget),
      } : null,
    };
  }

  if (entry.activityId) {
    return {
      parent: entry.activity,
      parentKind: 'activity',
      parentCode: entry.activity?.code,
      parentTitle: entry.activity?.title,
      annualTarget: null,
      kpi: entry.activity ? {
        kpiType: entry.activity.kpiType,
        seasonality: entry.activity.seasonality,
        direction: entry.activity.direction,
        unit: entry.activity.targetUnit,
        targetValue: entry.activity.targetValue ?? 0,
      } : null,
    };
  }

  if (entry.objectiveId) {
    return {
      parent: entry.objective,
      parentKind: 'objective',
      parentCode: entry.objective?.code,
      parentTitle: entry.objective?.title,
      annualTarget: null,
      kpi: entry.objective ? {
        kpiType: entry.objective.kpiType,
        seasonality: entry.objective.seasonality,
        direction: entry.objective.direction,
        unit: entry.objective.unit,
        targetValue: entry.objective.target ?? 0,
      } : null,
    };
  }

  return { parent: null, parentKind: 'orphan', parentCode: null, parentTitle: null, annualTarget: null, kpi: null };
}

function keyFor(entry) {
  return entry.indicatorId
    ? `indicator:${entry.indicatorId}:${entry.year}`
    : entry.activityId
      ? `activity:${entry.activityId}:${entry.year}`
      : entry.objectiveId
        ? `objective:${entry.objectiveId}:${entry.year}`
        : `orphan:${entry.id}`;
}

function readable(entry, meta, extra = '') {
  const period = `${entry.year}/${String(entry.month).padStart(2, '0')}`;
  const code = meta.parentCode || entry.id;
  const title = meta.parentTitle || '-';
  return `${period} | ${meta.parentKind} | ${code} | ${title} | value=${entry.actualValue}${extra ? ` | ${extra}` : ''}`;
}

function pushIssue(issues, id, severity, label, sample) {
  if (!issues[id]) issues[id] = { id, severity, label, count: 0, samples: [] };
  issues[id].count += 1;
  if (issues[id].samples.length < 20) issues[id].samples.push(sample);
}

function isFuture(entry) {
  return entry.year > currentYear || (entry.year === currentYear && entry.month > currentMonth);
}

async function main() {
  const entries = await prisma.kpiEntry.findMany({
    include: {
      indicator: {
        include: {
          annualTargets: true,
          owner: { select: { name: true, email: true } },
          dataEntryUser: { select: { name: true, email: true } },
        },
      },
      activity: true,
      objective: true,
      enteredBy: { select: { name: true, email: true } },
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const byParentYear = new Map();
  for (const entry of entries) {
    const k = keyFor(entry);
    if (!byParentYear.has(k)) byParentYear.set(k, []);
    byParentYear.get(k).push(entry);
  }
  for (const rows of byParentYear.values()) rows.sort((a, b) => a.month - b.month);

  const issues = {};

  for (const entry of entries) {
    const meta = buildKpi(entry);
    const fkCount = [entry.objectiveId, entry.activityId, entry.indicatorId].filter(Boolean).length;

    if (fkCount !== 1) {
      pushIssue(issues, 'KPI-FK', 'ERROR', 'قراءة بلا رابط واحد صحيح', readable(entry, meta, `fkCount=${fkCount}`));
      continue;
    }

    if (!Number.isInteger(entry.month) || entry.month < 1 || entry.month > 12) {
      pushIssue(issues, 'KPI-MONTH', 'ERROR', 'شهر القراءة خارج النطاق 1-12', readable(entry, meta));
    }

    if (!Number.isFinite(Number(entry.actualValue))) {
      pushIssue(issues, 'KPI-ACTUAL', 'ERROR', 'القيمة الفعلية غير رقمية', readable(entry, meta));
    }

    if (Number(entry.actualValue) < 0) {
      pushIssue(issues, 'KPI-NEGATIVE', 'WARN', 'القيمة الفعلية سالبة وتحتاج مراجعة', readable(entry, meta));
    }

    if (isFuture(entry)) {
      pushIssue(issues, 'KPI-FUTURE', 'ERROR', 'قراءة محفوظة لفترة مستقبلية', readable(entry, meta));
    }

    if (!meta.parent || meta.parent.deletedAt) {
      pushIssue(issues, 'KPI-PARENT', 'ERROR', 'قراءة مرتبطة بسجل أب محذوف أو غير موجود', readable(entry, meta));
      continue;
    }

    if (entry.indicatorId && !meta.annualTarget) {
      pushIssue(issues, 'KPI-TARGET', 'ERROR', 'قراءة مؤشر بلا مستهدف سنوي لنفس السنة', readable(entry, meta));
      continue;
    }

    if (entry.indicatorId && !isDueMonth(meta.parent.frequency, entry.month, meta.parent.seasonality)) {
      pushIssue(
        issues,
        'KPI-NOT-DUE',
        'ERROR',
        'قراءة محفوظة في شهر غير مستحق حسب تردد المؤشر',
        readable(entry, meta, `frequency=${frequencyLabel(meta.parent.frequency)}`),
      );
    }

    if (!meta.kpi || !meta.kpi.targetValue || meta.kpi.targetValue <= 0) continue;

    const series = byParentYear.get(keyFor(entry)) || [];
    const evaluation = evaluateKpi(meta.kpi, series.filter(e => e.month <= entry.month), entry.year, entry.month);
    const ratio = evaluation.ratio;

    if (ratio != null && ratio < 0.80 && !entry.deviationReason?.trim()) {
      pushIssue(
        issues,
        'KPI-MISSING-REASON',
        'ERROR',
        'انحراف أقل من 80% بلا سبب انحراف',
        readable(entry, meta, `ratio=${Math.round(ratio * 100)}% expected=${Number(evaluation.expected).toFixed(2)}`),
      );
    }

    if (ratio != null && ratio < 0.60 && !entry.actionNote?.trim()) {
      pushIssue(
        issues,
        'KPI-MISSING-ACTION',
        'ERROR',
        'انحراف أقل من 60% بلا إجراء تصحيحي',
        readable(entry, meta, `ratio=${Math.round(ratio * 100)}% expected=${Number(evaluation.expected).toFixed(2)}`),
      );
    }
  }

  const checks = Object.values(issues).sort((a, b) => a.id.localeCompare(b.id));
  const summary = {
    at: new Date().toISOString(),
    totalEntries: entries.length,
    issueTypes: checks.length,
    errorTypes: checks.filter(c => c.severity === 'ERROR').length,
    warningTypes: checks.filter(c => c.severity === 'WARN').length,
    totalIssueRows: checks.reduce((sum, c) => sum + c.count, 0),
  };

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify({ summary, checks }, null, 2) + '\n');
  } else {
    console.log('\nKPI Entry Audit');
    console.log('===============');
    console.log(`Total entries: ${summary.totalEntries}`);
    console.log(`Issue rows:    ${summary.totalIssueRows}`);
    if (!checks.length) {
      console.log('OK: no KPI entry issues found.');
    } else {
      for (const check of checks) {
        console.log(`\n[${check.severity}] ${check.id} - ${check.label}: ${check.count}`);
        for (const sample of check.samples.slice(0, 10)) console.log(`  - ${sample}`);
        if (check.samples.length > 10) console.log(`  ... ${check.samples.length - 10} more samples`);
      }
    }
  }

  await prisma.$disconnect();
  process.exit(checks.some(c => c.severity === 'ERROR') ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(2);
});
