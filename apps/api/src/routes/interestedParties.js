import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'interested-parties',
  model: 'interestedParty',
  codePrefix: 'IP',
  searchFields: ['name', 'needs', 'expectations', 'responsible'],
  allowedSortFields: ['createdAt', 'type', 'influence', 'status'],
  allowedFilters: ['type', 'status', 'departmentId', 'responsibleUserId', 'relatedRiskId'],
  include: {
    responsibleUser:  { select: { id: true, name: true } },
    relatedRisk:      { select: { id: true, code: true, title: true } },
    partyDepartment:  { select: { id: true, name: true } },
  },
});
