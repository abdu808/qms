/**
 * schemas/fundingPlan.schema.js — تحقق Zod لخطط التمويل السنوية (FundingPlan).
 */
import { z } from 'zod';
import { optionalTrimmedString, idString } from './_helpers.js';

const numRequired = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number({ required_error: 'المبلغ مطلوب' }).min(0, 'المبلغ يجب أن يكون صفراً أو أكبر'),
);

const numOptional = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().min(0).nullable().optional(),
);

const yearRequired = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(2000).max(2100),
);

export const createSchema = z.object({
  planId:             idString,
  sourceId:           idString,
  year:               yearRequired,
  expectedAmount:     numRequired,
  actualAmount:       numOptional,
  concentrationLimit: z.preprocess(
    v => (v === '' || v == null ? 35 : Number(v)),
    z.number().min(1).max(100),
  ).optional(),
  notes:              optionalTrimmedString(2000),
}).strip();

export const updateSchema = createSchema.partial();
