# نموذج حوكمة إدارة الجودة و فرض انضباط المؤشرات
## Bir Sabia - مؤسسة خيرية (50-100 موظف، 5-6 أقسام)

**التاريخ:** 2 مايو 2026  
**الإصدار:** 1.0 - مسودة  
**الحالة:** جاهز للتنفيذ

---

## 1. نموذج الحوكمة المتكامل (Organization Model)

### 1.1 الأدوار والمسؤوليات

```
┌─────────────────────────────────────────────────────────────────┐
│                   نموذج حوكمة المؤشرات                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 1. مالك المؤشر (Indicator Owner)                                 │
├──────────────────────────────────────────────────────────────────┤
│ • المسؤول النهائي عن المؤشر                                      │
│ • يحدد التعريف والصيغة والعتبات (Green/Yellow/Red)               │
│ • يُحدّث المستهدفات السنوية (Annual Targets)                    │
│ • مسؤول عن دقة وصحة البيانات                                     │
│ • يُعتمد عليه في تحليل الانحرافات والإجراءات التصحيحية            │
│ • عادةً: رئيس قسم أو مدير العملية المتعلقة                       │
│                                                                  │
│ Database Field: Indicator.ownerId                                │
│ Relation: User@"IndicatorOwner"                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 2. مُدخِل البيانات (Data Entry User)                             │
├──────────────────────────────────────────────────────────────────┤
│ • ينفذ إدخال البيانات الفعلية شهرياً / ربع سنوياً                 │
│ • يُرفق الأدلة (evidenceUrl)                                     │
│ • يُوضّح سبب الانحراف عند النسبة < 80%                           │
│ • يقترح إجراء تصحيحي عند النسبة < 60%                             │
│ • يُرسل للمُعتمد في اليوم 3-5 من الشهر التالي                    │
│ • عادةً: موظف تشغيلي / مسؤول البيانات في القسم                   │
│                                                                  │
│ Database Field: Indicator.dataEntryUserId                        │
│ Relation: User@"IndicatorDataEntry"                              │
│ Entry Model: KpiEntry                                            │
│   - enteredById (Who entered)                                    │
│   - enteredAt (When)                                            │
│   - deviationReason (Why below 80%)                              │
│   - actionNote (Corrective action if < 60%)                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 3. معتمد الدخل (KPI Entry Approver)                              │
├──────────────────────────────────────────────────────────────────┤
│ • يتحقق من صحة البيانات والأدلة                                  │
│ • يعتمد أو يرفض الإدخال (Approval Workflow)                      │
│ • يُطلب فيه التوقيع الرقمي (signature required)                  │
│ • يُسجّل الوقت والتعليقات في KpiEntry                            │
│ • عادةً: نائب رئيس القسم أو مسؤول جودة وسيط                      │
│                                                                  │
│ Database Field: KpiEntry.approvedById                            │
│ Relation: User@"KpiEntryApprover"                                │
│ Status Workflow:                                                 │
│   DRAFT → SUBMITTED → APPROVED | REJECTED                        │
│                                                                  │
│ Fields to populate:                                              │
│   - approvedAt (timestamp)                                       │
│   - rejectionReason (if rejected)                                │
│   - entryStatus (new status)                                     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 4. مدير الجودة (QMS Manager)                                     │
├──────────────────────────────────────────────────────────────────┤
│ • الإشراف الكلي على نظام إدارة الجودة                            │
│ • مراقبة التأخيرات والمتأخرات (Late Submissions)                │
│ • استقبال تنبيهات المتأخرات الآلية                               │
│ • عقد اجتماعات مع مالكي المؤشرات المتأخرة                         │
│ • إصدار تقارير رسمية للإدارة العليا                              │
│ • إجراءات تصحيحية رسمية (Formal CAPAs)                           │
│ • مراجعة سنوية لفعالية نظام المؤشرات                             │
│                                                                  │
│ Role: QUALITY_MANAGER (defined in User.role enum)               │
│ Permissions: Read all indicators, see all KpiEntries, send      │
│   alerts, create formal CAPAs                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 5. الإدارة العليا (Executive / C-Level)                          │
├──────────────────────────────────────────────────────────────────┤
│ • استقبال التقارير الشهرية / الربع سنوية                         │
│ • الموافقة على الإجراءات التصحيحية الرسمية                      │
│ • المراجعة الإدارية (Management Review) كل 3-6 أشهر             │
│ • قرارات استراتيجية بناءً على أداء المؤشرات                     │
│                                                                  │
│ Role: EXECUTIVE (access dashboard & formal reports only)        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 6. المستشار الخارجي (External Consultant) - حسب الحاجة          │
├──────────────────────────────────────────────────────────────────┤
│ • دعم تطوير نظام المؤشرات                                        │
│ • تدقيق دوري (Audit) لفعالية النظام                             │
│ • تدريب الفريق على ISO 9001 و KPI Management                    │
│ • مراجعة الإجراءات التصحيحية                                     │
│                                                                  │
│ Role: CONSULTANT (read-only + session management)               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. آلية فرض الانضباط (Enforcement Mechanism)

### 2.1 جدول التنبيهات والإجراءات

**التوقيت المقترح** (بناءً على دورة شهرية بدء الإدخال يوم 1 من الشهر):

```
┌────────────────────────────────────────────────────────────────────┐
│           جدول فرض انضباط متدرج                                  │
└────────────────────────────────────────────────────────────────────┘

📅 يوم 5 من الشهر
├─ الحالة: KpiEntry.submittedAt = null (لم يُرسل)
├─ الإجراء: تذكير آلي (Automated Email) الأول
├─ المستقبل: مُدخِل البيانات + مالك المؤشر
├─ النص:
│  "تذكير: لم يُستكمل إدخال بيانات مؤشر [IND-XXXX] للشهر [MM/YYYY]
│   الموعد النهائي: يوم 10 من الشهر"
├─ نوع الإخطار: WARNING
└─ System: Auto-trigger via scheduler (cron job)

📅 يوم 10 من الشهر
├─ الحالة: KpiEntry.submittedAt = null
├─ الإجراء: تذكير آلي الثاني + تقرير لمدير الجودة
├─ المستقبل: 
│  - مُدخِل البيانات + مالك المؤشر
│  - مدير الجودة (QMS Manager)
├─ النص:
│  "تنبيه عاجل: تأخر إدخال بيانات مؤشر [IND-XXXX] للشهر [MM/YYYY]
│   الموعد النهائي: يوم 15 من الشهر
│   تحذير: سيتم بدء إجراء رسمي إذا تأخر عن اليوم 15"
├─ نوع الإخطار: ALERT (محفوظ في Notification جديد)
├─ التقرير لمدير الجودة:
│  - قائمة المؤشرات المتأخرة (Late KPIs Report)
│  - أسماء المسؤولين
│  - الفترة المتأخرة
└─ System: Scheduler + auto-trigger email service

