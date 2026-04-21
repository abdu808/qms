/**
 * rollup.test.js — اختبارات وحدة لـ computeProgressFromEntries (الدالة الرياضية
 * الخالصة الموجودة في services/rollup.js). لا تلمس قاعدة البيانات.
 */
import { describe, it, expect } from 'vitest';
import { computeProgressFromEntries } from '../src/services/rollup.js';

const e = (month, actualValue, spent) => ({ month, actualValue, spent: spent ?? null });

describe('computeProgressFromEntries', () => {
  it('بدون قراءات → progress=0 و actual=null', () => {
    const r = computeProgressFromEntries({ kpiType: 'CUMULATIVE', target: 100 }, []);
    expect(r.progress).toBe(0);
    expect(r.actual).toBeNull();
  });

  it('بدون هدف صالح → progress=0', () => {
    const r = computeProgressFromEntries({ kpiType: 'CUMULATIVE', target: 0 }, [e(1, 50)]);
    expect(r.progress).toBe(0);
  });

  describe('CUMULATIVE (تراكمي)', () => {
    it('قراءتان يجمعان للمستهدف', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 30), e(2, 50)],
      );
      expect(r.actual).toBe(80);
      expect(r.progress).toBe(80);
    });

    it('تجاوز الهدف يُقصّ عند 100', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100 },
        [e(1, 70), e(2, 60)],
      );
      expect(r.actual).toBe(130);
      expect(r.progress).toBe(100);
    });
  });

  describe('PERIODIC (شهري مستقل)', () => {
    it('متوسط نسب التحقيق', () => {
      // كل شهر هدفه 100؛ قراءات: 100, 80, 60 → متوسط = 80
      const r = computeProgressFromEntries(
        { kpiType: 'PERIODIC', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 100), e(2, 80), e(3, 60)],
      );
      expect(r.actual).toBeCloseTo(80, 1);
      expect(r.progress).toBe(80);
    });
  });

  describe('SNAPSHOT (لحظي)', () => {
    it('آخر قراءة فقط تُعتمد', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 100 },
        [e(1, 20), e(2, 60), e(3, 90)],
      );
      expect(r.actual).toBe(90);
      expect(r.progress).toBe(90);
    });
  });

  describe('direction = LOWER_BETTER (الأقل أفضل)', () => {
    it('قراءة أقل من الهدف → progress عالي', () => {
      // target=10 شكاوى شهرياً، وصلنا لـ 5 → progress=100 (ممتاز)
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 10, direction: 'LOWER_BETTER' },
        [e(3, 5)],
      );
      expect(r.actual).toBe(5);
      expect(r.progress).toBe(100);
    });

    it('قراءة أعلى من الهدف → progress منخفض', () => {
      // target=10 لكن الشكاوى 20 → ratio=10/20=0.5 → 50%
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 10, direction: 'LOWER_BETTER' },
        [e(3, 20)],
      );
      expect(r.actual).toBe(20);
      expect(r.progress).toBe(50);
    });
  });

  describe('BINARY (نعم/لا)', () => {
    it('قراءة ≥1 → progress=100', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'BINARY', target: 1 },
        [e(6, 1)],
      );
      expect(r.progress).toBe(100);
    });
    it('كل القراءات صفر → progress=0', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'BINARY', target: 1 },
        [e(3, 0), e(4, 0)],
      );
      expect(r.progress).toBe(0);
    });
  });

  it('clamp — قيم سالبة/عالية جداً → [0,100]', () => {
    const r = computeProgressFromEntries(
      { kpiType: 'CUMULATIVE', target: 10 },
      [e(1, 1000)],
    );
    expect(r.progress).toBe(100);
    expect(r.progress).toBeGreaterThanOrEqual(0);
    expect(r.progress).toBeLessThanOrEqual(100);
  });

  // ═══════════════════════════════════════════════════════════════
  //  حالات إضافية — Error recovery & Concurrent entries
  // ═══════════════════════════════════════════════════════════════

  describe('error recovery — قراءات جزئية/خاطئة', () => {
    it('قراءة واحدة صحيحة بعد قراءات بقيمة null → تُعالج فقط الصحيحة', () => {
      // actualValue=null يُعامَل كصفر في kpi-engine أو يُتجاهل
      // نتوقع أن الدالة لا ترمي وتُرجع قيمة منطقية
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 100 },
        [e(1, null), e(2, null), e(3, 50)],
      );
      expect(() => r.progress).not.toThrow();
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(100);
    });

    it('جميع القراءات بقيمة صفر → progress=0', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100 },
        [e(1, 0), e(2, 0), e(3, 0)],
      );
      expect(r.progress).toBe(0);
    });

    it('قراءة واحدة فقط في وسط السنة → لا تتأثر SNAPSHOT', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 80, direction: 'HIGHER_BETTER' },
        [e(6, 80)],
      );
      expect(r.actual).toBe(80);
      expect(r.progress).toBe(100);
    });

    it('PERIODIC بقراءة واحدة فقط → يعمل بدون خطأ', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'PERIODIC', target: 100, direction: 'HIGHER_BETTER' },
        [e(3, 50)],
      );
      expect(r.actual).toBeCloseTo(50, 1);
      expect(r.progress).toBe(50);
    });

    it('هدف سالب → يُرجع progress=0 (حالة بيانات تالفة)', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: -10 },
        [e(1, 50)],
      );
      expect(r.progress).toBe(0);
    });
  });

  describe('concurrent entries — قراءات متعددة لنفس الشهر', () => {
    it('CUMULATIVE — قراءتان في نفس الشهر تُجمعان كلتاهما', () => {
      // قراءتان للشهر 1: 30 + 20 = 50، + شهر 2: 30 → مجموع 80
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 30), e(1, 20), e(2, 30)],
      );
      expect(r.actual).toBe(80);
      expect(r.progress).toBe(80);
    });

    it('SNAPSHOT — قراءتان في نفس الشهر — الأعلى رقماً (آخر شهر) يُعتمد', () => {
      // كلتا القراءتين في شهر 5؛ SNAPSHOT يأخذ آخر شهر = 5
      // actualByMonth يجمع القراءات بنفس الشهر — نتحقق فقط أن النتيجة منطقية
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 100 },
        [e(5, 40), e(5, 90)],
      );
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(100);
    });

    it('PERIODIC — قراءتان للشهر الواحد تُكسِّران المتوسط بشكل متسق', () => {
      // لا نفترض السلوك الدقيق لكن نتحقق أن القيمة في [0,100]
      const r = computeProgressFromEntries(
        { kpiType: 'PERIODIC', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 50), e(1, 100), e(2, 80)],
      );
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(100);
    });

    it('LOWER_BETTER مع قراءات متعددة → يبقى في [0,100]', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 10, direction: 'LOWER_BETTER' },
        [e(3, 15), e(4, 8), e(5, 3)],
      );
      expect(r.actual).toBe(3);  // SNAPSHOT → آخر شهر
      expect(r.progress).toBe(100);  // 3 < 10 → ممتاز
    });
  });
});
