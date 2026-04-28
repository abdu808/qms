/**
 * services/backup.js — نسخ احتياطي آلي (ISO 9.1 / 7.5.3).
 *
 * يُنفِّذ:
 *   1) pg_dump preflight: يتحقق من وجود pg_dump قبل أي عملية (C6)
 *   2) `pg_dump` لقاعدة بيانات PostgreSQL (مضغوط gzip)
 *   3) تشفير AES-256-GCM للملف قبل حفظه على القرص (C7)
 *   4) أرشفة مجلد الملفات المرفوعة (اختياري)
 *   5) تدوير: 7 يومية + 4 أسبوعية + 6 شهرية
 *      ← التدوير يعمل فقط إذا نجح backup جديد (C6)
 *
 * متغيرات البيئة:
 *   QMS_BACKUP=on             تفعيل النسخ الآلي
 *   DATABASE_URL              سلسلة اتصال PostgreSQL
 *   BACKUP_DIR                مجلد النسخ (افتراضي: ./backups)
 *   BACKUP_ENCRYPTION_KEY     32 بايت hex (64 محرف) أو base64 (44 محرف) — مطلوب
 *   BACKUP_ALLOW_PLAINTEXT    true: يسمح بنسخة غير مشفرة عند غياب المفتاح (للتطوير فقط)
 *   BACKUP_RETENTION_DAYS     عدد الأيام الإجمالية (غير مستخدم في المنطق الحالي)
 */
import { spawn }                         from 'node:child_process';
import { createReadStream, createWriteStream,
         existsSync, mkdirSync, readdirSync,
         statSync, unlinkSync }           from 'node:fs';
import { promises as fsPromises }        from 'node:fs';
import { createGzip }                    from 'node:zlib';
import { join, resolve }                 from 'node:path';
import { pipeline }                      from 'node:stream/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const BACKUP_DIR  = resolve(process.env.BACKUP_DIR  || './backups');
const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR || './uploads');

// ── تنسيق ملف التشفير ────────────────────────────────────────────────────────
// [4B magic "QBK1"] [16B IV] [N bytes encrypted] [16B GCM authTag]
const MAGIC   = Buffer.from('QBK1');
const IV_LEN  = 16;
const TAG_LEN = 16;

// ─────────────────────────────────────────────────────────────────────────────
// C7: مفاتيح التشفير
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يُحوِّل متغير البيئة إلى Buffer مفتاح 32-بايت.
 * يقبل: 64 محرف hex أو 44 محرف base64.
 * @returns {Buffer} — مفتاح 32-بايت
 * @throws إذا المفتاح مشوَّه أو طوله خاطئ
 */
export function parseEncryptionKey(keyEnv) {
  if (!keyEnv) return null;
  const keyBuf = Buffer.from(keyEnv, keyEnv.length === 64 ? 'hex' : 'base64');
  if (keyBuf.length !== 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY يجب أن يكون 32 بايت — ' +
      'ولّد مفتاحاً جديداً: node scripts/backup-keygen.mjs'
    );
  }
  return keyBuf;
}

/**
 * يُحدِّد مفتاح التشفير بناءً على متغيرات البيئة.
 * @returns {Buffer|null} مفتاح 32-بايت أو null إذا BACKUP_ALLOW_PLAINTEXT=true
 * @throws إذا لم يوجد مفتاح ولم يُسمح بالنص الواضح
 */
export function resolveEncryptionKey() {
  const keyEnv     = process.env.BACKUP_ENCRYPTION_KEY;
  const allowPlain = process.env.BACKUP_ALLOW_PLAINTEXT === 'true';

  if (keyEnv) {
    return parseEncryptionKey(keyEnv); // قد يرمي إذا المفتاح مشوَّه
  }

  if (allowPlain) {
    console.warn(
      '[backup] ⚠️  BACKUP_ALLOW_PLAINTEXT=true — ' +
      'النسخة الاحتياطية ستُحفظ بدون تشفير. للإنتاج: حدِّد BACKUP_ENCRYPTION_KEY'
    );
    return null;
  }

  throw new Error(
    '[backup] رُفض إنشاء نسخة: BACKUP_ENCRYPTION_KEY غير محدد ' +
    'وBACKUP_ALLOW_PLAINTEXT≠true. ' +
    'ولّد مفتاحاً: node scripts/backup-keygen.mjs'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// C7: تشفير / فك تشفير (Buffer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يُشفِّر buffer بـ AES-256-GCM.
 * الناتج: [magic 4B][IV 16B][ciphertext][authTag 16B]
 */
export function encryptBuffer(plaintext, key) {
  const iv     = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body   = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, body, tag]);
}