📅 يوم 15 من الشهر
├─ الحالة: KpiEntry.submittedAt = null و enteredAt < 15 يوم
├─ الإجراء: اجتماع إداري مُجدول
├─ المستقبل:
│  - مالك المؤشر
│  - مدير الجودة
│  - رئيس القسم (إذا كانت هناك تأخيرات متكررة)
├─ أجندة الاجتماع:
│  1. فهم السبب الجذري للتأخير
│  2. الأثر على الأهداف الاستراتيجية
│  3. خطة العمل العاجلة (إن وجدت)
│  4. التاريخ الملموس للتسليم
├─ المخرجات:
│  - ملاحظات مسجلة في FollowUpTask أو ConsultSession
│  - التزام مكتوب بموعد التسليم
│  - متابعة يومية إذا لزم الحال
└─ System: Manual scheduling + notification to QMS Manager

📅 يوم 20+ من الشهر
├─ الحالة: ما زال KpiEntry.submittedAt = null
├─ الإجراء: إجراء تصحيحي رسمي (Formal CAPA)
├─ المستقبل:
│  - إدارة عليا
│  - مدير الجودة
│  - مالك المؤشر
│  - رئيس القسم
├─ الوثائق:
│  1. تقرير رسمي:
│     - التأخير والأثر
│     - التحليل الجذري (5 Whys)
│     - الإجراء التصحيحي الموصى به
│  2. خطة العمل المفصلة
│  3. مؤشرات المراقبة
│  4. التاريخ المستهدف للإغلاق
├─ نوع الإخراج: Formal CAPA record
│  - يُنشأ في نموذج Capa
│  - Capa.type = "DELAYED_KPI_ENTRY"
│  - Capa.description = تفاصيل التأخير
│  - Capa.targetCompletionDate = مجموعة بوضوح
├─ المتابعة:
│  - أسبوعية إلى يومية حسب الخطورة
│  - تحديثات الحالة (Not Started → In Progress → Completed)
│  - تقارير المراجعة الإدارية
└─ System: Manual CAPA creation + assignment

📅 يوم 25+ من الشهر (مرة أخرى متأخر)
├─ الحالة: تأخير متكرر (نمط سلوكي)
├─ الإجراء: إجراء انضباطي إداري
├─ المستقبل: إدارة موارد بشرية + مدير الجودة
├─ الخيارات:
│  - تدريب إضافي
│  - إعادة تعيين المسؤول
│  - خصم من التقييم الأداء
│  - تحذير رسمي (Written Warning)
│  - فصل (في الحالات القصوى بعد تحذيرات متعددة)
└─ System: Manual HR process + documentation in AuditLog

```

### 2.2 توقيتات بديلة حسب نوع المؤشر

يمكن تخصيص التوقيتات حسب طبيعة المؤشر:

```
مؤشرات حرجة (Critical KPIs):
├─ Green Threshold إذا كانت ≥ 95%
├─ Yellow Threshold إذا كانت 75-94%
├─ تقليل المواعيد بـ 2-3 أيام
├─ اجتماعات إدارية أسبوعية، لا شهرية
├─ مثال: مؤشرات السلامة، رضا المستفيد الرئيسي

مؤشرات عادية (Standard KPIs):
├─ تتبع الجدول الأساسي (5-10-15-20)
├─ اجتماعات شهرية
├─ مثال: إنتاجية، جودة خدمة

