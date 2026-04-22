# 🤖 خارطة طريق: الذكاء الاصطناعي كمدير جودة افتراضي

**التاريخ:** 2026-04-22
**الحالة:** مسودة نقاش — للتوسع لاحقاً (يوم عمل كامل)

---

## الرؤية

تحويل QMS من **أداة تسجيل** إلى **مساعد ذكي يُدير** نظام الجودة والخطة التشغيلية بشكل شبه مستقل:
- يتابع النقص
- يجلب البيانات حسب المؤشر والمسؤول
- يتواصل مع المسؤولين
- يولِّد التقارير التلقائية
- يُنبِّه الإدارة العليا بالانحرافات

---

## المكونات المقترحة

### 1. Followup Agent (موجود — مرحلة أولى)
فحوصات حالية:
1. وثائق قديمة > 365 يوم
2. CAPAs متأخرة
3. NCRs راكدة > 30 يوم
4. إقرارات السياسة الناقصة
5. غياب سياسة نشطة
6. مخاطر عالية بلا خطة

### 2. KPI Tracker Agent (مطلوب)
- **يفحص كل مؤشر:** هل له قيمة محدَّثة هذا الشهر؟
- **يُقارن القيمة بالمستهدف:** تنبيه إذا كان الانحراف > X%
- **يتابع المسؤول:** إشعار آلي + رسالة WhatsApp/Email
- **يطلب السبب:** إذا لم تُحقَّق القيمة، يسأل المسؤول عن السبب وخطة التصحيح

### 3. Operational Plan Agent (مطلوب)
- **يراقب النشاطات:** نسبة الإنجاز، الميزانية المصروفة، المسؤول
- **يربط النشاط بالهدف الاستراتيجي وبالمؤشر**
- **يُرسل تذكيرات** للمسؤولين قبل موعد الاستحقاق
- **يولِّد تقرير شهري** للإدارة العليا

### 4. Data Collection Agent (مطلوب)
- **يجلب البيانات تلقائياً** من المصادر:
  - نماذج Google Forms
  - Excel sheets على SharePoint
  - قواعد بيانات أخرى
  - WhatsApp responses
- **يُصنِّفها** حسب المؤشر والفترة
- **يُدخلها في KpiEntry**

### 5. Communication Agent (مطلوب)
- **يعرف مسؤول كل مؤشر/نشاط/مخاطرة**
- **يُرسل رسائل ذكية:**
  - "مدير الموارد البشرية: مؤشر رضا الموظفين متأخر — هل تريد نموذج جمع البيانات؟"
  - "مدير التبرعات: الهدف الربعي 80% — الانحراف 15% — السبب؟"
- **يُتابع الرد ويصعِّد** إذا لم يُستجب

### 6. Management Review Agent (مطلوب)
- **يولِّد محضر مراجعة الإدارة تلقائياً** من:
  - كل المؤشرات للفترة
  - كل NCRs/CAPAs
  - كل المخاطر
  - كل الشكاوى
  - نتائج التدقيق
  - تعليقات الأطراف المهتمة
- يحتاج فقط تعديلات بشرية خفيفة

### 7. Audit Preparation Agent (مطلوب)
- **قبل التدقيق الخارجي بشهر:**
  - يفحص كل بنود ISO
  - يجمع الأدلة لكل بند
  - يُنبِّه بالفجوات
  - يُولِّد ملف أدلة كامل للمدقق

---

## الفجوات الحالية المكتشفة (22 أبريل 2026)

### 🔴 كبيرة
1. **الخطط غير مرتبطة بالمؤشرات ولا بالمستهدفات**
   - `StrategicGoal` موجود (3) لكن بلا `targetValue` / `unit` / `frequency`
   - لا يوجد `Objective` مرتبط بكل هدف
   - لا يوجد `KpiEntry` يُسجِّل القيم الفعلية

2. **المؤشرات غير مرتبطة بمسؤولين**
   - لا يوجد حقل `ownerId` أو `responsibleUserId` في الأهداف/المؤشرات
   - لا يعرف النظام "من يُحدِّث هذا المؤشر"

3. **البيانات عشوائية في الأنشطة**
   - `OperationalActivity` له `title` و `description` فقط
   - لا يوجد: مسؤول، ميزانية، تاريخ بدء، تاريخ نهاية، نسبة إنجاز، هدف أب

### 🟡 متوسطة
4. الوثائق غير مربوطة بالأقسام المسؤولة
5. لا توجد علاقة بين Document و ISO Clause المحددة
6. Announcements كلها غير نشطة

---

## تشخيص: أين الخلل؟

**الجواب: الخلل في طبقة الاستيعاب (Ingestion Layer)، ليس في الملفات.**

### ما حدث:
`uploader.mjs` الحالي يعامل كل ملف **بشكل مستقل**:
```js
// Extract: title, summary, category, isoClause
// Upload: document / policy / goal / activity
// DONE
```

يستخرج **metadata سطحية فقط** ويتجاهل:
- الجداول داخل Excel (المستهدفات، المسؤولون، الميزانيات)
- العلاقات بين الملفات (نشاط ← هدف ← مؤشر)
- الأسماء والأقسام المذكورة (لربطها بـ `User` و `Department`)

