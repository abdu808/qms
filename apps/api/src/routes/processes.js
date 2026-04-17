import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  model: 'process',
  codePrefix: 'PRO',
  searchFields: ['name', 'owner', 'description', 'kpis'],
  allowedSortFields: ['createdAt', 'type', 'status', 'name'],
});
