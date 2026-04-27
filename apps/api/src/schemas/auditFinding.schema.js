/**
 * schemas/auditFinding.schema.js — Zod validation for AuditFinding
 * Audit task 9 (architectural) — ISO 9001:2015 §9.2
 */
import { z } from 'zod';
import { idString, optionalTrimmedString, trimmedString } from './_helpers.js';

const VALID_TYPES    = ['OBSERVATION', 'MINOR_NC', 'MAJOR_NC', 'POSITIVE_FINDING'];
const VALID_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'ESCALATED'];

const typeField = z.enum(VALID_TYPES, {
  errorMap: () => ({ message: `النوع يجب أن يكون: ${VALID_TYPES.join(' | ')}` }),
});

const statusField = z.enum(VALID_STATUSES, {
  errorMap: () => ({ message: `الحالة يجب أن تكون: ${VALID_STATUSES.join(' | ')}` }),
});

const optDate = z.preprocess(
  v => (!v || v === '' ? null : v),
  z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).nullable().optional(),
);

// ── Create ─────────────────────────────────────────────────────
export const createSchema = z.object({
  auditId:      idString,
  type:         typeField.default('OBSERVATION'),
  clauseRef:    optionalTrimmedString(50).optional(),
  departmentId: idString.nullable().optional(),
  processId:    idString.nullable().optional(),
  title:        trimmedString(2, 300),
  description:  trimmedString(2, 5000),
  evidence:     optionalTrimmedString(5000).optional(),
  ownerId:      idString.nullable().optional(),
  dueDate:      optDate,
  status:       statusField.optional(),
  response:     optionalTrimmedString(5000).optional(),
});

// ── Update ─────────────────────────────────────────────────────
export const updateSchema = z.object({
  type:         typeField.optional(),
  clauseRef:    optionalTrimmedString(50).optional(),
  departmentId: idString.nullable().optional(),
  processId:    idString.nullable().optional(),
  title:        trimmedString(2, 300).optional(),
  description:  trimmedString(2, 5000).optional(),
  evidence:     optionalTrimmedString(5000).optional(),
  ownerId:      idString.nullable().optional(),
  dueDate:      optDate,
  status:       statusField.optional(),
  response:     optionalTrimmedString(5000).optional(),
  closureNote:  optionalTrimmedString(5000).optional(),
}).partial();
