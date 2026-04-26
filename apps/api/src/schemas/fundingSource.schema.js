/**
 * schemas/fundingSource.schema.js — تحقق Zod لمصادر التمويل (FundingSource).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString } from './_helpers.js';

const TYPES = ['DONATION', 'ZAKAT', 'CSR', 'GOVT', 'INVESTMENT', 'INTERNAL'];

export const createSchema = z.object({
  code:        trimmedString(1, 30),
  name:        trimmedString(2, 200),
  type:        z.enum(TYPES),
  description: optionalTrimmedString(2000),
}).strip();

export const updateSchema = createSchema.partial();
