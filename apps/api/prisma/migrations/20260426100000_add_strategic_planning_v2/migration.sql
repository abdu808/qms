-- Migration: add_strategic_planning_v2
-- Adds: Axis, Indicator, AnnualTarget, Initiative, FundingSource, FundingPlan, StrategicPlanVersion
-- Modifies: StrategicGoal, Risk, ImprovementProject, KpiEntry
-- NOTE: StrategicGoal.initiatives is RENAMED (not dropped) to legacyInitiatives to preserve data.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rename existing text field to preserve data (safe rename, NOT drop+add)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "StrategicGoal" RENAME COLUMN "initiatives" TO "legacyInitiatives";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add new columns to existing tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "StrategicGoal"
  ADD COLUMN "axisId" TEXT,
  ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Risk"
  ADD COLUMN "earlyWarning" TEXT;

ALTER TABLE "ImprovementProject"
  ADD COLUMN "strategicGoalId" TEXT,
  ADD COLUMN "budget" DOUBLE PRECISION,
  ADD COLUMN "spent" DOUBLE PRECISION;

ALTER TABLE "KpiEntry"
  ADD COLUMN "indicatorId" TEXT;

-- Fix updatedAt on StrategicPlan (remove default — Prisma manages this)
ALTER TABLE "StrategicPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add FK for ConsultSession (was created without FK in previous db push)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only add FK if both the table and User table exist and the constraint doesn't yet
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ConsultSession'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ConsultSession_userId_fkey'
  ) THEN
    ALTER TABLE "ConsultSession"
      ADD CONSTRAINT "ConsultSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- BSC Axes
CREATE TABLE "Axis" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "nameAr"    TEXT NOT NULL,
    "nameEn"    TEXT,
    "color"     TEXT,
    "weight"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Axis_pkey" PRIMARY KEY ("id")
);

-- Strategic Indicators
CREATE TABLE "Indicator" (
    "id"               TEXT NOT NULL,
    "code"             TEXT NOT NULL,
    "nameAr"           TEXT NOT NULL,
    "nameEn"           TEXT,
    "definition"       TEXT,
    "formula"          TEXT,
    "unit"             TEXT,
    "direction"        TEXT NOT NULL DEFAULT 'HIGHER_BETTER',
    "frequency"        TEXT NOT NULL DEFAULT 'MONTHLY',
    "kpiType"          TEXT NOT NULL DEFAULT 'SNAPSHOT',
    "seasonality"      TEXT NOT NULL DEFAULT 'UNIFORM',
    "indicatorType"    TEXT NOT NULL DEFAULT 'LAGGING',
    "dataSource"       TEXT,
    "baseline"         DOUBLE PRECISION,
    "weight"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "greenThreshold"   DOUBLE PRECISION NOT NULL DEFAULT 95,
    "yellowThreshold"  DOUBLE PRECISION NOT NULL DEFAULT 75,
    "isoClause"        TEXT,
    "nationalStandard" TEXT,
    "notes"            TEXT,
    "objectiveId"      TEXT,
    "ownerId"          TEXT,
    "dataEntryUserId"  TEXT,
    "approverUserId"   TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "deletedAt"        TIMESTAMP(3),
    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- Annual Targets (one per indicator per year)
CREATE TABLE "AnnualTarget" (
    "id"                 TEXT NOT NULL,
    "indicatorId"        TEXT NOT NULL,
    "year"               INTEGER NOT NULL,
    "targetValue"        DOUBLE PRECISION NOT NULL,
    "q1Target"           DOUBLE PRECISION,
    "q2Target"           DOUBLE PRECISION,
    "q3Target"           DOUBLE PRECISION,
    "q4Target"           DOUBLE PRECISION,
    "modificationReason" TEXT,
    "createdById"        TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnualTarget_pkey" PRIMARY KEY ("id")
);

-- Strategic Initiatives (replaces legacyInitiatives text)
CREATE TABLE "Initiative" (
    "id"           TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "goalId"       TEXT NOT NULL,
    "ownerId"      TEXT,
    "departmentId" TEXT,
    "startDate"    TIMESTAMP(3),
    "endDate"      TIMESTAMP(3),
    "budget"       DOUBLE PRECISION,
    "spent"        DOUBLE PRECISION,
    "progress"     INTEGER NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),
    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- Funding Sources (reference table)
CREATE TABLE "FundingSource" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);

