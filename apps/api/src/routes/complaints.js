import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'complaint',
  codePrefix: 'CMP',
  searchFields: ['subject', 'description', 'complainantName'],
  include: { assignee: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'receivedAt', 'status', 'severity'],
});
