/**
 * schemas/strategicPlan.schema.js — تحقق Zod للخطة الاستراتيجية (StrategicPlan).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString } from './_helpers.js';

const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const yearInt = (label) => z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number({ required_error: `${label} مطلوب` }).int().min(2000).max(2100),
);

export const createSchema = z.object({
  title:       trimmedString(3, 300),
  description: optionalTrimmedString(5000),
  startYear:   yearInt('سنة البداية'),
  endYear:     yearInt('سنة النهاية'),
  status:      z.enum(STATUSES).optional(),
  notes:       optionalTrimmedString(2000),
}).strip().refine(d => !d.endYear || !d.startYear || d.endYear >= d.startYear, {
  message: 'سنة النهاية يجب أن تكون مساوية أو أكبر من سنة البداية',
  path: ['endYear'],
});

export const updateSchema = z.object({
  title:       trimmedString(3, 300).optional(),
  description: optionalTrimmedString(5000),
  startYear:   yearInt('سنة البداية').optional(),
  endYear:     yearInt('سنة النهاية').optional(),
  status:      z.enum(STATUSES).optional(),
  notes:       optionalTrimmedString(2000),
}).strip();
