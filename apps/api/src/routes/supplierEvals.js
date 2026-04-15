import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';

function grade(pct) {
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جداً';
  if (pct >= 70) return 'جيد';
  if (pct >= 60) return 'مقبول';
  return 'ضعيف';
}
function decision(pct) {
  if (pct >= 80) return 'معتمد';
  if (pct >= 60) return 'مشروط';
  return 'مرفوض';
}

const router = crudRouter({
  model: 'supplierEval',
  codePrefix: 'REG-004-VAL',
  searchFields: ['notes'],
  include: { supplier: true, evaluator: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'percentage'],
  beforeCreate: async (data, req) => {
    const total = Number(data.totalScore) || 0;
    const max   = Number(data.maxScore) || 100;
    const pct   = max > 0 ? (total / max) * 100 : 0;
    const out = { ...data, percentage: pct, grade: grade(pct), decision: decision(pct), evaluatorId: req.user.sub };
    // update supplier's overall rating
    if (data.supplierId) {
      const all = await prisma.supplierEval.findMany({ where: { supplierId: data.supplierId }, select: { percentage: true } });
      const avg = ([...all.map(a => a.percentage), pct].reduce((a, b) => a + b, 0)) / (all.length + 1);
      await prisma.supplier.update({ where: { id: data.supplierId }, data: { overallRating: avg } });
    }
    return out;
  },
});

export default router;
