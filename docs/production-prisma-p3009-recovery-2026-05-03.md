# إصلاح Prisma P3009 في الإنتاج

تاريخ التوثيق: 2026-05-03

## المشكلة

عند النشر قد يظهر الخطأ:

```text
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260503001000_add_integration_delivery` migration ... failed
```

هذا يعني أن Prisma سجل محاولة ترحيل فاشلة في جدول `_prisma_migrations`. عند وجود هذا السجل، لن يطبق Prisma أي ترحيلات لاحقة حتى يتم حل حالة الترحيل.

## التحقق قبل القرار

نفذ داخل حاوية التطبيق أو بيئة لديها نفس `DATABASE_URL` للإنتاج:

```bash
npx prisma db execute --stdin <<'SQL'
SELECT to_regclass('"IntegrationDelivery"') AS integration_delivery_table;

SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20260503001000_add_integration_delivery';
SQL
```

## القرار 1: الجدول موجود

إذا رجع `integration_delivery_table` بقيمة `"IntegrationDelivery"`، فهذا يعني أن الترحيل أنشأ الجدول فعلياً ثم فشل التسجيل أو انقطع الاتصال. في هذه الحالة:

```bash
npx prisma migrate resolve --applied 20260503001000_add_integration_delivery
npx prisma migrate deploy
```

## القرار 2: الجدول غير موجود

إذا رجع `integration_delivery_table` بقيمة فارغة، فهذا يعني أن الترحيل لم يطبق. في هذه الحالة:

```bash
npx prisma migrate resolve --rolled-back 20260503001000_add_integration_delivery
npx prisma migrate deploy
```

## ملاحظات مهمة

- لا تحذف جدول `_prisma_migrations`.
- لا تستخدم `prisma migrate reset` في الإنتاج.
- بعد نجاح `migrate deploy` ستطبق الترحيلات اللاحقة، ومنها ترحيل أقسام الهيكل المعتمدة.
