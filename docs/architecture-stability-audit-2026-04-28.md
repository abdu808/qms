# تقرير فحص استقرار المعمارية — QMS
**التاريخ:** 2026-04-28  
**الفرع:** `architecture-stabilization-audit` → مدمج في `main` @ `79967e6`  
**النطاق:** بعد دمج C1–C7 + Strategic Planning v2  
**حالة Pre-UAT:** Deploy #1 ✅ · Deploy #2 ✅ · Deploy #3 جارٍ · فحص البيانات 10/10 ✅ · health db=ok ✅

---

## § 1 — ملخص تنفيذي

| المحور | الحالة | ملاحظة |
|--------|--------|--------|
| نماذج قاعدة البيانات | ✅ مستقرة | 40+ نموذج، soft-delete موحَّد |
| مسارات API | ✅ مكتملة | 80+ ملف route، crudFactory موحَّد |
| الجدول الزمني (Scheduler) | ✅ يعمل | 8 فحوصات ساعية + 3 مهام يومية + 1 أسبوعية |
| النسخ الاحتياطي | ✅ C7 AES-256-GCM | يعمل بـ `QMS_BACKUP=on` |
| حوكمة الذكاء الاصطناعي | ⚠️ ثغرة جزئية | 5 أدوات كتابة خارج ALWAYS_REVIEW |
| الواجهة الأمامية | ⚠️ ناقصة | `planVersions` غائبة من planning.js |
| سلامة البيانات | 🔲 بانتظار التشغيل | سكربت جاهز: `check-data-integrity.mjs` |
| الاختبارات | ✅ شاملة | 20 ملف · ~393 حالة اختبار |

---

## § 2 — جدول المشكلات

### 🔴 عالية الأولوية

| الرقم | المعرف | المكان | المشكلة | التأثير | الإصلاح |
|-------|--------|--------|---------|---------|---------|
| 1 | AI-GOV-001 | `tools.js` → `ALWAYS_REVIEW_TOOLS` | 5 أدوات كتابة خارج ALWAYS_REVIEW: `create_ncr`, `create_capa`, `plan_audit`, `create_complaint`, `create_risk` | المستشار الآلي يمكنه إنشاء NCR / CAPA / شكاوى / مراجعات دون عرضها على المستخدم للموافقة | إضافة الخمسة لـ `ALWAYS_REVIEW_TOOLS` في tools.js |

### 🟡 متوسطة الأولوية

| الرقم | المعرف | المكان | المشكلة | التأثير | الإصلاح |
|-------|--------|--------|---------|---------|---------|
| 2 | FE-001 | `planning.js` | `planVersions` غائب من modules-config | لا يوجد UI لعرض/إنشاء StrategicPlanVersion رغم وجود route ونموذج | إضافة قسم `planVersions` (read-only) لـ planning.js |
| 3 | DATA-001 | `schema.prisma` + DB | لا يوجد CHECK constraint على مستوى DB لفرض FK واحد في KpiEntry | Prisma Studio / migration script يمكنه إدراج صفوف بـ FK مزدوج أو صفر | تطبيق migration يدوي يضيف CHECK (راجع خطة v2 § 1.3) |
| 4 | DATA-002 | `schema.prisma` + `planning.js` | StrategicGoal: `perspective String?` (legacy) + `axisId String?` (v2) كلاهما نشط | الفرونت يعرض `perspective` كنص حر (قائمة قديمة) بجانب `axisId` FK — خطر تعارض بيانات | بعد اكتمال ترحيل البيانات: ترحيل perspective → Axis ثم soft-deprecate الحقل |

### 🔵 منخفضة / معلومات

| الرقم | المعرف | المكان | المشكلة | التأثير | الإصلاح |
|-------|--------|--------|---------|---------|---------|
| 5 | SCHED-001 | `scheduler.js:622` | النسخ الاحتياطي يتطلب `QMS_BACKUP=on` (env) — غير موثَّق في startup checklist | قد يُنسى تفعيله في بيئة Coolify الجديدة | إضافة فحص `/api/health/deep` يكشف عن غياب القيمة |
| 6 | AI-GOV-002 | `tools.js` → `update_strategic_goal` | الأداة تقبل `initiatives: String` (legacy field) وترسله للـ route الذي يكتبه على `legacyInitiatives` — يتعارض مع v2 Initiative model | الذكاء يكتب على الحقل القديم بدلاً من إنشاء Initiative عبر `create_initiative` | إزالة حقل `initiatives` من schema أداة `update_strategic_goal` / `create_strategic_goal` |

---

## § 3 — نتائج فحص سلامة البيانات

**السكربت:** `apps/api/scripts/check-data-integrity.mjs`

### تشغيل الفحص

