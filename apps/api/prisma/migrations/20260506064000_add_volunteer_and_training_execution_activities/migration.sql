-- Complete execution coverage after moving generic monthly-review activities to
-- their correct goals. These activities are lightweight and practical, not extra
-- strategic layers.

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_sg25_012_2026', 'ACT-2026-108',
  'تنظيم فرص التطوع التخصصي والفعاليات المجتمعية',
  'تحديد فرص التطوع التخصصي والفعاليات الكبرى، توثيق المشاركين والمخرجات، وربط الأثر بتقرير اتصال مؤسسي مختصر.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'أضيف لإغلاق فجوة تنفيذ هدف التطوع والاتصال المؤسسي بعد نقل الأنشطة العامة إلى أهدافها الصحيحة.',
  g.id, i.id, 'CUMULATIVE', 4, 'فعاليات/فرص', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-056' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%فاطمة%' AND u.active = true
JOIN "Department" d ON d.code = 'COM'
WHERE g.code = 'SG25-012' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO "OperationalActivity" (
  id, code, title, description, perspective, department, responsible, year,
  "startDate", "endDate", budget, spent, progress, status, notes,
  "strategicGoalId", "indicatorId", "kpiType", "targetValue", "targetUnit",
  seasonality, direction, "ownerId", "deptId", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'act_consult_trn_2026', 'ACT-2026-109',
  'تنفيذ الدورات التدريبية المعتمدة للموظفين',
  'تنفيذ الدورات المعتمدة من خطة التدريب، وتوثيق الحضور والمخرجات التدريبية بما يدعم مؤشر ساعات التدريب لكل موظف.',
  g.perspective, d.name, u.name, 2026,
  DATE '2026-01-01', DATE '2026-12-31', 0, 0, 0, 'PLANNED',
  'نشاط داعم يربط المعهد والتدريب بمؤشر التدريب دون تحميله ملكية استراتيجية كاملة.',
  g.id, i.id, 'CUMULATIVE', 4, 'دفعات تدريب', 'QUARTERLY', 'HIGHER_BETTER',
  u.id, d.id, NOW(), NOW(), NULL
FROM "StrategicGoal" g
JOIN "Indicator" i ON i.code = 'IND-2026-052' AND i."deletedAt" IS NULL
JOIN "User" u ON u.name LIKE '%عماد%' AND u.active = true
JOIN "Department" d ON d.code = 'TRN'
WHERE g.code = 'SG25-010' AND g."deletedAt" IS NULL
ON CONFLICT (code) DO NOTHING;
