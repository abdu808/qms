# أوامر Coolify Terminal — Pre-UAT Readiness

افتح: Coolify → Applications → qms-api → Terminal

---

## A. فحص Backup المشفر

```bash
# 1. تحقق من وجود ملفات backup
ls -lah /app/uploads/backups/db-*.sql.gz.enc 2>/dev/null \
  || echo "⚠️ لا توجد ملفات backup — تأكد من QMS_BACKUP=on في Coolify env"

# 2. فك تشفير أحدث ملف (اختباري — يُحذف بعده)
LATEST=$(ls -t /app/uploads/backups/db-*.sql.gz.enc 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  echo "📂 الملف: $LATEST"
  node scripts/backup-decrypt.mjs "$LATEST" /tmp/pre-uat-test.sql.gz \
    && echo "✅ فك التشفير نجح" \
    || echo "❌ فك التشفير فشل"
else
  echo "❌ لا يوجد ملف للاختبار"
fi

# 3. احذف ملف الاختبار
rm -f /tmp/pre-uat-test.sql.gz /tmp/pre-uat-test.sql
echo "🧹 ملف الاختبار مُحذف"
```

**المتوقع:**
- يظهر ملف مثل `db-2026-04-28.sql.gz.enc`
- "✅ فك التشفير نجح"
- لا تطبع BACKUP_ENCRYPTION_KEY في الشات

---

## B. فحص سلامة البيانات (production)

```bash
cd /app
node scripts/check-data-integrity.mjs
echo "EXIT: $?"
```

**المتوقع:**
```
✅ جميع الفحوصات نظيفة — البيانات سليمة.
EXIT: 0
```

---

## C. تحقق سريع من حالة النظام

```bash
# هل QMS_BACKUP مفعّل؟
echo "QMS_BACKUP=${QMS_BACKUP:-NOT SET}"

# هل BACKUP_ENCRYPTION_KEY موجود؟ (بدون طباعة قيمته)
[ -n "$BACKUP_ENCRYPTION_KEY" ] \
  && echo "✅ BACKUP_ENCRYPTION_KEY محدد (${#BACKUP_ENCRYPTION_KEY} محرف)" \
  || echo "❌ BACKUP_ENCRYPTION_KEY غير محدد"

# هل QMS_SCHEDULER يعمل؟
echo "QMS_SCHEDULER=${QMS_SCHEDULER:-on (default)}"
```

---

## ملاحظات
- لا تنسخ أي مفتاح أو كلمة مرور في الشات
- بعد اختبار الـ backup احذف `/tmp/pre-uat-test.*` فوراً
- إذا لم تظهر ملفات `.sql.gz.enc` → أضف `QMS_BACKUP=on` في Coolify env vars وانتظر 02:00 صباحاً
