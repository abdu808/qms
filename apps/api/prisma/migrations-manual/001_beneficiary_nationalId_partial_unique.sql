-- Migration 1 — Beneficiary.nationalId Partial Unique (ISO 9.1 / schema-audit.md §6)
-- الحالة الحالية: nationalId String? @unique  →  يمنع تكرار NULL حسب SQL، لكنه لا يسمح
-- بإعادة تسجيل نفس الهوية بعد soft-delete (deletedAt != null).
--
-- الهدف: السماح بإعادة تسجيل المستفيد إذا كان السجل السابق قد حُذف softly.
-- كذلك يبقى يمنع التكرار الحقيقي بين السجلات النشطة.
--
-- ⚠️ قبل التطبيق:
--   1) SELECT nationalId, COUNT(*) FROM "Beneficiary"
--        WHERE "nationalId" IS NOT NULL AND "deletedAt" IS NULL
--        GROUP BY "nationalId" HAVING COUNT(*) > 1;
--      يجب أن تُرجع 0 صفوف — وإلا نظّف التكرار أولاً.
--   2) نسخ احتياطي (pg_dump).
--
-- ⚠️ Prisma schema: يلزم إزالة `@unique` من `nationalId` في schema.prisma
--    واستبداله بتعليق يوضّح أن القيد partial index يُدار يدوياً.

BEGIN;

-- 1) احذف الـ unique القديم (الاسم الافتراضي من Prisma)
ALTER TABLE "Beneficiary" DROP CONSTRAINT IF EXISTS "Beneficiary_nationalId_key";
DROP INDEX IF EXISTS "Beneficiary_nationalId_key";

-- 2) أنشئ partial unique index يحترم soft-delete
CREATE UNIQUE INDEX IF NOT EXISTS "beneficiary_nationalId_active_unique"
  ON "Beneficiary"("nationalId")
  WHERE "nationalId" IS NOT NULL AND "deletedAt" IS NULL;

-- 3) فهرس بحث عام (non-unique) للاستعلامات التاريخية
CREATE INDEX IF NOT EXISTS "beneficiary_nationalId_idx"
  ON "Beneficiary"("nationalId")
  WHERE "nationalId" IS NOT NULL;

COMMIT;

-- Rollback:
-- BEGIN;
-- DROP INDEX IF EXISTS "beneficiary_nationalId_active_unique";
-- DROP INDEX IF EXISTS "beneficiary_nationalId_idx";
-- ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_nationalId_key" UNIQUE ("nationalId");
-- COMMIT;
