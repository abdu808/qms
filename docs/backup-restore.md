# النسخ الاحتياطي والاستعادة — QMS

> **تحذير أمني:** لا تُخزِّن كلمات المرور أو سلاسل الاتصال أو مفاتيح التشفير في هذا الملف.
> استخدم متغيرات البيئة أو مدير الأسرار الخاص بـ Coolify.

---

## 1. آلية النسخ الآلي

يُنفِّذ النظام دورة نسخ يومية عبر `scheduler.js` تمر بالمراحل التالية بالترتيب:

```
preflight (pg_dump --version)
    ↓ فشل → توقف فوري، لا حذف لأي نسخة قديمة
    ↓ نجاح
pg_dump → gzip → تشفير AES-256-GCM → ملف .sql.gz.enc
    ↓ فشل → توقف، لا حذف لأي نسخة قديمة
    ↓ نجاح
تدوير النسخ القديمة (7 يومية + 4 أسبوعية + 6 شهرية)
```

**مبدأ الحماية:** النسخ القديمة لا تُحذف أبداً إذا فشل إنشاء نسخة جديدة.

---

## 2. التشفير (C7 — AES-256-GCM)

### 2.1 الخوارزمية

- **الخوارزمية:** AES-256-GCM (Authenticated Encryption with Associated Data)
- **طول المفتاح:** 256 بت (32 بايت)
- **IV:** 16 بايت عشوائي لكل ملف
- **AuthTag:** 16 بايت — يكشف أي تلاعب بالملف
- **تنسيق الملف:** `[QBK1 4B][IV 16B][Encrypted payload][AuthTag 16B]`
- **لاحقة الملف:** `.sql.gz.enc`

### 2.2 توليد مفتاح التشفير

```bash
node apps/api/scripts/backup-keygen.mjs
```

الناتج:
```
BACKUP_ENCRYPTION_KEY=a3f8c2d...  (64 محرف hex = 32 بايت)
```

**أضِف هذا المتغير إلى Coolify Environment Variables فقط.** لا تحفظه في:
- ملفات `.env` في الكود
- مستودعات Git
- logs أو console output

### 2.3 إعدادات متغيرات البيئة

| المتغير | القيمة | الوصف |
|---------|--------|-------|
| `BACKUP_ENCRYPTION_KEY` | 64 hex / 44 base64 | **مطلوب** للإنتاج |
| `BACKUP_ALLOW_PLAINTEXT` | `true` | للتطوير فقط — يسمح بنسخة بدون تشفير |

إذا لم يوجد `BACKUP_ENCRYPTION_KEY` ولم تكن `BACKUP_ALLOW_PLAINTEXT=true`، يرفض النظام إنشاء أي نسخة.

---

## 3. فحص preflight (C6)

قبل كل دورة نسخ، يتحقق النظام من وجود `pg_dump`:

```bash
pg_dump --version
```

**إذا فشل الفحص:**
- يظهر خطأ واضح في logs: `[backup] ❌ pg_dump preflight فشل: pg_dump غير مُثبَّت`
- لا تُنشأ أي نسخة
- لا تُحذف أي نسخة قديمة
- يُرجع `{ ok: false, rotate: { skipped: true } }`

`pg_dump` مُثبَّت داخل Docker image عبر `postgresql16-client`. إذا غاب، يعني أن الـ image خاطئ.

---

## 4. الاستعادة (Restore)

### 4.1 فك تشفير النسخة

```bash
# الخطوة 1: فك التشفير
BACKUP_ENCRYPTION_KEY=<hex-key> \
  node apps/api/scripts/backup-decrypt.mjs \
  /app/uploads/backups/db-2026-04-28.sql.gz.enc \
  /tmp/db-2026-04-28.sql.gz
```

الناتج:
```
📂 المصدر:  db-2026-04-28.sql.gz.enc
📄 الهدف:   db-2026-04-28.sql.gz
✅ تم فك التشفير بنجاح
   المشفَّر: 4521.3 KB  →  النص الواضح: 18204.1 KB
```

### 4.2 استعادة قاعدة البيانات

```bash
# الخطوة 2: فك الضغط
gunzip /tmp/db-2026-04-28.sql.gz

# الخطوة 3: استعادة على قاعدة بيانات جديدة (الأسلم)
psql "$DATABASE_URL_NEW" < /tmp/db-2026-04-28.sql

# أو استعادة على قاعدة البيانات الحالية (مع إيقاف التطبيق أولاً)
psql "$DATABASE_URL" < /tmp/db-2026-04-28.sql
```

### 4.3 التحقق من النسخة