مؤشرات متأخرة (Lagging KPIs):
├─ قد تتطلب توقيتات مختلفة (ربع سنوي)
├─ إذا كانت frequency = QUARTERLY
├─ التذكيرات تُعدّل حسب الدورة
```

---

## 3. معايير المؤشر الجيد (KPI Standards)

### 3.1 معايير الجودة العامة (General Criteria)

كل مؤشر يجب أن يحقق المعايير التالية:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. الوضوح والتحديد (Clarity & Definition)                   │
├──────────────────────────────────────────────────────────────┤
│ المعيار: Indicator.definition يجب أن يكون واضحاً وقابلاً      │
│         للقياس بدقة (SMART)                                  │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ nameAr: اسم واضح باللغة العربية (25-100 حرف)              │
│ ✓ definition: تعريف شامل يشمل:                              │
│   - ماذا يقيس المؤشر؟                                        │
│   - لماذا مهم للمؤسسة؟                                       │
│   - من المسؤول عن جودته؟                                    │
│ ✓ formula: الصيغة الحسابية الدقيقة                           │
│   - مثال: (عدد الخدمات المنجزة / الطلبات المستقبلة) × 100   │
│ ✓ unit: وحدة القياس واضحة (%, عدد، ريال، يوم، ساعة)          │
│                                                              │
│ Validation Rules:                                            │
│ - definition.length >= 50 (على الأقل)                       │
│ - formula.length >= 20                                       │
│ - unit != null                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. التوجيه والعتبات (Direction & Thresholds)                │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن يكون واضحاً:                                 │
│         - هل أعلى قيمة أفضل أم أقل قيمة أفضل؟               │
│         - ما هي النطاقات الخضراء والصفراء والحمراء؟          │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ direction: HIGHER_BETTER أم LOWER_BETTER                  │
│ ✓ greenThreshold: العتبة الخضراء (مثلاً 95%)                │
│ ✓ yellowThreshold: العتبة الصفراء (مثلاً 75%)               │
│   - دائماً yellowThreshold < greenThreshold                  │
│   - النطاقات: أحمر < 75% | أصفر 75-94% | أخضر >= 95%       │
│ ✓ seasonality: هل هناك تذبذب موسمي؟                         │
│                                                              │
│ Validation Rules:                                            │
│ - greenThreshold > yellowThreshold                           │
│ - 0 < yellowThreshold <= 100                                 │
│ - 0 < greenThreshold <= 100                                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 3. الملكية والمسؤولية (Ownership & Accountability)           │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن يكون هناك شخص واضح المسؤول عن كل عنصر       │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ Indicator.ownerId: مالك المؤشر الأساسي                    │
│ ✓ Indicator.dataEntryUserId: من يُدخِل البيانات             │
│ ✓ Indicator.approverUserId: من يُعتمد الدخول                │
│                                                              │
│ إذا كان أي من هذه null:                                     │
│ - الحقل status = "INCOMPLETE" (لا يمكن الاستخدام)           │
│ - إشعار تنبيه إلى مدير الجودة                                │
│ - يجب إكمال الملكية قبل أول إدخال بيانات                   │
│                                                              │
│ Validation Rules:                                            │
│ - ownerId != null AND user.active = true                     │
│ - dataEntryUserId != null AND user.active = true             │
│ - approverUserId != null AND user.active = true              │
│ - ownerId != dataEntryUserId (فصل الواجبات)                  │
│ - ownerId != approverUserId (فصل الواجبات)                   │
│ - ownerId.department != null (ينتمي لقسم)                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 4. المستهدفات السنوية (Annual Targets)                      │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن يكون هناك مستهدف واضح لكل سنة              │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ AnnualTarget يوجد للسنة الحالية (2026)                    │
│ ✓ targetValue: قيمة محددة وواقعية                            │
│ ✓ إذا كانت frequency = QUARTERLY:                           │
│   - يفضل q1Target, q2Target, q3Target, q4Target            │
│   - إذا لم توجد، نُحسب مباشرة من targetValue               │
│                                                              │
│ الحد الأدنى:                                                 │
│ - إذا لم يوجد AnnualTarget للسنة الحالية:                   │
│   = إشعار تنبيه إلى مالك المؤشر                              │
│   = لا يمكن قبول KpiEntry إذا كانت status = "UNPLANNED"   │
│                                                              │
│ Validation Rules:                                            │
│ - AnnualTarget.exists(indicatorId, currentYear) OR status   │
│   = "WARNING_NO_TARGET"                                      │
│ - targetValue > 0                                            │
│ - modificationReason filled إذا تم التعديل                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 5. ربط ISO 9001 والمعايير الوطنية (ISO/Standards Link)      │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن يكون المؤشر مرتبطاً برقابة أو متطلب معين    │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ isoClause: مثل "8.2.3" (requirement mapping)              │
│ ✓ nationalStandard: إذا كان هناك معيار وطني مقابل           │
│                                                              │
│ أمثلة:                                                       │
│ - مؤشر رضا المستفيد → isoClause = "8.2.1"                  │
│ - مؤشر أداء الموردين → isoClause = "8.4.1"                 │
│ - مؤشر كفاءة العاملين → isoClause = "7.2"                  │
│                                                              │
│ Validation Rules:                                            │
│ - isoClause يتبع صيغة "X.X.X" أو "X.X"                     │
│ - هناك Audit trail عند تغيير isoClause                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 6. دورة الإدخال والموثوقية (Entry Frequency & Reliability)  │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن يكون الإدخال منتظماً وموثوقاً               │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ frequency: MONTHLY | QUARTERLY | ANNUALLY                 │
│ ✓ dataSource: من أين تأتي البيانات؟                         │
│   - SYSTEM (مباشرة من النظام)                                │
│   - EXCEL (من ملف Excel)                                     │
│   - MANUAL (إدخال يدوي)                                      │
│ ✓ على مدى آخر 12 شهراً:                                      │
│   - أقل من 20% تأخيرات مقبول                                 │
│   - أكثر من 30% تأخيرات = مؤشر خطر (RED FLAG)               │
│   - 100% تأخيرات = يجب إيقاف المؤشر مؤقتاً                   │
│                                                              │
│ Validation Rules:                                            │
│ - frequency != null                                          │
│ - dataSource != null                                         │
│ - Late entries ratio tracking (calculated field)             │
│ - Alert إذا ratio > 30%                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 7. نوع البيانات والعلاقات (Data Type & Relationships)       │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن تكون البيانات متسقة وله سياق واضح          │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ kpiType: CUMULATIVE | PERIODIC | SNAPSHOT | BINARY        │
│   - CUMULATIVE: القيمة تتراكم (مثل المبيعات السنوية)        │
│   - PERIODIC: قيمة الفترة (مثل الربح الشهري)                │
│   - SNAPSHOT: لحظة معينة (مثل عدد الموظفين)                 │
│   - BINARY: نعم/لا (مثل الامتثال)                            │
│ ✓ indicatorType: LEADING | LAGGING                           │
│   - LEADING: مؤشر استباقي (يتنبأ بالنتائج)                  │
│   - LAGGING: مؤشر متأخر (يقيس النتائج المنجزة)             │
│ ✓ objectiveId: مرتبط بـ Objective (الهدف التشغيلي)          │
│ ✓ axisId: مرتبط بـ BSC Axis (محور بطاقة الأداء)             │
│                                                              │
│ Validation Rules:                                            │
│ - kpiType != null (يجب اختيار نوع)                          │
│ - indicatorType != null                                      │
│ - إذا كان objectiveId = null:                              │
│   = يجب axisId != null (ارتباط على الأقل)                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 8. الأدلة والتوثيق (Evidence & Documentation)                │
├──────────────────────────────────────────────────────────────┤
│ المعيار: يجب أن تكون هناك أدلة واضحة تدعم كل إدخال         │
│                                                              │
│ المتطلبات الدنيا:                                            │
│ ✓ KpiEntry.evidenceUrl: يجب أن توجد إذا كانت:              │
│   - القيمة < 60% (إجباري لتوثيق الإجراء)                    │
│   - القيمة < 80% (يفضل تقديم دليل)                         │
│   - من نوع MANUAL أو EXCEL                                  │
│ ✓ صيغ مقبولة:                                               │
│   - رابط مشاركة Google Drive / OneDrive                     │
│   - رابط ملف PDF أو Excel في نظام الأرشفة                  │
│   - الإحداثيات إلى سجل في قاعدة البيانات الداخلية          │
│ ✓ deviationReason: إجباري إذا < 80%                        │
│ ✓ actionNote: إجباري إذا < 60%                              │
│                                                              │
│ Validation Rules:                                            │
│ - IF KpiEntry.actualValue < 60%:                            │
│     REQUIRE evidenceUrl && actionNote && deviationReason    │
│ - IF KpiEntry.actualValue < 80%:                            │
│     REQUIRE deviationReason (evidence is optional)          │
│ - evidenceUrl must be valid HTTP(S) URL                      │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 سجل التحقق من المؤشر (KPI Validation Checklist)

استخدم هذا الفحص قبل تفعيل أي مؤشر جديد:

```
المؤشر: [IND-CODE] | الاسم: [NAME]
المدقق: __________________ | التاريخ: ________

# الوضوح والتحديد
☐ التعريف (definition) واضح وشامل (50+ حرف)
☐ الصيغة الحسابية (formula) محددة ومعروفة
☐ الوحدة (unit) واضحة
☐ الارتباط بـ ISO 9001 موثق (isoClause)

# التوجيه والعتبات
☐ التوجيه محدد (HIGHER_BETTER أم LOWER_BETTER)
☐ greenThreshold و yellowThreshold معقولة
☐ greenThreshold > yellowThreshold
☐ الموسمية محددة (seasonality)

# الملكية
☐ مالك (ownerId) معيّن وفعّال
☐ مُدخِل بيانات (dataEntryUserId) معيّن وفعّال
☐ معتمد (approverUserId) معيّن وفعّال
☐ لا يوجد تنازع في الواجبات (أشخاص مختلفون)

