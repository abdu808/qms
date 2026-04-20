#!/bin/sh
set -e

echo "[startup] ── المرحلة 1: مزامنة schema مع قاعدة البيانات ──"
MAX_RETRIES=30
i=0
until npx prisma db push --accept-data-loss; do
  i=$((i + 1))
  if [ $i -ge $MAX_RETRIES ]; then
    echo "[startup] قاعدة البيانات غير متاحة بعد $MAX_RETRIES محاولة. إنهاء."
    exit 1
  fi
  echo "[startup] المحاولة $i/$MAX_RETRIES فشلت. إعادة المحاولة بعد 5 ثوانٍ..."
  sleep 5
done

echo "[startup] ── المرحلة 2: تطبيق الترحيلات اليدوية (SQL) ──"
node scripts/migrate.mjs

echo "[startup] ── المرحلة 3: ترحيل بيانات الاستبيانات (إن وُجدت) ──"
node scripts/backfill-survey-responses.mjs

echo "[startup] ── المرحلة 4: تهيئة البيانات الأولية ──"
node src/seed-if-empty.js

echo "[startup] ── المرحلة 5: تعبئة البيانات الاستراتيجية ──"
node scripts/seed-strategic-plan.mjs

echo "[startup] ── المرحلة 6: إدخال بيانات المؤشرات التاريخية (2025 + Q1 2026) ──"
node scripts/seed-kpi-history.mjs

echo "[startup] ── المرحلة 7: تشغيل الخادم ──"
exec node src/server.js
