/**
 * schemas/annualTarget.schema.js — تحقق Zod للمستهدفات السنوية (AnnualTarget).
 */
import { z } from 'zod';
import { optionalTrimmedString, idString } from './_helpers.js';

const numRequired = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number({ required_error: 'القيمة المستهدفة مطلوبة' }),
);

const numOptional = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().nullable().optional(),
);

const yearRequired = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(2000).max(2100, 'السنة يجب أن تكون بين 2000 و 2100'),
);

export const createSchema = z.object({
  indicatorId:        idString,
  year:               yearRequired,
  targetValue:        numRequired,
  q1Target:           numOptional,
  q2Target:           numOptional,
  q3Target:           numOptional,
  q4Target:           numOptional,
  modificationReason: optionalTrimmedString(1000),
  createdById:        idString.optional(),  // يُملأ من req.user.sub في الـ server إذا غاب
}).strip();

export const updateSchema = createSchema.partial();
