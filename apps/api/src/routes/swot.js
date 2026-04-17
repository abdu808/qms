import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  model: 'swotItem',
  codePrefix: 'SWOT',
  searchFields: ['description', 'category', 'strategy'],
  allowedSortFields: ['createdAt', 'type', 'impact', 'status'],
});
