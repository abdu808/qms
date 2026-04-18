import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';

const RESOLVED_STATES = ['RESOLVED', 'CLOSED'];

function normalize(data) {
  // Coerce satisfaction to Int or null
  if (data.satisfaction === '' || data.satisfaction === null || data.satisfaction === undefined) {
    data.satisfaction = null;
  } else {
    const s = Number(data.satisfaction);
    if (!Number.isFinite(s) || s < 1 || s > 5) {
      throw BadRequest('درجة الرضا يجب أن تكون بين 1 و 5');
    }
    data.satisfaction = s;
  }

  // Auto-stamp resolvedAt when moving to a resolved state
  if (RESOLVED_STATES.includes(data.status) && !data.resolvedAt) {
    data.resolvedAt = new Date();
  }
  return data;
}

export default crudRouter({
  model: 'complaint',
  codePrefix: 'CMP',
  searchFields: ['subject', 'description', 'complainantName'],
  include: { assignee: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'receivedAt', 'status', 'severity'],
  allowedFilters: ['status', 'severity', 'assigneeId'],
  beforeCreate: async (data) => normalize(data),
  beforeUpdate: async (data) => normalize(data),
});
