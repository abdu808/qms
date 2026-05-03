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
# Narrow recovery for known production migration states.
# Never reset the database. If a known migration is stuck as failed, inspect
# whether its target table already exists, then mark it applied or rolled back.
failed_migrations() {
  node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT migration_name
  FROM "_prisma_migrations"
  WHERE finished_at IS NULL
    AND rolled_back_at IS NULL
  ORDER BY started_at
`).then(rows => {
  for (const row of rows) console.log(row.migration_name);
}).catch(() => {
  // If the metadata table does not exist yet, there is nothing to recover.
}).finally(() => p.$disconnect());
NODE
}

table_exists() {
  TABLE_NAME="$1" node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const allowed = new Set(['KpiFollowUp', 'IntegrationDelivery']);
const table = process.env.TABLE_NAME;
if (!allowed.has(table)) {
  console.log('no');
  process.exit(0);
}
const p = new PrismaClient();
p.$queryRawUnsafe(`SELECT to_regclass('public."${table}"')::text AS rel`).then(rows => {
  console.log(rows && rows[0] && rows[0].rel ? 'yes' : 'no');
}).catch(() => {
  console.log('no');
}).finally(() => p.$disconnect());
NODE
}

recover_failed_migration() {
  MIGRATION_NAME="$1"
  TABLE_NAME="$2"
  FAILED_NAMES="$3"

  if echo "$FAILED_NAMES" | grep -qx "$MIGRATION_NAME"; then
    echo "[$(ts)] [deploy] failed migration detected: $MIGRATION_NAME"
    if [ "$(table_exists "$TABLE_NAME")" = "yes" ]; then
      echo "[$(ts)] [deploy] table $TABLE_NAME exists; marking $MIGRATION_NAME as applied"
      npx prisma migrate resolve --applied "$MIGRATION_NAME"
    else
      echo "[$(ts)] [deploy] table $TABLE_NAME is missing; marking $MIGRATION_NAME as rolled back"
      npx prisma migrate resolve --rolled-back "$MIGRATION_NAME"
    fi
  fi
}

FAILED_MIGRATIONS="$(failed_migrations || true)"
if [ -n "$FAILED_MIGRATIONS" ]; then
  echo "[$(ts)] [deploy] Prisma failed migrations found:"
  echo "$FAILED_MIGRATIONS"
  recover_failed_migration "20260502220000_add_kpi_followup" "KpiFollowUp" "$FAILED_MIGRATIONS"
  recover_failed_migration "20260503001000_add_integration_delivery" "IntegrationDelivery" "$FAILED_MIGRATIONS"
fi

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
