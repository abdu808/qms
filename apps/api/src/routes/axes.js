import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'axes',
  model: 'axis',
  codePrefix: 'AXIS',
  allowedFilters: ['deletedAt'],
  softDelete: true,
});
