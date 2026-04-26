import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'operational-activities',
  model: 'operationalActivity',
  codePrefix: 'ACT',
  searchFields: ['title', 'description', 'responsible', 'department', 'perspective'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'year', 'startDate', 'endDate'],
  allowedFilters: ['status', 'year', 'strategicGoalId', 'ownerId', 'deptId'],
  include: {
    owner: { select: { id: true, name: true, jobTitle: true } },
    dept:  { select: { id: true, name: true, code: true } },
    strategicGoal: { select: { id: true, code: true, title: true } },
  },
});
