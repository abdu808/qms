import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/axis.schema.js';

export default crudRouter({
  resource: 'axes',
  model: 'axis',
  codePrefix: 'AXIS',
  allowedFilters: ['deletedAt'],
  softDelete: true,
  schemas: { create: createSchema, update: updateSchema },
});
