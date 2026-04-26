-- Migration: 009_kpientry_fk_check
-- Adds a CHECK constraint to enforce that every KpiEntry row has EXACTLY ONE of
-- objectiveId, activityId, or indicatorId set (never zero, never two).
--
-- PREREQUISITE: Before running this, verify there are no orphan rows:
--   SELECT COUNT(*) FROM "KpiEntry"
--   WHERE "objectiveId" IS NULL AND "activityId" IS NULL AND "indicatorId" IS NULL;
-- Must return 0.
--
-- Apply manually:
--   psql $DATABASE_URL -f apps/api/prisma/migrations-manual/009_kpientry_fk_check.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'kpientry_exactly_one_fk'
      AND table_name = 'KpiEntry'
  ) THEN
    ALTER TABLE "KpiEntry"
      ADD CONSTRAINT "kpientry_exactly_one_fk" CHECK (
        (CASE WHEN "objectiveId"  IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "activityId"   IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "indicatorId"  IS NOT NULL THEN 1 ELSE 0 END) = 1
      );
    RAISE NOTICE 'Constraint kpientry_exactly_one_fk added.';
  ELSE
    RAISE NOTICE 'Constraint kpientry_exactly_one_fk already exists — skipped.';
  END IF;
END $$;
