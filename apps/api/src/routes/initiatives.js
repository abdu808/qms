import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/initiative.schema.js';

export default crudRouter({
  resource: 'initiatives',
  model: 'initiative',
  codePrefix: 'INI',
  allowedFilters: ['goalId', 'status', 'ownerId', 'departmentId', 'deletedAt'],
  softDelete: true,
  schemas: { create: createSchema, update: updateSchema },
  include: {
    goal: { select: { id: true, title: true } },
    owner: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
  },
});
