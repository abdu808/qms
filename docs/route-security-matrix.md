# مصفوفة أمن مسارات API

آخر تحديث: 2026-05-21T21:39:50.625Z

## الخلاصة

- النتيجة: ناجح
- المسارات العامة المقصودة: 7
- المسارات المحمية بعد تسجيل الدخول: 74
- محمية بمصفوفة الصلاحيات: 37
- محمية بحراس مخصصين: 14
- ذاتية النطاق للمستخدم الحالي: 6
- موارد CRUD غير موجودة في المصفوفة: 0
- مسارات محمية بلا حارس واضح: 0

## المسارات العامة المقصودة

| المسار | الملف | السبب |
| --- | --- | --- |
| /api/auth | auth | login/refresh/logout endpoints |
| /api/meta | meta | non-sensitive app metadata |
| /eval | publicEval | public evaluation token flow |
| /survey | publicSurvey | public survey token flow |
| /ack | publicAck | public acknowledgement token flow |
| /api/public | publicPortal | public read-only portal endpoints |
| /api/integrations | integrationCallback | n8n callback before JWT; authenticated by X-Webhook-Secret |

## المسارات المحمية

| المسار | الملف | نوع الحماية | الحراس | ملاحظة |
| --- | --- | --- | --- | --- |
| /api/dashboard | dashboard | self-scoped | requireAction, self-scoped | role-aware dashboard summary, still behind JWT |
| /api/charts | charts | guarded | requireAction |  |
| /api/users | users | guarded | requireAction, authorize |  |
| /api/user-preferences | userPreferences | self-scoped | self-scoped | current-user UI preferences only |
| /api/departments | departments | matrix:departments | crudRouter |  |
| /api/objectives | objectives | matrix:objectives | crudRouter |  |
| /api/risks | risks | matrix:risks | crudRouter |  |
| /api/complaints | complaints | matrix:complaints | crudRouter, requireAction |  |
| /api/ncr | ncr | matrix:ncr | crudRouter, requireAction |  |
| /api/capa | capa | guarded | requireAction |  |
| /api/audits | audits | matrix:audits | crudRouter |  |
| /api/suppliers | suppliers | matrix:suppliers | crudRouter, requireAction |  |
| /api/supplier-evals | supplierEvals | matrix:supplier-evals | crudRouter |  |
| /api/donations | donations | matrix:donations | crudRouter |  |
| /api/donation-evals | donationEvals | matrix:donation-evals | crudRouter |  |
| /api/beneficiaries | beneficiaries | matrix:beneficiaries | crudRouter, requireAction |  |
| /api/programs | programs | matrix:programs | crudRouter |  |
| /api/surveys | surveys | guarded | requireAction |  |
| /api/documents | documents | matrix:documents | crudRouter, requireAction |  |
| /api/training | training | matrix:training | crudRouter, requireAction, custom require* middleware |  |
| /api/signatures | signatures | guarded | requireAction |  |
| /api/audit-log | auditLog | guarded | requireAction, authorize |  |
| /api/exports | exports | guarded | requireAction |  |
| /api/strategic-plans | strategicPlans | matrix:strategic-plans | crudRouter, requireAction |  |
| /api/strategic-goals | strategicGoals | matrix:strategic-goals | crudRouter, requireAction, authorize |  |
| /api/operational-activities | operationalActivities | matrix:operational-activities | crudRouter |  |
| /api/swot | swot | matrix:swot | crudRouter, requireAction |  |
| /api/interested-parties | interestedParties | matrix:interested-parties | crudRouter |  |
| /api/processes | processes | matrix:processes | crudRouter |  |
| /api/quality-policy | qualityPolicy | matrix:quality-policy | crudRouter |  |
| /api/policy-ack | policyAck | self-scoped | requireAction, self-scoped | current-user acknowledgement flow with scoped reporting routes |
| /api/performance-reviews | performanceReviews | matrix:performance-reviews | crudRouter, requireAction, custom require* middleware |  |
| /api/improvement-projects | improvementProjects | matrix:improvement-projects | crudRouter, requireAction |  |
| /api/audit-checklists | auditChecklists | matrix:audit-checklists | crudRouter |  |
| /api/notifications | notifications | self-scoped | self-scoped | current-user notification inbox only |
| /api/alerts | alerts | guarded | requireAction |  |
| /api/state-machines | stateMachines | self-scoped | self-scoped | read-only workflow metadata, still behind JWT |
| /api/ack-documents | ackDocuments | matrix:ack-documents | crudRouter, requireAction |  |
| /api/data-health | dataHealth | guarded | requireAction |  |
| /api/sla | sla | guarded | requireAction |  |
| /api/import | import | custom-guard | custom require* middleware, custom require* function, custom-guard allowlist | requireImportRole restricts imports to QUALITY_MANAGER/SUPER_ADMIN |
| /api/my-work | myWork | self-scoped | self-scoped | self-scoped work center; payload is built from req.user role and department |
| /api/scheduler | scheduler | custom-guard | custom require* middleware, custom require* function, custom-guard allowlist | super-admin scheduler guard |
| /api/report-builder | reportBuilder | guarded | requireAction |  |
| /api/portal | portalAdmin | custom-guard | authorize, custom-guard allowlist | portal admin role guards |
| /api/webhook-settings | webhookSettings | custom-guard | authorize, custom-guard allowlist | super-admin webhook settings guard |
| /api/integrations | integrationDelivery | custom-guard | authorize, custom-guard allowlist | integration delivery admin routes use authorize guards |
| /api/notification-templates | notificationTemplates | custom-guard | authorize, custom-guard allowlist | notification template admin guards |
| /api/notification-rules | notificationRules | custom-guard | authorize, custom-guard allowlist | notification rule admin guards |
| /api/automation | automation | custom-guard | custom require* middleware, custom require* function, custom-guard allowlist | webhook secret guard plus internal role controls |
| /api/ai-settings | aiSettings | custom-guard | authorize, custom-guard allowlist | explicit role checks per endpoint |
| /api/consultant | consultant | custom-guard | authorize, custom-guard allowlist | role checks, rate limits, and tool permissions |
| /api/consult-sessions | consultSessions | custom-guard | authorize, custom-guard allowlist | session ownership isolation plus role checks |
| /api/progress-reports | progressReports | custom-guard | authorize, custom-guard allowlist | department/QM workflow guards |
| /api/management-review | managementReview | matrix:management-review | crudRouter, requireAction |  |
| /api/competence | competence | matrix:competence | crudRouter |  |
| /api/communication | communication | matrix:communication | crudRouter |  |
| /api/iso-readiness | isoReadiness | guarded | requireAction |  |
| /api/eval-tokens | evalTokens | guarded | requireAction |  |
| /api/reports | reports | custom-guard | requireAction, custom-guard allowlist | parent reports router applies requireAction(reports, read) |
| /api/operational-reports | operationalReports | guarded | requireAction |  |
| /api/kpi | kpi | guarded | requireAction |  |
| /api/kpi-followups | kpiFollowUp | custom-guard | custom require* middleware, custom-guard allowlist | KPI follow-up read/QM access guards |
| /api/integration | integration | guarded | requireAction |  |
| /api/axes | axes | matrix:axes | crudRouter |  |
| /api/indicators | indicators | matrix:indicators | crudRouter, requireAction |  |
| /api/annual-targets | annual-targets | matrix:annual-targets | crudRouter, requireAction |  |
| /api/initiatives | initiatives | matrix:initiatives | crudRouter |  |
| /api/funding-sources | funding-sources | matrix:funding-sources | crudRouter |  |
| /api/funding-plans | funding-plans | matrix:funding-plans | crudRouter, requireAction |  |
| /api/plan-versions | plan-versions | matrix:plan-versions | crudRouter, requireAction |  |
| /api/change-requests | change-requests | guarded | requireAction |  |
| /api/follow-up-tasks | follow-up-tasks | matrix:follow-up-tasks | crudRouter, requireAction |  |
| /api/audit-findings | audit-findings | matrix:audit-findings | crudRouter, requireAction |  |

## نتائج يجب ألا تظهر

- ملفات مفقودة: 0
- موارد CRUD بلا مصفوفة: 0
- مسارات محمية بلا حارس: 0

## ملفات Routes غير مركبة مباشرة

- لا يوجد.

