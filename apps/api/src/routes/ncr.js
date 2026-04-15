import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'nCR',
  codePrefix: 'NCR',
  searchFields: ['title', 'description'],
  include: {
    department: true,
    reporter: { select: { id: true, name: true } },
    assignee: { select: { id: true, name: true } },
  },
  allowedSortFields: ['createdAt', 'dueDate', 'status'],
  beforeCreate: async (data, req) => ({ ...data, reporterId: req.user.sub }),
});
