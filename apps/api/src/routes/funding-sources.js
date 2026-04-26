import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'funding-sources',
  model: 'fundingSource',
  codePrefix: 'FSRC',
  allowedFilters: ['type'],
  softDelete: false,
});
