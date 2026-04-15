import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  model: 'training',
  codePrefix: 'TRN',
  searchFields: ['title', 'trainer'],
  include: { records: { include: { user: { select: { id: true, name: true } } } } },
  allowedSortFields: ['createdAt', 'date'],
});
