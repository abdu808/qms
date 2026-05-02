# خطوة التطبيق 1️⃣: تطبيق Prisma Schema والـ APIs
## Step 1: Apply Prisma Schema and APIs

---

## ✅ المتطلبات (Prerequisites)

```bash
# تأكد من وجود Node.js و npm
node --version
npm --version

# تأكد من كونك في مجلد API
cd C:\Users\abdu8\Documents\dev\qms\apps\api
```

---

## 🚀 الخطوات (Steps)

### الخطوة 1: التحقق من التعديلات
```bash
# تحقق من أن schema.prisma تم تحديثها بشكل صحيح
# يجب أن ترى:
# - model KpiFollowUp (جديد)
# - علاقات جديدة في Indicator
# - علاقات جديدة في User
# - علاقات جديدة في Department
# - علاقات جديدة في KpiEntry

cat prisma/schema.prisma | grep -A5 "KPI FOLLOW-UP SYSTEM"
```

### الخطوة 2: إنشاء ملف Migration
```bash
# تنفيذ أمر Prisma لإنشاء migration
cd apps/api
npx prisma migrate dev --name add_kpi_followup_system

# إذا طُلب منك إدخال اسم Migration، اختر:
# → add_kpi_followup_system
```

### الخطوة 3: التحقق من نجاح Migration
```bash
# تحقق من أن الجداول تم إنشاؤها
npx prisma db execute --stdin << 'EOF'
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%kpi%';
EOF

# يجب أن ترى:
# - KpiFollowUp (جدول جديد)
# - KpiEntry (موجود)
```

### الخطوة 4: دمج API Routes
```bash
# فتح ملف API الرئيسي
# C:\Users\abdu8\Documents\dev\qms\apps\api\src\index.ts

# أضف هذا السطر بعد الـ import الأخرى:
import kpiFollowUpRoutes from './routes/kpiFollowUp.routes';

# أضف هذا السطر بعد تسجيل الـ routes الأخرى:
app.use('/api/kpi-followups', kpiFollowUpRoutes);
```

### الخطوة 5: اختبار الـ API
```bash
# ابدأ development server
npm run dev

# في نافذة أخرى، اختبر الـ API
curl -X GET http://localhost:3000/api/kpi-followups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# يجب أن تحصل على:
# { "data": [], "pagination": { ... } }
```

---

## 📊 ملخص الـ API Endpoints

| الطريقة | المسار | الوصف |
|--------|--------|-------|
| GET | `/api/kpi-followups` | قائمة المتابعات (مع تصفية) |
| GET | `/api/kpi-followups/:id` | تفاصيل متابعة واحدة |
| GET | `/api/kpi-followups/stats/summary` | إحصائيات لوحة التحكم |
| POST | `/api/kpi-followups` | إنشاء متابعة جديدة |
| PATCH | `/api/kpi-followups/:id` | تحديث الملاحظات والحالة |
| POST | `/api/kpi-followups/:id/escalate` | تصعيد إلى المستوى التالي |
| POST | `/api/kpi-followups/:id/resolve` | وضع علامة على أنها مُحلّة |
| DELETE | `/api/kpi-followups/:id` | إلغاء المتابعة |

---

## 🔒 الصلاحيات (Permissions)

فقط الأدوار التالية يمكنها الوصول:
- `SUPER_ADMIN` - وصول كامل
- `QUALITY_MANAGER` - وصول كامل
- `EXECUTIVE_DIRECTOR` - وصول كامل

---

## ⚙️ متغيرات البيئة المطلوبة

```env
# موجودة بالفعل في .env.example
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=your_secret_key
```

---

## ✔️ قائمة التحقق (Checklist)

- [ ] تم تحديث `prisma/schema.prisma`
- [ ] تم إنشاء ملف `kpiFollowUp.routes.ts`
- [ ] تم تنفيذ `npx prisma migrate dev`
- [ ] تم إضافة الـ routes إلى `index.ts`
- [ ] تم اختبار الـ API endpoints
- [ ] لا توجد أخطاء في server log
- [ ] قاعدة البيانات تحتوي على جدول `KpiFollowUp`

---

## 🆘 استكشاف الأخطاء

### خطأ: "Unique constraint failed"
**السبب:** محاولة إنشاء متابعة لنفس المؤشر والشهر مرتين
**الحل:** تأكد من أن البيانات فريدة

### خطأ: "Foreign key constraint failed"
**السبب:** المستخدم أو القسم لا يوجد
**الحل:** تأكد من أن جميع IDs موجودة

### خطأ: "Permission denied"
**السبب:** المستخدم ليس QM أو Executive Director
**الحل:** استخدم حساب بالصلاحيات المناسبة

---

## 📝 مثال طلب API

```bash
# 1. إنشاء متابعة
curl -X POST http://localhost:3000/api/kpi-followups \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "indicatorId": "cuid123",
    "departmentId": "cuid456",
    "dataEntryUserId": "cuid789",
    "year": 2026,
    "month": 5,
    "dueDate": "2026-05-10T00:00:00Z",
    "performanceOwnerId": "cuid999"
  }'

# 2. تصعيد المتابعة
curl -X POST http://localhost:3000/api/kpi-followups/kfuid123/escalate \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "escalationLevel": 1,
    "notes": "لم يدخل البيانات بعد 10 أيام"
  }'

# 3. وضع علامة على أنها مُحلّة
curl -X POST http://localhost:3000/api/kpi-followups/kfuid123/resolve \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "resolvedEntryId": "entryid123"
  }'
```

---

✅ **اكتملت المرحلة 1!**

الخطوة التالية: بناء لوحة التحكم (Dashboard)