# المستهدفات
☐ AnnualTarget يوجد للسنة الحالية
☐ targetValue واقعي وقابل للتحقق
☐ إذا كانت دورية ربع سنوية: الربع الأول له target

# الدورة والموثوقية
☐ التكرار محدد (MONTHLY / QUARTERLY / ANNUALLY)
☐ مصدر البيانات معروف (SYSTEM / EXCEL / MANUAL)
☐ النوع محدد (CUMULATIVE / PERIODIC / SNAPSHOT / BINARY)

# الجودة العامة
☐ الوصف (definition) لا يحتوي على أخطاء إملائية
☐ لا يوجد مؤشر مكرر بنفس الكود
☐ المؤشر لا يتنازع مع آخر (نطاق واضح)
☐ هناك مورد لدعم جمع البيانات

# الموافقة النهائية
☐ معتمد من قبل: _________________ (مدير القسم أو الجودة)
☐ التاريخ: ____________
☐ الحالة: ☐ معتمد | ☐ معتمد بشروط | ☐ مرفوض (السبب: _______)

ملاحظات إضافية:
________________________________________________________________________
________________________________________________________________________
```

---

## 4. سجل المتابعة المطلوب (Tracking Log Schema)

### 4.1 نموذج بيانات للمتأخرات والإجراءات

```
┌────────────────────────────────────────────────────────────────┐
│              جداول المتابعة والإجراءات                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 1: KPI Late Entry Tracking                               │
│ (تتبع المؤشرات المتأخرة)                                      │
├────────────────────────────────────────────────────────────────┤
│ Fields:                                                        │
│ - id (UUID)                                                    │
│ - indicatorId (FK → Indicator)                                 │
│ - month, year (الفترة المتأخرة)                                │
│ - expectedSubmissionDate (الموعد المتوقع)                      │
│ - actualSubmissionDate (تاريخ التسليم الفعلي)                   │
│ - daysLate (عدد أيام التأخير = actualSubmissionDate -          │
│   expectedSubmissionDate)                                      │
│ - ownerUserId (FK → User, مالك المؤشر)                         │
│ - dataEntryUserId (FK → User, مُدخِل البيانات)                │
│ - status (LATE_NOTICE_1 | LATE_NOTICE_2 | FORMAL_MEETING |    │
│          FORMAL_CAPA | RESOLVED)                              │
│ - reminder1SentAt (وقت إرسال التذكير الأول)                   │
│ - reminder2SentAt (وقت إرسال التذكير الثاني)                   │
│ - meetingScheduledAt (موعد الاجتماع المجدول)                  │
│ - capaId (FK → Capa, إذا تم فتح إجراء تصحيحي)                │
│ - resolutionNotes (ملاحظات الحل: لماذا تأخر؟ كيف تم حله؟)     │
│ - createdAt, updatedAt                                         │
│                                                                │
│ Indexes:                                                       │
│ - (indicatorId, year, month) - unique                          │
│ - (status) - للبحث السريع                                      │
│ - (ownerUserId, status)                                        │
│ - (daysLate DESC) - لترتيب الأسوأ حالات                       │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT * FROM KpiLateEntryTracking                           │
│   WHERE status != 'RESOLVED' AND year = CURRENT_YEAR          │
│   ORDER BY daysLate DESC                                       │
│   → قائمة المتأخرات الحالية لمدير الجودة                    │
│                                                                │
│ - SELECT indicatorId, COUNT(*) AS late_count                  │
│   FROM KpiLateEntryTracking                                    │
│   GROUP BY indicatorId HAVING late_count > 3                   │
│   → مؤشرات بنمط تأخير متكرر (Red Flag)                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 2: KPI Entry Approval Log                                │
│ (سجل معتمدة إدخالات المؤشرات)                                 │
├────────────────────────────────────────────────────────────────┤
│ Fields:                                                        │
│ - id (UUID)                                                    │
│ - kpiEntryId (FK → KpiEntry)                                   │
│ - indicatorId (FK → Indicator)                                 │
│ - month, year (الفترة)                                         │
│ - enteredById (FK → User, من أدخل البيانات)                  │
│ - enteredAt (وقت الإدخال الأول)                               │
│ - submittedAt (وقت الإرسال للمعتمد)                            │
│ - approverUserId (FK → User, من اعتمد)                        │
│ - approvalStatus (PENDING | APPROVED | REJECTED)              │
│ - approvalDate (تاريخ الاعتماد)                                │
│ - rejectionReason (إذا تم الرفض)                              │
│ - revisionCount (كم مرة أُعيد إرساله)                         │
│ - actualValue (القيمة المُدخلة)                                │
│ - targetValue (المستهدف)                                      │
│ - variance (الانحراف = actualValue - targetValue)              │
│ - variancePercent (كنسبة مئوية)                                │
│ - performanceStatus (RED | YELLOW | GREEN)                    │
│ - evidenceUrl (رابط الدليل إن وجد)                            │
│ - deviationReason (سبب الانحراف)                               │
│ - actionNote (الإجراء المقترح)                                 │
│ - notes (ملاحظات المعتمد)                                      │
│ - createdAt, updatedAt                                         │
│                                                                │
│ Indexes:                                                       │
│ - (kpiEntryId) - unique (واحد لكل entry)                      │
│ - (approvalStatus, approvalDate)                               │
│ - (month, year) - للبحث الدوري                                │
│ - (performanceStatus) - لسهولة الفلترة                        │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT COUNT(*) FROM KpiEntryApprovalLog                    │
│   WHERE performanceStatus = 'RED' AND month = CURRENT_MONTH   │
│   → عدد مؤشرات الأداء الضعيفة هذا الشهر                      │
│                                                                │
│ - SELECT approverUserId, COUNT(*) AS rejections               │
│   FROM KpiEntryApprovalLog                                     │
│   WHERE approvalStatus = 'REJECTED' AND YEAR(approvalDate)    │
│        = CURRENT_YEAR                                          │
│   GROUP BY approverUserId                                      │
│   → إحصائية الرفض لكل معتمد                                  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 3: KPI Enforcement Action Log                            │
│ (سجل الإجراءات الإنفاذية)                                     │
├────────────────────────────────────────────────────────────────┤
│ Fields:                                                        │
│ - id (UUID)                                                    │
│ - indicatorId (FK → Indicator)                                 │
│ - month, year (الفترة)                                         │
│ - actionType (REMINDER_1 | REMINDER_2 | FORMAL_MEETING |     │
│              FORMAL_CAPA | DISCIPLINARY_ACTION)               │
│ - actionDate (تاريخ الإجراء)                                   │
│ - targetUserId (FK → User, المسؤول عن التأخير)               │
│ - actionBy (FK → User, من اتخذ الإجراء - مدير الجودة)       │
│ - description (وصف الإجراء)                                    │
│ - details (تفاصيل إضافية - JSON)                              │
│   {                                                            │
│     "reminderCount": 1,                                        │
│     "emailSentTo": ["user@example.com"],                      │
│     "meetingNotes": "...",                                     │
│     "capaId": "capa-123",                                      │
│     "disciplinaryLevel": "warning_1" | "warning_2" |         │
│                          "suspension" | "termination"         │
│   }                                                            │
│ - status (PENDING | COMPLETED | ESCALATED)                    │
│ - followUpDueDate (تاريخ المتابعة القادمة)                    │
│ - followUpNotes (ملاحظات المتابعة)                             │
│ - createdAt, updatedAt                                         │
│                                                                │
│ Indexes:                                                       │
│ - (indicatorId, month, year) - unique per action             │
│ - (actionType, status)                                         │
│ - (targetUserId, actionType) - تاريخ الإجراءات ضد مستخدم    │
│ - (actionDate DESC) - ترتيب زمني                              │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT * FROM KpiEnforcementActionLog                       │
│   WHERE actionType IN ('FORMAL_CAPA', 'DISCIPLINARY_ACTION')  │
│   AND YEAR(actionDate) = CURRENT_YEAR                         │
│   → إجراءات رسمية اتُخذت السنة الحالية                      │
│                                                                │
│ - SELECT targetUserId, COUNT(*) AS action_count               │
│   FROM KpiEnforcementActionLog                                │
│   WHERE YEAR(actionDate) = CURRENT_YEAR                       │
│   GROUP BY targetUserId HAVING action_count >= 3              │
│   → موظفون متكررو التأخير (نمط سلوكي)                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 4: KPI Performance Monthly Summary                       │
│ (ملخص الأداء الشهري للمؤشرات)                                  │
├────────────────────────────────────────────────────────────────┤
│ Fields:                                                        │
│ - id (UUID)                                                    │
│ - month, year (الفترة)                                         │
│ - departmentId (FK → Department, قسم المسؤول)                 │
│ - totalIndicators (إجمالي المؤشرات في القسم)                 │
│ - submittedOnTime (تم تسليمه في الموعد)                       │
│ - submittedLate (تم تسليمه متأخراً)                           │
│ - notSubmitted (لم يتم تسليمه)                                 │
│ - averagePerformance (متوسط الأداء %)                          │
│ - redIndicators (عدد مؤشرات الأداء الضعيف)                    │
│ - yellowIndicators (عدد مؤشرات الأداء المتوسط)                │
│ - greenIndicators (عدد مؤشرات الأداء الجيد)                   │
│ - complianceRate (نسبة الامتثال = submittedOnTime / total)   │
│ - notes (ملاحظات عامة)                                         │
│ - generatedBy (FK → User, من أنشأ التقرير)                   │
│ - createdAt                                                    │
│                                                                │
│ Indexes:                                                       │
│ - (month, year) - unique per period                            │
│ - (departmentId, month, year)                                  │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT departmentId, AVG(complianceRate) AS avg_compliance   │
│   FROM KpiPerformanceMonthlySummary                            │
│   WHERE YEAR(createdAt) = CURRENT_YEAR                         │
│   GROUP BY departmentId                                        │
│   → متوسط الامتثال لكل قسم السنة                            │
│                                                                │
│ - SELECT * FROM KpiPerformanceMonthlySummary                   │
│   WHERE month = CURRENT_MONTH AND year = CURRENT_YEAR          │
│   ORDER BY complianceRate ASC                                  │
│   → الأقسام بأداء أضعف هذا الشهر (للتركيز عليها)            │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 5: QMS Manager Alerts / Notifications                    │
│ (إشعارات مدير الجودة)                                          │
├────────────────────────────────────────────────────────────────┤
│ Fields:                                                        │
│ - id (UUID)                                                    │
│ - alertType (LATE_ENTRY | RED_PERFORMANCE | MISSING_TARGET |  │
│             REPEATED_DELAYS | APPROVAL_REJECTED |            │
│             CRITICAL_THRESHOLD)                               │
│ - severity (INFO | WARNING | CRITICAL)                        │
│ - indicatorId (FK → Indicator)                                 │
│ - relatedUserId (FK → User, المسؤول الأساسي)                 │
│ - month, year (الفترة)                                         │
│ - message (رسالة الإشعار)                                      │
│ - actionRequired (هل يتطلب إجراء فوري؟)                       │
│ - actionDueDate (موعد الإجراء إن وجد)                         │
│ - status (NEW | ACKNOWLEDGED | ADDRESSED | CLOSED)           │
│ - acknowledgedBy (FK → User, من أقرّ به)                     │
│ - acknowledgedAt (وقت الإقرار)                                │
│ - resolution (كيف تم حل المشكلة)                               │
│ - createdAt, updatedAt                                         │
│                                                                │
│ Indexes:                                                       │
│ - (alertType, status) - للفلترة السريعة                       │
│ - (severity DESC, createdAt DESC) - ترتيب الأولويات          │
│ - (relatedUserId) - إشعارات متعلقة بمستخدم                   │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT * FROM QmsManagerAlerts                              │
│   WHERE status IN ('NEW', 'ACKNOWLEDGED')                     │
│   ORDER BY severity DESC, createdAt ASC                        │
│   → لوحة تحكم مدير الجودة (الإشعارات الحالية)                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ جدول 6: Corrective Action Plan Linkage                        │
│ (ربط الإجراءات التصحيحية بالمؤشرات)                            │
├────────────────────────────────────────────────────────────────┤
│ Fields (relation join table):                                  │
│ - id (UUID)                                                    │
│ - capaId (FK → Capa, الإجراء التصحيحي)                       │
│ - indicatorId (FK → Indicator, المؤشر المتأثر)                │
│ - triggerType (DELAYED_ENTRY | POOR_PERFORMANCE |            │
│               ROOT_CAUSE_IDENTIFIED)                          │
│ - triggerDate (متى بُدئت المشكلة)                              │
│ - expectedClosureDate (المتوقع لإغلاق CAPA)                   │
│ - actualClosureDate (متى أُغلقت فعلاً)                         │
│ - effectiveness (هل الإجراء فعّال؟ YES | NO | PENDING)        │
│ - followUpRequired (هل نحتاج متابعة بعد الإغلاق؟)             │
│ - notes (ملاحظات)                                              │
│ - createdAt, updatedAt                                         │
│                                                                │
│ Indexes:                                                       │
│ - (capaId, indicatorId) - unique per CAPA-Indicator link      │
│ - (triggerType, status)                                        │
│                                                                │
│ Views / Queries:                                               │
│ - SELECT capaId, COUNT(*) AS indicator_count                   │
│   FROM CapaIndicatorLink                                       │
│   WHERE actualClosureDate IS NULL                              │
│   → CAPAs المفتوحة وعدد المؤشرات المتأثرة بها                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 تقرير مدير الجودة الشهري (QMS Manager Monthly Report)

