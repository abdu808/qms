-- Remove annual targets attached to archived/deleted indicators.
-- AnnualTarget has no deletedAt column, so orphaned targets remain visible
-- unless explicitly removed. This keeps the target list aligned with the
-- active indicator set.

DELETE FROM "AnnualTarget" t
USING "Indicator" i
WHERE t."indicatorId" = i.id
  AND i."deletedAt" IS NOT NULL;
