import { z } from 'zod';

export const announcementCreateSchema = z.object({
  title:       z.string().min(3).max(200),
  summary:     z.string().max(500).optional(),
  body:        z.string().min(10),
  category:    z.enum(['خبر', 'إعلان', 'تحديث', 'إنجاز']).optional(),
  isActive:    z.boolean().default(true),
  publishedAt: z.string().datetime().optional(),
  expiresAt:   z.string().datetime().optional().nullable(),
});

export const announcementUpdateSchema = announcementCreateSchema.partial();

export const portalSettingsSchema = z.object({
  orgName:           z.string().min(2).max(100).optional(),
  orgDescription:    z.string().max(500).optional().nullable(),
  showPolicy:        z.boolean().optional(),
  showDocuments:     z.boolean().optional(),
  showAnnouncements: z.boolean().optional(),
  showSurveys:       z.boolean().optional(),
  showKpis:          z.boolean().optional(),
  footerText:        z.string().max(200).optional().nullable(),
});