**تنسيق التقرير (JSON / PDF):**

```json
{
  "reportId": "QMS-REPORT-2026-05",
  "period": {
    "month": 5,
    "year": 2026,
    "generatedDate": "2026-05-15T10:30:00Z"
  },
  "executive_summary": {
    "total_indicators": 42,
    "on_time_submissions": 38,
    "late_submissions": 3,
    "not_submitted": 1,
    "on_time_rate": "90.5%",
    "overall_performance": "GREEN",
    "critical_alerts": 2,
    "warning_alerts": 5
  },
  "performance_by_department": [
    {
      "department_id": "dept-sales",
      "department_name": "المبيعات",
      "indicators_count": 12,
      "on_time": 10,
      "late": 2,
      "not_submitted": 0,
      "compliance_rate": "83.3%",
      "average_performance": "85%",
      "red_indicators": 2,
      "yellow_indicators": 3,
      "green_indicators": 7,
      "status": "WARNING"
    },
    {
      "department_id": "dept-operations",
      "department_name": "العمليات",
      "indicators_count": 15,
      "on_time": 15,
      "late": 0,
      "not_submitted": 0,
      "compliance_rate": "100%",
      "average_performance": "92%",
      "red_indicators": 0,
      "yellow_indicators": 1,
      "green_indicators": 14,
      "status": "GREEN"
    }
  ],
  "late_submissions": [
    {
      "indicator_code": "IND-2026-005",
      "indicator_name": "مؤشر رضا المستفيد",
      "due_date": "2026-05-10",
      "actual_date": "2026-05-14",
      "days_late": 4,
      "owner": "أحمد محمد",
      "data_entry_user": "سارة علي",
      "status": "RESOLVED",
      "reason": "تأخر في جمع البيانات من الحقل"
    }
  ],
  "critical_alerts": [
    {
      "alert_id": "alert-001",
      "indicator_code": "IND-2026-012",
      "alert_type": "POOR_PERFORMANCE",
      "severity": "CRITICAL",
      "message": "مؤشر أداء الجودة: 45% (الهدف: 85%) - انحراف -40%",
      "owner": "فاطمة عمر",
      "action_required": true,
      "action_due_date": "2026-05-22",
      "recommended_action": "اجتماع طوارئ مع فريق الجودة"
    }
  ],
  "repeated_delays": [
    {
      "user_id": "user-045",
      "user_name": "محمود حسن",
      "late_count_this_year": 4,
      "indicators_affected": ["IND-2026-003", "IND-2026-008"],
      "pattern": "تأخير متكرر في الإدخال",
      "recommended_action": "تحذير رسمي + تدريب"
    }
  ],
  "not_submitted": [
    {
      "indicator_code": "IND-2026-018",
      "indicator_name": "مؤشر رضا الموظفين",
      "days_overdue": 5,
      "owner": "علي إبراهيم",
      "data_entry_user": "نور أحمد",
      "reason": "pending - تحت المتابعة"
    }
  ],
  "capa_status": {
    "open_capas": 3,
    "due_capa_count": 1,
    "overdue_capa_count": 0,
    "effectiveness_verification_pending": 1
  },
  "recommendations": [
    "تشديد المتابعة على قسم المبيعات لتحسين الامتثال",
    "عقد اجتماع طوارئ لمعالجة مؤشر أداء الجودة الحرج",
    "بدء إجراء تصحيحي رسمي لتأخير محمود حسن المتكرر",
    "تجديد تدريب فريق إدخال البيانات على المستهدفات الجديدة"
  ],
  "next_review_date": "2026-06-15",
  "prepared_by": {
    "name": "محمد الجودة",
    "role": "QMS Manager",
    "timestamp": "2026-05-15T10:30:00Z"
  }
}
```

