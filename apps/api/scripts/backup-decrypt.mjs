#!/usr/bin/env node
/**
 * backup-decrypt.mjs — فك تشفير نسخة احتياطية QMS مشفَّرة
 *
 * الاستخدام:
 *   BACKUP_ENCRYPTION_KEY=<hex-key> node scripts/backup-decrypt.mjs <input.enc> <output>
 *
 * مثال كامل (استعادة قاعدة البيانات):
 *   # خطوة 1: فك التشفير
 *   BACKUP_ENCRYPTION_KEY=abc123... \
 *     node scripts/backup-decrypt.mjs db-2026-04-28.sql.gz.enc db-2026-04-28.sql.gz
 *
 *   # خطوة 2: فك الضغط
 *   gunzip db-2026-04-28.sql.gz
 *
 *   # خطوة 3: استعادة قاعدة البيانات
 *   psql "$DATABASE_URL" < db-2026-04-28.sql
 *
 * الفرمات:
 *   BACKUP_ENCRYPTION_KEY: 64 محرف hex (32 بايت) أو 44 محرف base64
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync }          from 'node:fs';
import { createDecipheriv }    from 'node:crypto';
import { resolve, basename }   from 'node:path';

const MAGIC   = Buffer.from('QBK1');
const IV_LEN  = 16;
const TAG_LEN = 16;

function getKey() {
  const keyEnv = process.env.BACKUP_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY غير محدد. ' +
      'مثال: BACKUP_ENCRYPTION_KEY=<hex> node scripts/backup-decrypt.mjs ...'
    );
  }
  const keyBuf = Buffer.from(keyEnv, keyEnv.length === 64 ? 'hex' : 'base64');
  if (keyBuf.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY يجب أن يكون 32 بايت (64 hex أو 44 base64)');
  }
  return keyBuf;
}

async function main() {
  const [,, src, dst] = process.argv;

  if (!src || !dst) {
    console.error('');
    console.error('الاستخدام:');
    console.error('  BACKUP_ENCRYPTION_KEY=<key> node scripts/backup-decrypt.mjs <input.enc> <output>');
    console.error('');
    console.error('مثال:');
    console.error('  BACKUP_ENCRYPTION_KEY=abc123... \\');
    console.error('    node scripts/backup-decrypt.mjs db-2026-04-28.sql.gz.enc db-2026-04-28.sql.gz');
    process.exit(1);
  }

  const srcPath = resolve(src);
  const dstPath = resolve(dst);

  if (!existsSync(srcPath)) {
    console.error(`❌ الملف غير موجود: ${srcPath}`);
    process.exit(1);
  }

  let key;
  try {
    key = getKey();
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  console.log(`📂 المصدر:  ${basename(srcPath)}`);
  console.log(`📄 الهدف:   ${basename(dstPath)}`);

  const data = await readFile(srcPath);

  // التحقق من بنية الملف
  if (data.length < 4 + IV_LEN + TAG_LEN) {
    console.error('❌ الملف قصير جداً — ليس ملف نسخة QMS مشفَّرة');
    process.exit(1);
  }
  if (!data.slice(0, 4).equals(MAGIC)) {
    console.error('❌ magic bytes لا تتطابق — ليس ملف نسخة QMS (المتوقع: QBK1)');
    console.error('   هل هذا ملف .sql.gz.enc صحيح من نظام QMS؟');
    process.exit(1);
  }

  const iv         = data.slice(4, 4 + IV_LEN);
  const authTag    = data.slice(-TAG_LEN);
  const ciphertext = data.slice(4 + IV_LEN, -TAG_LEN);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    console.error('❌ فشل التحقق من التشفير (GCM authTag غير صالحة)');
    console.error('   الأسباب المحتملة:');
    console.error('   • المفتاح خاطئ');
    console.error('   • الملف تالف أو مُعدَّل');
    process.exit(1);
  }

  await writeFile(dstPath, decrypted);

  const encSize  = (data.length     / 1024).toFixed(1);
  const plainSize = (decrypted.length / 1024).toFixed(1);
  console.log(`✅ تم فك التشفير بنجاح`);
  console.log(`   المشفَّر: ${encSize} KB  →  النص الواضح: ${plainSize} KB`);
  console.log('');
  console.log('الخطوات التالية:');
  if (dstPath.endsWith('.sql.gz')) {
    console.log(`  gunzip "${dstPath}"`);
    console.log(`  psql "$DATABASE_URL" < "${dstPath.replace('.gz', '')}"`);
  } else {
    console.log(`  تحقق من صيغة الملف وافك ضغطه إذا لزم`);
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
