import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'donation',
  codePrefix: 'DON',
  searchFields: ['donorName', 'itemName'],
  allowedSortFields: ['createdAt', 'receivedAt', 'amount'],
});