-- Funding Plans (per plan per source per year)
CREATE TABLE "FundingPlan" (
    "id"                 TEXT NOT NULL,
    "planId"             TEXT NOT NULL,
    "sourceId"           TEXT NOT NULL,
    "year"               INTEGER NOT NULL,
    "expectedAmount"     DOUBLE PRECISION NOT NULL,
    "actualAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concentrationLimit" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundingPlan_pkey" PRIMARY KEY ("id")
);

-- Strategic Plan Versions (snapshots)
CREATE TABLE "StrategicPlanVersion" (
    "id"          TEXT NOT NULL,
    "planId"      TEXT NOT NULL,
    "version"     INTEGER NOT NULL,
    "snapshot"    JSONB NOT NULL,
    "reason"      TEXT,
    "trigger"     TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategicPlanVersion_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Unique constraints
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "Axis_code_key"                        ON "Axis"("code");
CREATE UNIQUE INDEX "Indicator_code_key"                   ON "Indicator"("code");
CREATE UNIQUE INDEX "AnnualTarget_indicatorId_year_key"    ON "AnnualTarget"("indicatorId", "year");
CREATE UNIQUE INDEX "Initiative_code_key"                  ON "Initiative"("code");
CREATE UNIQUE INDEX "FundingSource_code_key"               ON "FundingSource"("code");
CREATE UNIQUE INDEX "FundingPlan_planId_sourceId_year_key" ON "FundingPlan"("planId", "sourceId", "year");
CREATE UNIQUE INDEX "StrategicPlanVersion_planId_version_key" ON "StrategicPlanVersion"("planId", "version");
CREATE UNIQUE INDEX "KpiEntry_indicatorId_year_month_key"  ON "KpiEntry"("indicatorId", "year", "month");

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Regular indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX "Axis_deletedAt_idx"                      ON "Axis"("deletedAt");
CREATE INDEX "Indicator_objectiveId_idx"               ON "Indicator"("objectiveId");
CREATE INDEX "Indicator_ownerId_idx"                   ON "Indicator"("ownerId");
CREATE INDEX "Indicator_deletedAt_idx"                 ON "Indicator"("deletedAt");
CREATE INDEX "AnnualTarget_indicatorId_idx"            ON "AnnualTarget"("indicatorId");
CREATE INDEX "Initiative_goalId_idx"                   ON "Initiative"("goalId");
CREATE INDEX "Initiative_ownerId_idx"                  ON "Initiative"("ownerId");
CREATE INDEX "Initiative_deletedAt_idx"                ON "Initiative"("deletedAt");
CREATE INDEX "FundingPlan_planId_idx"                  ON "FundingPlan"("planId");
CREATE INDEX "FundingPlan_sourceId_idx"                ON "FundingPlan"("sourceId");
CREATE INDEX "StrategicPlanVersion_planId_idx"         ON "StrategicPlanVersion"("planId");
CREATE INDEX "ImprovementProject_strategicGoalId_idx"  ON "ImprovementProject"("strategicGoalId");
CREATE INDEX "KpiEntry_indicatorId_idx"                ON "KpiEntry"("indicatorId");
CREATE INDEX "StrategicGoal_axisId_idx"                ON "StrategicGoal"("axisId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Foreign key constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "StrategicGoal"
  ADD CONSTRAINT "StrategicGoal_axisId_fkey"
    FOREIGN KEY ("axisId") REFERENCES "Axis"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "StrategicGoal_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImprovementProject"
  ADD CONSTRAINT "ImprovementProject_strategicGoalId_fkey"
    FOREIGN KEY ("strategicGoalId") REFERENCES "StrategicGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KpiEntry"
  ADD CONSTRAINT "KpiEntry_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Indicator"
  ADD CONSTRAINT "Indicator_objectiveId_fkey"
    FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Indicator_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Indicator_dataEntryUserId_fkey"
    FOREIGN KEY ("dataEntryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Indicator_approverUserId_fkey"
    FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnnualTarget"
  ADD CONSTRAINT "AnnualTarget_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AnnualTarget_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Initiative"
  ADD CONSTRAINT "Initiative_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "StrategicGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Initiative_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Initiative_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FundingPlan"
  ADD CONSTRAINT "FundingPlan_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "StrategicPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FundingPlan_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "FundingSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StrategicPlanVersion"
  ADD CONSTRAINT "StrategicPlanVersion_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "StrategicPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StrategicPlanVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
