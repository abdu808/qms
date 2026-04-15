import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'department',
  searchFields: ['name', 'code'],
  allowedSortFields: ['createdAt', 'name', 'code'],
});
