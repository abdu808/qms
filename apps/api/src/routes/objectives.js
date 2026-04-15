import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'objective',
  codePrefix: 'OBJ',
  searchFields: ['title', 'description', 'kpi'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'dueDate', 'status', 'progress'],
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub }),
});
