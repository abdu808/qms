# مصفوفة عرض الأدوار والصلاحيات

آخر تحديث: 2026-05-21

هذا الملف مرجع تشغيلي سريع لما يجب أن يظهر لكل دور في واجهة النظام. يتم توليده من تعريفات الواجهة الحالية في `apps/web/public/app.js`، ويُراجع عبر `npm run audit:roles`.

## قواعد حاكمة

- الموظف لا يرى إلا عمله الشخصي وما أُسند إليه.
- رئيس القسم لا يرى لوحة الإدارة العامة ولا صفحات بيانات التشغيل العامة للأقسام الأخرى.
- مدير الجودة يرى وحدات الجاهزية والمتابعة والتحسين، وليس بالضرورة كل إعدادات النظام.
- مسؤول النظام فقط يملك الرؤية الكاملة لإدارة النظام.
- أي صفحة غير مسموحة يتم تحويل المستخدم منها إلى صفحته الرئيسية حسب الدور.

## الأدوار

### الموظف `EMPLOYEE`

يرى عمله الشخصي فقط: القراءات المطلوبة منه، إقراراته، البلاغات/الشكاوى/NCR المسندة، ودليل المستخدم.

**المسار الموجه الظاهر:**
- إنجازي اليوم `myWork`
- قراءات KPI المطلوبة مني `myKpi`
- إقراراتي المطلوبة `myAcknowledgments`
- الشكاوى `complaints`
- بلّغ عدم مطابقة `ncr`
- دليل المستخدم `userGuide`

**النطاق الكامل المسموح:**
- قراءات KPI المطلوبة مني `myKpi`
- إنجازي اليوم `myWork`
- إقراراتي المطلوبة `myAcknowledgments`
- الوثائق والسجلات `documents`
- الشكاوى `complaints`
- بلّغ عدم مطابقة `ncr`
- دليل المستخدم `userGuide`

### رئيس القسم `DEPT_MANAGER`

يرى متابعة قسمه وتنفيذ فريقه وحالات الجودة ضمن نطاقه، ولا يرى لوحة الإدارة العامة أو بيانات تشغيل الأقسام الأخرى.

**المسار الموجه الظاهر:**
- إنجازي اليوم `myWork`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- لوحة SLA (الشكاوى/NCR) `slaBoard`
- قراءات KPI المطلوبة مني `myKpi`
- متابعة الأداء `kpiTracking`
- تقرير الإنجاز الشهري `progressReports`
- الشكاوى `complaints`
- بلّغ عدم مطابقة `ncr`
- المخاطر والفرص `risks`

**النطاق الكامل المسموح:**
- إنجازي اليوم `myWork`
- نطاق نظام الجودة `qualityScope`
- الهيكل التنظيمي `organizationalChart`
- سياسة الجودة `qualityPolicy`
- وثائق تحتاج إقرار `ackDocuments`
- إقراراتي المطلوبة `myAcknowledgments`
- الخطة التشغيلية `operationalActivities`
- متابعة الأداء `kpiTracking`
- قراءات KPI المطلوبة مني `myKpi`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- مهام المتابعة `follow-up-tasks`
- المخاطر والفرص `risks`
- الوثائق والسجلات `documents`
- التدريب `training`
- مصفوفة الكفاءات `competence`
- تقييم الأداء `performanceReviews`
- خطة الاتصال `communication`
- الشكاوى `complaints`
- لوحة SLA (الشكاوى/NCR) `slaBoard`
- تقرير الإنجاز الشهري `progressReports`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- التحسين المستمر (PDCA) `improvementProjects`
- دليل المستخدم `userGuide`

### عضو اللجنة `COMMITTEE_MEMBER`

يرى ملخصات المراجعة والجاهزية والامتثال وما يحتاج قراراً أو متابعة، بدون إدارة النظام.

**المسار الموجه الظاهر:**
- إنجازي اليوم `myWork`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- جاهزية الأيزو `iso-readiness`
- متطلبات ISO `isoRequirements`
- تقرير الإنجاز الشهري `progressReports`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- المخاطر والفرص `risks`
- التدقيق الداخلي `audits`
- دليل المستخدم `userGuide`

