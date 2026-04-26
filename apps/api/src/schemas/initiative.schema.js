/**
 * schemas/initiative.schema.js — تحقق Zod للمبادرات الاستراتيجية (Initiative).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString, optionalDate } from './_helpers.js';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

const numOptional = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().nullable().optional(),
);

export const createSchema = z.object({
  name:         trimmedString(2, 300),
  description:  optionalTrimmedString(5000),
  goalId:       idString,
  ownerId:      idString.nullable().optional(),
  departmentId: idString.nullable().optional(),
  startDate:    optionalDate,
  endDate:      optionalDate,
  budget:       numOptional,
  spent:        numOptional,
  progress:     z.preprocess(v => (v === '' || v == null ? 0 : Number(v)), z.number().int().min(0).max(100)).optional(),
  status:       z.enum(STATUSES).optional(),
  notes:        optionalTrimmedString(2000),
}).strip();

export const updateSchema = createSchema.partial();
