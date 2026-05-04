-- Refine optional activity-to-indicator links.
-- Some activities are operational commitments that should be tracked directly,
-- not forced into an unrelated supporting KPI.

UPDATE "OperationalActivity"
SET "indicatorId" = NULL
WHERE "deletedAt" IS NULL
  AND code IN ('ACT-2026-021', 'ACT-2026-022')
  AND "indicatorId" IS NOT NULL;