```bash
# التحقق من أن الملف مشفَّر (ليس plain SQL)
head -c 4 db-2026-04-28.sql.gz.enc | xxd
# الناتج يجب أن يبدأ بـ: 51 42 4b 31  (= QBK1)

# التحقق من سلامة التشفير (فك التشفير بدون حفظ)
BACKUP_ENCRYPTION_KEY=<key> \
  node apps/api/scripts/backup-decrypt.mjs \
  db-2026-04-28.sql.gz.enc \
  /dev/null 2>&1 | grep -E "✅|❌"
```

---

## 5. نسخ يدوية

### 5.1 تشغيل دورة نسخ يدوياً (داخل الحاوية)

```bash
docker exec qms-api node src/services/backup.js
```

الناتج في logs:
```
[backup] ✅ pg_dump preflight: pg_dump (PostgreSQL) 16.3
[backup] ✅ {"ok":true,"at":"...","db":{"ok":true,"path":"...","sizeBytes":4200000,"encrypted":true},...}
```

### 5.2 تشغيل من خارج الحاوية

```bash
# من خادم Coolify
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export BACKUP_ENCRYPTION_KEY="<hex-key>"
export BACKUP_DIR="/backups"
node apps/api/src/services/backup.js
```

---

## 6. تدوير النسخ

| الفئة | الاحتفاظ |
|-------|---------|
| آخر 7 أيام | كل النسخ اليومية |
| 8–35 يوم | نسخة واحدة لكل أسبوع |
| 36–210 يوم | نسخة واحدة لكل شهر |
| > 210 يوم | تُحذف تلقائياً |

**⚠️ التدوير لا يعمل إذا فشل backup يوم ما** — النسخ القديمة تبقى محمية.

---

## 7. ماذا يحدث عند الفشل؟

| سبب الفشل | السلوك |
|-----------|--------|
| `pg_dump` غير مُثبَّت | توقف فوري، خطأ في logs، لا حذف |
| DATABASE_URL خاطئ | `db.ok=false`، لا حذف للنسخ القديمة |
| تشفير مكسور (مفتاح خاطئ) | `db.ok=false`، الملف المؤقت يُحذف |
| قرص ممتلئ | pipeline error، الملف المؤقت يُحذف |
| مشكلة شبكة أثناء pg_dump | `code≠0`، خطأ في stderr، لا حذف |

---

## 8. التحقق الدوري من النسخ

**لا قيمة لنسخة لم تُختبر.** كل أسبوعين على الأقل:

```bash
# 1. اختر نسخة عشوائية من الأسبوع الماضي
ls -la /app/uploads/backups/db-*.sql.gz.enc | tail -3

# 2. فك التشفير
BACKUP_ENCRYPTION_KEY=<key> \
  node apps/api/scripts/backup-decrypt.mjs \
  db-YYYY-MM-DD.sql.gz.enc /tmp/test-restore.sql.gz

# 3. فك الضغط
gunzip /tmp/test-restore.sql.gz

# 4. استعادة على قاعدة اختبار مؤقتة
createdb qms_restore_test
psql qms_restore_test < /tmp/test-restore.sql

# 5. تحقق من البيانات
psql qms_restore_test -c 'SELECT COUNT(*) FROM "User";'
psql qms_restore_test -c 'SELECT COUNT(*) FROM "StrategicPlan";'

# 6. تنظيف
dropdb qms_restore_test
rm /tmp/test-restore.sql
```

---

## 9. إعادة توليد المفتاح (Key Rotation)

إذا اشتُبه بتسرب المفتاح:

1. **لا تحذف النسخ القديمة** — ستحتاجها للاستعادة بالمفتاح القديم
2. ولّد مفتاحاً جديداً: `node apps/api/scripts/backup-keygen.mjs`
3. حدِّث `BACKUP_ENCRYPTION_KEY` في Coolify
4. أعِد نشر التطبيق — النسخ الجديدة ستستخدم المفتاح الجديد
5. احتفظ بالمفتاح القديم في مكان آمن حتى تتجاوز النسخ القديمة فترة الاحتفاظ (210 يوم)

---

## 10. أمان النسخ

- ملفات `.sql.gz.enc` لا تحتوي بيانات قابلة للقراءة — الـ magic bytes فقط (`QBK1`)
- GCM authTag يكشف أي تلاعب — فك التشفير يفشل إذا عُدِّل الملف
- المفتاح لا يظهر في logs، لا يُطبع في stdout
- `backup-decrypt.mjs` يرفض الملفات ذات magic bytes خاطئة
