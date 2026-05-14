/**
 * Pure KPI evaluation engine.
 *
 * Important rule:
 * - Annual targets are not used as the expected value for every month.
 * - CUMULATIVE/SNAPSHOT indicators are compared to the expected value
 *   up to the selected month.
 * - Optional q1Target..q4Target values are treated as cumulative quarter
 *   targets and interpolated inside the quarter.
 */

export const SEASONALITY = {
  UNIFORM:        [1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12],
  MONTHLY_EVEN:   [1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12, 1/12],
  QUARTERLY:      [0,    0,    .25,  0,    0,    .25,  0,    0,    .25,  0,    0,    .25],
  SCHOOL_START:   [0,    0,    0,    0,    0,    0,    0,    .5,   .5,   0,    0,    0],
  EID_SEASONAL:   [0,    .15,  .3,   0,    .3,   .25,  0,    0,    0,    0,    0,    0],
  RAMADAN_RELIEF: [0,    .35,  .35,  0,    0,    .3,   0,    0,    0,    0,    0,    0],
};

function numericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeMonth(month) {
  return Math.min(Math.max(Number(month) || 1, 1), 12);
}

function quarterlyTargets(kpi) {
  const annual = numericOrNull(kpi?.targetValue) ?? 0;
  const raw = [
    numericOrNull(kpi?.q1Target),
    numericOrNull(kpi?.q2Target),
    numericOrNull(kpi?.q3Target),
    numericOrNull(kpi?.q4Target),
  ];
  if (!raw.some(v => v != null)) return null;

  let last = 0;
  return raw.map((value, index) => {
    const fallback = annual * ((index + 1) / 4);
    const next = value ?? fallback;
    last = Math.max(last, next);
    return last;
  });
}

export function expectedCumulativeByMonth(kpi, month) {
  const targetValue = numericOrNull(kpi?.targetValue) ?? 0;
  const m = safeMonth(month);
  const qTargets = quarterlyTargets(kpi);

  if (qTargets) {
    const qIndex = Math.ceil(m / 3) - 1;
    const monthInQuarter = ((m - 1) % 3) + 1;
    const previousQuarterTarget = qIndex === 0 ? 0 : qTargets[qIndex - 1];
    const currentQuarterTarget = qTargets[qIndex];
    return previousQuarterTarget + ((currentQuarterTarget - previousQuarterTarget) * (monthInQuarter / 3));
  }

  const weights = SEASONALITY[kpi?.seasonality] || SEASONALITY.UNIFORM;
  const cumWeight = weights.slice(0, m).reduce((a, b) => a + b, 0);
  return targetValue * cumWeight;
}

export function expectedPeriodByMonth(kpi, month) {
  const targetValue = numericOrNull(kpi?.targetValue) ?? 0;
  const m = safeMonth(month);
  const qTargets = quarterlyTargets(kpi);
  if (!qTargets) return targetValue;

  const qIndex = Math.ceil(m / 3) - 1;
  const previousQuarterTarget = qIndex === 0 ? 0 : qTargets[qIndex - 1];
  const currentQuarterTarget = qTargets[qIndex];
  return (currentQuarterTarget - previousQuarterTarget) / 3;
}

export function expectedSnapshotByMonth(kpi, month) {
  const targetValue = numericOrNull(kpi?.targetValue) ?? 0;
  const qTargets = quarterlyTargets(kpi);
  if (!qTargets) return targetValue;
  const qIndex = Math.ceil(safeMonth(month) / 3) - 1;
  return qTargets[qIndex] ?? targetValue;
}

export function expectedByMonth(kpi, month) {
  const { kpiType, targetValue = 0 } = kpi || {};

  switch (kpiType) {
    case 'CUMULATIVE':
      return expectedCumulativeByMonth(kpi, month);
    case 'PERIODIC':
      return expectedPeriodByMonth(kpi, month);
    case 'SNAPSHOT':
      return expectedSnapshotByMonth(kpi, month) || targetValue;
    case 'BINARY':
      return safeMonth(month) >= 12 ? 1 : 0;
    default:
      return expectedCumulativeByMonth(kpi, month);
  }
}

export function actualByMonth(kpi, entries, upToMonth) {
  const { kpiType } = kpi || {};
  const relevant = (entries || []).filter(e => Number(e.month) <= safeMonth(upToMonth));
  if (!relevant.length) return null;

  switch (kpiType) {
    case 'CUMULATIVE':
      return relevant.reduce((s, e) => s + Number(e.actualValue || 0), 0);
    case 'PERIODIC': {
      const target = expectedPeriodByMonth(kpi, upToMonth) || kpi?.targetValue || 1;
      const ratios = relevant.map(e => Number(e.actualValue || 0) / target);
      return (ratios.reduce((a, b) => a + b, 0) / ratios.length) * target;
    }
    case 'SNAPSHOT': {
      const last = relevant[relevant.length - 1];
      return Number(last.actualValue || 0);
    }
    case 'BINARY':
      return relevant.some(e => Number(e.actualValue) >= 1) ? 1 : 0;
    default:
      return relevant.reduce((s, e) => s + Number(e.actualValue || 0), 0);
  }
}

export function achievementRatio(kpi, actual, expected) {
  if (expected === 0 || expected == null || actual == null) return null;
  const direction = kpi?.direction || 'HIGHER_BETTER';
  const ratio = actual / expected;
  return direction === 'LOWER_BETTER' ? (1 / Math.max(ratio, 0.0001)) : ratio;
}

