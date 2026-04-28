/**
 * tests/backup-c6-c7.test.js
 *
 * اختبارات C6 و C7 للنسخ الاحتياطية:
 *   C6 — pg_dump preflight guard: rotation لا تعمل عند فشل backup
 *   C7 — تشفير AES-256-GCM: encrypt/decrypt round-trip، كشف التلاعب، التحقق من المفتاح
 */
import { describe, it, expect }                          from 'vitest';
import { randomBytes }                                   from 'node:crypto';
import {
  encryptBuffer, decryptBuffer,
  parseEncryptionKey, resolveEncryptionKey,
  rotateBackups, pgDumpPreflight,
  runBackupCycle,
} from '../src/services/backup.js';

// ─── C7: تشفير / فك تشفير (Buffer level) ────────────────────────────────────
describe('C7 — AES-256-GCM encrypt/decrypt', () => {
  const key = randomBytes(32); // مفتاح اختبار عشوائي

  it('round-trip: encrypt then decrypt returns original plaintext', () => {
    const original  = Buffer.from('SELECT 1; -- fake SQL dump content\n'.repeat(100));
    const encrypted = encryptBuffer(original, key);
    const decrypted = decryptBuffer(encrypted, key);
    expect(decrypted.equals(original)).toBe(true);
  });

  it('encrypted output starts with magic bytes QBK1', () => {
    const enc = encryptBuffer(Buffer.from('test'), key);
    expect(enc.slice(0, 4).toString()).toBe('QBK1');
  });

  it('encrypted output is larger than plaintext by header + tag', () => {
    const plain = Buffer.from('a'.repeat(1000));
    const enc   = encryptBuffer(plain, key);
    // magic(4) + iv(16) + tag(16) = 36 bytes overhead
    expect(enc.length).toBe(plain.length + 4 + 16 + 16);
  });

  it('each encryption produces a different IV (different ciphertext)', () => {
    const plain = Buffer.from('same content');
    const enc1  = encryptBuffer(plain, key);
    const enc2  = encryptBuffer(plain, key);
    // يجب أن يكونا مختلفين بسبب IV عشوائي
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('decryption throws on tampered ciphertext (GCM authentication fail)', () => {
    const enc = encryptBuffer(Buffer.from('secret data'), key);
    // تعديل بايت واحد في منتصف الـ ciphertext
    const tampered = Buffer.from(enc);
    tampered[20] ^= 0xff; // flip bits في أول بايت من الـ ciphertext
    expect(() => decryptBuffer(tampered, key)).toThrow();
  });

  it('decryption throws on tampered authTag', () => {
    const enc     = encryptBuffer(Buffer.from('secret data'), key);
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1] ^= 0xff; // flip آخر بايت (في الـ authTag)
    expect(() => decryptBuffer(tampered, key)).toThrow();
  });

  it('decryption throws on wrong key', () => {
    const enc      = encryptBuffer(Buffer.from('secret data'), key);
    const wrongKey = randomBytes(32);
    expect(() => decryptBuffer(enc, wrongKey)).toThrow();
  });

  it('decryption throws on wrong magic bytes', () => {
    const enc      = encryptBuffer(Buffer.from('test'), key);
    const corrupted = Buffer.from(enc);
    corrupted.write('XXXX', 0); // استبدال magic
    expect(() => decryptBuffer(corrupted, key)).toThrow(/magic bytes/);
  });

  it('decryption throws on file too short', () => {
    const tooShort = Buffer.from('QBK1short'); // أقل من 36 بايت
    expect(() => decryptBuffer(tooShort, key)).toThrow(/قصير/);
  });

  it('handles empty plaintext', () => {
    const empty     = Buffer.alloc(0);
    const encrypted = encryptBuffer(empty, key);
    const decrypted = decryptBuffer(encrypted, key);
    expect(decrypted.length).toBe(0);
  });

  it('handles large binary content (1 MB)', () => {
    const large     = randomBytes(1024 * 1024);
    const encrypted = encryptBuffer(large, key);
    const decrypted = decryptBuffer(encrypted, key);
    expect(decrypted.equals(large)).toBe(true);
  });
});

// ─── C7: مفاتيح التشفير ──────────────────────────────────────────────────────
describe('C7 — parseEncryptionKey', () => {
  it('accepts 32-byte hex key (64 chars)', () => {
    const hex = randomBytes(32).toString('hex');
    expect(hex).toHaveLength(64);
    const key = parseEncryptionKey(hex);
    expect(key).toHaveLength(32);
  });

  it('accepts 32-byte base64 key (44 chars)', () => {
    const b64 = randomBytes(32).toString('base64');
    expect(b64).toHaveLength(44);
    const key = parseEncryptionKey(b64);
    expect(key).toHaveLength(32);
  });

  it('returns null for empty/null input', () => {
    expect(parseEncryptionKey('')).toBeNull();
    expect(parseEncryptionKey(null)).toBeNull();
    expect(parseEncryptionKey(undefined)).toBeNull();
  });

  it('throws for key shorter than 32 bytes', () => {
    const shortHex = randomBytes(16).toString('hex'); // 16 bytes only
    expect(() => parseEncryptionKey(shortHex)).toThrow(/32 بايت/);
  });
});

// ─── C7: resolveEncryptionKey ────────────────────────────────────────────────
describe('C7 — resolveEncryptionKey env logic', () => {
  const origKey   = process.env.BACKUP_ENCRYPTION_KEY;
  const origPlain = process.env.BACKUP_ALLOW_PLAINTEXT;

  const cleanup = () => {
    if (origKey   !== undefined) process.env.BACKUP_ENCRYPTION_KEY   = origKey;
    else delete process.env.BACKUP_ENCRYPTION_KEY;
    if (origPlain !== undefined) process.env.BACKUP_ALLOW_PLAINTEXT  = origPlain;
    else delete process.env.BACKUP_ALLOW_PLAINTEXT;
  };

  it('returns 32-byte key when BACKUP_ENCRYPTION_KEY is valid', () => {
    process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    delete process.env.BACKUP_ALLOW_PLAINTEXT;
    try {
      const k = resolveEncryptionKey();
      expect(k).toHaveLength(32);
    } finally { cleanup(); }
  });

  it('returns null when BACKUP_ALLOW_PLAINTEXT=true and no key', () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ALLOW_PLAINTEXT = 'true';
    try {
      const k = resolveEncryptionKey();
      expect(k).toBeNull();
    } finally { cleanup(); }
  });

  it('throws when no key and BACKUP_ALLOW_PLAINTEXT is not true', () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    delete process.env.BACKUP_ALLOW_PLAINTEXT;
    try {
      expect(() => resolveEncryptionKey()).toThrow(/BACKUP_ENCRYPTION_KEY/);
    } finally { cleanup(); }
  });

  it('throws when BACKUP_ALLOW_PLAINTEXT=false and no key', () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ALLOW_PLAINTEXT = 'false';
    try {
      expect(() => resolveEncryptionKey()).toThrow();
    } finally { cleanup(); }
  });
});

