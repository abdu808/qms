#!/bin/sh
# لا نستخدم set -e لأننا نُشغّل Node في الخلفية ونحتاج إدارة العمليات يدوياً

# دالة تنظيف: تُوقف الخادم عند خروج سكريبت الـ startup بخطأ
cleanup() {
  echo "[startup] ⚠️  خطأ في الـ startup — إيقاف الخادم"
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  exit 1
}

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

echo "[startup] ── تشغيل Node.js مبكراً (يرد بـ 503 حتى يكتمل الـ startup) ──"
# نبدأ الخادم في الخلفية فوراً بعد تأكيد قاعدة البيانات
# /api/health يُرجع 503 حتى تُكتب /tmp/startup-complete → healthcheck يمر دون انقطاع الـ migration
node src/server.js &
SERVER_PID=$!
echo "[startup] Node.js يعمل في الخلفية (PID=$SERVER_PID)"

# من الآن: أي فشل يُشغّل cleanup ويُوقف الخادم
trap cleanup EXIT INT TERM

echo "[startup] ── المرحلة 2: تطبيق ترحيلات Prisma (آمن للإنتاج) ──"
if [ "${PRISMA_BASELINE:-false}" = "true" ]; then
  echo "[startup] وضع BASELINE — تعليم migration الأولي كمُطبَّق مسبقاً"
  MIGRATION_NAME=$(ls prisma/migrations | grep -v migration_lock.toml | sort | head -1)
  if [ -n "$MIGRATION_NAME" ]; then
    npx prisma migrate resolve --applied "$MIGRATION_NAME" || echo "[startup] تخطّي — مُعلَّم مسبقاً"
  fi
fi

# إذا وُجدت هجرة فاشلة (P3009) بسبب انقطاع سابق، أعدها إلى rolled-back
MIGRATE_STATUS=$(npx prisma migrate status 2>&1)
if echo "$MIGRATE_STATUS" | grep -qE "failed|P3009"; then
  echo "[startup] ⚠️  وُجدت هجرة فاشلة — إعادة تعيينها كـ rolled-back وإعادة المحاولة"
  # البحث في كامل المخرجات عن اسم الهجرة (قد يكون في سطر مختلف عن كلمة failed)
  FAILED_MIGRATION=$(echo "$MIGRATE_STATUS" | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+' | head -1)
  # احتياطي: استخرج الاسم من نظام الملفات
  if [ -z "$FAILED_MIGRATION" ]; then
    FAILED_MIGRATION=$(ls prisma/migrations/ | grep -E '^[0-9]{14}_' | sort | head -1)
  fi
  if [ -n "$FAILED_MIGRATION" ]; then
    echo "[startup] إعادة تعيين: $FAILED_MIGRATION"
    npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" || true
  fi
fi

npx prisma migrate deploy || { echo "[startup] ❌ فشلت migrate deploy"; cleanup; }

echo "[startup] ── المرحلة 3: تطبيق الترحيلات اليدوية (SQL) ──"
node scripts/migrate.mjs || { echo "[startup] ❌ فشلت migrate.mjs"; cleanup; }

echo "[startup] ── المرحلة 4: ترحيل بيانات الاستبيانات (إن وُجدت) ──"
node scripts/backfill-survey-responses.mjs || echo "[startup] تخطّي الترحيل — الحقل غير موجود أو البيانات محوّلة مسبقاً"

echo "[startup] ── المرحلة 5: تهيئة البيانات الأولية ──"
node src/seed-if-empty.js || echo "[startup] تخطّي — البيانات الأولية موجودة أو فشل غير حرج"

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[startup] ── المرحلة 6: تعبئة البيانات الاستراتيجية ──"
  node scripts/seed-strategic-plan.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"

  echo "[startup] ── المرحلة 7: إدخال بيانات المؤشرات التاريخية ──"
  node scripts/seed-kpi-history.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"

  echo "[startup] ── المرحلة 8: تعبئة وثائق ISO 9001 ──"
  node scripts/seed-iso-documents.mjs || echo "[startup] تخطّي — البيانات موجودة مسبقاً"
else
  echo "[startup] ── المراحل 6-8 متخطّاة — SEED_DEMO_DATA غير مُفعَّل ──"
fi

if [ "${SEED_FROM_JSON:-off}" = "on" ]; then
  echo "[startup] ── المرحلة 9: تعبئة seed-data.json ──"
  node scripts/seed-from-json.mjs || echo "[startup] تخطّي — فشل seed-from-json (غير حرج)"
fi

echo "[startup] ── المرحلة 10: اكتمال الـ startup ✅ ──"
# الآن يُرجع /api/health 200 بدل 503
touch /tmp/startup-complete

# إلغاء trap الخطأ — الخادم يعمل بشكل طبيعي
trap - EXIT INT TERM

echo "[startup] الخادم جاهز — في انتظار إنهائه..."
# انتظر الخادم حتى يتوقف (يعيش طوال عمر الـ container)
wait "$SERVER_PID"
