-- 006_portal_indices.sql
-- فهارس إضافية للبوابة العامة (الجداول تُنشأ بـ prisma db push)

BEGIN;

CREATE INDEX IF NOT EXISTS "announcement_active_pub_idx"
  ON "Announcement"("isActive", "publishedAt")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "document_public_idx"
  ON "Document"("isPublic", "status")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "survey_public_idx"
  ON "Survey"("isPublic", "active")
  WHERE "deletedAt" IS NULL;

COMMIT;
