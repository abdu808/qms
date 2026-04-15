import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'survey',
  codePrefix: 'SRV',
  searchFields: ['title'],
  allowedSortFields: ['createdAt'],
});
