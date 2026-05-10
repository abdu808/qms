import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/donation.schema.js';
import { donationScopeWhere } from '../lib/accessScope.js';

export default crudRouter({
  resource: 'donations',
  model: 'donation',
  codePrefix: 'DON',
  searchFields: ['donorName', 'itemName'],
  allowedSortFields: ['createdAt', 'receivedAt', 'amount'],
  allowedFilters: ['type', 'status', 'donorType', 'recipientId'],
  scopeFilter: (req) => donationScopeWhere(req.user),
  include: {
    recipient:    { select: { id: true, code: true, fullName: true } },
    allocations:  { include: { program: { select: { id: true, code: true, name: true } } } },
    evaluations:  { take: 1, orderBy: { createdAt: 'desc' } },
  },
  schemas: { create: createSchema, update: updateSchema },
});
