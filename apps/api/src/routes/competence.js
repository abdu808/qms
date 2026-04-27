import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'competence',
  model: 'competenceRequirement',
  codePrefix: 'COMP',
  searchFields: ['jobTitle', 'department', 'requiredSkills', 'certifications'],
  allowedSortFields: ['createdAt', 'jobTitle', 'status'],
  allowedFilters: ['status', 'departmentId'],
  include: {
    compDepartment: { select: { id: true, name: true } },
    trainingLinks:  { include: { training: { select: { id: true, code: true, title: true } } } },
  },
});