```bash
# قراءة فقط — آمن للإنتاج
cd apps/api
node scripts/check-data-integrity.mjs

# للتكامل في CI أو عند الـ deployment
node scripts/check-data-integrity.mjs --json | jq '.summary'
```

### الفحوصات المُضمَّنة (10 فحوصات)

| المعرف | الوصف | الشدة |
|--------|-------|-------|
| KPI-001 | KpiEntry يتامى (objectiveId + activityId + indicatorId كلها null) | ERROR |
| KPI-002 | KpiEntry بـ FK مزدوج (أكثر من رابط واحد) | ERROR |
| KPI-003 | KpiEntry بـ actualValue = null (إدخال ناقص) | WARN |
| AT-001 | AnnualTarget مكرر (indicatorId + year) | ERROR |
| IND-001 | Objective تحمل أكثر من Indicator واحد | WARN |
| FUT-001 | FollowUpTask نشطة بلا مالك فعّال | ERROR |
| AF-001 | AuditFinding بلا Audit أب (يتيم) | ERROR |
| RSK-001 | Risk مرتفع/حرج ناقص بيانات (owner/dept/treatment/reviewDate) | ERROR |
| NCR-001 | NCR مُغلق بلا توثيق التحقق (verifiedAt/verifiedNote/effective) | ERROR |
| CAPA-001 | CAPA مُغلقة بلا فحص فاعلية (effective = null) | ERROR |

> **ملاحظة:** النتائج الفعلية تُولَّد عند تشغيل السكربت على البيانات الحقيقية.
> عند تشغيله على بيئة development فارغة سترى جميع الفحوصات "✅ نظيفة".

---

## § 4 — نتائج الواجهة الأمامية

### ما تم فحصه

| الملف | الأقسام | الحالة |
|-------|---------|--------|
| `planning.js` | strategicPlans, strategicGoals, objectives, risks, operationalActivities, **axes**, **indicators**, **annualTargets**, **initiatives**, **fundingSources**, **fundingPlans** | ✅ مكتمل (ماعدا planVersions) |
| `operation.js` | NCR, CAPA, corrective actions... | ✅ موجود |
| `support.js` | documents, training... | ✅ موجود |
| `evaluation.js` | audits, supplier evaluations... | ✅ موجود |
| `context.js` | departments, users, settings... | ✅ موجود |

### مشكلات محددة

**FE-001 — planVersions غائبة:**
- `StrategicPlanVersion` موجود في: schema.prisma ✅ · route `/api/plan-versions` ✅ · permissions-matrix.js ✅
- **غائب من:** `planning.js` ← لا يوجد أي قسم `planVersions`
- الأثر: المستخدم لا يرى تاريخ إصدارات الخطة من الواجهة

**FE-002 — الحقول القديمة لا تزال ظاهرة:**
- StrategicGoal.cols يعرض `kpi` و `perspective` و `target` (legacy fields)
- `legacyInitiatives` يظهر في الـ fields بـ hint "حقل قديم" — ✅ مقبول كحل مرحلي

**FE-003 — مؤشر indicatorId في KPI entry:**
- `kpi.js` يدعم `indicatorId` في `POST /entries` ✅
- الواجهة (لو كانت تستخدم generic form) لا تعرض `indicatorId` في حقول الإدخال اليدوي — يحتاج فحصاً بصرياً

### ما يعمل بشكل صحيح
- `axes`, `indicators`, `annualTargets`, `initiatives`, `fundingSources`, `fundingPlans` — كلها موجودة وكاملة الحقول في planning.js ✅
- relation fields مربوطة بشكل صحيح (indicatorId → indicators، goalId → strategicGoals) ✅
- statusOptions موجودة لكل قسم قابل للتصفية ✅
- حقل `axisId` غائب من strategic goals form في planning.js (يظهر `perspective` القديم فقط) — تحتاج إضافة relation field

---

## § 5 — نتائج حوكمة الذكاء الاصطناعي

### TOOL_PERMISSIONS — 51 أداة مسجَّلة

| الفئة | العدد | الحالة |
|-------|-------|--------|
| READ_ONLY_TOOLS | 15 | ✅ لا تحتاج مراجعة |
| ALWAYS_REVIEW_TOOLS | 14 | ✅ مُعرَّفة بشكل صريح |
| أدوات كتابة عادية | 22 | ✅ محمية بـ TOOL_PERMISSIONS |
| **أدوات كتابة خارج ALWAYS_REVIEW** | **5** | ❌ ثغرة |

### ✅ ما يعمل صحيح

1. **deny-by-default**: أدوات غير مسجَّلة في `TOOL_PERMISSIONS` → `deny` بـ `403` ✅
2. **ALWAYS_REVIEW_TOOLS (14 أداة):**
   - Strategic planning v2: `create/update_indicator`, `create/update_initiative`, `create/update_annual_target` ✅
   - Core planning: `create/update_strategic_goal`, `create/update_operational_activity` ✅
   - ISO: `close_ncr`, `close_capa` ✅