**النطاق الكامل المسموح:**
- إنجازي اليوم `myWork`
- جاهزية الأيزو `iso-readiness`
- متطلبات ISO `isoRequirements`
- منشئ التقارير `reportBuilder`
- نطاق نظام الجودة `qualityScope`
- الهيكل التنظيمي `organizationalChart`
- سياق المنظمة (SWOT) `swot`
- الأطراف ذات العلاقة `interestedParties`
- خريطة العمليات `processes`
- سياسة الجودة `qualityPolicy`
- وثائق تحتاج إقرار `ackDocuments`
- إقراراتي المطلوبة `myAcknowledgments`
- تغطية الإقرارات `acknowledgmentsMatrix`
- الخطط الاستراتيجية `strategicPlans`
- محاور BSC `axes`
- مكتبة المؤشرات `indicators`
- المستهدفات السنوية `annualTargets`
- خريطة ترابط الخطة `planMap`
- الأهداف الاستراتيجية `strategicGoals`
- المبادرات الاستراتيجية `initiatives`
- مصادر التمويل `fundingSources`
- خطط التمويل `fundingPlans`
- الخطة التشغيلية `operationalActivities`
- متابعة الأداء `kpiTracking`
- قراءات KPI المطلوبة مني `myKpi`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- مهام المتابعة `follow-up-tasks`
- المخاطر والفرص `risks`
- طلبات التعديل `changeRequests`
- الوثائق والسجلات `documents`
- التدريب `training`
- مصفوفة الكفاءات `competence`
- تقييم الأداء `performanceReviews`
- خطة الاتصال `communication`
- المستفيدون `beneficiaries`
- التبرعات `donations`
- البرامج `programs`
- الموردون `suppliers`
- التدقيق الداخلي `audits`
- قوالب التدقيق `auditChecklists`
- استبيانات الرضا `surveys`
- الشكاوى `complaints`
- لوحة SLA (الشكاوى/NCR) `slaBoard`
- تقرير الإنجاز الشهري `progressReports`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- التحسين المستمر (PDCA) `improvementProjects`
- المستشار الذكي `consultant`
- دليل المستخدم `userGuide`

### مدير الجودة `QUALITY_MANAGER`

يرى مركز قيادة الجودة والجاهزية والمتأخرات وحالات التحسين، مع صلاحيات متابعة واعتماد أوسع.

**المسار الموجه الظاهر:**
- إنجازي اليوم `myWork`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- صحة البيانات المؤسسية `dataHealth`
- جاهزية الشهر `monthlyReadiness`
- جاهزية الأيزو `iso-readiness`
- متطلبات ISO `isoRequirements`
- الشكاوى `complaints`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- المخاطر والفرص `risks`
- جدولة مراجعة إدارية `managementReview`
- خريطة ترابط الخطة `planMap`
- الوثائق والسجلات `documents`
- التدقيق الداخلي `audits`
- استبيانات الرضا `surveys`
- دليل المستخدم `userGuide`

**النطاق الكامل المسموح:**
- إنجازي اليوم `myWork`
- لوحة المعلومات `dashboard`
- جاهزية الشهر `monthlyReadiness`
- جاهزية الأيزو `iso-readiness`
- متطلبات ISO `isoRequirements`
- صحة البيانات المؤسسية `dataHealth`
- الحالات الحرجة `operationalReports`
- منشئ التقارير `reportBuilder`
- نطاق نظام الجودة `qualityScope`
- الهيكل التنظيمي `organizationalChart`
- سياق المنظمة (SWOT) `swot`
- الأطراف ذات العلاقة `interestedParties`
- خريطة العمليات `processes`
- سياسة الجودة `qualityPolicy`
- وثائق تحتاج إقرار `ackDocuments`
- إقراراتي المطلوبة `myAcknowledgments`
- تغطية الإقرارات `acknowledgmentsMatrix`
- الخطط الاستراتيجية `strategicPlans`
- محاور BSC `axes`
- مكتبة المؤشرات `indicators`
- المستهدفات السنوية `annualTargets`
- خريطة ترابط الخطة `planMap`
- الأهداف الاستراتيجية `strategicGoals`
- المبادرات الاستراتيجية `initiatives`
- مصادر التمويل `fundingSources`
- خطط التمويل `fundingPlans`
- إصدارات الخطة `planVersions`
- الخطة التشغيلية `operationalActivities`
- متابعة الأداء `kpiTracking`
- قراءات KPI المطلوبة مني `myKpi`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- مهام المتابعة `follow-up-tasks`
- المخاطر والفرص `risks`
- طلبات التعديل `changeRequests`
- الوثائق والسجلات `documents`
- التدريب `training`
- مصفوفة الكفاءات `competence`
- تقييم الأداء `performanceReviews`
- خطة الاتصال `communication`
- المستفيدون `beneficiaries`
- التبرعات `donations`
- البرامج `programs`
- الموردون `suppliers`
- جدولة مراجعة إدارية `managementReview`
- التدقيق الداخلي `audits`
- قوالب التدقيق `auditChecklists`
- استبيانات الرضا `surveys`
- الشكاوى `complaints`
- لوحة SLA (الشكاوى/NCR) `slaBoard`
- تقرير الإنجاز الشهري `progressReports`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- التحسين المستمر (PDCA) `improvementProjects`
- المستشار الذكي `consultant`
- مركز AI `aiSettings`
- التكاملات والتنبيهات `integrationsSettings`
- المستخدمون `users`
- الإدارات `departments`
- سجل التدقيق `audit-log`
- استيراد البيانات `dataImport`
- دليل المستخدم `userGuide`

