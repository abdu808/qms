-- Migration 004 — SurveyResponse: فهارس مركّبة لجدول الردود الجديد
--
-- السياق: استبدال Survey.resultsJson (JSON blob متنامٍ) بجدول SurveyResponse علائقي.
-- الجدول نفسه تنشئه `prisma db push` من schema.prisma.
-- هذا الملف يضيف فهرسين مركّبَيْن لا يمكن لـ Prisma DSL التعبير عنهما.
--
-- ⚠️ ترتيب التطبيق الإجباري:
--   1) npx prisma db push --skip-generate        (ينشئ جدول SurveyResponse)
--   2) psql "$DATABASE_URL" -f migrations-manual/004_survey_response_table.sql
--   3) node scripts/backfill-survey-responses.mjs (يرحّل البيانات الموجودة)
--   4) تحقق: الاستعلام أدناه يجب أن يُرجع 0 صفوف
--   5) نشر الكود المحدَّث (publicSurvey.js + surveys.js)
--
-- استعلام التحقق من صحة البيانات بعد الترحيل:
--   SELECT s.id, s.responses, COUNT(r.id) AS actual,
--          s.responses - COUNT(r.id) AS discrepancy
--   FROM "Survey" s
--   LEFT JOIN "SurveyResponse" r ON r."surveyId" = s.id
--   WHERE s."deletedAt" IS NULL
--   GROUP BY s.id, s.responses
--   HAVING s.responses != COUNT(r.id);
--   -- يجب أن يُرجع 0 صفوف

BEGIN;

-- فهرس 1: كشف التكرار — WHERE surveyId=? AND idHash=? AND submittedAt >= ?
CREATE INDEX IF NOT EXISTS "survey_response_dedup_idx"
  ON "SurveyResponse"("surveyId", "idHash", "submittedAt");

-- فهرس 2: الاتجاه الزمني — GROUP BY month، ORDER BY submittedAt
CREATE INDEX IF NOT EXISTS "survey_response_trend_idx"
  ON "SurveyResponse"("surveyId", "submittedAt");

COMMIT;

-- Rollback:
-- BEGIN;
-- DROP INDEX IF EXISTS "survey_response_dedup_idx";
-- DROP INDEX IF EXISTS "survey_response_trend_idx";
-- COMMIT;