3. **DEPT_MANAGER scope في get_system_state:**
   - `annualTargets`: `{ indicator: { objective: { departmentId: deptScopeId } } }` ✅
   - `initiatives`: `{ deletedAt: null, departmentId: deptScopeId }` ✅
4. **Plan Freeze**: crudFactory يفرض `frozenAt` على جميع نماذج التخطيط — SUPER_ADMIN يتجاوز ✅
5. **EMPLOYEE لا يستطيع الكتابة**: TOOL_PERMISSIONS يتطلب `MANAGER_UP` للأدوات الحساسة ✅
6. **لا بيانات حساسة في logs**: backup key لا يُطبع، المفتاح من env فقط ✅

### ❌ AI-GOV-001 — الثغرة المحددة

الأدوات التالية تُنشئ/تُعدِّل سجلات **بدون** عرض على المستخدم للموافقة أولاً:

```
create_ncr       → ينشئ عدم مطابقة رسمية تلقائياً
create_capa      → ينشئ إجراء تصحيحي/وقائي تلقائياً  
plan_audit       → يُجدول تدقيقاً داخلياً تلقائياً
create_complaint → ينشئ شكوى رسمية تلقائياً
create_risk      → ينشئ خطراً في السجل الرسمي تلقائياً
```

**الإصلاح المقترح:**

```javascript
// في tools.js — إضافة للـ ALWAYS_REVIEW_TOOLS
export const ALWAYS_REVIEW_TOOLS = new Set([
  // ... الأدوات الموجودة ...
  'create_ncr',
  'create_capa',
  'plan_audit',
  'create_complaint',
  'create_risk',
]);
```

### ⚠️ AI-GOV-002 — حقل initiatives القديم

أداة `update_strategic_goal` و `create_strategic_goal` تقبلان `initiatives: String` مما يكتب على `legacyInitiatives` — يتجاوز نموذج `Initiative` المستقل الجديد.

---

## § 6 — عدد الاختبارات

### إجمالي الاختبارات: 20 ملف · ~393 حالة اختبار

| الملف | الحالات | المحتوى |
|-------|---------|---------|
| `permissions.test.js` | 45 | RBAC — الأدوار والصلاحيات |
| `consultantToolsPermissions.test.js` | 33 | صلاحيات أدوات AI |
| `security-c1-c4.test.js` | 34 | C1–C4: hook propagation، timing attack، ext blocklist، log injection |
| `documentApproval.test.js` | 29 | سير عمل اعتماد الوثائق |
| `ai-layer.test.js` | 28 | طبقة AI — توليد، أدوات |
| `backup-c6-c7.test.js` | 27 | C6–C7: preflight، AES-256-GCM، key management |
| `rollup.test.js` | 22 | إعادة حساب الـ KPI |
| `schemas.test.js` | 22 | مخططات Zod |
| `ai-tool-permissions.test.js` | 18 | أذونات أدوات AI |
| `phase2.test.js` | 18 | اختبارات المرحلة 2 |
| `audit-finding.test.js` | 16 | نتائج التدقيق |
| `softDelete.test.js` | 16 | الحذف الناعم |
| `riskHighCritical.test.js` | 15 | مخاطر مرتفعة/حرجة |
| `followup-tasks.test.js` | 14 | مهام المتابعة |
| `reportBuilder.test.js` | 12 | بناء التقارير |
| `kpiSmartFilters.test.js` | 11 | مرشحات KPI الذكية |
| `ncrClosure.test.js` | 11 | إغلاق عدم المطابقة |
| `normalize.test.js` | 10 | تطبيع البيانات |
| `smoke.test.js` | 9 | اختبارات الدخان |
| `fileSignatures.test.js` | 3 | التحقق من امتدادات الملفات |

### تغطية حرجة

| المنطقة | تغطيتها؟ | الاختبار |
|---------|---------|---------|
| C1 — hook error propagation | ✅ | `security-c1-c4.test.js` |
| C2 — timing attack | ✅ | `security-c1-c4.test.js` |
| C3 — extension blocklist | ✅ | `security-c1-c4.test.js` + `fileSignatures.test.js` |
| C4 — log injection | ✅ | `security-c1-c4.test.js` |
| C6 — preflight + rotation guard | ✅ | `backup-c6-c7.test.js` |
| C7 — AES-256-GCM round-trip + tamper | ✅ | `backup-c6-c7.test.js` |
| RBAC roles | ✅ | `permissions.test.js` |
| AI tool permissions | ✅ | `ai-tool-permissions.test.js` + `consultantToolsPermissions.test.js` |
| Plan freeze enforcement | ❌ | **غير مُختبر بعد** |
| DEPT_MANAGER AI scope | ❌ | **غير مُختبر بعد** |
| KpiEntry triple-FK validation | ⚠️ | `schemas.test.js` (جزئي) |

