-- Migration: إضافة ownerId و deptId إلى OperationalActivity
-- ربط الأنشطة التشغيلية بالمستخدم المسؤول والإدارة المنفذة عبر FK بدل النص الحر

-- Columns (IF NOT EXISTS — آمن إذا طُبّق مسبقاً عبر prisma db execute)
ALTER TABLE "OperationalActivity" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "OperationalActivity" ADD COLUMN IF NOT EXISTS "deptId"  TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "OperationalActivity_ownerId_idx" ON "OperationalActivity"("ownerId");
CREATE INDEX IF NOT EXISTS "OperationalActivity_deptId_idx"  ON "OperationalActivity"("deptId");

-- FK constraints (فقط إذا لم تكن موجودة)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OperationalActivity_ownerId_fkey'
  ) THEN
    ALTER TABLE "OperationalActivity"
      ADD CONSTRAINT "OperationalActivity_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OperationalActivity_deptId_fkey'
  ) THEN
    ALTER TABLE "OperationalActivity"
      ADD CONSTRAINT "OperationalActivity_deptId_fkey"
      FOREIGN KEY ("deptId") REFERENCES "Department"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
