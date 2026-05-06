import { z } from 'zod';
import { optionalTrimmedString, trimmedString } from './_helpers.js';

const requiredDate = z.preprocess(
  v => {
    if (v == null || v === '') return undefined;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d;
  },
  z.date({ required_error: 'تاريخ التدريب مطلوب', invalid_type_error: 'تاريخ التدريب غير صالح' }),
);

const optionalDuration = z.preprocess(
  v => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  },
  z.number({ invalid_type_error: 'مدة التدريب يجب أن تكون رقماً' }).min(0, 'مدة التدريب لا يمكن أن تكون سالبة').nullable().optional(),
);

export const createSchema = z.object({
  title: trimmedString(3, 250),
  description: optionalTrimmedString(3000),
  trainer: optionalTrimmedString(250),
  date: requiredDate,
  duration: optionalDuration,
  location: optionalTrimmedString(250),
  category: optionalTrimmedString(150),
  competenceTarget: optionalTrimmedString(1500),
}).strip();

export const updateSchema = createSchema.partial();
