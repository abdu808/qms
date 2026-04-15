import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'beneficiary',
  codePrefix: 'BEN',
  searchFields: ['fullName', 'nationalId', 'phone'],
  allowedSortFields: ['createdAt', 'appliedAt', 'status'],
});
