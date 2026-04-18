import { crudRouter } from '../utils/crudFactory.js';

function computeLevel(score) {
  if (score >= 20) return 'حرج';
  if (score >= 12) return 'مرتفع';
  if (score >= 6)  return 'متوسط';
  return 'منخفض';
}

export default crudRouter({
  model: 'risk',
  codePrefix: 'RSK',
  searchFields: ['title', 'description'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'score', 'status'],
  allowedFilters: ['status', 'level', 'departmentId', 'ownerId'],
  beforeCreate: async (data, req) => {
    const p = Number(data.probability) || 1;
    const i = Number(data.impact) || 1;
    const score = p * i;
    return { ...data, probability: p, impact: i, score, level: computeLevel(score), createdById: req.user.sub };
  },
  beforeUpdate: async (data) => {
    if (data.probability != null || data.impact != null) {
      const p = Number(data.probability) || 1;
      const i = Number(data.impact) || 1;
      data.score = p * i;
      data.level = computeLevel(data.score);
    }
    return data;
  },
});
