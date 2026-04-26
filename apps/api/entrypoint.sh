#!/bin/sh
# entrypoint.sh — نقطة دخول مبسّطة
# set -e: أي خطأ يوقف النشر فوراً بكود خروج واضح — لا حالة half-deployed
set -e

echo "[deploy] ── Prisma migrate deploy ──────────────────────────────"
npx prisma migrate deploy

echo "[deploy] ── Custom SQL migrations ─────────────────────────────"
node scripts/migrate.mjs

echo "[deploy] ── Initial seed (idempotent — skip if data exists) ───"
node src/seed-if-empty.js || true

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[deploy] ── Demo data seeds ──────────────────────────────────"
  node scripts/seed-strategic-plan.mjs   || true
  node scripts/seed-kpi-history.mjs      || true
  node scripts/seed-iso-documents.mjs    || true
fi

if [ "${SEED_FROM_JSON:-off}" = "on" ]; then
  echo "[deploy] ── Seed from JSON ───────────────────────────────────"
  node scripts/seed-from-json.mjs || true
fi

echo "[deploy] ✅ All migrations done — starting server"
exec node src/server.js
