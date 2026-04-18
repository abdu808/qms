import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'audit',
  codePrefix: 'AUD',
  searchFields: ['title', 'scope'],
  include: { leadAuditor: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'plannedDate', 'status'],
  allowedFilters: ['status', 'type', 'leadAuditorId'],
});
