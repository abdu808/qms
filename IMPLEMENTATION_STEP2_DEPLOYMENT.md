# خطوة التطبيق 2️⃣: خطة النشر على الخادم الحي
## Step 2: Deployment Plan for Production

---

## 📋 نظرة عامة (Overview)

هذه الوثيقة تشرح كيفية نشر نظام متابعة الإدخالات المتأخرة (KPI Follow-Up) على خادم الإنتاج (Coolify) بدون وقت توقف.

**المدة المقدرة:** 2-3 ساعات  
**متطلبات الموارد:** 500 MB للقاعدة الجديدة  
**وقت التوقف المتوقع:** 5-10 دقائق

---

## 🔄 مراحل النشر (Deployment Phases)

### المرحلة 1️⃣: الاختبار المحلي (Local Testing)
**المدة:** 30 دقيقة

```bash
# 1. تأكد من أن كل التعديلات موجودة محلياً
cd C:\Users\abdu8\Documents\dev\qms
git status

# 2. شغّل الاختبارات
npm run test

# 3. شغّل التطبيق محلياً
npm run dev

# 4. اختبر الـ API endpoints
curl http://localhost:3000/api/kpi-followups -H "Authorization: Bearer TEST_TOKEN"

# 5. اختبر واجهة المستخدم
# افتح http://localhost:3000 وتصفح إلى صفحة KPI Follow-Up
```

### المرحلة 2️⃣: إعداد قاعدة البيانات (Database Preparation)
**المدة:** 20 دقيقة

```bash
# 1. إنشاء backup قبل التغيير
docker exec qms-db pg_dump -U qms_user qms_db | gzip > backup_pre_kpi_followup_$(date +%F).sql.gz

# 2. تحقق من نسخة Prisma
npx prisma --version

# 3. اختبر Migration محلياً
npm run migrate:test

# يجب أن ترى:
# "Migration apply successfully"
# "Database synced"
```

### المرحلة 3️⃣: الدفع إلى GitHub (Git Push)
**المدة:** 5 دقائق

```bash
# 1. إضافة التعديلات
git add .
git commit -m "feat: add KPI follow-up system for tracking late indicator entries

- Add KpiFollowUp model with escalation workflow
- Create API endpoints for CRUD operations
- Implement KPI Follow-Up dashboard page
- Add automatic escalation logic
- Support for QM manager notes and decision tracking

BREAKING_CHANGE: Database migration required"

# 2. دفع إلى الفرع الرئيسي
git push origin main

# ملاحظة: تفعيل auto-deploy من GitHub webhook
```

### المرحلة 4️⃣: المراقبة أثناء النشر (Monitoring)
**المدة:** 10-15 دقيقة

```bash
# 1. افتح لوحة Coolify
# https://coolify.aqiltech.sa (استخدم بيانات دخول IT Admin)

# 2. انتقل إلى project QMS

# 3. اضغط "Deploy" يدوياً إذا لم يتفعل auto-deploy

# 4. راقب السجلات (Logs):
# - الخادم: يجب أن يشير إلى "Database schema updated successfully"
# - قاعدة البيانات: تحقق من عدم وجود أخطاء

# 5. اختبر من قبل IT:
curl https://quality.aqiltech.sa/api/kpi-followups \
  -H "Authorization: Bearer ADMIN_TOKEN"

# يجب أن تحصل على:
# { "data": [], "pagination": { ... } }
```

### المرحلة 5️⃣: التحقق النهائي (Post-Deployment Verification)
**المدة:** 15 دقيقة