### ما كان يجب أن يحدث:
استيعاب **ذو وعي بالعلاقات** — على مرحلتين:

**المرحلة 1: استخراج هيكلي**
- DOCX/PDF → AI يستخرج: `{title, isoClause, responsibleRole, linkedGoalCode, ...}`
- Excel → parse خلايا محددة: `{goalCode, kpiName, target, unit, frequency, ownerName, actualValue}`

**المرحلة 2: بناء العلاقات**
- بعد رفع كل السجلات، Agent ثانٍ يمشي على الكل:
  - يربط `OperationalActivity.goalId = StrategicGoal.id`
  - يُنشئ `Objective` لكل KPI ويربطه بالهدف
  - يُطابق أسماء المسؤولين مع `User.name` ويملأ `ownerId`
  - يستخرج المستهدفات من النصوص: "نسبة 85%" → `targetValue: 85, unit: '%'`

---

## الحل المقترح (ليوم عمل كامل)

### Phase A: توسيع السكيما (2 ساعة)
```prisma
model StrategicGoal {
  // + جديد:
  targetValue   Decimal?
  unit          String?     // "%", "ريال", "عدد"
  frequency     String?     // "شهري", "ربعي", "سنوي"
  ownerId       String?
  owner         User?       @relation(fields: [ownerId], references: [id])
  departmentId  String?
  startDate     DateTime?
  endDate       DateTime?
}

model OperationalActivity {
  // + جديد:
  goalId        String?
  goal          StrategicGoal? @relation(fields: [goalId], references: [id])
  ownerId       String?
  owner         User?
  budget        Decimal?
  spentBudget   Decimal?
  progress      Int       @default(0)  // 0-100
  startDate     DateTime?
  endDate       DateTime?
}

model KpiDefinition {   // جديد كلياً
  id            String    @id @default(cuid())
  code          String    @unique
  name          String
  goalId        String
  target        Decimal
  unit          String
  frequency     String
  ownerId       String
  formula       String?   // "إجمالي الشكاوى / إجمالي المستفيدين"
  dataSource    String?   // "Google Form", "Excel", "Manual"
}

model KpiEntry {
  kpiDefinitionId String   // بدلاً من objectiveId
  period          String   // "2026-Q1"
  actualValue     Decimal
  variance        Decimal? // محسوب آلياً
  note            String?
  submittedById   String
}
```

### Phase B: Structured Extractor (3 ساعات)
استخراج متخصِّص حسب نوع الملف:
- `excel-kpi-extractor.mjs` — يفهم هيكل الخطة الاستراتيجية
- `excel-plan-extractor.mjs` — يفهم الخطة التشغيلية
- `docx-policy-extractor.mjs` — يستخرج المسؤوليات من نصوص السياسات

كل extractor يُنتج JSON مُهيكل:
```json
{
  "type": "StrategicGoal",
  "code": "SG-001",
  "title": "...",
  "targetValue": 85,
  "unit": "%",
  "owner": "مدير الجودة",          // سيُطابق لاحقاً
  "kpis": [
    { "name": "...", "target": 90, "frequency": "شهري" }
  ],
  "linkedActivities": ["ACT-2026-0001", "ACT-2026-0002"]
}
```

### Phase C: Relationship Builder (2 ساعة)
بعد الرفع، agent ثالث يمشي على كل السجلات ويبني العلاقات:
```js
// 1. ربط كل نشاط بهدفه
// 2. مطابقة أسماء الأشخاص مع User.name (fuzzy match)
// 3. مطابقة الأقسام
// 4. توليد Objectives من KPIs
```

### Phase D: Communication Agent (ساعة)
- WhatsApp Web integration أو Email SMTP
- Templates لكل نوع تنبيه
- Queue + Retry

---

## خطة التنفيذ (ليوم كامل)

| الوقت | المهمة |
|---|---|
| 08:00-10:00 | Phase A: توسيع السكيما + migration |
| 10:00-13:00 | Phase B: extractors متخصِّصة |
| 14:00-16:00 | Phase C: Relationship builder |
| 16:00-17:00 | Phase D: Communication channels |
| 17:00-18:00 | اختبار end-to-end + تقرير |

---

## أسئلة للنقاش قبل البدء

1. **قناة التواصل المفضَّلة:** WhatsApp, Email, داخل النظام فقط؟
2. **مستوى الاستقلالية:** الوكيل يُرسل مباشرة، أم يقترح ويُرسل بعد موافقة الأدمن؟
3. **البيانات الخارجية:** هل ندمج مع Google Forms / SharePoint مبدئياً؟
4. **AI Model:** نستخدم Claude لكل شيء، أم نفصل (Haiku للفحوصات، Sonnet للتحليل)؟
5. **الجدولة:** cron يومي، أم trigger حسب الأحداث (event-driven)؟

---

## ملاحظات

- هذه الرؤية تحوِّل QMS إلى **مدير جودة افتراضي**، ليس مجرد نظام تسجيل
- القيمة الحقيقية تظهر بعد 3-6 شهور من التشغيل عندما يبدأ الذكاء يتعلَّم الأنماط
- يحتاج كل ذلك **بيانات نظيفة أولاً** — لذا الأولوية القصوى: إعادة استيعاب الملفات بالطريقة الهيكلية
