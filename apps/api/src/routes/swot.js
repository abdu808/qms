import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'swot',
  model: 'swotItem',
  codePrefix: 'SWOT',
  searchFields: ['description', 'category', 'strategy'],
  allowedSortFields: ['createdAt', 'type', 'impact', 'status'],
  allowedFilters: ['type', 'status', 'relatedRiskId', 'relatedGoalId', 'departmentId', 'ownerUserId'],
  include: {
    relatedRisk:    { select: { id: true, code: true, title: true, level: true } },
    relatedGoal:    { select: { id: true, code: true, title: true } },
    ownerUser:      { select: { id: true, name: true } },
    swotDepartment: { select: { id: true, name: true } },
  },
});
