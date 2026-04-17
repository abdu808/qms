import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  model: 'strategicGoal',
  codePrefix: 'STR',
  searchFields: ['title', 'perspective', 'kpi', 'initiatives', 'responsible'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'startYear', 'endYear'],
});
