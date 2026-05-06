-- External consultant pass: close the execution/connectivity gaps without changing
-- the approved 2025-2027 strategic plan identity.

-- 1) Add one practical 2026 activity for each strategic goal that had no
-- activity. Codes start at 101 to avoid collisions with user-entered activities.
INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_001_2026', 'ACT-2026-101',
  'تحديث ومراجعة بيانات الكفالات والأيتام والكافلين شهرياً',
  'نشاط شهري خفيف لضمان بقاء قوائم الأيتام والكافلين محدثة، ومراجعة حالات التوقف أو التغير قبل رفع قراءة المؤشر.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 12, 'مراجعة', 'UNIFORM', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-022' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%خاتمة%' AND u.active = true
JOIN "Department" d ON d.code = 'SOC'
WHERE g.code = 'SG25-001' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_003_2026', 'ACT-2026-102',
  'تنفيذ مسارات التمكين والتأهيل للأسر القابلة للتمكين',
  'تحديد الأسر القابلة للتمكين، ترشيحها للتدريب أو التوظيف أو المشاريع الصغيرة، وتوثيق مخرجات كل مسار.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 4, 'مسارات', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-032' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%خاتمة%' AND u.active = true
JOIN "Department" d ON d.code = 'SOC'
WHERE g.code = 'SG25-003' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_004_2026', 'ACT-2026-103',
  'تنفيذ خطة تنمية الإيرادات غير المقيدة والمتجر الإلكتروني',
  'متابعة حملات التبرع والمتجر الإلكتروني ومصادر الإيرادات غير المقيدة، مع تقرير مختصر يوضح النمو والعوائق.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 4, 'مراجعات', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-035' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%ناديه%' AND u.active = true
JOIN "Department" d ON d.code = 'RES'
WHERE g.code = 'SG25-004' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_008_2026', 'ACT-2026-104',
  'رقمنة العمليات ذات الأولوية في الإدارة والمالية والجودة',
  'اختيار العمليات ذات الأولوية، توثيق الوضع الحالي، تنفيذ التحسين الرقمي، وقياس نسبة الإنجاز دون تعميم غير واقعي على جميع عمليات الجمعية.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 4, 'حزم', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-048' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%خليل%' AND u.active = true
JOIN "Department" d ON d.code = 'IT'
WHERE g.code = 'SG25-008' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_009_2026', 'ACT-2026-105',
  'إصدار تقرير الحوكمة ومراجعة الالتزام المؤسسي',
  'تجميع أدلة الحوكمة والامتثال، مراجعة الفجوات، وإصدار تقرير سنوي مختصر قابل للعرض على الإدارة.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'BINARY', 1, 'تقرير', 'UNIFORM', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-051' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%ايلاف%' AND u.active = true
JOIN "Department" d ON d.code = 'QM'
WHERE g.code = 'SG25-009' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_010_2026', 'ACT-2026-106',
  'تنفيذ خطة التدريب ورفع كفاءة الموظفين ذات الأولوية',
  'خطة تدريب عملية مرتبطة باحتياج الأقسام ونظام الجودة، مع قياس ساعات التدريب والمخرجات دون إرهاق الفريق.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 4, 'متابعات', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-052' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%خليل%' AND u.active = true
JOIN "Department" d ON d.code = 'SUP'
WHERE g.code = 'SG25-010' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_011_2026', 'ACT-2026-107',
  'تفعيل مسار الشراكات المجتمعية وتوثيق العائد',
  'متابعة الشراكات الفعالة وتوثيق العائد المالي أو العيني بالتنسيق بين الاتصال المؤسسي وتنمية الموارد.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف ضمن جولة ضبط الترابط الخارجي: هدف ← نشاط ← مؤشر، لتسهيل التنفيذ والمتابعة دون تعقيد.',
  g.id, i.id, 'CUMULATIVE', 4, 'متابعات', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-054' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%فاطمة%' AND u.active = true
JOIN "Department" d ON d.code = 'COM'
WHERE g.code = 'SG25-011' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

-- 2) Link the three weak/orphan activities to the closest goal and indicator.
UPDATE "OperationalActivity" a
SET "strategicGoalId" = g.id,
    "indicatorId" = i.id,
    "ownerId" = u.id,
    "deptId" = d.id,
    perspective = g.perspective,
    department = d.name,
    responsible = u.name,
    notes = CASE WHEN COALESCE(a.notes, '') LIKE '%تم ربط النشاط بهدف نظام الجودة%'
      THEN a.notes ELSE CONCAT(COALESCE(a.notes || E'\n', ''), 'تم ربط النشاط بهدف نظام الجودة ومؤشر توثيق الأدلة التنظيمية ضمن ضبط الترابط.') END,
    "updatedAt" = NOW()
FROM "StrategicGoal" g, "Indicator" i, "User" u, "Department" d
WHERE a.code = 'ACT-2026-023'
  AND g.code = 'SG25-007'
  AND i.code = 'IND-2026-046'
  AND u.name LIKE '%ايلاف%'
  AND d.code = 'QM';

