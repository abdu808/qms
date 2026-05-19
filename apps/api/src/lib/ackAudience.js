const INTERNAL_AUDIENCES = ['EMPLOYEE', 'BOARD_MEMBER', 'AUDITOR', 'ALL'];

export function ackAudienceTagsForUser(user = {}) {
  const role = user.role || '';
  const tags = new Set(['ALL']);

  if (role === 'GUEST_AUDITOR') {
    tags.add('AUDITOR');
  } else {
    tags.add('EMPLOYEE');
  }

  if (role === 'COMMITTEE_MEMBER') {
    tags.add('BOARD_MEMBER');
  }

  return [...tags];
}

export function ackDocumentAppliesToUser(document, user) {
  const audiences = Array.isArray(document?.audience) ? document.audience : [];
  if (!audiences.length) return false;
  if (audiences.includes('ALL')) return true;
  const tags = ackAudienceTagsForUser(user);
  return audiences.some(audience => tags.includes(audience));
}

export function isInternalAckDocument(document) {
  const audiences = Array.isArray(document?.audience) ? document.audience : [];
  return audiences.some(audience => INTERNAL_AUDIENCES.includes(audience));
}

export { INTERNAL_AUDIENCES };
