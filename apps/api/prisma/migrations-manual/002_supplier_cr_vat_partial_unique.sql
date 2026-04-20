-- Migration 2 — Supplier.crNumber / vatNumber Partial Unique (schema-audit.md §6)
-- الهدف: منع تكرار السجل التجاري أو الرقم الضريبي بين الموردين النشطين.
--
-- ⚠️ قبل التطبيق:
--   SELECT "crNumber", COUNT(*) FROM "Supplier"
--     WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL
--     GROUP BY "crNumber" HAVING COUNT(*) > 1;
--   (كرّرها لـ vatNumber). يجب أن تُرجع 0.

BEGIN;

-- إزالة التكرارات في crNumber قبل إنشاء الـ index (soft-delete للأقدم)
UPDATE "Supplier" SET "deletedAt" = NOW()
WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON ("crNumber") id FROM "Supplier"
    WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL
    ORDER BY "crNumber", "createdAt" DESC
  );

-- إزالة التكرارات في vatNumber
UPDATE "Supplier" SET "deletedAt" = NOW()
WHERE "vatNumber" IS NOT NULL AND "deletedAt" IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON ("vatNumber") id FROM "Supplier"
    WHERE "vatNumber" IS NOT NULL AND "deletedAt" IS NULL
    ORDER BY "vatNumber", "createdAt" DESC
  );

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
