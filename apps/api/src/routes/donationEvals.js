import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'donationEval',
  codePrefix: 'DEV',
  searchFields: ['notes'],
  include: { donation: true, evaluator: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'score'],
  beforeCreate: async (data, req) => {
    const q = Number(data.quality) || 0;
    const u = Number(data.usability) || 0;
    const score = (q + u) / 2;
    const decision = score >= 4 ? 'قبول' : score >= 3 ? 'قبول مشروط' : 'رفض';
    return { ...data, score, decision, evaluatorId: req.user.sub };
  },
});