```bash
# 1. اختبر الـ API endpoints على الخادم
curl https://quality.aqiltech.sa/api/kpi-followups/stats/summary \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. اختبر من واجهة المستخدم
# - سجّل دخول كـ QMS Manager
# - انتقل إلى "سجل متابعة الإدخالات"
# - يجب أن ترى الصفحة (حتى لو بدون بيانات في البداية)

# 3. تحقق من قاعدة البيانات
docker exec qms-db psql -U qms_user -d qms_db -c "SELECT COUNT(*) FROM \"KpiFollowUp\";"

# 4. اختبر الإنشاء اليدوي
# من خلال واجهة المستخدم أو API:
curl -X POST https://quality.aqiltech.sa/api/kpi-followups \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "indicatorId": "ACTUAL_ID",
    "departmentId": "ACTUAL_ID",
    "dataEntryUserId": "ACTUAL_ID",
    "year": 2026,
    "month": 5,
    "dueDate": "2026-05-10T00:00:00Z"
  }'
```

---

## 🚨 خطة الطوارئ (Rollback Plan)

إذا حدثت مشكلة، اتبع هذه الخطوات:

### الخطوة 1: إيقاف الخدمة مؤقتاً
```bash
# في Coolify:
# 1. انتقل إلى Settings → Health Check
# 2. عطّل التحقق الصحي مؤقتاً

docker-compose stop qms-api
```

### الخطوة 2: استرجاع قاعدة البيانات
```bash
# استرجع النسخة الاحتياطية
gunzip < backup_pre_kpi_followup_2026-05-02.sql.gz | \
  docker exec -i qms-db psql -U qms_user qms_db
```

### الخطوة 3: التراجع عن الكود
```bash
git revert HEAD
git push origin main

# في Coolify: أعد النشر من الكود السابق
```

### الخطوة 4: أعد التشغيل
```bash
docker-compose up -d
```

---

## 📊 قائمة فحص النشر (Deployment Checklist)

### قبل النشر (Pre-Deployment)
- [ ] تم إنشاء نسخة احتياطية من قاعدة البيانات
- [ ] تم اختبار جميع التعديلات محلياً
- [ ] تم اختبار الـ API endpoints
- [ ] تم اختبار واجهة المستخدم
- [ ] تم مراجعة أسطر الكود (Code Review)
- [ ] تم كتابة رسالة commit واضحة

### أثناء النشر (During Deployment)
- [ ] تم الدفع إلى GitHub بنجاح
- [ ] بدأ Coolify النشر التلقائي
- [ ] تم مراقبة السجلات (Logs)
- [ ] لا توجد أخطاء في البناء (Build)
- [ ] لا توجد أخطاء في Migration
- [ ] الخادم يعمل بدون مشاكل

### بعد النشر (Post-Deployment)
- [ ] تم اختبار الـ API على الخادم الحي
- [ ] تم اختبار واجهة المستخدم على الخادم الحي
- [ ] تم التحقق من قاعدة البيانات
- [ ] تم التحقق من السجلات (Logs)
- [ ] لا توجد رسائل خطأ
- [ ] الأداء مقبول

---

## 📈 مراقبة ما بعد النشر (Post-Deployment Monitoring)

### اليوم الأول
```bash
# راقب الأخطاء كل 30 دقيقة
docker logs -f qms-api | grep -i error

# تحقق من استهلاك الموارد
docker stats
```

### أول أسبوع
```bash
# قم بزيارة يومية للتحقق من:
# 1. عدم وجود رسائل خطأ في السجلات
# 2. أداء قاعدة البيانات طبيعية
# 3. استجابة سريعة من الـ API
```

### أول شهر
```bash
# قم بفحص أسبوعي:
# 1. تقرير الأخطاء
# 2. أداء الاستعلامات
# 3. ملاحظات من المستخدمين
```

---

## 📞 للمساعدة

| المشكلة | الحل |
|--------|------|
| خطأ Migration | تحقق من صيغة Prisma schema |
| API غير مستجيبة | أعد بناء Docker image |
| بطء الأداء | أضف indexes إلى قاعدة البيانات |
| خطأ الصلاحيات | تحقق من معرّف المستخدم والدور |

---

✅ **اكتملت المرحلة 2!**

الخطوة التالية: إعداد برنامج التدريب الشامل
