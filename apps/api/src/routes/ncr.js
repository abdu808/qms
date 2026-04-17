import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';

// Normalize payload: coerce `effective` string → boolean, auto-stamp verifiedAt
function normalize(data) {
  if (data.effective === 'true')  data.effective = true;
  else if (data.effective === 'false') data.effective = false;
  else if (data.effective === '' || data.effective === null) data.effective = null;

  // When effectiveness is recorded, auto-stamp verifiedAt if not provided
  if (data.effective !== null && data.effective !== undefined && !data.verifiedAt) {
    data.verifiedAt = new Date();
  }
  return data;
}

// ISO 10.2: cannot CLOSE an NCR without verifying effectiveness
function guardClosure(data) {
  if (data.status === 'CLOSED') {
    if (data.effective !== true) {
      throw BadRequest('لا يمكن إغلاق عدم المطابقة دون التحقق من فعالية الإجراء التصحيحي (ISO 10.2)');
    }
    if (!data.verifiedAt) {
      throw BadRequest('مطلوب تاريخ التحقق من الفعالية قبل الإغلاق');
    }
  }
}

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
  beforeCreate: async (data, req) => {
    data = normalize(data);
    guardClosure(data);
    return { ...data, reporterId: req.user.sub };
  },
  beforeUpdate: async (data) => {
    data = normalize(data);
    guardClosure(data);
    return data;
  },
});
