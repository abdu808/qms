ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "governing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvalReference" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalAuthority" TEXT,
  ADD COLUMN IF NOT EXISTS "publicationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceSystem" TEXT;

UPDATE "Document"
SET "governing" = true
WHERE "deletedAt" IS NULL
  AND "category" IN ('MANUAL', 'POLICY', 'PROCEDURE', 'WORK_INSTRUCTION')
  AND "governing" = false;

CREATE INDEX IF NOT EXISTS "Document_governing_idx" ON "Document"("governing");
CREATE INDEX IF NOT EXISTS "Document_approvalReference_idx" ON "Document"("approvalReference");