/**
 * يفكّ تشفير buffer مشفَّر بـ encryptBuffer.
 * @throws إذا magic bytes خاطئة أو authTag لا يتطابق (ملف تالف/مُعدَّل)
 */
export function decryptBuffer(data, key) {
  if (data.length < 4 + IV_LEN + TAG_LEN) {
    throw new Error('الملف قصير جداً — ليس ملف نسخة QMS مشفَّرة');
  }
  if (!data.slice(0, 4).equals(MAGIC)) {
    throw new Error('magic bytes لا تتطابق — ليس ملف نسخة QMS مشفَّرة');
  }
  const iv         = data.slice(4, 4 + IV_LEN);
  const authTag    = data.slice(-TAG_LEN);
  const ciphertext = data.slice(4 + IV_LEN, -TAG_LEN);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  // decipher.final() يرمي إذا authTag خاطئة (ملف مُعدَّل أو مفتاح خاطئ)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * يُشفِّر ملف من srcPath ويكتب المشفَّر إلى dstPath.
 */
export async function encryptFile(srcPath, dstPath, key) {
  const plaintext = await fsPromises.readFile(srcPath);
  const encrypted = encryptBuffer(plaintext, key);
  await fsPromises.writeFile(dstPath, encrypted);
}

/**
 * يفكّ تشفير ملف من srcPath ويكتب النص الواضح إلى dstPath.
 * @throws إذا الملف تالف أو المفتاح خاطئ
 */
export async function decryptFile(srcPath, dstPath, key) {
  const data      = await fsPromises.readFile(srcPath);
  const plaintext = decryptBuffer(data, key);
  await fsPromises.writeFile(dstPath, plaintext);
}

// ─────────────────────────────────────────────────────────────────────────────
// أدوات مساعدة
// ─────────────────────────────────────────────────────────────────────────────

function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

/**
 * ينظِّف URL من معاملات Prisma التي لا يفهمها libpq/pg_dump.
 */
function sanitizeUrlForPgDump(url) {
  try {
    const u = new URL(url);
    const prismaOnly = new Set([
      'schema', 'connection_limit', 'pool_timeout',
      'pgbouncer', 'connect_timeout', 'socket_timeout',
    ]);
    for (const key of [...u.searchParams.keys()]) {
      if (prismaOnly.has(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─────────────────────────────────────────────────────────────────────────────
// C6: preflight — التحقق من وجود pg_dump قبل أي عملية
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يتحقق من وجود pg_dump وإصداره.
 * @returns {{ ok: boolean, version?: string, error?: string }}
 */
export async function pgDumpPreflight() {
  return new Promise((resolve) => {
    const proc = spawn('pg_dump', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('close', (code) => {
      resolve({ ok: code === 0, version: stdout.trim() });
    });
    proc.on('error', (err) => {
      resolve({
        ok: false,
        error: err.code === 'ENOENT'
          ? 'pg_dump غير مُثبَّت — ثبّت postgresql-client في Docker image'
          : `خطأ في تشغيل pg_dump: ${err.message}`,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// النسخ الاحتياطية
// ─────────────────────────────────────────────────────────────────────────────

/**
 * pg_dump → gzip → [تشفير AES-256-GCM] → ملف على القرص.
 * @returns {{ ok, path?, sizeBytes?, durationMs, encrypted?, error? }}
 */
export async function runDatabaseBackup() {
  const started = Date.now();
  const url = getDatabaseUrl();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return { ok: false, error: 'DATABASE_URL ليس Postgres — لم يتم التنفيذ', durationMs: 0 };
  }

  // حل مفتاح التشفير (يرمي إذا مشكلة بالإعداد)
  let encKey = null;
  try {
    encKey = resolveEncryptionKey();
  } catch (e) {
    return { ok: false, error: e.message, durationMs: Date.now() - started };
  }

  ensureDir(BACKUP_DIR);
  const today   = todayStamp();
  // نكتب دائماً إلى .tmp أولاً — نضمن أن الملف النهائي مكتمل
  const tmpPath   = join(BACKUP_DIR, `db-${today}.sql.gz.tmp`);
  const finalPath = join(BACKUP_DIR, encKey ? `db-${today}.sql.gz.enc` : `db-${today}.sql.gz`);
  const dumpUrl   = sanitizeUrlForPgDump(url);

  // ── تشغيل pg_dump وانتظار اكتمال pipeline والعملية معاً ─────────────
  const { code, stderr, procErr } = await new Promise((resolve) => {
    const proc = spawn(
      'pg_dump',
      ['--no-owner', '--no-privileges', '--format=plain', dumpUrl],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderrBuf = '';
    proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });
    proc.on('error', (err) => resolve({ code: -1, stderr: '', procErr: err }));

    const gzip = createGzip({ level: 6 });
    const out  = createWriteStream(tmpPath);

    // نتابع كلا الحدثين: إغلاق العملية + اكتمال pipeline
    let procCode     = null;
    let pipelineDone = false;

    const tryResolve = () => {
      if (procCode !== null && pipelineDone) {
        resolve({ code: procCode, stderr: stderrBuf.slice(0, 500) });
      }
    };

    proc.on('close', (c) => { procCode = c; tryResolve(); });
    pipeline(proc.stdout, gzip, out)
      .then(() => { pipelineDone = true; tryResolve(); })
      .catch((e) => {
        stderrBuf += `\n[pipeline] ${e.message}`;
        pipelineDone = true;
        tryResolve();
      });
  });

  const durationMs = Date.now() - started;

  // فشل تشغيل العملية (pg_dump غير موجود)
  if (procErr) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return {
      ok: false,
      error: procErr.code === 'ENOENT'
        ? 'pg_dump غير مُثبَّت على النظام'
        : procErr.message,
      durationMs,
    };
  }

  // فشل pg_dump (كود خروج ≠ 0)
  if (code !== 0) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return { ok: false, error: `pg_dump فشل (code=${code}): ${stderr}`, durationMs };
  }

  // تشفير أو إعادة تسمية
  try {
    if (encKey) {
      await encryptFile(tmpPath, finalPath, encKey);
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    } else {
      // BACKUP_ALLOW_PLAINTEXT=true — مسموح بدون تشفير
      await fsPromises.rename(tmpPath, finalPath);
    }
  } catch (e) {
    try { unlinkSync(tmpPath); }   catch { /* ignore */ }
    try { unlinkSync(finalPath); } catch { /* ignore */ }
    return { ok: false, error: `فشل معالجة ملف النسخة: ${e.message}`, durationMs };
  }

  let size = 0;
  try { size = statSync(finalPath).size; } catch { /* ignore */ }
  return { ok: true, path: finalPath, sizeBytes: size, durationMs, encrypted: !!encKey };
}

/**
 * أرشفة دليل uploads إلى tar.gz (إذا كان الدليل موجوداً).
 */
export async function runFilesBackup() {
  const started = Date.now();
  if (!existsSync(UPLOADS_DIR)) {
    return { ok: true, skipped: true, reason: 'UPLOADS_DIR غير موجود' };
  }
  ensureDir(BACKUP_DIR);
  const outPath = join(BACKUP_DIR, `files-${todayStamp()}.tar.gz`);

  return new Promise((resolve) => {
    const proc = spawn('tar', ['-czf', outPath, '-C', UPLOADS_DIR, '.'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderrBuf = '';
    proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });
    proc.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) {
        try { unlinkSync(outPath); } catch { /* ignore */ }
        return resolve({ ok: false, error: `tar فشل (code=${code}): ${stderrBuf.slice(0, 300)}`, durationMs });
      }
      let size = 0;
      try { size = statSync(outPath).size; } catch { /* ignore */ }
      resolve({ ok: true, path: outPath, sizeBytes: size, durationMs });
    });
    proc.on('error', (err) => {
      resolve({
        ok: false,
        error: err.code === 'ENOENT' ? 'tar غير مُثبَّت' : err.message,
        durationMs: Date.now() - started,
      });
    });
  });
}

/**
 * تدوير النسخ: يحتفظ بـ 7 يومية + 4 أسبوعية + 6 شهرية.
 * ⚠️  يجب استدعاؤه فقط بعد نجاح backup جديد (C6).
 */
export function rotateBackups(prefix) {
  if (!existsSync(BACKUP_DIR)) return { kept: 0, deleted: 0 };

  const all = readdirSync(BACKUP_DIR)
    .filter((f) => {
      if (!f.startsWith(prefix + '-')) return false;
      return (
        f.endsWith('.sql.gz')     || f.endsWith('.sql.gz.enc') ||
        f.endsWith('.tar.gz')     || f.endsWith('.tar.gz.enc')
      );
    })
    .map((f) => {
      const m = f.match(/^.*?-(\d{4}-\d{2}-\d{2})\./);
      return m ? { f, date: m[1], ts: new Date(m[1]).getTime() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts); // الأحدث أولاً

  const now = Date.now();
  const DAY = 86400000;
  const keptWeeks = new Set();
  const keptMonths = new Set();
  const toKeep = new Set();

  for (const b of all) {
    const ageDays = (now - b.ts) / DAY;
    if (ageDays <= 7) {
      toKeep.add(b.f);
    } else if (ageDays <= 35) {
      const d  = new Date(b.ts);
      const yw = `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
      if (!keptWeeks.has(yw)) { toKeep.add(b.f); keptWeeks.add(yw); }
    } else if (ageDays <= 210) {
      const d  = new Date(b.ts);
      const ym = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      if (!keptMonths.has(ym)) { toKeep.add(b.f); keptMonths.add(ym); }
    }
    // >210 يوم → حذف
  }

  let deleted = 0;
  for (const b of all) {
    if (!toKeep.has(b.f)) {
      try { unlinkSync(join(BACKUP_DIR, b.f)); deleted++; } catch { /* ignore */ }
    }
  }
  return { kept: toKeep.size, deleted };
}

/**
 * دورة كاملة: preflight → DB backup → files backup → rotate (إذا نجح).
 *
 * C6: التدوير لا يعمل إذا فشل backup الجديد.
 * C6: preflight يفحص pg_dump قبل أي عملية.
 */
export async function runBackupCycle() {
  const started = Date.now();

  // ── C6: preflight ─────────────────────────────────────────────────────
  const pf = await pgDumpPreflight();
  if (!pf.ok) {
    const msg = `pg_dump preflight فشل: ${pf.error}`;
    console.error(`[backup] ❌ ${msg}`);
    return {
      ok: false,
      error: msg,
      at: new Date().toISOString(),
      rotate: { skipped: true, reason: 'preflight failed — لم يُحذف أي backup قديم' },
    };
  }
  console.log(`[backup] ✅ pg_dump preflight: ${pf.version}`);

  // ── تنفيذ النسخ ───────────────────────────────────────────────────────
  const db    = await runDatabaseBackup();
  const files = await runFilesBackup();

  // ── C6: التدوير فقط إذا نجح backup جديد ──────────────────────────────
  // نحمي النسخ القديمة في حالة فشل النسخة الجديدة
  const rotDb = db.ok
    ? rotateBackups('db')
    : { kept: 0, deleted: 0, skipped: true, reason: 'db backup failed — لم يُحذف أي نسخة قديمة' };

  const rotFs = (files.ok && !files.skipped)
    ? rotateBackups('files')
    : { kept: 0, deleted: 0, skipped: true, reason: 'files backup failed or skipped' };

  const durationMs = Date.now() - started;
  const summary = {
    ok: db.ok,
    at: new Date().toISOString(),
    db,
    files,
    rotate: { db: rotDb, files: rotFs },
    durationMs,
  };

  if (!db.ok) {
    console.error('[backup] ❌', JSON.stringify(summary));
  } else {
    console.log('[backup] ✅', JSON.stringify(summary));
  }

  return summary;
}

// ── CLI: تشغيل يدوي ───────────────────────────────────────────────────────────
// node src/services/backup.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackupCycle()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(2); });
}
