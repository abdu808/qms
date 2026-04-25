#!/bin/sh
set -e

echo "[startup] ── المرحلة 1: انتظار قاعدة البيانات ──"
MAX_RETRIES=30
i=0
until node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT 1').then(()=>{p.\$disconnect();process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"; do
  i=$((i + 1))
  if [ $i -ge $MAX_RETRIES ]; then
    echo "[startup] قاعدة البيانات غير متاحة بعد $MAX_RETRIES محاولة. إنهاء."
    exit 1
  fi
  echo "[startup] المحاولة $i/$MAX_RETRIES — إعادة بعد 5 ثوانٍ..."
  sleep 5
done

echo "[startup] ── المرحلة 2: تطبيق ترحيلات Prisma (آمن للإنتاج) ──"
# prisma migrate deploy: يطبّق الهجرات المُعتمَدة فقط — لا يُغيّر سكيما بلا ترحيل، لا يفقد بيانات.
#
# عند أول نشر بعد إنشاء baseline migration (20260425033924_init):
#   - إذا كانت قاعدة البيانات موجودة بالفعل (db push سابق)، نُعلّم الـ migration كـ "مُطبَّق مسبقاً"
#     عبر: PRISMA_BASELINE=true في متغيرات البيئة
#   - بعدها يعود PRISMA_BASELINE إلى false ويعمل migrate deploy عادياً
if [ "${PRISMA_BASELINE:-false}" = "true" ]; then
  echo "[startup] وضع BASELINE — تعليم migration الأولي كمُطبَّق مسبقاً (لقاعدة بيانات موجودة)"
  MIGRATION_NAME=$(ls prisma/migrations | grep -v migration_lock.toml | sort | head -1)
  if [ -n "$MIGRATION_NAME" ]; then
    npx prisma migrate resolve --applied "$MIGRATION_NAME" || echo "[startup] تخطّي — مُعلَّم مسبقاً"
  fi
fi

# إذا وُجدت هجرة فاشلة (P3009) بسبب انقطاع سابق، أعدها إلى rolled-back لإعادة التطبيق
# هذا آمن فقط عند أول نشر (قاعدة بيانات فارغة جزئياً) — لا تُفعِّله على بيانات إنتاج حقيقية
if npx prisma migrate status 2>&1 | grep -q "failed"; then
  echo "[startup] ⚠️  وُجدت هجرة فاشلة — إعادة تعيينها كـ rolled-back وإعادة المحاولة"
  FAILED_MIGRATION=$(npx prisma migrate status 2>&1 | grep "failed" | grep -oP '\d{14}_\w+' | head -1)
  if [ -n "$FAILED_MIGRATION" ]; then
    npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" || true
  fi
fi
npx prisma migrate deploy

echo "[startup] ── المرحلة 3: تطبيق الترحيلات اليدوية (SQL) ──"
node scripts/migrate.mjs

echo "[startup] ── المرحلة 4: ترحيل بيانات الاستبيانات (إن وُجدت) ──"
node scripts/backfill-survey-responses.mjs || echo "[startup] تخطّي الترحيل — الحقل غير موجود أو البيانات محوّلة مسبقاً"

echo "[startup] ── المرحلة 5: تهيئة البيانات الأولية ──"
node src/seed-if-empty.js || echo "[startup] تخطّي — البيانات الأولية موجودة أو فشل غير حرج"

# المراحل 6-8: بيانات تعريفية خاصّة بالمنظمة (خطة استراتيجية، تاريخ KPI، وثائق ISO).
# لا تُشغَّل افتراضياً — قاعدة البيانات تبدأ نظيفة من المرحلة 5 فقط.
# لتفعيلها (للمنظّمة الأصلية أو للعرض التوضيحي): SEED_DEMO_DATA=true
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[startup] ── المرحلة 6: تعبئة البيانات الاستراتيجية (SEED_DEMO_DATA=true) ──"
  node scripts/seed-strategic-plan.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"

  echo "[startup] ── المرحلة 7: إدخال بيانات المؤشرات التاريخية ──"
  node scripts/seed-kpi-history.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"

  echo "[startup] ── المرحلة 8: تعبئة وثائق ISO 9001 ──"
  node scripts/seed-iso-documents.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"
else
  echo "[startup] ── المراحل 6-8 (بيانات تعريفية) متخطّاة — SEED_DEMO_DATA غير مُفعَّل ──"
fi

# المرحلة 9 (اختيارية): تعبئة seed-data.json عند أول deploy.
# SEED_FROM_JSON=on عند أول deploy فقط، ثم أعدها إلى off.
if [ "${SEED_FROM_JSON:-off}" = "on" ]; then
  echo "[startup] ── المرحلة 9: تعبئة seed-data.json (SEED_FROM_JSON=on) ──"
  node scripts/seed-from-json.mjs || echo "[startup] تخطّي — فشل seed-from-json (غير حرج)"
fi

echo "[startup] ── المرحلة 10: تشغيل الخادم ──"
# علامة اكتمال الـ startup — يقرأها /api/health ليُرجع 200 بدل 503
touch /tmp/startup-complete
exec node src/server.js
