ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "plannedStartAt" TIMESTAMP(3);
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "plannedEndAt" TIMESTAMP(3);
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "targetResponses" INTEGER;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "audienceNote" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "executionStatus" TEXT NOT NULL DEFAULT 'DRAFT';

DO $$
BEGIN
  ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Survey_ownerId_idx" ON "Survey"("ownerId");
CREATE INDEX IF NOT EXISTS "Survey_executionStatus_idx" ON "Survey"("executionStatus");
CREATE INDEX IF NOT EXISTS "Survey_plannedEndAt_idx" ON "Survey"("plannedEndAt");
