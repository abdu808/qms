/**
 * schemas/axis.schema.js — تحقق Zod لمحاور BSC (Axis).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString } from './_helpers.js';

const numOptional = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().nullable().optional(),
);

export const createSchema = z.object({
  code:   trimmedString(1, 20),
  nameAr: trimmedString(2, 200),
  nameEn: optionalTrimmedString(200),
  color:  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'لون hex غير صالح').nullable().optional(),
  weight: numOptional,
  order:  z.preprocess(v => (v === '' || v == null ? 0 : Number(v)), z.number().int().min(0)).optional(),
}).strip();

export const updateSchema = createSchema.partial();
