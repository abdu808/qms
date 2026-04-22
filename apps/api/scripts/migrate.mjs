/**
 * scripts/migrate.mjs — مُشغِّل الترحيلات اليدوية عبر Prisma
 *
 * يُطبِّق ملفات SQL من prisma/migrations-manual/ بالترتيب الرقمي.
 * يُسجِّل كل ترحيل مطبَّق في جدول "_MigrationLog" لتجنب إعادة التطبيق.
 *
 * الاستخدام: node scripts/migrate.mjs
 * يُستدعى من startup.sh قبل تشغيل الخادم.
 *
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, '../prisma/migrations-manual');

// migrations التي تتطلب موافقة يدوية (لا تُطبَّق تلقائياً)
const MANUAL_ONLY = new Set([]);

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function ensureLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_MigrationLog" (
      "name"       TEXT PRIMARY KEY,
      "appliedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "name" FROM "_MigrationLog" ORDER BY "appliedAt"`
  );
  return new Set(rows.map(r => r.name));
}

async function applyFile(name, sql) {
  // تقسيم SQL إلى عبارات منفصلة — يحترم كتل dollar-quoted ($$...$$ أو $tag$...$tag$)
  // ونصوص ' ' و "  " لتجنّب كسر PL/pgSQL DO $$ ... $$ blocks
  const clean = sql
    .replace(/--[^\n]*/g, '')              // احذف التعليقات السطرية
    .replace(/\bBEGIN\s*;/gi, '')          // احذف BEGIN;
    .replace(/\bCOMMIT\s*;/gi, '');        // احذف COMMIT;

  const statements = [];
  let buf = '';
  let i = 0;
  let dollarTag = null;   // e.g. "$$" أو "$foo$" — null يعني خارج dollar-quote
  let inSingle = false;   // داخل '...'
  let inDouble = false;   // داخل "..."

  while (i < clean.length) {
    const ch = clean[i];
    const rest = clean.slice(i);

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += ch; i++; continue;
    }
    if (inSingle) {
      buf += ch; i++;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      buf += ch; i++;
      if (ch === '"') inDouble = false;
      continue;
    }

    // خارج أي سياق quoted
    if (ch === '$') {
      const m = rest.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (m) { dollarTag = m[0]; buf += dollarTag; i += dollarTag.length; continue; }
    }
    if (ch === "'") { inSingle = true; buf += ch; i++; continue; }
    if (ch === '"') { inDouble = true; buf += ch; i++; continue; }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = '';
      i++;
      continue;
    }
    buf += ch; i++;
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "_MigrationLog" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
    name
  );
}

async function main() {
  await ensureLogTable();
  const applied = await getApplied();

  // اقرأ الملفات بالترتيب الرقمي (001, 002, ...)
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !MANUAL_ONLY.has(f))
      .sort();
  } catch {
    console.log('[migrate] لا يوجد مجلد migrations-manual — تخطّي');
    return;
  }

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrate] لا توجد ترحيلات معلّقة ✓');
    return;
  }

  console.log(`[migrate] ${pending.length} ترحيل(ات) معلّق(ة): ${pending.join(', ')}`);

  for (const file of pending) {
    const path = join(MIGRATIONS_DIR, file);
    const sql  = readFileSync(path, 'utf8');
    try {
      await applyFile(file, sql);
      console.log(`[migrate] ✓ ${file}`);
    } catch (e) {
      console.error(`[migrate] ✗ ${file}: ${e?.message}`);
      throw e; // وقف فوري — لا تشغّل الخادم بقاعدة بيانات غير مكتملة
    }
  }

  console.log('[migrate] جميع الترحيلات طُبِّقت بنجاح ✓');
}

main()
  .catch(e => { console.error('[migrate] خطأ فادح:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
