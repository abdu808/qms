# دليل التشغيل — QMS

> **بيئة النشر:** Coolify (self-hosted) + Neon PostgreSQL + Node.js 20 Alpine.
> كل push إلى `main` يُشغِّل نشراً تلقائياً عبر Coolify.

---

## 1. النشر الطبيعي (Deploy)

### تلقائي (الحالة الافتراضية)

```bash
git push origin main
```

Coolify يستمع إلى الـ webhook، يبني الصورة، يشغِّل:
```bash
npx prisma migrate deploy   # يُطبّق migrations الجديدة فقط
node src/server.js
```

### يدوي من Coolify

1. Coolify Dashboard ← التطبيق ← **Deploy**.
2. تابع سجلات البناء في **Logs** ← **Build Logs**.
3. بعد انتهاء البناء، تحقق من **Logs** ← **Application Logs**.

---

## 2. التراجع عن نشر (Rollback)

### عبر Git

```bash
# العودة إلى commit سابق
git revert HEAD          # يُنشئ commit عكسي (آمن)
git push origin main     # يُشغِّل نشراً جديداً تلقائياً
```

```bash
# أو إن كنت متأكداً — reset صريح (يُعيد كتابة التاريخ)
git reset --hard <commit-sha>
git push --force-with-lease origin main
```

### عبر Coolify

Coolify يحتفظ بـ Docker images السابقة قصيرة الأمد:
1. Coolify ← التطبيق ← **Deployments**.
2. اختر نشراً ناجحاً سابقاً ← **Redeploy**.

> **تحذير migrations:** إذا كان الـ rollback يعود قبل migration، تأكد من التراجع عن الـ migration يدوياً في Neon قبل إعادة النشر.

---

## 3. قراءة السجلات (Logs)

### من Coolify

Coolify ← التطبيق ← **Logs** ← **Application Logs** (streaming مباشر).

### من Docker مباشرة (على سيرفر Coolify)

```bash
# عرض آخر 200 سطر + متابعة مستمرة
docker logs --tail 200 -f <container-name>

# البحث في السجلات
docker logs <container-name> 2>&1 | grep "ERROR"

# أسماء الـ containers الفعّالة
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### السجلات الهامة

| السجل | المعنى |
|-------|--------|
| `[prisma-error]` | خطأ في قاعدة البيانات |
| `[kpi] rollup failed` | فشل rollup — غير حرج، يُسجَّل فقط |
| `[webhook]` | إرسال أو فشل webhook خارجي |
| `[audit-finding] escalated` | تصعيد ملاحظة تدقيق إلى NCR |
| `JWT_SECRET` errors | مشكلة في متغيرات البيئة |

---

## 4. فحص صحة التطبيق (Health Check)

```bash
# من أي مكان
curl -s https://quality.aqiltech.sa/api/health | jq .

# الاستجابة الصحيحة
# { "ok": true, "version": "...", "db": "connected" }
```

Coolify يستخدم هذا المسار تلقائياً للـ Health Check. إذا فشل أكثر من مرة، يُعيد تشغيل الـ container.

---

## 5. تطبيق Migrations

Migrations تُطبَّق **تلقائياً** عند كل نشر عبر `npx prisma migrate deploy`.

### لتطبيق migration يدوياً على production

```bash
# الطريقة الأكثر أماناً — من سيرفر Coolify عبر exec
docker exec -it <container-name> npx prisma migrate deploy

# أو عبر Neon — انتهج دائماً:
# 1. خذ نسخة احتياطية أولاً (راجع backup-restore.md)
# 2. اختبر على Neon branch منفصل
# 3. طبّق على الـ main branch
```

> **قاعدة:** لا تُشغِّل `prisma migrate dev` على production أبداً.

---

## 6. سيناريوهات الفشل والحلول

### 6.1 قاعدة البيانات لا تستجيب

**الأعراض:** `Can't reach database server at ... neon.tech`

