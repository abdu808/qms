import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/fundingSource.schema.js';

export default crudRouter({
  resource: 'funding-sources',
  model: 'fundingSource',
  codePrefix: 'FSRC',
  allowedFilters: ['type'],
  softDelete: false,
  schemas: { create: createSchema, update: updateSchema },
});
