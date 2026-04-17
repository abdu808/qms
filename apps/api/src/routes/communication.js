import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  model: 'communicationPlan',
  codePrefix: 'COMM',
  searchFields: ['topic', 'audience', 'responsible', 'channel'],
  allowedSortFields: ['createdAt', 'frequency', 'status'],
});
