import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';

function computeScore(data) {
  const q = Number(data.quality);
  const u = Number(data.usability);

  // Validate 1-5 range
  if (!Number.isFinite(q) || q < 1 || q > 5) throw BadRequest('درجة الجودة يجب أن تكون بين 1 و 5');
  if (!Number.isFinite(u) || u < 1 || u > 5) throw BadRequest('درجة القابلية للاستخدام يجب أن تكون بين 1 و 5');

  const conformity  = data.conformity === true || data.conformity === 'true';
  const expiryCheck = data.expiryCheck === true || data.expiryCheck === 'true';

  const score = (q + u) / 2;

  // Critical failure rules — non-conforming or expired → reject regardless of score
  let decision;
  if (!conformity) {
    decision = 'رفض — غير مطابق للمواصفات';
  } else if (!expiryCheck) {
    decision = 'رفض — فشل فحص الصلاحية';
  } else if (score >= 4) {
    decision = 'قبول';
  } else if (score >= 3) {
    decision = 'قبول مشروط';
  } else {
    decision = 'رفض — جودة غير كافية';
  }

  return { ...data, conformity, expiryCheck, score, decision };
}

export default crudRouter({
  model: 'donationEval',
  codePrefix: 'DEV',
  searchFields: ['notes'],
  include: { donation: true, evaluator: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'score'],
  beforeCreate: async (data, req) => {
    const d = computeScore(data);
    return { ...d, evaluatorId: req.user.sub };
  },
  beforeUpdate: async (data) => computeScore(data),
});