### مسؤول النظام `SUPER_ADMIN`

يرى كل وحدات النظام لإدارة الإعدادات والصلاحيات والتكاملات والدعم الكامل.

**المسار الموجه الظاهر:**
- إنجازي اليوم `myWork`
- لوحة المعلومات `dashboard`
- سجل متابعة الإدخالات المتأخرة `kpiFollowUp`
- صحة البيانات المؤسسية `dataHealth`
- جاهزية الشهر `monthlyReadiness`
- جاهزية الأيزو `iso-readiness`
- متطلبات ISO `isoRequirements`
- مكتبة القوالب `templateLibrary`
- الشكاوى `complaints`
- بلّغ عدم مطابقة `ncr`
- الإجراءات التصحيحية (CAPA) `capa`
- المخاطر والفرص `risks`
- جدولة مراجعة إدارية `managementReview`
- التدقيق الداخلي `audits`
- استبيانات الرضا `surveys`
- خريطة ترابط الخطة `planMap`
- الخطط الاستراتيجية `strategicPlans`
- الأهداف الاستراتيجية `strategicGoals`
- الخطة التشغيلية `operationalActivities`
- متابعة الأداء `kpiTracking`
- تقرير الإنجاز الشهري `progressReports`
- التكاملات والتنبيهات `integrationsSettings`
- مركز AI `aiSettings`
- المستخدمون `users`
- الإدارات `departments`
- سجل التدقيق `audit-log`

**النطاق الكامل المسموح:**
- كل الوحدات حسب الصلاحيات `كل الوحدات حسب الصلاحيات`

## حواجز منع التسرب

- `dashboard`, `dataHealth`, `operationalReports`, `reportBuilder` ممنوعة على رئيس القسم لأنها أسطح قرار/رقابة مؤسسية.
- `beneficiaries`, `donations`, `programs`, `suppliers` ممنوعة على رئيس القسم كصفحات تشغيل عامة للأقسام الأخرى.
- الوضع المتقدم ممنوع على الموظف ورئيس القسم.
- الهدف التشغيلي `objectives` مخفي عن الأدوار التشغيلية لأن النظام يعتمد طبقة الأنشطة والمؤشرات بدلاً منه.

## نتيجة آخر فحص

```json
{
  "ok": true,
  "guidedGroupsChecked": {
    "EMPLOYEE": [
      "myWork",
      "myKpi",
      "myAcknowledgments",
      "complaints",
      "ncr",
      "userGuide"
    ],
    "DEPT_MANAGER": [
      "myWork",
      "kpiFollowUp",
      "slaBoard",
      "myKpi",
      "kpiTracking",
      "progressReports",
      "complaints",
      "ncr",
      "risks"
    ],
    "COMMITTEE_MEMBER": [
      "myWork",
      "kpiFollowUp",
      "iso-readiness",
      "isoRequirements",
      "progressReports",
      "ncr",
      "capa",
      "risks",
      "audits",
      "userGuide"
    ],
    "QUALITY_MANAGER": [
      "myWork",
      "kpiFollowUp",
      "dataHealth",
      "monthlyReadiness",
      "iso-readiness",
      "isoRequirements",
      "complaints",
      "ncr",
      "capa",
      "risks",
      "managementReview",
      "planMap",
      "documents",
      "audits",
      "surveys",
      "userGuide"
    ],
    "SUPER_ADMIN": [
      "myWork",
      "dashboard",
      "kpiFollowUp",
      "dataHealth",
      "monthlyReadiness",
      "iso-readiness",
      "isoRequirements",
      "templateLibrary",
      "complaints",
      "ncr",
      "capa",
      "risks",
      "managementReview",
      "audits",
      "surveys",
      "planMap",
      "strategicPlans",
      "strategicGoals",
      "operationalActivities",
      "kpiTracking",
      "progressReports",
      "integrationsSettings",
      "aiSettings",
      "users",
      "departments",
      "audit-log"
    ]
  },
  "unknownGuidedPages": [],
  "guidedOutsideRoleMenu": [],
  "duplicateGuidedPages": [],
  "operationalObjectivesVisible": [],
  "deptManagerForbiddenVisible": [],
  "roleForbiddenVisible": [],
  "advancedModeLeak": false,
  "endpointWarnings": []
}
```
