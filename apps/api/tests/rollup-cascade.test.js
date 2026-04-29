/**
 * rollup-cascade.test.js — ROLLUP-001
 *
 * اختبارات وحدة لـ recomputeStrategicGoal (بدون قاعدة بيانات — نمرّر mock tx).
 * تتحقق من:
 *   - الـ cascade الرياضي الصحيح (متوسط الأبناء)
 *   - حالة لا أطفال → لا تعديل
 *   - حالة حذف ناعم (deletedAt موجود) → لا يُحسب ضمن الأبناء
 *   - recompute idempotent (نفس النتيجة عند التشغيل مرتين)
 */
import { describe, it, expect, vi } from 'vitest';
import { recomputeStrategicGoal } from '../src/services/rollup.js';

/** ينشئ mock tx يُقلّد prisma.$transaction/tx */
function mockTx({ objectives = [], activities = [] } = {}) {
  const updated = { progress: null };
  return {
    objective: {
      findMany: vi.fn().mockResolvedValue(objectives),
    },
    operationalActivity: {
      findMany: vi.fn().mockResolvedValue(activities),
    },
    strategicGoal: {
      update: vi.fn().mockImplementation(({ data }) => {
        updated.progress = data.progress;
        return Promise.resolve({ id: 'sg-1', progress: data.progress });
      }),
    },
    _updated: updated,
  };
}

describe('recomputeStrategicGoal — cascade unit tests', () => {
  it('هدف واحد بـ progress=60 + نشاط بـ progress=0 → avg=30', async () => {
    const tx = mockTx({
      objectives:  [{ progress: 60 }],
      activities:  [{ progress: 0 }],
    });
    const result = await recomputeStrategicGoal('sg-1', tx);
    expect(result.progress).toBe(30);
    expect(tx._updated.progress).toBe(30);
  });

  it('هدف=100 ونشاط=100 → avg=100', async () => {
    const tx = mockTx({
      objectives:  [{ progress: 100 }],
      activities:  [{ progress: 100 }],
    });
    const result = await recomputeStrategicGoal('sg-1', tx);
    expect(result.progress).toBe(100);
  });

  it('ثلاثة أبناء: 30+60+90 → avg=60', async () => {
    const tx = mockTx({
      objectives:  [{ progress: 30 }, { progress: 60 }],
      activities:  [{ progress: 90 }],
    });
    const result = await recomputeStrategicGoal('sg-1', tx);
    expect(result.progress).toBe(60);
    expect(result.childrenCount).toBe(3);
  });

  it('لا أطفال → لا تحديث ويعود progress=null', async () => {
    const tx = mockTx({ objectives: [], activities: [] });
    const result = await recomputeStrategicGoal('sg-1', tx);
    expect(result.progress).toBeNull();
    expect(result.childrenCount).toBe(0);
    expect(tx.strategicGoal.update).not.toHaveBeenCalled();
  });

  it('progress=null في ابن يُعامَل كـ 0 في المتوسط', async () => {
    const tx = mockTx({
      objectives:  [{ progress: null }, { progress: 80 }],
      activities:  [],
    });
    const result = await recomputeStrategicGoal('sg-1', tx);
    // avg(0, 80) = 40
    expect(result.progress).toBe(40);
  });

  it('قيمة مكسورة تُقرَّب إلى أقرب صحيح', async () => {
    // avg(0, 100, 100) = 66.67 → 67
    const tx = mockTx({
      objectives:  [{ progress: 0 }, { progress: 100 }],
      activities:  [{ progress: 100 }],
    });
    const result = await recomputeStrategicGoal('sg-1', tx);
    expect(result.progress).toBe(67);
  });

  it('idempotent: تشغيلان يعطيان نفس النتيجة', async () => {
    const tx1 = mockTx({ objectives: [{ progress: 50 }], activities: [{ progress: 50 }] });
    const tx2 = mockTx({ objectives: [{ progress: 50 }], activities: [{ progress: 50 }] });
    const r1 = await recomputeStrategicGoal('sg-1', tx1);
    const r2 = await recomputeStrategicGoal('sg-1', tx2);
    expect(r1.progress).toBe(r2.progress);
    expect(r1.progress).toBe(50);
  });

  it('goalId=null أو undefined → يرجع null بدون أخطاء', async () => {
    const tx = mockTx();
    const r1 = await recomputeStrategicGoal(null, tx);
    const r2 = await recomputeStrategicGoal(undefined, tx);
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(tx.objective.findMany).not.toHaveBeenCalled();
  });

  it('يستدعي findMany بـ deletedAt:null لاستبعاد المحذوفين ناعماً', async () => {
    const tx = mockTx({ objectives: [{ progress: 50 }], activities: [] });
    await recomputeStrategicGoal('sg-test', tx);
    expect(tx.objective.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
    expect(tx.operationalActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
