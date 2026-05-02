# 🔗 دليل دمج صفحة سجل متابعة الإدخالات المتأخرة
# Integration Guide - KPI Follow-Up Page

---

## 📍 موقع الملفات

```
✅ React Component: apps/web/src/pages/KpiFollowUp.tsx
✅ API Routes: apps/api/src/routes/kpiFollowUp.routes.ts
✅ Database Model: apps/api/prisma/schema.prisma (KpiFollowUp)
```

---

## 🔧 خطوات التكامل

### الخطوة 1️⃣: إضافة المسار في app.js

**الملف:** `apps/web/public/app.js`

**البحث عن السطر الذي يحتوي على:**
```javascript
else if (id === 'kpiTracking') await this.kpiInit();
```

**أضف بعده:**
```javascript
else if (id === 'kpiFollowUp') await this.loadKpiFollowUp();
```

**المثال الكامل:**
```javascript
// ------ navigation ------
async goto(id) {
  this.page = id;
  this.search = '';
  this.filterStatus = '';
  this.filterYear = '';
  this.currentPage = 1;
  this.totalItems = 0;
  
  if (id === 'dashboard') await this.loadDashboard();
  else if (id === 'kpiTracking') await this.kpiInit();
  else if (id === 'kpiFollowUp') await this.loadKpiFollowUp();  // ← جديد
  else if (id === 'myKpi') await this.loadMyKpi();
  else await this.loadList();
}
```

---

### الخطوة 2️⃣: إضافة دالة التحميل

**أضف هذه الدالة في نفس الملف (app.js):**

```javascript
// ─── KPI Follow-Up System ───────────────────────────────────────
kpiFollowUpList: null,
kpiFollowUpStats: null,
kpiFollowUpLoading: false,

async loadKpiFollowUp() {
  try {
    this.kpiFollowUpLoading = true;
    const [list, stats] = await Promise.all([
      this.api('GET', '/kpi-followups?limit=100'),
      this.api('GET', '/kpi-followups/stats/summary'),
    ]);
    this.kpiFollowUpList = list.data;
    this.kpiFollowUpStats = stats;
  } catch (e) {
    alert(e.message || 'فشل تحميل سجل المتابعة');
    this.kpiFollowUpList = null;
    this.kpiFollowUpStats = null;
  } finally {
    this.kpiFollowUpLoading = false;
  }
},

async escalateKpiFollowUp(followUpId, notes) {
  try {
    const result = await this.api('POST', `/kpi-followups/${followUpId}/escalate`, {
      escalationLevel: 1,
      notes: notes,
    });
    await this.loadKpiFollowUp();
    return result;
  } catch (e) {
    alert(e.message || 'فشل التصعيد');
    throw e;
  }
},

async resolveKpiFollowUp(followUpId, entryId) {
  try {
    const result = await this.api('POST', `/kpi-followups/${followUpId}/resolve`, {
      resolvedEntryId: entryId,
    });
    await this.loadKpiFollowUp();
    return result;
  } catch (e) {
    alert(e.message || 'فشل الحل');
    throw e;
  }
},
```

---

### الخطوة 3️⃣: إضافة الصلاحيات

**في نفس الملف (app.js)، ابحث عن:**
```javascript
const PERMISSIONS = {
  kpi: { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
```

**أضف بعده:**
```javascript
'kpi-followups': { read:_QM_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP, escalate:_QM_UP },
```

---

### الخطوة 4️⃣: إضافة التبويب في القائمة الجانبية

**الملف:** `apps/web/public/index.html`

**ابحث عن قسم Navigation/Menu**

**أضف هذا البند:**
```html
<a href="#" @click.prevent="goto('kpiFollowUp')" 
   :class="{ 'bg-indigo-700': page === 'kpiFollowUp', 'hover:bg-indigo-600': page !== 'kpiFollowUp' }"
   class="block px-4 py-3 text-right text-white transition">
  📋 سجل متابعة الإدخالات
  <span v-if="page === 'kpiFollowUp'" class="text-xs text-indigo-300">
    ({{ kpiFollowUpStats?.totalOverdue || 0 }} متأخر)
  </span>
</a>
```

---

### الخطوة 5️⃣: إضافة صفحة HTML/Template

**في نفس الملف (index.html)، ابحث عن:**
```html
<template x-if="page === 'kpiTracking'">
```