---

## 5. الإجراءات العملية (Implementation Steps)

### 5.1 خطة التنفيذ المرحلية (Phased Implementation)

```
┌────────────────────────────────────────────────────────────────┐
│              المرحلة 1: التحضير والتخطيط (أسبوع 1-2)          │
├────────────────────────────────────────────────────────────────┤

□ 1.1 تشكيل فريق الحوكمة
   └─ أعضاء: مدير الجودة + رئيس قسم المالية + قائد التقنية
   └─ المهمة: الموافقة على النموذج والجدول الزمني
   └─ النتيجة: اجتماع تأسيسي موثّق

□ 1.2 تدقيق المؤشرات الحالية
   └─ مراجعة جميع المؤشرات في النظام (42 مؤشر)
   └─ التحقق من توافق كل مؤشر مع معايير الجودة (Section 3.1)
   └─ تصنيفها: ✓ جاهز | ⚠️ جاهز مع تحفظات | ❌ يحتاج تصحيح
   └─ النتيجة: تقرير تدقيق المؤشرات + خطة إصلاح

□ 1.3 تحديد الأدوار (Role Assignment)
   └─ اختيار مدير الجودة الرسمي (QMS Manager)
   └─ اختيار معتمدو الإدخال (Approvers) لكل قسم
   └─ تحديث جدول User.role في قاعدة البيانات
   └─ إنشاء RACI matrix (مسؤول / معتمد / استشاري / مطّلع)
   └─ النتيجة: Org chart موثّق

□ 1.4 إعداد جداول المتابعة في قاعدة البيانات
   └─ تنفيذ الجداول الـ 6 من Section 4.1
   └─ Migration script (إضافة الحقول الجديدة)
   └─ Initial data import (من KpiEntry و Capa موجود)
   └─ Testing: التحقق من الـ views و queries
   └─ النتيجة: جداول جاهزة + test data

□ 1.5 تثقيف وتدريب أولي
   └─ جلسة تدريب لمدير الجودة (1 ساعة)
   └─ جلسة تدريب لمالكي المؤشرات (1.5 ساعة)
   └─ جلسة تدريب لمدخلي البيانات والمعتمدين (1 ساعة)
   └─ توزيع دليل الإجراءات والنماذج
   └─ النتيجة: فهم مشترك للنموذج

┌────────────────────────────────────────────────────────────────┐
│       المرحلة 2: البناء والتطوير التقني (أسبوع 3-4)           │
├────────────────────────────────────────────────────────────────┤

□ 2.1 تطوير نظام الإشعارات الآلية
   └─ Scheduler job: تذكيرات يوم 5 و 10 من كل شهر
   └─ Email templates:
      ├─ Reminder 1 (Day 5)
      ├─ Reminder 2 + Alert to QMS Manager (Day 10)
      ├─ Formal notice (Day 15)
   └─ Integration: قاعدة البيانات + Email service
   └─ Testing: محاكاة التواريخ وإرسال تجريبي
   └─ النتيجة: نظام إشعارات فعّال وقابل للاختبار

□ 2.2 تطوير لوحة تحكم مدير الجودة (Dashboard)
   └─ Widgets:
      ├─ KPI submission status (pie chart)
      ├─ Late submissions list (sortable)
      ├─ Performance summary by department
      ├─ Alerts and critical indicators
      ├─ CAPA status tracker
   └─ Filters: بحسب القسم / الحالة / التاريخ / الشدة
   └─ Exports: PDF report + Excel data
   └─ Real-time data (no caching)
   └─ النتيجة: واجهة قابلة للاستخدام

□ 2.3 تطوير نموذج إدخال البيانات المحسّن
   └─ تحسينات:
      ├─ إذا actualValue < 80%: إجبارياً deviationReason
      ├─ إذا actualValue < 60%: إجبارياً actionNote + evidenceUrl
      ├─ حساب الانحراف التلقائي (variance %)
      ├─ عرض الحالة (RED / YELLOW / GREEN) فوراً
   └─ Validation: client-side + server-side
   └─ Save & Submit: زران منفصلان (Draft vs Submit)
   └─ النتيجة: UX محسّن

□ 2.4 تطوير سير عمل الاعتماد (Approval Workflow)
   └─ State Machine: DRAFT → SUBMITTED → APPROVED/REJECTED
   └─ Notification للمعتمد عند الاستقبال
   └─ Form رفض مع سبب إجباري
   └─ Re-submission by data entry user
   └─ Audit trail: من اعتمد ومتى؟
   └─ النتيجة: تدفق واضح ومسجّل

□ 2.5 تطوير نظام تقارير QMS Manager
   └─ Report generator:
      ├─ تقرير الأداء الشهري (JSON + PDF)
      ├─ تقرير المتأخرات
      ├─ تقرير الأداء الضعيف
      ├─ تقرير الإجراءات التصحيحية
   └─ Scheduling: توليد آلي آخر يوم من الشهر
   └─ Email: إرسال تلقائي للإدارة العليا
   └─ النتيجة: تقارير منتظمة وموثوقة

□ 2.6 ربط نظام CAPA الموجود
   └─ علاقة جديدة: KpiLateEntryTracking.capaId
   └─ Trigger: عند الانتقال لـ FORMAL_CAPA
   └─ Auto-create CAPA form بـ:
      ├─ Type: "DELAYED_KPI_ENTRY" أو "POOR_PERFORMANCE"
      ├─ Description: ملخص المشكلة
      ├─ Target Completion Date: محسوبة
   └─ Effectiveness check: بعد الإغلاق
   └─ النتيجة: ربط شامل بين النظامين

┌────────────────────────────────────────────────────────────────┐
│         المرحلة 3: الاختبار والتحقق (أسبوع 5)                │
├────────────────────────────────────────────────────────────────┤

□ 3.1 اختبار الوظائف (Functional Testing)
   └─ Test cases:
      ├─ إدخال بيانات كاملة وناقصة
      ├─ الاعتماد والرفض
      ├─ التذكيرات الآلية (simulation)
      ├─ إنشاء CAPAs
      ├─ توليد التقارير
   └─ Acceptance criteria: جميع الحالات تمر
   └─ النتيجة: Bug list + fixes

□ 3.2 اختبار الأداء (Performance Testing)
   └─ Scenarios:
      ├─ 500 KpiEntry في نفس الوقت
      ├─ Query التقرير مع 10,000 record
      ├─ Notification sending لـ 100 مستخدم
   └─ Targets: response time < 2 seconds
   └─ النتيجة: Performance report

□ 3.3 اختبار الأمان (Security Testing)
   └─ Checks:
      ├─ لا يمكن مستخدم رؤية مؤشرات أخرى أقسام
      ├─ معتمد لا يمكنه تعديل البيانات المُدخلة
      ├─ مدير الجودة فقط يرى جميع المؤشرات
      ├─ No SQL injection أو XSS
   └─ النتيجة: Security checklist موثّق

□ 3.4 UAT مع الفريق
   └─ مشاركون: 2-3 من كل دور (entry + approver + owner)
   └─ Scenarios الواقعية:
      ├─ إدخال شهري كامل
      ├─ رفض وإعادة إرسال
      ├─ تأخير متعمد لاختبار التنبيهات
   └─ Feedback collection & fixes
   └─ النتيجة: Sign-off من الأقسام

□ 3.5 اختبار التكامل مع الأنظمة الأخرى
   └─ Integration points:
      ├─ User management (إضافة/حذف مستخدمين)
      ├─ Department structure changes
      ├─ CAPA system
      ├─ Audit log
   └─ النتيجة: No regressions

┌────────────────────────────────────────────────────────────────┐
│           المرحلة 4: التشغيل الفعلي (الأسبوع 6+)              │
├────────────────────────────────────────────────────────────────┤

□ 4.1 إطلاق النظام (Go-Live)
   └─ التاريخ: ____________ (مثلاً: 1 يونيو 2026)
   └─ Deployment:
      ├─ Deploy code updates
      ├─ Run migration scripts
      ├─ Seed initial data
      ├─ Health check على جميع المكونات
   └─ Backup: قبل الإطلاق مباشرة
   └─ النتيجة: نظام فعّال وجاهز

□ 4.2 بدء الدورة الأولى
   └─ شهر إدخال أول: يناير 2026 (إذا كان تاريخ الإطلاق يناير)
   └─ أو بدء من الشهر الحالي
   └─ Reminders & monitoring مكثّف (مدير الجودة)
   └─ Support 24/7 لحل المشاكل الفورية
   └─ النتيجة: نسبة امتثال عالية للدورة الأولى

□ 4.3 مراقبة ومتابعة مستمرة
   └─ أسبوعي:
      ├─ مراجعة الإشعارات الجديدة
      ├─ متابعة المتأخرات
   └─ شهري:
      ├─ توليد تقرير QMS Manager
      ├─ اجتماع تقييم الأداء مع الإدارة
   └─ ربع سنوي:
      ├─ مراجعة فعالية النظام
      ├─ تحديثات وتحسينات
   └─ النتيجة: نظام مستقر وفعّال

□ 4.4 جمع الملاحظات والتحسينات
   └─ Feedback channels:
      ├─ نماذج استبيان (Google Form)
      ├─ اجتماعات دورية
      ├─ مراجعة AuditLog للمشاكل المتكررة
   └─ Prioritization: high impact / low effort أولاً
   └─ Updates: في كل إصدار شهري
   └─ النتيجة: نظام يتحسّن باستمرار

└────────────────────────────────────────────────────────────────┘
```

