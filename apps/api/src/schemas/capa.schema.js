import { z } from 'zod';
export const capaCreateSchema = z.object({
  type:              z.enum(['CORRECTIVE','PREVENTIVE']).default('CORRECTIVE'),
  title:             z.string().min(3).max(200),
  description:       z.string().max(1000).optional(),
  sourceType:        z.enum(['NCR','COMPLAINT','RISK','AUDIT','MANUAL']).default('MANUAL'),
  sourceId:          z.string().optional(),
  sourceCode:        z.string().max(50).optional(),
  ncrId:             z.string().optional(),
  complaintId:       z.string().optional(),
  riskId:            z.string().optional(),
  rootCauseAnalysis: z.string().max(2000).optional(),
  plannedAction:     z.string().max(2000).optional(),
  ownerId:           z.string().optional(),
  dueDate:           z.string().datetime().optional().nullable(),
});
export const capaUpdateSchema = capaCreateSchema.partial().extend({
  implementedAction: z.string().max(2000).optional(),
  verificationNote:  z.string().max(1000).optional(),
  effective:         z.boolean().optional(),
  lessonsLearned:    z.string().max(1000).optional(),
});
