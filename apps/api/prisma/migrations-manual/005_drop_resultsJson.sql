-- Migration 005 — حذف Survey.resultsJson (بعد استقرار SurveyResponse)
--
-- ⚠️ يُطبَّق بعد أسبوع على الأقل من نشر الكود الجديد والتحقق من صحة البيانات.
--
-- المتطلبات قبل التطبيق:
--   1) تطبيق migration 004 والتحقق من 0 discrepancy
--   2) نشر publicSurvey.js المحدَّث (يكتب إلى SurveyResponse فقط)
--   3) حذف `resultsJson String?` من schema.prisma
--      ثم: npx prisma generate (بدون db push — الحذف يتم هنا)
--   4) تشغيل هذا الملف:
--      psql "$DATABASE_URL" -f migrations-manual/005_drop_resultsJson.sql
--
-- تحقق نهائي قبل التطبيق (يجب أن لا توجد قيم غير null حديثة):
--   SELECT COUNT(*) FROM "Survey"
--   WHERE "resultsJson" IS NOT NULL
--   AND "updatedAt" > NOW() - INTERVAL '7 days';
--   -- يجب أن يُرجع 0

BEGIN;

ALTER TABLE "Survey" DROP COLUMN IF EXISTS "resultsJson";

COMMIT;

-- Rollback (البيانات لن تُستعاد — النسخ الاحتياطي هو الحل الوحيد):
-- BEGIN;
-- ALTER TABLE "Survey" ADD COLUMN "resultsJson" TEXT;
-- COMMIT;
