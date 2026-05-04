import { describe, expect, it } from 'vitest';
import {
  dueMonthsForFrequency,
  frequencyLabel,
  isDueMonth,
  normalizeFrequency,
} from '../src/lib/kpiFrequency.js';

const AR_MONTHLY = '\u0634\u0647\u0631\u064a';
const AR_QUARTERLY_LONG = '\u0631\u0628\u0639 \u0633\u0646\u0648\u064a';
const AR_SEMI_ANNUAL = '\u0646\u0635\u0641 \u0633\u0646\u0648\u064a';
const AR_ANNUALLY = '\u0633\u0646\u0648\u064a';
const AR_SEASONAL = '\u062d\u0633\u0628 \u0627\u0644\u0645\u0648\u0633\u0645';

describe('kpiFrequency', () => {
  it('normalizes Arabic and English frequency values', () => {
    expect(normalizeFrequency(AR_MONTHLY)).toBe('MONTHLY');
    expect(normalizeFrequency(AR_QUARTERLY_LONG)).toBe('QUARTERLY');
    expect(normalizeFrequency(AR_SEMI_ANNUAL)).toBe('SEMI_ANNUAL');
    expect(normalizeFrequency('annual')).toBe('ANNUALLY');
    expect(normalizeFrequency(AR_SEASONAL)).toBe('SEASONAL');
  });

  it('detects due months by frequency', () => {
    expect(dueMonthsForFrequency('MONTHLY')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dueMonthsForFrequency('QUARTERLY')).toEqual([3, 6, 9, 12]);
    expect(dueMonthsForFrequency('SEMI_ANNUAL')).toEqual([6, 12]);
    expect(dueMonthsForFrequency('ANNUALLY')).toEqual([12]);

    expect(isDueMonth('QUARTERLY', 3)).toBe(true);
    expect(isDueMonth('QUARTERLY', 4)).toBe(false);
    expect(isDueMonth('SEMI_ANNUAL', 6)).toBe(true);
    expect(isDueMonth('ANNUALLY', 11)).toBe(false);
  });

  it('supports seasonal presets without forcing monthly readings', () => {
    expect(dueMonthsForFrequency('SEASONAL', 'SCHOOL_START')).toEqual([1, 9]);
    expect(isDueMonth('SEASONAL', 9, 'SCHOOL_START')).toBe(true);
    expect(isDueMonth('SEASONAL', 5, 'SCHOOL_START')).toBe(false);
    expect(frequencyLabel('SEMI_ANNUAL')).toBe(AR_SEMI_ANNUAL);
    expect(frequencyLabel(AR_ANNUALLY)).toBe(AR_ANNUALLY);
  });
});