### 5.2 قائمة الفحص للتنفيذ (Go-Live Checklist)

```
الإطلاق الفعلي: _______________

☐ إعداد البيانات (Data Preparation)
  ☐ تصحيح جميع المؤشرات الـ 42 حسب معايير الجودة
  ☐ تعيين مالك + مُدخِل + معتمد لكل مؤشر
  ☐ AnnualTarget موجود لجميع المؤشرات للسنة الحالية
  ☐ القيم الحدية (thresholds) واقعية ومقبولة

☐ إعداد النظام (System Setup)
  ☐ Database migration تم تنفيذها
  ☐ جداول المتابعة (6 جداول) موجودة وفارغة
  ☐ Scheduler jobs مُعرّفة ومختبرة
  ☐ Email service مُعدّة ومختبرة
  ☐ Dashboard عمل منفصل وقابل للوصول

☐ إعداد التصاريح (Permissions & Access)
  ☐ QMS Manager معيّن وله وصول كامل
  ☐ Approvers لكل قسم لديهم صلاحيات
  ☐ Data Entry Users لديهم وصول للإدخال فقط
  ☐ Indicator Owners يرون مؤشراتهم فقط
  ☐ Executives يرون التقارير النهائية فقط

☐ التدريب (Training)
  ☐ جميع مالكي المؤشرات تدربوا
  ☐ جميع مُدخِلي البيانات تدربوا
  ☐ جميع المعتمدين تدربوا
  ☐ مدير الجودة مُهيّأ
  ☐ دليل مستخدم موزّع (Word/PDF)

☐ الاختبار النهائي (Final Testing)
  ☐ UAT نجح من جميع الأقسام
  ☐ لا توجد bugs عالية الأولوية
  ☐ Backup تم أخذه
  ☐ Rollback plan معدّ

☐ الإطلاق (Go-Live)
  ☐ تم تعيين مسؤول الإطلاق (GO-LIVE COMMANDER)
  ☐ Support line مفتوح (رقم هاتف / Slack)
  ☐ Monitoring dashboard نشط
  ☐ تسجيل الأخطاء والمشاكل الفورية
  ☐ First wave: 20% من المؤشرات (اختبار حقيقي)

☐ بعد الإطلاق (Post-Launch)
  ☐ مراجعة يومية أول أسبوع
  ☐ تصحيح الأخطاء الفورية (hot fixes)
  ☐ تقرير حالة منتصف الأسبوع
  ☐ تقرير نهائي بعد شهر كامل
  ☐ تحديد الدروس المستفادة
```

