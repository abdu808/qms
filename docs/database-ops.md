# دليل تشغيل قاعدة البيانات — QMS

> مرجع سريع لضبط Prisma/PostgreSQL في الإنتاج، الترحيلات اليدوية، وإدارة refresh tokens.

آخر تحديث: 2026-04-22

---

## 1. Prisma Connection Pool — ضبط الإنتاج

Prisma 5.x يستخدم PgBouncer/داخلي لإدارة الاتصالات. الضوابط التالية تُمرَّر عبر `DATABASE_URL`:

```
DATABASE_URL="postgresql://USER:PASS@host:5432/qms?connection_limit=10&pool_timeout=20&connect_timeout=10"
```

| البارامتر | الافتراضي | القيمة الموصى بها للإنتاج | ملاحظة |
|----------|-----------|-------------------------|--------|
| `connection_limit` | `num_cpus * 2 + 1` | `10` لكل عقدة API | يجب ألا يتجاوز مجموع العقد × القيمة حدود Postgres `max_connections` |
| `pool_timeout` | 10s | `20` | زمن انتظار الحصول على اتصال من الـ pool |
| `connect_timeout` | 5s | `10` | زمن إنشاء اتصال TCP |
| `statement_timeout` | ∞ | `30000` (30s) | يُضاف في `postgresql.conf` أو عبر `SET` |

### فحص الاستخدام

```sql
-- عدد الاتصالات النشطة
SELECT state, count(*) FROM pg_stat_activity WHERE datname = 'qms' GROUP BY state;

-- الاستعلامات البطيئة (> 1s)
SELECT query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE datname = 'qms' AND state != 'idle'
ORDER BY duration DESC;
```

### الحد الأقصى لـ Postgres

`max_connections = 100` افتراضياً. مع 3 عقد API × 10 = 30 → آمن. ارفع إلى 200 قبل التوسّع إلى 10 عقد.

---

## 2. الفهارس الأساسية

- `RefreshToken.expiresAt` (DB-001) — يُسرِّع التنظيف اليومي الذي يحذف الـ tokens المنتهية.
- `AuditLog.at` — تصفية بالزمن.
- جميع العلاقات FK مفهرسة تلقائياً.

### تنظيف Refresh Tokens (Cron يومي)

```sql
DELETE FROM "RefreshToken"
WHERE "expiresAt" < NOW() - INTERVAL '7 days';
```

> احذف فقط المنتهية منذ أكثر من أسبوع — للحفاظ على audit trail للاستجابة للحوادث.

---

## 3. الترحيلات — Migration Baseline

المشروع يستخدم **مزيجاً** من:
- `prisma db push` للتطوير المحلي السريع
- `scripts/migrate.mjs` + `prisma/migrations-manual/*` للإنتاج (ترحيلات يدوية مُدارة)

### إنشاء baseline (أول مرة فقط)

عند الانتقال من `db push` إلى `prisma migrate deploy` الرسمي:

```bash
# 1. تأكد أن schema.prisma يعكس حالة الإنتاج بالضبط
npx prisma db pull

# 2. أنشئ مجلد baseline
mkdir -p prisma/migrations/0_init

# 3. ولِّد SQL من الـ schema الحالي
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 4. وسم الترحيل كمُطبَّق في DB الإنتاج (بدون تنفيذه فعلياً)
npx prisma migrate resolve --applied 0_init
```

### بعد الـ baseline

- أي تغيير مخطَّط جديد → `npx prisma migrate dev --name <description>` محلياً
- في الإنتاج → `npx prisma migrate deploy` (يُنفَّذ تلقائياً في Docker entrypoint)

### الترحيلات اليدوية (للحالات الخاصة)

`scripts/migrate.mjs` يُدير ترحيلات لا يدعمها Prisma (مثل `CREATE INDEX CONCURRENTLY`، الـ partial indexes). يتتبّعها عبر جدول `_MigrationLog`. لا تمزج بينها وبين Prisma migrations إلا بعد فهم التسلسل.

---

## 4. النسخ الاحتياطي والاستعادة

راجع `docs/backup-restore.md`.

**نقاط حرجة:**
- `pg_dump` يومي → تخزين 30 يوماً
- ملفات الوثائق (`/app/uploads`) → snapshot أسبوعي
- اختبار استعادة كامل → ربع سنوي

---

## 5. مراقبة الصحة

- `GET /health` → 200 إذا DB + الخدمة صحية
- `X-Request-Id` header على كل استجابة → لتتبع الأخطاء في السجلات
- Rate limits + audit log → جدول `AuditLog`
