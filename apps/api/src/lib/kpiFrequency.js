/**
 * Centralized measurement-frequency rules.
 * Arabic labels use Unicode escapes so Windows shells cannot corrupt them.
 */

export const KPI_FREQUENCIES = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUALLY',
  'SEASONAL',
];

const AR_MONTHLY = '\u0634\u0647\u0631\u064a';
const AR_QUARTERLY = '\u0631\u0628\u0639\u064a';
const AR_QUARTERLY_LONG = '\u0631\u0628\u0639 \u0633\u0646\u0648\u064a';
const AR_SEMI_ANNUAL = '\u0646\u0635\u0641 \u0633\u0646\u0648\u064a';
const AR_ANNUALLY = '\u0633\u0646\u0648\u064a';
const AR_SEASONAL = '\u062d\u0633\u0628 \u0627\u0644\u0645\u0648\u0633\u0645';
const AR_SEASONAL_SHORT = '\u0645\u0648\u0633\u0645\u064a';

export function normalizeFrequency(value) {
  const raw = String(value || 'MONTHLY').trim().toUpperCase();
  if (raw === 'ANNUAL' || raw === 'YEARLY') return 'ANNUALLY';
  if (raw === 'SEMIANNUAL' || raw === 'SEMI_ANNUALLY' || raw === 'HALF_YEARLY') return 'SEMI_ANNUAL';
  if (raw === AR_QUARTERLY_LONG || raw === AR_QUARTERLY) return 'QUARTERLY';
  if (raw === AR_SEMI_ANNUAL) return 'SEMI_ANNUAL';
  if (raw === AR_ANNUALLY) return 'ANNUALLY';
  if (raw === AR_SEASONAL || raw === AR_SEASONAL_SHORT) return 'SEASONAL';
  if (KPI_FREQUENCIES.includes(raw)) return raw;
  return 'MONTHLY';
}

export function frequencyLabel(value) {
  return {
    MONTHLY: AR_MONTHLY,
    QUARTERLY: AR_QUARTERLY,
    SEMI_ANNUAL: AR_SEMI_ANNUAL,
    ANNUALLY: AR_ANNUALLY,
    SEASONAL: AR_SEASONAL,
  }[normalizeFrequency(value)] || AR_MONTHLY;
}

export function dueMonthsForFrequency(frequency, seasonality = 'UNIFORM') {
  const f = normalizeFrequency(frequency);
  if (f === 'MONTHLY') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (f === 'QUARTERLY') return [3, 6, 9, 12];
  if (f === 'SEMI_ANNUAL') return [6, 12];
  if (f === 'ANNUALLY') return [12];

  const s = String(seasonality || 'UNIFORM').trim().toUpperCase();
  if (s === 'SCHOOL_START') return [1, 9];
  if (s === 'EID_SEASONAL') return [3, 4];
  if (s === 'RAMADAN_RELIEF') return [2, 3];
  if (s === 'QUARTERLY') return [3, 6, 9, 12];
  return [12];
}

export function isDueMonth(frequency, month, seasonality = 'UNIFORM') {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  return dueMonthsForFrequency(frequency, seasonality).includes(m);
}

export function getDuePeriodsToCheck({ ref = new Date(), lookbackMonths = 12 } = {}) {
  const periods = [];
  for (let i = lookbackMonths; i >= 0; i -= 1) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return periods;
}

// Due date = period month end + 5 grace days.
export function calculateKpiDueDate(year, month) {
  const lastDay = new Date(Number(year), Number(month), 0);
  lastDay.setDate(lastDay.getDate() + 5);
  return lastDay;
}
