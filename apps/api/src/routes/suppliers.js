import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'supplier',
  codePrefix: 'SUP',
  searchFields: ['name', 'crNumber', 'contactPerson'],
  allowedSortFields: ['createdAt', 'name', 'status', 'overallRating'],
});