**أضف قبله أو بعده:**
```html
<!-- KPI FOLLOW-UP PAGE -->
<template x-if="page === 'kpiFollowUp'">
  <div class="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-gray-800">سجل متابعة الإدخالات المتأخرة</h1>
      <p class="text-gray-600">إدارة المؤشرات المتأخرة والإجراءات التصحيحية</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" v-if="kpiFollowUpStats">
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600 text-sm">إجمالي المتأخرات</p>
        <p class="text-3xl font-bold text-red-600">{{ kpiFollowUpStats.totalOverdue }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600 text-sm">قيد الانتظار</p>
        <p class="text-3xl font-bold text-yellow-600">
          {{ kpiFollowUpStats.byStatus?.find(s => s.status === 'PENDING')?._count || 0 }}
        </p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600 text-sm">مصعّدة</p>
        <p class="text-3xl font-bold text-orange-600">
          {{ kpiFollowUpStats.byStatus?.find(s => s.status === 'ESCALATED')?._count || 0 }}
        </p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600 text-sm">مُحلّة</p>
        <p class="text-3xl font-bold text-green-600">
          {{ kpiFollowUpStats.byStatus?.find(s => s.status === 'RESOLVED')?._count || 0 }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="kpiFollowUpLoading" class="text-center py-8">
      <p>جاري التحميل...</p>
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-indigo-600 text-white">
          <tr>
            <th class="px-4 py-3 text-right">الرمز</th>
            <th class="px-4 py-3 text-right">المؤشر</th>
            <th class="px-4 py-3 text-right">الإدارة</th>
            <th class="px-4 py-3 text-right">مدخل البيانات</th>
            <th class="px-4 py-3 text-right">تاريخ الاستحقاق</th>
            <th class="px-4 py-3 text-right">أيام التأخير</th>
            <th class="px-4 py-3 text-right">الحالة</th>
            <th class="px-4 py-3 text-right">الإجراء</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in kpiFollowUpList" :key="item.id" class="border-t hover:bg-gray-50">
            <td class="px-4 py-3 font-mono text-xs">{{ item.code }}</td>
            <td class="px-4 py-3">{{ item.indicator.nameAr }}</td>
            <td class="px-4 py-3">{{ item.department.name }}</td>
            <td class="px-4 py-3 text-sm">{{ item.dataEntryUser.name }}</td>
            <td class="px-4 py-3 text-sm">{{ new Date(item.dueDate).toLocaleDateString('ar-SA') }}</td>
            <td class="px-4 py-3 text-center">
              <span v-if="item.daysLate" class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                {{ item.daysLate }} يوم
              </span>
              <span v-else class="text-green-600">في الوقت</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-xs px-2 py-1 rounded"
                :class="{
                  'bg-yellow-100 text-yellow-800': item.status === 'PENDING',
                  'bg-orange-100 text-orange-800': item.status === 'ESCALATED',
                  'bg-green-100 text-green-800': item.status === 'RESOLVED',
                }">
                {{ item.status }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button v-if="item.status !== 'RESOLVED'" 
                @click="escalateKpiFollowUp(item.id, '')"
                class="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">
                تصعيد
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

---

## 🎨 التصميم والألوان

```
┌─────────────────────────────────────────────────┐
│  سجل متابعة الإدخالات المتأخرة                 │
│  (الخلفية: Gradient أزرق فاتح)                │
│                                                 │
│  [إحصائيات في 4 مربعات]:                       │
│  ├─ إجمالي: أحمر (15)                          │
│  ├─ قيد الانتظار: أصفر (5)                    │
│  ├─ مصعّدة: برتقالي (7)                        │
│  └─ مُحلّة: أخضر (3)                          │
│                                                 │
│  [جدول بيانات]:                                │
│  ├─ رأس: أزرق داكن (Indigo-600)               │
│  ├─ صفوف: بيضاء مع hover رمادي                │
│  └─ أزرار: برتقالي للتصعيد                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 الصلاحيات المطلوبة

| الدور | الوصول |
|------|--------|
| **QUALITY_MANAGER** | ✅ كامل |
| **EXECUTIVE_DIRECTOR** | ✅ كامل |
| **SUPER_ADMIN** | ✅ كامل |
| **DEPT_MANAGER** | ❌ محظور |
| **EMPLOYEE** | ❌ محظور |

---

## 📱 الاستجابة (Responsive)

```
📱 Mobile (< 768px):
   ├─ Stack الإحصائيات عمودياً
   ├─ جدول بتمرير أفقي
   └─ أزرار أصغر

💻 Tablet (768px - 1024px):
   ├─ شبكة 2x2 للإحصائيات
   └─ جدول كامل

🖥️ Desktop (> 1024px):
   ├─ شبكة 4 أعمدة للإحصائيات
   └─ جدول كامل مع جميع الأعمدة
```

---

## 🧪 اختبار التكامل

### 1. اختبر الملاحة:
```javascript
// في وحدة التحكم:
app.goto('kpiFollowUp');
// يجب أن ترى الصفحة الجديدة
```

### 2. اختبر تحميل البيانات:
```javascript
// يجب أن ترى:
// - app.kpiFollowUpList (array من المتابعات)
// - app.kpiFollowUpStats (إحصائيات)
// - app.kpiFollowUpLoading (false عند الانتهاء)
```

### 3. اختبر الأذونات:
```javascript
// تسجيل دخول كـ QUALITY_MANAGER
// ✅ يجب أن ترى التبويب والصفحة

// تسجيل دخول كـ EMPLOYEE
// ❌ يجب ألا ترى التبويب
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: الصفحة لا تظهر
**الحل:**
- تحقق من اسم الصفحة `kpiFollowUp` (بدون مسافات)
- تحقق من إضافة الدالة `loadKpiFollowUp()`
- افتح DevTools وتحقق من الأخطاء

### المشكلة: الجدول فارغ
**الحل:**
- تحقق من الـ API endpoints: `/api/kpi-followups`
- تحقق من token JWT
- تحقق من الدور (يجب أن يكون QUALITY_MANAGER أو أعلى)

### المشكلة: الأزرار لا تعمل
**الحل:**
- تحقق من دالة `escalateKpiFollowUp()`
- تحقق من الـ API endpoint: `/api/kpi-followups/:id/escalate`
- تحقق من الـ payload المرسل

---

## 🚀 قائمة التحقق النهائية

- [ ] تم إضافة المسار في `goto()` بـ app.js
- [ ] تم إضافة دالة `loadKpiFollowUp()` بـ app.js
- [ ] تم إضافة الصلاحيات في PERMISSIONS
- [ ] تم إضافة التبويب في القائمة الجانبية
- [ ] تم إضافة template الصفحة بـ index.html
- [ ] تم اختبار الملاحة والتحميل
- [ ] تم اختبار التصعيد والحل
- [ ] تم التحقق من الأذونات
- [ ] تم الرفع إلى GitHub
- [ ] تم النشر على الخادم

---

✅ **جاهز للاستخدام الفعلي!**

