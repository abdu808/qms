import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'communication',
  model: 'communicationPlan',
  codePrefix: 'COMM',
  searchFields: ['topic', 'audience', 'responsible', 'channel'],
  allowedSortFields: ['createdAt', 'frequency', 'status'],
  allowedFilters: ['status', 'channel', 'frequency', 'responsibleUserId'],
  include: {
    responsibleUser: { select: { id: true, name: true } },
    parties:         { include: { party: { select: { id: true, code: true, name: true } } } },
  },
});
