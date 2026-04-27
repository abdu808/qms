-- Migration: ربط المؤشرات بمحاور BSC عبر axisId
-- يُكمِل البنية المعمارية لـ BSC حيث كانت Axis معزولة عن Indicator

ALTER TABLE "Indicator" ADD COLUMN IF NOT EXISTS "axisId" TEXT;
CREATE INDEX IF NOT EXISTS "Indicator_axisId_idx" ON "Indicator"("axisId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Indicator_axisId_fkey'
  ) THEN
    ALTER TABLE "Indicator"
      ADD CONSTRAINT "Indicator_axisId_fkey"
      FOREIGN KEY ("axisId") REFERENCES "Axis"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
