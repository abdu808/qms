import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';

export default crudRouter({
  model: 'objective',
  codePrefix: 'OBJ',
  searchFields: ['title', 'description', 'kpi'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'dueDate', 'status', 'progress'],
  allowedFilters: ['status', 'departmentId', 'ownerId'],
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub }),
  beforeUpdate: async (data) => {
    // ISO 6.2: نسبة التقدم يجب أن تكون بين 0 و 100
    if (data.progress != null) {
      const p = Number(data.progress);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw BadRequest('نسبة التقدم يجب أن تكون بين 0 و 100');
      }
      data.progress = Math.round(p);
    }
    return data;
  },
});
