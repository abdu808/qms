/**
 * schemas/planVersion.schema.js — تحقق Zod لإصدارات الخطة الاستراتيجية (StrategicPlanVersion).
 *
 * الإنشاء يتم فقط عبر POST /api/plan-versions/snapshot (منطق مخصص).
 * هذه الـ schemas مطلوبة فقط لإرضاء CI guard (check-schemas.js).
 */
import { z } from 'zod';
import { optionalTrimmedString, idString } from './_helpers.js';

const TRIGGERS = ['MANUAL', 'QUARTERLY', 'ACTIVATION'];

export const createSchema = z.object({
  planId:      idString,
  reason:      optionalTrimmedString(1000),
  trigger:     z.enum(TRIGGERS).optional(),
}).strip();

export const updateSchema = createSchema.partial();