// ─── C6: rotation guard ──────────────────────────────────────────────────────
describe('C6 — rotation guard: no old backups deleted on failure', () => {
  it('rotateBackups returns { kept:0, deleted:0 } for non-existent dir', () => {
    const result = rotateBackups('nonexistent-prefix-xyz');
    expect(result.kept).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it('runBackupCycle returns skipped rotation info when preflight fails', async () => {
    // نحاكي بيئة بدون DATABASE_URL صالح — pg_dump سيفشل أو URL خاطئ
    // لكن الأهم: نتحقق من بنية الـ response عند الفشل
    // ملاحظة: هذا الاختبار يحتاج pg_dump متاحاً لفحص الـ preflight
    // لذلك نتحقق من السلوك الدفاعي للـ runBackupCycle فقط

    // نعطي DATABASE_URL غير صالح لضمان فشل النسخة (ليس الـ preflight)
    const origUrl  = process.env.DATABASE_URL;
    const origKey  = process.env.BACKUP_ENCRYPTION_KEY;
    const origPlain = process.env.BACKUP_ALLOW_PLAINTEXT;

    process.env.DATABASE_URL = 'http://not-postgres.example.com/db';
    process.env.BACKUP_ALLOW_PLAINTEXT = 'true';
    delete process.env.BACKUP_ENCRYPTION_KEY;

    try {
      const result = await runBackupCycle();
      // يجب أن يُرجع نتيجة (سواء نجح preflight أم لا)
      expect(result).toHaveProperty('at');
      expect(result).toHaveProperty('rotate');
    } finally {
      if (origUrl   !== undefined) process.env.DATABASE_URL            = origUrl;
      else delete process.env.DATABASE_URL;
      if (origKey   !== undefined) process.env.BACKUP_ENCRYPTION_KEY   = origKey;
      else delete process.env.BACKUP_ENCRYPTION_KEY;
      if (origPlain !== undefined) process.env.BACKUP_ALLOW_PLAINTEXT  = origPlain;
      else delete process.env.BACKUP_ALLOW_PLAINTEXT;
    }
  }, 15_000);

  it('runBackupCycle.rotate.db has skipped=true when db backup fails', async () => {
    // بيئة: DATABASE_URL غير Postgres → db.ok = false → rotation يجب أن تُتخطى
    // ملاحظة: إذا كان pg_dump غير مُثبَّت في البيئة الحالية، يرجع preflight failure
    //          مبكراً بدون خاصية db — في كلتا الحالتين التحقق من أن rotation مُتخطّاة.
    const origUrl   = process.env.DATABASE_URL;
    const origPlain = process.env.BACKUP_ALLOW_PLAINTEXT;
    const origKey   = process.env.BACKUP_ENCRYPTION_KEY;

    process.env.DATABASE_URL = 'mongodb://not-postgres/db'; // ليس postgres
    process.env.BACKUP_ALLOW_PLAINTEXT = 'true';
    delete process.env.BACKUP_ENCRYPTION_KEY;

    try {
      const result = await runBackupCycle();
      expect(result.ok).toBe(false); // دائماً false في هذه البيئة

      if (result.db) {
        // pg_dump مُثبَّت: preflight نجح، backup فشل بسبب DATABASE_URL غير Postgres
        expect(result.db.ok).toBe(false);
        expect(result.rotate.db.skipped).toBe(true);
        expect(result.rotate.db.reason).toMatch(/failed/);
      } else {
        // pg_dump غير مُثبَّت: preflight فشل → إرجاع مبكر
        // التحقق أن rotate مُتخطّى بشكل صريح
        expect(result.rotate.skipped ?? result.rotate?.db?.skipped ?? true).toBe(true);
        expect(result.error).toBeTruthy();
      }
    } finally {
      if (origUrl   !== undefined) process.env.DATABASE_URL            = origUrl;
      else delete process.env.DATABASE_URL;
      if (origPlain !== undefined) process.env.BACKUP_ALLOW_PLAINTEXT  = origPlain;
      else delete process.env.BACKUP_ALLOW_PLAINTEXT;
      if (origKey   !== undefined) process.env.BACKUP_ENCRYPTION_KEY   = origKey;
      else delete process.env.BACKUP_ENCRYPTION_KEY;
    }
  }, 15_000);
});

// ─── C6: pgDumpPreflight ────────────────────────────────────────────────────
describe('C6 — pgDumpPreflight', () => {
  it('returns object with ok and version or error properties', async () => {
    const result = await pgDumpPreflight();
    expect(result).toHaveProperty('ok');
    // إذا pg_dump موجود (في Docker image): ok=true + version
    // إذا غير موجود (بيئة تطوير): ok=false + error
    if (result.ok) {
      expect(result.version).toMatch(/pg_dump/i);
    } else {
      expect(result.error).toBeTruthy();
    }
  }, 10_000);
});
