-- Migration 2 — Supplier.crNumber / vatNumber Partial Unique (schema-audit.md §6)
-- الهدف: منع تكرار السجل التجاري أو الرقم الضريبي بين الموردين النشطين.
--
-- ⚠️ قبل التطبيق:
--   SELECT "crNumber", COUNT(*) FROM "Supplier"
--     WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL
--     GROUP BY "crNumber" HAVING COUNT(*) > 1;
--   (كرّرها لـ vatNumber). يجب أن تُرجع 0.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_crNumber_active_unique"
  ON "Supplier"("crNumber")
  WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_vatNumber_active_unique"
  ON "Supplier"("vatNumber")
  WHERE "vatNumber" IS NOT NULL AND "deletedAt" IS NULL;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS "supplier_crNumber_active_unique";
-- DROP INDEX IF EXISTS "supplier_vatNumber_active_unique";
