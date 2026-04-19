import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/donation.schema.js';

export default crudRouter({
  resource: 'donations',
  model: 'donation',
  codePrefix: 'DON',
  searchFields: ['donorName', 'itemName'],
  allowedSortFields: ['createdAt', 'receivedAt', 'amount'],
  allowedFilters: ['status', 'type', 'donorType'],
  schemas: { create: createSchema, update: updateSchema },
});