export function ragStatus(ratio) {
  if (ratio == null || isNaN(ratio)) return 'GRAY';
  if (ratio >= 0.95) return 'GREEN';
  if (ratio >= 0.75) return 'YELLOW';
  return 'RED';
}

export function forecastYearEnd(kpi, entries, currentMonth) {
  const rows = entries || [];
  if (!rows.length) return null;
  const { kpiType, targetValue = 0, seasonality = 'UNIFORM' } = kpi || {};
  const weights = SEASONALITY[seasonality] || SEASONALITY.UNIFORM;
  const month = safeMonth(currentMonth);

  switch (kpiType) {
    case 'CUMULATIVE': {
      const actualSoFar = rows.reduce((s, e) => s + Number(e.actualValue || 0), 0);
      const weightSoFar = weights.slice(0, month).reduce((a, b) => a + b, 0);
      if (weightSoFar === 0) return actualSoFar;
      return actualSoFar / weightSoFar;
    }
    case 'PERIODIC': {
      const last3 = rows.slice(-3);
      return last3.reduce((s, e) => s + Number(e.actualValue || 0), 0) / last3.length;
    }
    case 'SNAPSHOT': {
      if (rows.length < 3) return Number(rows[rows.length - 1].actualValue || 0);
      const pts = rows.slice(-6);
      const n = pts.length;
      const sumX = pts.reduce((s, _, i) => s + i, 0);
      const sumY = pts.reduce((s, e) => s + Number(e.actualValue || 0), 0);
      const sumXY = pts.reduce((s, e, i) => s + i * Number(e.actualValue || 0), 0);
      const sumX2 = pts.reduce((s, _, i) => s + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / Math.max(n * sumX2 - sumX * sumX, 0.0001);
      const intercept = (sumY - slope * sumX) / n;
      const stepsAhead = 12 - month;
      return intercept + slope * (n - 1 + stepsAhead);
    }
    case 'BINARY':
      return rows.some(e => Number(e.actualValue) >= 1) ? 1 : 0;
    default:
      return targetValue ? null : null;
  }
}

export function detectAlerts(kpi, entries, currentYear, currentMonth) {
  const alerts = [];
  const rows = entries || [];
  const lastEntry = rows[rows.length - 1];

  if (!lastEntry) {
    if (safeMonth(currentMonth) >= 2) {
      alerts.push({ severity: 'WARNING', code: 'NO_DATA', msg: 'لا توجد بيانات مدخلة لهذا المؤشر' });
    }
  } else {
    const monthsGap = (Number(currentYear) - Number(lastEntry.year || currentYear)) * 12 + (safeMonth(currentMonth) - Number(lastEntry.month));
    if (monthsGap >= 2) {
      alerts.push({ severity: 'WARNING', code: 'STALE_DATA', msg: `آخر إدخال منذ ${monthsGap} شهر` });
    }
  }

  if (!rows.length) return alerts;

  const expected = expectedByMonth(kpi, currentMonth);
  const actual = actualByMonth(kpi, rows, currentMonth);
  const ratio = achievementRatio(kpi, actual, expected);
  if (ratio != null && ratio < 0.60) {
    alerts.push({ severity: 'CRITICAL', code: 'CRITICAL_GAP', msg: `الإنجاز ${Math.round(ratio * 100)}% من المتوقع` });
  }

  const forecast = forecastYearEnd(kpi, rows, currentMonth);
  if (forecast != null && kpi?.targetValue && forecast < kpi.targetValue * 0.70) {
    alerts.push({ severity: 'CRITICAL', code: 'FORECAST_MISS', msg: `التوقع بنهاية السنة ${Math.round(forecast)} فقط من ${kpi.targetValue}` });
  }

  if (kpi?.kpiType === 'SNAPSHOT' && rows.length >= 2) {
    const prev = Number(rows[rows.length - 2].actualValue || 0);
    const curr = Number(lastEntry.actualValue || 0);
    if (prev > 0 && curr < prev * 0.80) {
      alerts.push({ severity: 'HIGH', code: 'DECLINE', msg: `تراجع من ${prev} إلى ${curr}` });
    }
  }

  if (kpi?.budget) {
    const totalSpent = rows.reduce((s, e) => s + Number(e.spent || 0), 0);
    const spentPct = (totalSpent / kpi.budget) * 100;
    const progressPct = ratio ? ratio * 100 : 0;
    if (spentPct > progressPct + 25 && spentPct > 30) {
      alerts.push({ severity: 'HIGH', code: 'BUDGET_OVERRUN', msg: `صُرف ${Math.round(spentPct)}% والإنجاز ${Math.round(progressPct)}%` });
    }
  }

  return alerts;
}

export function evaluateKpi(kpi, entries, currentYear, currentMonth) {
  const expected = expectedByMonth(kpi, currentMonth);
  const actual = actualByMonth(kpi, entries, currentMonth);
  const ratio = achievementRatio(kpi, actual, expected);
  const rag = ragStatus(ratio);
  const forecast = forecastYearEnd(kpi, entries, currentMonth);
  const alerts = detectAlerts(kpi, entries, currentYear, currentMonth);
  const totalSpent = (entries || []).reduce((s, e) => s + Number(e.spent || 0), 0);

  return {
    expected,
    actual,
    ratio,
    rag,
    forecast,
    forecastRatio: kpi?.targetValue ? forecast / kpi.targetValue : null,
    totalSpent,
    spentRatio: kpi?.budget ? totalSpent / kpi.budget : null,
    alerts,
    entriesCount: (entries || []).length,
  };
}
