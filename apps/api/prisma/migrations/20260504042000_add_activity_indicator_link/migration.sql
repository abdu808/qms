-- Link operational activities to supporting/independent indicators.
-- This keeps the formal hierarchy light while allowing procedural activities
-- to declare which KPI they serve.

ALTER TABLE "OperationalActivity" ADD COLUMN IF NOT EXISTS "indicatorId" TEXT;

CREATE INDEX IF NOT EXISTS "OperationalActivity_indicatorId_idx"
  ON "OperationalActivity"("indicatorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OperationalActivity_indicatorId_fkey'
  ) THEN
    ALTER TABLE "OperationalActivity"
      ADD CONSTRAINT "OperationalActivity_indicatorId_fkey"
      FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Initial links for the approved 2025-2027 plan.
-- These updates are intentionally text-based so the migration can run safely
-- across environments where generated IDs differ.
UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%إيصال الدعم للأسر العاجزة عن الحضور%'
  AND i."nameAr" LIKE '%أوامر الصرف والتوزيع%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%اعتماد سياسة تخصيص الاستثمار%'
  AND i."nameAr" LIKE '%عدد الاستثمارات الجديدة المنجزة%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%تحصيل مستحقات الأصول إلكترونياً%'
  AND i."nameAr" LIKE '%عائد الاستثمارات القائمة%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%ترشيد الإنفاق التشغيلي%'
  AND i."nameAr" LIKE '%المصاريف الإدارية%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%تدقيق داخلي استعدادي%'
  AND i."nameAr" LIKE '%توثيق الأدلة التنظيمية%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%مراجعة إدارية رسمية%'
  AND i."nameAr" LIKE '%تقرير الحوكمة السنوي%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%سجل عدم المطابقة%'
  AND i."nameAr" LIKE '%اكتمال تطوير السياسات والإجراءات%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%تقارير الأثر الشهرية%'
  AND i."nameAr" LIKE '%رضا المستفيدين%';

UPDATE "OperationalActivity" a
SET "indicatorId" = i.id
FROM "Indicator" i
WHERE a."deletedAt" IS NULL
  AND i."deletedAt" IS NULL
  AND a."indicatorId" IS NULL
  AND a.title LIKE '%اجتماعات المراجعة الشهرية%'
  AND i."nameAr" LIKE '%عدد الفعاليات الكبرى%';

-- Simplify the execution hierarchy:
-- 1) Indicators remain the measurable layer.
-- 2) Activities become the practical execution layer.
-- 3) Synthetic operational objectives generated only as "average KPI completion"
--    are archived so the user does not see duplicate conceptual layers.
WITH synthetic_objectives AS (
  SELECT id
  FROM "Objective"
  WHERE "deletedAt" IS NULL
    AND title LIKE 'هدف تشغيلي:%'
    AND kpi LIKE 'متوسط إنجاز مؤشرات الهدف%'
)
UPDATE "Indicator" i
SET "objectiveId" = NULL
WHERE i."objectiveId" IN (SELECT id FROM synthetic_objectives);

UPDATE "Objective"
SET "deletedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND title LIKE 'هدف تشغيلي:%'
  AND kpi LIKE 'متوسط إنجاز مؤشرات الهدف%';
