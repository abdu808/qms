-- Migration 007: Progress Reports + Investigation Flags
-- المحقق الشهري (Digital Quality Employee)

-- Enums
DO $$ BEGIN
  CREATE TYPE "ProgressReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FlagType" AS ENUM ('CONTRADICTION', 'OVERDUE_PROMISE', 'TREND_DROP', 'ANOMALY', 'MISSING_DATA', 'BEHAVIORAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ProgressReport
CREATE TABLE IF NOT EXISTS "ProgressReport" (
  "id"             TEXT PRIMARY KEY,
  "departmentId"   TEXT NOT NULL,
  "year"           INTEGER NOT NULL,
  "month"          INTEGER NOT NULL,
  "status"         "ProgressReportStatus" NOT NULL DEFAULT 'DRAFT',
  "autoFilled"     TEXT NOT NULL,
  "deptFilled"     TEXT,
  "aiQuestions"    TEXT NOT NULL,
  "score"          INTEGER,
  "scoreBreakdown" TEXT,
  "submittedAt"    TIMESTAMP(3),
  "submittedById"  TEXT,
  "approvedAt"     TIMESTAMP(3),
  "approvedById"   TEXT,
  "returnedAt"     TIMESTAMP(3),
  "returnedReason" TEXT,
  "extractedPromises" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"      TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgressReport_departmentId_year_month_key" ON "ProgressReport"("departmentId","year","month");
CREATE INDEX IF NOT EXISTS "ProgressReport_departmentId_idx" ON "ProgressReport"("departmentId");
CREATE INDEX IF NOT EXISTS "ProgressReport_status_idx" ON "ProgressReport"("status");
CREATE INDEX IF NOT EXISTS "ProgressReport_year_month_idx" ON "ProgressReport"("year","month");
CREATE INDEX IF NOT EXISTS "ProgressReport_deletedAt_idx" ON "ProgressReport"("deletedAt");

-- InvestigationFlag
CREATE TABLE IF NOT EXISTS "InvestigationFlag" (
  "id"             TEXT PRIMARY KEY,
  "reportId"       TEXT,
  "departmentId"   TEXT,
  "type"           "FlagType" NOT NULL,
  "severity"       "FlagSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status"         "FlagStatus" NOT NULL DEFAULT 'OPEN',
  "title"          TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "evidence"       TEXT,
  "aiGenerated"    BOOLEAN NOT NULL DEFAULT TRUE,
  "resolvedAt"     TIMESTAMP(3),
  "resolvedById"   TEXT,
  "resolutionNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestigationFlag_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProgressReport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "InvestigationFlag_departmentId_idx" ON "InvestigationFlag"("departmentId");
CREATE INDEX IF NOT EXISTS "InvestigationFlag_status_idx" ON "InvestigationFlag"("status");
CREATE INDEX IF NOT EXISTS "InvestigationFlag_type_idx" ON "InvestigationFlag"("type");
CREATE INDEX IF NOT EXISTS "InvestigationFlag_reportId_idx" ON "InvestigationFlag"("reportId");