UPDATE "OperationalActivity" a
SET "strategicGoalId" = g.id,
    "indicatorId" = i.id,
    "ownerId" = u.id,
    "deptId" = d.id,
    perspective = g.perspective,
    department = d.name,
    responsible = u.name,
    notes = CASE WHEN COALESCE(a.notes, '') LIKE '%متابعة إدارية شهرية%'
      THEN a.notes ELSE CONCAT(COALESCE(a.notes || E'\n', ''), 'تم نقله من الاتصال المؤسسي إلى التميز والحوكمة لأنه يمثل متابعة إدارية شهرية لا نشاط اتصال.') END,
    "updatedAt" = NOW()
FROM "StrategicGoal" g, "Indicator" i, "User" u, "Department" d
WHERE a.code = 'ACT-2026-022'
  AND g.code = 'SG25-009'
  AND i.code = 'IND-2026-050'
  AND u.name LIKE '%عبد الرحمن بن محمد%'
  AND d.code = 'ADM';

UPDATE "OperationalActivity" a
SET "strategicGoalId" = g.id,
    "indicatorId" = i.id,
    "ownerId" = u.id,
    "deptId" = d.id,
    perspective = g.perspective,
    department = d.name,
    responsible = u.name,
    notes = CASE WHEN COALESCE(a.notes, '') LIKE '%تقارير الأثر بتحسين تجربة%'
      THEN a.notes ELSE CONCAT(COALESCE(a.notes || E'\n', ''), 'تم ربط تقارير الأثر بتحسين تجربة برامج الرعاية ورضا المستفيدين، مع بقاء التنفيذ لدى الاتصال المؤسسي.') END,
    "updatedAt" = NOW()
FROM "StrategicGoal" g, "Indicator" i, "User" u, "Department" d
WHERE a.code = 'ACT-2026-021'
  AND g.code = 'SG25-002'
  AND i.code = 'IND-2026-031'
  AND u.name LIKE '%فاطمة%'
  AND d.code = 'COM';

-- 3) Give every indicator a clear 2025 baseline when missing. Existing baselines
-- are preserved. Estimated baselines are explicitly marked in notes.
WITH estimated AS (
  SELECT
    i.id,
    CASE
      WHEN i.baseline IS NOT NULL THEN i.baseline
      WHEN i.direction = 'LOWER_BETTER' THEN (ROUND((t."targetValue" * 1.10)::numeric, 2))::double precision
      ELSE (ROUND((t."targetValue" * 0.90)::numeric, 2))::double precision
    END AS baseline_value
  FROM "Indicator" i
  JOIN "AnnualTarget" t ON t."indicatorId" = i.id AND t.year = 2026
  WHERE i."deletedAt" IS NULL
)
UPDATE "Indicator" i
SET baseline = e.baseline_value,
    notes = CASE WHEN COALESCE(i.notes, '') LIKE '%خط أساس تقديري 2025%'
      THEN i.notes ELSE CONCAT(COALESCE(i.notes || E'\n', ''), 'خط أساس تقديري 2025: أضيف لغرض بدء المتابعة والمقارنة، ويُستبدل عند توفر قراءة موثقة لعام 2025.') END,
    "updatedAt" = NOW()
FROM estimated e
WHERE i.id = e.id
  AND i.baseline IS NULL;

-- 4) Create a 2025 reference target for every indicator. Cumulative indicators get
-- progressive quarter targets; snapshot/periodic/binary indicators repeat the
-- reference value to avoid false cumulative interpretation.
INSERT INTO "AnnualTarget" (
  id, "indicatorId", year, "targetValue", "q1Target", "q2Target", "q3Target", "q4Target",
  "modificationReason", "createdById", "createdAt", "updatedAt"
)
SELECT
  CONCAT('at2025_', REPLACE(i.code, '-', '_')) AS id,
  i.id,
  2025,
  i.baseline,
  CASE WHEN i."kpiType" = 'CUMULATIVE' THEN (ROUND((i.baseline * 0.25)::numeric, 2))::double precision ELSE i.baseline END,
  CASE WHEN i."kpiType" = 'CUMULATIVE' THEN (ROUND((i.baseline * 0.50)::numeric, 2))::double precision ELSE i.baseline END,
  CASE WHEN i."kpiType" = 'CUMULATIVE' THEN (ROUND((i.baseline * 0.75)::numeric, 2))::double precision ELSE i.baseline END,
  i.baseline,
  'خط أساس/مستهدف مرجعي 2025 لإغلاق سنة الأساس قبل تشغيل متابعة 2026؛ قابل للاستبدال عند إدخال القراءة الموثقة.',
  u.id,
  NOW(),
  NOW()
FROM "Indicator" i
CROSS JOIN LATERAL (
  SELECT id FROM "User"
  WHERE active = true AND role = 'SUPER_ADMIN'
  ORDER BY "createdAt" ASC
  LIMIT 1
) u
WHERE i."deletedAt" IS NULL
  AND i.baseline IS NOT NULL
ON CONFLICT ("indicatorId", year) DO NOTHING;
