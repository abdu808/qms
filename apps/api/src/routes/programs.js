import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'program',
  codePrefix: 'PRG',
  searchFields: ['name', 'description'],
  allowedSortFields: ['createdAt', 'startDate', 'status'],
});
