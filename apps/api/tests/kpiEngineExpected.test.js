import { describe, expect, it } from 'vitest';

import {
  evaluateKpi,
  expectedByMonth,
  expectedCumulativeByMonth,
  expectedPeriodByMonth,
} from '../src/lib/kpi-engine.js';

describe('kpi-engine expected values', () => {
  it('prorates a cumulative annual target by month', () => {
    const kpi = { kpiType: 'CUMULATIVE', targetValue: 12, seasonality: 'UNIFORM' };

    expect(expectedByMonth(kpi, 1)).toBeCloseTo(1);
    expect(expectedByMonth(kpi, 4)).toBeCloseTo(4);
    expect(expectedByMonth(kpi, 12)).toBeCloseTo(12);
  });

  it('uses quarterly cumulative targets as the phase plan', () => {
    const kpi = {
      kpiType: 'CUMULATIVE',
      targetValue: 12,
      q1Target: 3,
      q2Target: 6,
      q3Target: 9,
      q4Target: 12,
    };

    expect(expectedCumulativeByMonth(kpi, 3)).toBeCloseTo(3);
    expect(expectedCumulativeByMonth(kpi, 4)).toBeCloseTo(4);
    expect(expectedCumulativeByMonth(kpi, 6)).toBeCloseTo(6);
  });

  it('turns quarterly targets into per-period targets for periodic KPIs', () => {
    const kpi = {
      kpiType: 'PERIODIC',
      targetValue: 120,
      q1Target: 30,
      q2Target: 60,
      q3Target: 90,
      q4Target: 120,
    };

    expect(expectedPeriodByMonth(kpi, 1)).toBeCloseTo(10);
    expect(expectedPeriodByMonth(kpi, 4)).toBeCloseTo(10);
  });

  it('does not require a deviation reason against the full annual target mid-year', () => {
    const kpi = { kpiType: 'CUMULATIVE', targetValue: 12, seasonality: 'UNIFORM' };
    const evaluation = evaluateKpi(kpi, [{ year: 2026, month: 4, actualValue: 4 }], 2026, 4);

    expect(evaluation.expected).toBeCloseTo(4);
    expect(evaluation.actual).toBeCloseTo(4);
    expect(evaluation.ratio).toBeCloseTo(1);
    expect(evaluation.rag).toBe('GREEN');
  });

  it('keeps snapshot percentage targets as thresholds, not annual cumulative targets', () => {
    const kpi = { kpiType: 'SNAPSHOT', targetValue: 85, seasonality: 'UNIFORM' };

    expect(expectedByMonth(kpi, 4)).toBeCloseTo(85);
  });
});
