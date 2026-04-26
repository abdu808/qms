import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'initiatives',
  model: 'initiative',
  codePrefix: 'INI',
  allowedFilters: ['goalId', 'status', 'ownerId', 'departmentId', 'deletedAt'],
  softDelete: true,
  include: {
    goal: { select: { id: true, title: true } },
    owner: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
  },
});
