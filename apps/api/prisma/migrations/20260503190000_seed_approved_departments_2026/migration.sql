-- Seed the approved 2026 organizational departments.
-- This migration is intentionally limited to department master data only:
-- no employees, no emails, no temporary passwords.

INSERT INTO "Department" ("id", "code", "name", "nameEn", "manager", "active", "createdAt", "updatedAt")
VALUES
  ('dept_adm_2026', 'ADM', 'الإدارة التنفيذية', 'Executive Management', 'المدير التنفيذي', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_fin_2026', 'FIN', 'الإدارة المالية', 'Finance', 'مدير الإدارة المالية', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_sup_2026', 'SUP', 'إدارة الدعم المؤسسي', 'Institutional Support', 'مدير الدعم المؤسسي', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_res_2026', 'RES', 'إدارة تنمية الموارد والمشاريع', 'Resource Development and Projects', 'مدير تنمية الموارد والمشاريع', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_com_2026', 'COM', 'إدارة الاتصال المؤسسي والشراكات', 'Corporate Communication and Partnerships', 'مدير الاتصال المؤسسي والشراكات', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_soc_2026', 'SOC', 'إدارة الخدمة المجتمعية', 'Community Service', 'مدير الخدمة المجتمعية', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_qm_2026', 'QM', 'وحدة الاستراتيجية والتميز المؤسسي', 'Strategy and Institutional Excellence', 'مدير الجودة والتميز', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_wh_2026', 'WH', 'إدارة المساعدات العينية والمستودع', 'In-kind Aid and Warehouse', 'مدير المساعدات العينية والمستودع', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_trn_2026', 'TRN', 'مركز التدريب والتأهيل', 'Training and Rehabilitation Center', 'مدير مركز التدريب والتأهيل', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_it_2026', 'IT', 'قسم تقنية المعلومات', 'Information Technology', 'مسؤول تقنية المعلومات', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_inv_2026', 'INV', 'وحدة الاستثمار', 'Investment Unit', 'مسؤول الاستثمار', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "nameEn" = EXCLUDED."nameEn",
  "manager" = EXCLUDED."manager",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
