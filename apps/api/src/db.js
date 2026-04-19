import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

// ──────────────────────────────────────────────────────────────
// Slow-query observability.
// Logs any Prisma call that exceeds SLOW_QUERY_MS (default 500).
// Helps surface N+1 loops and missing indexes without needing APM.
// ──────────────────────────────────────────────────────────────
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 500);
prisma.$use(async (params, next) => {
  const t0 = Date.now();
  try {
    const result = await next(params);
    const ms = Date.now() - t0;
    if (ms >= SLOW_QUERY_MS) {
      const model = params.model || '(raw)';
      console.warn(`[slow-query] ${model}.${params.action} ${ms}ms`);
    }
    return result;
  } catch (err) {
    const ms = Date.now() - t0;
    const model = params.model || '(raw)';
    // Skip well-known "expected" errors that callers already handle:
    //   P2002 = unique constraint (idempotent inserts)
    //   P2025 = record not found (optimistic "update if exists")
    const silent = err.code === 'P2002' || err.code === 'P2025';
    if (!silent) {
      // Log *once* with a compact summary; the route layer will still see the throw.
      console.error(`[prisma-error] ${model}.${params.action} ${ms}ms — ${err.message?.split('\n')[0]}`);
    }
    throw err;
  }
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
