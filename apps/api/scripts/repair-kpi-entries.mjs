#!/usr/bin/env node
/**
 * Repair existing KPI readings after the stricter entry rules.
 *
 * Safe changes only:
 * - Delete indicator readings saved in months that are not due for their
 *   frequency, unless a follow-up record references them.
 * - Add audit text for existing readings that already violate the deviation
 *   thresholds but were saved before the new validation.
 *
 * Usage:
 *   node scripts/repair-kpi-entries.mjs          # dry-run
 *   node scripts/repair-kpi-entries.mjs --apply # write changes
 */

import { PrismaClient } from '@prisma/client';

import { evaluateKpi } from '../src/lib/kpi-engine.js';
import { isDueMonth } from '../src/lib/kpiFrequency.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function targetFieldsFromAnnualTarget(annualTarget) {
  return {
    targetValue: annualTarget?.targetValue ?? 0,
    q1Target: annualTarget?.q1Target ?? null,
    q2Target: annualTarget?.q2Target ?? null,
    q3Target: annualTarget?.q3Target ?? null,
    q4Target: annualTarget?.q4Target ?? null,
  };
}

function kpiFor(entry) {
  if (entry.indicatorId) {
    const annualTarget = entry.indicator?.annualTargets?.find(t => t.year === entry.year);
    if (!entry.indicator || !annualTarget) return null;
    return {
      kpiType: entry.indicator.kpiType,
      seasonality: entry.indicator.seasonality,
      direction: entry.indicator.direction,
      unit: entry.indicator.unit,
      ...targetFieldsFromAnnualTarget(annualTarget),
    };
  }
  if (entry.activityId && entry.activity) {
    return {
      kpiType: entry.activity.kpiType,
      seasonality: entry.activity.seasonality,
      direction: entry.activity.direction,
      unit: entry.activity.targetUnit,
      targetValue: entry.activity.targetValue ?? 0,
    };
  }
  if (entry.objectiveId && entry.objective) {
    return {
      kpiType: entry.objective.kpiType,
      seasonality: entry.objective.seasonality,
      direction: entry.objective.direction,
      unit: entry.objective.unit,
      targetValue: entry.objective.target ?? 0,
    };
  }
  return null;
}

function parentKey(entry) {
  if (entry.indicatorId) return `indicator:${entry.indicatorId}:${entry.year}`;
  if (entry.activityId) return `activity:${entry.activityId}:${entry.year}`;
  if (entry.objectiveId) return `objective:${entry.objectiveId}:${entry.year}`;
  return `orphan:${entry.id}`;
}

function parentLabel(entry) {
  if (entry.indicatorId) return `${entry.indicator?.code || '-'} ${entry.indicator?.nameAr || ''}`.trim();
  if (entry.activityId) return `${entry.activity?.code || '-'} ${entry.activity?.title || ''}`.trim();
  if (entry.objectiveId) return `${entry.objective?.code || '-'} ${entry.objective?.title || ''}`.trim();
  return entry.id;
}

function reasonText(entry, evaluation) {
  const expected = Number(evaluation.expected || 0).toFixed(2).replace(/\.00$/, '');
  return `تسوية ضبط بيانات الأداء: القراءة المحفوظة أقل من 80% من المتوقع للفترة (${entry.year}/${entry.month}). المتوقع حتى الفترة ${expected}.`;
}

function actionText(entry) {
  return `إجراء متابعة: مراجعة سبب الانحراف مع مالك المؤشر في أقرب متابعة أداء، وتحديث الإجراء التصحيحي عند توفر تفاصيل أدق.`;
}

async function main() {
  const entries = await prisma.kpiEntry.findMany({
    include: {
      indicator: { include: { annualTargets: true } },
      activity: true,
      objective: true,
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const byParentYear = new Map();
  for (const entry of entries) {
    const key = parentKey(entry);
    if (!byParentYear.has(key)) byParentYear.set(key, []);
    byParentYear.get(key).push(entry);
  }
  for (const rows of byParentYear.values()) rows.sort((a, b) => a.month - b.month);

  const toDelete = [];
  const deleteSkipped = [];
  const toUpdate = [];

  for (const entry of entries) {
    if (entry.indicatorId && entry.indicator && !isDueMonth(entry.indicator.frequency, entry.month, entry.indicator.seasonality)) {
      const linkedFollowUps = await prisma.kpiFollowUp.count({
        where: { OR: [{ previousEntryId: entry.id }, { resolvedEntryId: entry.id }] },
      });
      if (linkedFollowUps > 0) {
        deleteSkipped.push({ id: entry.id, label: parentLabel(entry), year: entry.year, month: entry.month, linkedFollowUps });
      } else {
        toDelete.push({ id: entry.id, label: parentLabel(entry), year: entry.year, month: entry.month });
      }
      continue;
    }

    const kpi = kpiFor(entry);
    if (!kpi?.targetValue || kpi.targetValue <= 0) continue;
    const series = byParentYear.get(parentKey(entry)) || [];
    const evaluation = evaluateKpi(kpi, series.filter(e => e.month <= entry.month), entry.year, entry.month);
    const ratio = evaluation.ratio;

    const patch = {};
    if (ratio != null && ratio < 0.80 && !entry.deviationReason?.trim()) {
      patch.deviationReason = reasonText(entry, evaluation);
    }
    if (ratio != null && ratio < 0.60 && !entry.actionNote?.trim()) {
      patch.actionNote = actionText(entry);
    }
    if (Object.keys(patch).length) {
      toUpdate.push({ id: entry.id, label: parentLabel(entry), year: entry.year, month: entry.month, ratio, patch });
    }
  }

  if (APPLY) {
    for (const row of toDelete) {
      await prisma.kpiEntry.delete({ where: { id: row.id } });
    }
    for (const row of toUpdate) {
      await prisma.kpiEntry.update({ where: { id: row.id }, data: row.patch });
    }
  }

  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    deletedNonDueEntries: APPLY ? toDelete.length : 0,
    wouldDeleteNonDueEntries: toDelete.length,
    skippedReferencedNonDueEntries: deleteSkipped.length,
    updatedDeviationNotes: APPLY ? toUpdate.length : 0,
    wouldUpdateDeviationNotes: toUpdate.length,
    samples: {
      delete: toDelete.slice(0, 10),
      skipped: deleteSkipped.slice(0, 10),
      update: toUpdate.slice(0, 10).map(r => ({
        id: r.id,
        label: r.label,
        year: r.year,
        month: r.month,
        ratio: Math.round(r.ratio * 100),
        fields: Object.keys(r.patch),
      })),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