**الخطوات:**
1. تحقق من [Neon Status Page](https://neonstatus.com) للانقطاعات المعروفة.
2. تحقق من متغير `DATABASE_URL` في Coolify ← **Environment Variables**.
3. تحقق من حدود الاتصال (Connection Pooling): في Neon Console ← **Connection Pooling**.
4. إن استمر المشكل، أعِد تشغيل التطبيق من Coolify ← **Restart**.

### 6.2 تعذّر تطبيق Migration

**الأعراض:** رسالة خطأ `Migration failed` في سجلات البناء

**الخطوات:**
1. اقرأ الخطأ كاملاً في **Build Logs**.
2. إن كان تعارض بيانات (constraint violation): صحّح البيانات أولاً ثم أعِد النشر.
3. إن كان خطأ في ملف الـ migration: أصلحه محلياً، اختبر، ثم أعِد الـ push.
4. في حالات الطوارئ فقط: استعِد من نسخة احتياطية (راجع backup-restore.md).

### 6.3 تجاوز حدود الذاكرة أو CPU

**الأعراض:** Container يُعاد تشغيله باستمرار، أو Coolify يُبلِّغ عن OOM.

**الخطوات:**
1. شغّل تقرير الاستهلاك: `./apps/api/scripts/container-usage.sh qms` (على سيرفر Coolify)
   أو `cd /app && ./scripts/container-usage.sh` (من Coolify Terminal).
2. تحقق من استخدام الذاكرة: Coolify ← **Metrics**.
3. ابحث عن memory leak في السجلات: `docker logs ... | grep -i "heap\|memory"`.
4. أعِد التشغيل مؤقتاً: Coolify ← **Restart**.
5. راجع الاستعلامات الثقيلة في Neon ← **Monitoring**.

> التفاصيل الكاملة (قراءة `docker stats`، حدود الموارد، تنظيف القرص):
> [`container-consumption.md`](./container-consumption.md).

### 6.4 فشل تخزين الملفات

**الأعراض:** `ENOENT` أو `EACCES` عند رفع الملفات.

**الخطوات:**
1. تحقق من وجود الـ Volume: Coolify ← **Storages**.
2. تحقق من الصلاحيات داخل الـ container: `docker exec -it <container> ls -la /app/uploads`.
3. إن اختفت الملفات، استعِد من النسخة الاحتياطية (راجع backup-restore.md).

---

## 7. تعطيل المساعد الذكي (AI) مؤقتاً

في Coolify ← **Environment Variables**:

```
AI_ENABLED=false
```

أعِد نشر التطبيق. المساعد الذكي يُعيد `503` عند الاستدعاء ريثما يُعاد تفعيله.

بديلاً: من داخل التطبيق ← **الإعدادات** ← **إعدادات الذكاء الاصطناعي** ← أوقِف التفعيل.

---

## 8. إعادة تشغيل التطبيق

### من Coolify

Coolify ← التطبيق ← **Restart** (يُعيد تشغيل الـ container بدون إعادة بناء الصورة).

### من سيرفر Coolify مباشرة

```bash
docker restart <container-name>
```

---

## 9. متغيرات البيئة الأساسية

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | سلسلة اتصال Neon (pooled) |
| `JWT_SECRET` | مفتاح توقيع JWT — 40+ حرف عشوائي |
| `NODE_ENV` | `production` في بيئة الإنتاج |
| `PORT` | منفذ التطبيق (افتراضي 3001) |
| `AI_ENABLED` | `true` / `false` لتفعيل/تعطيل الذكاء الاصطناعي |
| `ANTHROPIC_API_KEY` | مفتاح Anthropic (إن كان Claude مُفعَّلاً) |

> **تغيير أي متغير** يتطلب إعادة نشر أو إعادة تشغيل كي يسري.

---

## 10. ملاحظات Coolify

- **Auto-deploy:** مُفعَّل افتراضياً على branch `main`. يمكن إيقافه من Coolify ← **Settings** ← **Auto Deploy**.
- **Build Cache:** إذا فشل البناء بسبب cache قديم، اضغط **Force Rebuild** من قائمة النشر.
- **Domains:** ضبط SSL وإعادة التوجيه من Coolify ← **Domains**.
- **Volume persistence:** تأكد من أن الـ Volume مرتبط قبل النشر الأول وإلا ستضيع الملفات عند إعادة إنشاء الـ container.
