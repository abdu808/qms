INSERT INTO "NotificationTemplate" (
  "id",
  "eventKey",
  "name",
  "description",
  "subject",
  "body",
  "channels",
  "enabled",
  "category",
  "variables",
  "updatedAt"
)
VALUES (
  'tpl_kpi_qm_daily_summary',
  'KPI_QM_DAILY_SUMMARY',
  'ملخص يومي لمدير الجودة عن متابعات المؤشرات',
  'يرسل يومياً لمدير الجودة ومسؤول النظام عند وجود مؤشرات شهرية متأخرة أو مصعدة.',
  'ملخص متابعات المؤشرات المتأخرة: {{totalOverdue}}',
  'تحية طيبة {{managerName}},

ملخص متابعات المؤشرات لهذا اليوم:
- الإجمالي النشط: {{totalOverdue}}
- بانتظار أولي: {{pendingCount}}
- تنبيه أول: {{firstNoticeCount}}
- تصعيد مستوى 1: {{escalatedL1Count}}
- تصعيد مستوى 2: {{escalatedL2Count}}
- أقدم تأخير: {{oldestDaysLate}} يوم

الأقسام الأعلى تأخراً:
{{departmentSummary}}

للمتابعة:
{{link}}

نظام إدارة الجودة',
  'IN_APP,WHATSAPP,EMAIL',
  true,
  'KPI',
  '{{managerName}},{{totalOverdue}},{{pendingCount}},{{firstNoticeCount}},{{escalatedL1Count}},{{escalatedL2Count}},{{oldestDaysLate}},{{departmentSummary}},{{link}}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("eventKey") DO NOTHING;
