/**
 * tests/riskHighCritical.test.js — Audit task 7 (risk HIGH/CRITICAL validation)
 * ─────────────────────────────────────────────────────────────────────────────
 * يختبر guardHighCritical — دالة pure مُصدَّرة من routes/risks.js.
 * ISO 6.1.1: المخاطرة ذات المستوى مرتفع/حرج تتطلب حقول الحوكمة الأربعة.
 *
 * Pure — لا يتطلب DB.
 */

import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
});

// حقول صالحة لمخاطرة عالية مكتملة
const VALID_HIGH = {
  level:        'مرتفع',
  ownerId:      'user-1',
  departmentId: 'dept-1',
  treatment:    'تخفيف: تدريب دوري + مراجعة إجراءات',
  reviewDate:   new Date('2026-06-30'),
};

describe('Risk — guardHighCritical (ISO 6.1.1)', () => {
  // ── HIGH بدون ownerId ───────────────────────────────────────────
  it('HIGH بدون ownerId يرفض', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ ...VALID_HIGH, ownerId: null }),
    ).toThrow(/ownerId/);
  });

  // ── HIGH بدون departmentId ──────────────────────────────────────
  it('HIGH بدون departmentId يرفض', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ ...VALID_HIGH, departmentId: undefined }),
    ).toThrow(/departmentId/);
  });

  // ── HIGH بدون treatment ────────────────────────────────────────
  it('HIGH بدون treatment يرفض', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ ...VALID_HIGH, treatment: '' }),
    ).toThrow(/treatment/);
  });

  // ── HIGH بدون reviewDate ───────────────────────────────────────
  it('HIGH بدون reviewDate يرفض', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ ...VALID_HIGH, reviewDate: null }),
    ).toThrow(/reviewDate/);
  });

  // ── HIGH مكتمل يقبل ────────────────────────────────────────────
  it('HIGH مكتمل يقبل', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() => guardHighCritical(VALID_HIGH)).not.toThrow();
  });

  // ── CRITICAL مكتمل يقبل ────────────────────────────────────────
  it('CRITICAL مكتمل يقبل', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ ...VALID_HIGH, level: 'حرج' }),
    ).not.toThrow();
  });

  // ── LOW لا يُلزم بالحقول ──────────────────────────────────────
  it('LOW لا يُلزم بالحقول الإضافية', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ level: 'منخفض', ownerId: null, departmentId: null, treatment: null, reviewDate: null }),
    ).not.toThrow();
  });

  // ── MEDIUM لا يُلزم بالحقول ───────────────────────────────────
  it('MEDIUM لا يُلزم بالحقول الإضافية', async () => {
    const { guardHighCritical } = await import('../src/routes/risks.js');
    expect(() =>
      guardHighCritical({ level: 'متوسط', ownerId: null, departmentId: null, treatment: null, reviewDate: null }),
    ).not.toThrow();
  });
});
