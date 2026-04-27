-- 1. ChangeRequest
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeRequestStatus') THEN
    CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ChangeRequest" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "resource"      TEXT NOT NULL,
    "resourceId"    TEXT NOT NULL,
    "resourceTitle" TEXT,
    "fieldName"     TEXT NOT NULL,
    "oldValue"      TEXT,
    "newValue"      TEXT NOT NULL,
    "reason"        TEXT NOT NULL,
    "status"        "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById"  TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "reviewerNote"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChangeRequest_code_key" ON "ChangeRequest"("code");
CREATE INDEX IF NOT EXISTS "ChangeRequest_status_idx" ON "ChangeRequest"("status");
CREATE INDEX IF NOT EXISTS "ChangeRequest_resource_resourceId_idx" ON "ChangeRequest"("resource","resourceId");
CREATE INDEX IF NOT EXISTS "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangeRequest_requestedById_fkey') THEN
    ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangeRequest_reviewedById_fkey') THEN
    ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. StrategicPlan freeze fields
ALTER TABLE "StrategicPlan"
  ADD COLUMN IF NOT EXISTS "frozenAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozenById"   TEXT,
  ADD COLUMN IF NOT EXISTS "freezeReason" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StrategicPlan_frozenById_fkey') THEN
    ALTER TABLE "StrategicPlan" ADD CONSTRAINT "StrategicPlan_frozenById_fkey"
      FOREIGN KEY ("frozenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. KpiEntry approval fields
ALTER TABLE "KpiEntry"
  ADD COLUMN IF NOT EXISTS "entryStatus"     TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submittedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedById"    TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiEntry_approvedById_fkey') THEN
    ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. تحويل القراءات السابقة لـ APPROVED
UPDATE "KpiEntry" SET "entryStatus" = 'APPROVED' WHERE "entryStatus" = 'DRAFT';