---

## 6. معادلة النجاح (Success Metrics)

### 6.1 KPIs لقياس نجاح النموذج

```
المقياس                            الهدف           الحد الأدنى      القياس
────────────────────────────────────────────────────────────────
معدل الامتثال                      95%             85%             شهري
نسبة الإدخالات في الموعد            92%             80%             شهري
نسبة الاعتماد الأول                 98%             90%             شهري
متوسط وقت الاعتماد                  2 أيام          5 أيام         شهري
نسبة المؤشرات الخضراء                75%             60%             شهري
متوسط وقت حل التأخيرات               3 أيام          7 أيام         شهري
فعالية CAPAs المفتوحة                90%             75%             ربع سنوي
رضا الموظفين على النظام             4/5             3/5             نصف سنوي
```

---

## 7. الملاحق (Appendices)

### 7.1 قالب RACI Matrix

```
Task / Responsibility    | Owner | Approver | Consulted | Informed
────────────────────────┼───────┼──────────┼───────────┼──────────
Create Indicator        | QM    | Exec     | Owner     | All
Assign Ownership        | QM    | Own      | Exec      | Dept Head
Enter Data Monthly      | Data  | Approver | Owner     | QM
Approve KPI Entry       | App   | QM       | Owner     | Data
Monitor Late Entries    | QM    | Exec     | Own       | All Dept
Issue Formal CAPA       | QM    | Exec     | Own       | HR
Review Management       | QM    | Exec     | All       | All Dept
Update Annual Targets   | Own   | QM       | Exec      | Data
```

### 7.2 قالب بريد إلكتروني للتذكيرات

**التذكير الأول (Day 5):**

```
الموضوع: تذكير - إدخال بيانات مؤشر [IND-CODE] للشهر [MONTH/YEAR]

السلام عليكم،

هذا تذكير ودود بأن موعد إدخال بيانات المؤشر أدناه قريب:

المؤشر: [IND-CODE] - [INDICATOR_NAME]
الفترة: [MONTH] / [YEAR]
المالك: [OWNER_NAME]
مُدخِل البيانات المتوقع: [DATA_ENTRY_USER]
الموعد النهائي: [DUE_DATE]

الرابط: [DIRECT_LINK_TO_FORM]

يرجى التأكد من إدخال البيانات والأدلة اللازمة قبل الموعد المحدد.

مع التقدير،
نظام إدارة الجودة
```

**التنبيه الثاني (Day 10):**

```
الموضوع: تنبيه عاجل - تأخر إدخال مؤشر [IND-CODE]

السلام عليكم،

لم يتم استقبال بيانات المؤشر التالي حتى الآن:

المؤشر: [IND-CODE] - [INDICATOR_NAME]
الفترة: [MONTH] / [YEAR]
أيام التأخير: [DAYS_LATE]
مالك المؤشر: [OWNER_NAME]
مُدخِل البيانات: [DATA_ENTRY_USER]

الإجراء المطلوب:
1. إدخال البيانات والأدلة فوراً
2. تحديد سبب التأخير (إن وجد)

الموعد الجديد المقترح: [NEW_DUE_DATE]

تحذير: سيتم بدء إجراء رسمي إذا تأخر الإدخال عن [FORMAL_DEADLINE]

مع التقدير،
نظام إدارة الجودة
```

---

## 8. الخلاصة التنفيذية

نموذج الحوكمة المقترح يوفر:

1. **وضوح الأدوار**: 6 أدوار محددة بوضوح مع مسؤوليات منفصلة
2. **فرض منظم**: 4 مستويات تصعيد من التذكير إلى الإجراء الانضباطي
3. **معايير صارمة**: 8 معايير للمؤشر الجيد مع checklist للتحقق
4. **تتبع شامل**: 6 جداول تتبع توفر رؤية 360 درجة
5. **تطبيق عملي**: خطة تنفيذ مرحلية على 6 أسابيع
6. **استدامة**: نسب نجاح واضحة ومراقبة مستمرة

**المتوقع بعد 3 أشهر:**
- معدل امتثال 90%+
- تحسن 25% في أداء المؤشرات
- تقليل التأخيرات بـ 70%
- ثقة أكبر من الإدارة العليا في البيانات

---

**تاريخ الإعداد:** 2 مايو 2026  
**التوقيع:** _________________ (مدير الجودة)  
**الموافقة:** _________________ (الإدارة العليا)
