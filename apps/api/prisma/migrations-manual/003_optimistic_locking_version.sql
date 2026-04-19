-- Migration 3 — Optimistic Locking (schema-audit.md §3)
-- الهدف: منع race conditions عند اعتماد/إغلاق الوثائق والـ NCR والشكاوى.
-- الآلية: عمود `version` يتزايد مع كل UPDATE. الـ service يشترط version القديم في WHERE.
-- إن سبق طرف آخر → UPDATE يُرجع 0 صفوف → يُلقى Conflict 409.
--
-- ⚠️ قبل التطبيق:
--   1) تحديث Prisma schema بإضافة `version Int @default(0)` في Document / NCR / Complaint.
--   2) تحديث services:
--        documentApproval.js  — يضيف where: { id, version } + data: { version: { increment: 1 } }
--        ncrClosure.js        — نفس النمط
--        complaintLifecycle.js — نفس النمط
--   3) التقاط P2025 (RecordNotFound) في asyncHandler → Conflict 409
--      "تغيّرت البيانات من طرف آخر، أعد التحميل"

BEGIN;

ALTER TABLE "Document"  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NCR"       ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- Rollback:
-- BEGIN;
-- ALTER TABLE "Document"  DROP COLUMN IF EXISTS "version";
-- ALTER TABLE "NCR"       DROP COLUMN IF EXISTS "version";
-- ALTER TABLE "Complaint" DROP COLUMN IF EXISTS "version";
-- COMMIT;