---

## § 7 — جدول Routes الرئيسية

### مسارات التخطيط الاستراتيجي v2

| المسار | الملف | صلاحية الكتابة | freeze-aware |
|--------|-------|--------------|-------------|
| `/api/strategic-plans` | `strategicPlans.js` | QM_UP | ✅ |
| `/api/strategic-goals` | `strategicGoals.js` | MANAGER_UP | ✅ |
| `/api/axes` | `axes.js` | SA | ✅ |
| `/api/indicators` | `indicators.js` | MANAGER_UP | ✅ |
| `/api/annual-targets` | `annual-targets.js` | MANAGER_UP | ✅ |
| `/api/initiatives` | `initiatives.js` | MANAGER_UP | ✅ |
| `/api/funding-sources` | `funding-sources.js` | QM_UP | ✅ |
| `/api/funding-plans` | `funding-plans.js` | QM_UP | ✅ |
| `/api/plan-versions` | `plan-versions.js` | QM_UP (read) / SA (write) | — |

### مسارات KPI

| المسار | الوصف |
|--------|-------|
| `POST /api/kpi/entries` | إدخال قيمة (upsert) — يدعم objectiveId / activityId / indicatorId |
| `POST /api/kpi/entries/bulk` | إدخال مُجمَّع (500 صف أقصى) |
| `POST /api/kpi/entries/preview` | معاينة بدون حفظ |
| `GET /api/kpi/matrix` | مصفوفة heatmap |
| `GET /api/kpi/dashboard` | لوحة تنفيذية |
| `GET /api/kpi/alerts` | التنبيهات النشطة |

### مهام الجدول الزمني (Scheduler)

| الوظيفة | التكرار | الوصف |
|---------|--------|-------|
| `checkOverdueNcrs()` | ساعي | NCR متأخر → إشعار للمكلَّف |
| `checkSlaBreaches()` | ساعي | SLA شكاوى + NCR (BREACHED / DUE_SOON) + webhook |
| `checkDocumentsDueForReview()` | ساعي | وثائق تستحق مراجعة خلال 30 يوم |
| `checkStaleRisks()` | ساعي | مخاطر مرتفعة/حرجة لم تُحدَّث 90 يوماً |
| `checkMissingPolicyAcks()` | ساعي | إقرارات سياسة الجودة الغائبة |
| `checkMissingAckDocuments()` | ساعي | إقرارات وثائق AckDocument الغائبة |
| `checkStuckNcrs()` | ساعي | NCR بلا correctiveAction > 30 يوم |
| `checkDueManagementReview()` | ساعي | مراجعة إدارية مستحقة (ISO 9.3) |
| `dailyDataHealthScan()` | يومي (بعد 6 ص) | NCR منتهية + شكاوى مفتوحة + وثائق بلا مراجعة + مستخدمون بلا قسم |
| `runProgressReportMonthly()` | يومي | توليد تقارير الأقسام (أيام 1-3) + تذكير (يوم 5+) + تصعيد (يوم 15+) |
| `cleanupExpiredRefreshTokens()` | يومي | تنظيف refresh tokens منتهية (> 30 يوم) |
| `sendWeeklyExecSummary()` | أسبوعي (الإثنين 8ص) | ملخص تنفيذي: NCR + شكاوى + SLA |
| `runDailyBackupIfDue()` | يومي (بعد 2ص، `QMS_BACKUP=on`) | دورة نسخ AES-256-GCM |

---

## الخطوات الموصى بها

### أولوية عالية (هذا الأسبوع)
1. **AI-GOV-001**: إضافة `create_ncr`, `create_capa`, `plan_audit`, `create_complaint`, `create_risk` لـ `ALWAYS_REVIEW_TOOLS`
2. **DATA-001**: تطبيق migration يدوي يضيف CHECK constraint على KpiEntry
3. تشغيل `node scripts/check-data-integrity.mjs` على الإنتاج والتحقق من النتائج

### أولوية متوسطة (هذا الشهر)
4. **FE-001**: إضافة قسم `planVersions` (read-only) لـ planning.js
5. **FE-003**: إضافة `axisId` كـ relation field في نموذج strategic goals
6. **AI-GOV-002**: إزالة `initiatives: String` من schemas أدوات الأهداف الاستراتيجية
7. كتابة اختبارات plan freeze + DEPT_MANAGER AI scope (التوصيات المعلَّقة من v2)

### مؤجلة (خارج النطاق الحالي)
8. ترحيل `perspective` → `axisId` بعد اكتمال ترحيل البيانات (Phase 6 من خطة v2)
9. إضافة `SCHED-001` لـ `/api/health/deep` (فحص `QMS_BACKUP`)
