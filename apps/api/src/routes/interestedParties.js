import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  model: 'interestedParty',
  codePrefix: 'IP',
  searchFields: ['name', 'needs', 'expectations', 'responsible'],
  allowedSortFields: ['createdAt', 'type', 'influence', 'status'],
});
