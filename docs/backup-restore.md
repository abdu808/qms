# النسخ الاحتياطي والاستعادة — QMS

> **تحذير أمني:** لا تُخزِّن كلمات المرور أو سلاسل الاتصال في هذا الملف.
> استخدم متغيرات البيئة أو مدير الأسرار الخاص بـ Coolify.

---

## 1. قاعدة البيانات (PostgreSQL — Neon.tech)

### 1.1 نسخة يدوية

```bash
# يُقرأ DATABASE_URL من متغيرات البيئة — لا تُكتب بالنص الواضح
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-acl \
  --no-owner \
  --file="qms_$(date +%Y%m%d_%H%M%S).dump"
```

> **ملاحظة Neon:** الخطة المجانية تحتفظ بنقاط استعادة لمدة 24 ساعة تلقائياً.
> الخطط المدفوعة تدعم Branch-based restores.

### 1.2 استعادة كاملة

```bash
# أوقِف التطبيق أولاً لتجنب التعارض (اختياري على Neon بسبب الـ branching)
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-acl \
  --no-owner \
  qms_20260428_120000.dump
```

### 1.3 استعادة جزئية (جداول محددة)

```bash
# استعادة جدول واحد فقط
pg_restore \
  --dbname="$DATABASE_URL" \
  --table="User" \
  --no-acl \
  --no-owner \
  qms_20260428_120000.dump
```

### 1.4 استعادة باستخدام Neon Branching (الطريقة المفضَّلة)

1. اذهب إلى Neon Console ← مشروعك ← **Branches**.
2. أنشئ فرعاً من نقطة زمنية قبل الحادثة (Branch from: a point in time).
3. اختبر الفرع الجديد ثم أبدِّل متغير `DATABASE_URL` في Coolify للإشارة إليه.
4. احذف الفرع القديم بعد التحقق.

---

## 2. ملفات التطبيق (المرفقات)

التطبيق يعتمد على تخزين Coolify Volume لملفات المرفقات.

### 2.1 تحديد موقع الـ Volume

في Coolify ← التطبيق ← **Storages** ← انظر مسار الـ Volume المرتبط (مثل `/data/uploads`).

### 2.2 نسخ الملفات

```bash
# من سيرفر Coolify عبر SSH
tar -czf uploads_$(date +%Y%m%d).tar.gz /data/uploads/

# نقل النسخة إلى موقع خارجي
scp uploads_20260428.tar.gz user@backup-server:/backups/qms/
```

### 2.3 استعادة الملفات

```bash
# أوقِف التطبيق مؤقتاً في Coolify
tar -xzf uploads_20260428.tar.gz -C /
# أعِد تشغيل التطبيق
```

---

## 3. الجدول الزمني الموصى به

| النوع | التكرار | الاحتفاظ | الأداة |
|-------|---------|----------|--------|
| قاعدة البيانات (كاملة) | يومياً | 14 يوماً | pg_dump + cron |
| قاعدة البيانات (تزايدية) | Neon Branching | 24 ساعة (مجاني) / 30 يوماً (مدفوع) | Neon Console |
| ملفات المرفقات | أسبوعياً | 4 أسابيع | tar + cron |

### مثال cron (على سيرفر منفصل)

```cron
# /etc/cron.d/qms-backup
0 2 * * * root pg_dump "$DATABASE_URL" --format=custom -f /backups/db/qms_$(date +\%Y\%m\%d).dump
0 3 * * 0 root tar -czf /backups/files/uploads_$(date +\%Y\%m\%d).tar.gz /data/uploads/
```

---

## 4. التحقق من النسخ الاحتياطية

**لا قيمة لنسخة لم تُختبر.** كل أسبوعين على الأقل:

```bash
# إنشاء قاعدة بيانات اختبار مؤقتة
createdb qms_test_restore
pg_restore --dbname="postgresql://localhost/qms_test_restore" --no-acl --no-owner latest.dump

# تشغيل اختبار بسيط
psql qms_test_restore -c "SELECT COUNT(*) FROM \"User\";"

# حذف قاعدة الاختبار
dropdb qms_test_restore
```

---

## 5. تأمين النسخ الاحتياطية

- تشفير النسخ قبل التخزين الخارجي:
  ```bash
  gpg --symmetric --cipher-algo AES256 qms_20260428.dump
  ```
- احفظ مفتاح التشفير في مكان **مستقل** عن ملفات النسخ.
- لا ترفع النسخ على مستودعات Git أو تخزين عام.
- حدّد صلاحيات الوصول للنسخ: `chmod 600 *.dump`
- سجّل كل عملية استعادة في سجل التدقيق الداخلي.
