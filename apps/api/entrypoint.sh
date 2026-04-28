#!/bin/sh
# entrypoint.sh — نقطة دخول نظام QMS (Docker CMD)
# set -e: أي خطأ يوقف النشر فوراً بكود خروج واضح — لا حالة half-deployed
set -e

# دالة لطباعة الوقت مع كل سطر
ts() { date '+%H:%M:%S'; }

echo "[$(ts)] [deploy] ═══════════════════════════════════════════════"
echo "[$(ts)] [deploy] 🚀 بدء تشغيل نظام QMS  —  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "[$(ts)] [deploy] ═══════════════════════════════════════════════"

# ── المرحلة 1: انتظار قاعدة البيانات ───────────────────────────────
echo "[$(ts)] [deploy] ── المرحلة 1: انتظار قاعدة البيانات ──"
MAX_RETRIES=30
i=0
until node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT 1').then(()=>{p.\$disconnect();process.exit(0)}).catch(e=>{console.error('[db-wait] '+e.message.split('\n')[0]);process.exit(1)})"; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "[$(ts)] [deploy] ❌ قاعدة البيانات غير متاحة بعد $MAX_RETRIES محاولة. إنهاء."
    exit 1
  fi
  echo "[$(ts)] [deploy] المحاولة $i/$MAX_RETRIES — إعادة بعد 5 ثوانٍ..."
  sleep 5
done
echo "[$(ts)] [deploy] ✅ المرحلة 1 اكتملت — قاعدة البيانات متاحة"

# ── المرحلة 2: توليد Prisma Client ─────────────────────────────────
# يُعيد التوليد عند كل نشر لضمان توافق الـ client مع الـ schema الحالي
echo "[$(ts)] [deploy] ── المرحلة 2: prisma generate ──"
npx prisma generate
echo "[$(ts)] [deploy] ✅ المرحلة 2 اكتملت — Prisma Client جاهز"

# ── المرحلة 3: تطبيق ترحيلات Prisma ────────────────────────────────
echo "[$(ts)] [deploy] ── المرحلة 3: prisma migrate deploy ──"
npx prisma migrate deploy
echo "[$(ts)] [deploy] ✅ المرحلة 3 اكتملت — الترحيلات مُطبَّقة"

# ── المرحلة 4: الترحيلات اليدوية (SQL) ─────────────────────────────
echo "[$(ts)] [deploy] ── المرحلة 4: الترحيلات اليدوية ──"
node scripts/migrate.mjs
echo "[$(ts)] [deploy] ✅ المرحلة 4 اكتملت"

# ── المرحلة 5: البيانات الأولية (idempotent) ─────────────────────────
echo "[$(ts)] [deploy] ── المرحلة 5: البيانات الأولية ──"
node src/seed-if-empty.js || echo "[$(ts)] [deploy] ⚠️  تخطّي — البيانات موجودة أو فشل غير حرج"

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[$(ts)] [deploy] ── المرحلة 6: بيانات العرض التجريبية ──"
  node scripts/seed-strategic-plan.mjs   || echo "[$(ts)] [deploy] ⚠️  تخطّي — موجودة مسبقاً"
  node scripts/seed-kpi-history.mjs      || echo "[$(ts)] [deploy] ⚠️  تخطّي — موجودة مسبقاً"
  node scripts/seed-iso-documents.mjs    || echo "[$(ts)] [deploy] ⚠️  تخطّي — موجودة مسبقاً"
else
  echo "[$(ts)] [deploy] ── المراحل 6-8 متخطّاة — SEED_DEMO_DATA غير مُفعَّل ──"
fi

if [ "${SEED_FROM_JSON:-off}" = "on" ]; then
  echo "[$(ts)] [deploy] ── المرحلة 9: بيانات seed-from-json ──"
  node scripts/seed-from-json.mjs || echo "[$(ts)] [deploy] ⚠️  تخطّي"
fi

# ── جاهز: علّم الـ health endpoint ثم أطلق الخادم ──────────────────
echo "[$(ts)] [deploy] ═══════════════════════════════════════════════"
echo "[$(ts)] [deploy] ✅ اكتمال جميع المراحل — الخادم جاهز للاستماع"
echo "[$(ts)] [deploy] ═══════════════════════════════════════════════"
touch /tmp/startup-complete
echo "[$(ts)] [deploy] ── بدء خادم Node.js على PORT=${PORT:-3000} ──"
exec node src/server.js
