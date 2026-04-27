import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'processes',
  model: 'process',
  codePrefix: 'PRO',
  searchFields: ['name', 'owner', 'description', 'kpis'],
  allowedSortFields: ['createdAt', 'type', 'status', 'name'],
  allowedFilters: ['type', 'status', 'departmentId', 'ownerUserId'],
  include: {
    ownerUser:         { select: { id: true, name: true } },
    processDepartment: { select: { id: true, name: true } },
    processObjectives: { include: { objective: { select: { id: true, code: true, title: true } } } },
    processRisks:      { include: { risk: { select: { id: true, code: true, title: true, level: true } } } },
    processIndicators: { include: { indicator: { select: { id: true, code: true, nameAr: true } } } },
  },
});
