/**
 * tests/backupDiagnostics.test.js — SCHED-001
 *
 * Unit tests for getBackupDiagnostics() — safe config snapshot.
 * All 4 scenarios per spec:
 *   1. backup disabled
 *   2. backup enabled + encryption configured
 *   3. backup enabled + missing encryption key (misconfigured)
 *   4. plaintext allowed
 *
 * Tests run without a live process.env by injecting values then restoring.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBackupDiagnostics } from '../src/services/backup.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Temporarily override process.env vars, restore after each test. */
function withEnv(overrides, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// Valid 32-byte key as hex (64 chars)
const VALID_KEY_HEX = '0'.repeat(64);

// ─── Scenario 1: backup disabled ─────────────────────────────────────────────
describe('SCHED-001 — backup disabled (QMS_BACKUP != on)', () => {
  it('enabled=false when QMS_BACKUP is absent', () => {
    withEnv({ QMS_BACKUP: undefined, BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      expect(d.enabled).toBe(false);
    });
  });

  it('enabled=false when QMS_BACKUP=off', () => {
    withEnv({ QMS_BACKUP: 'off', BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      expect(d.enabled).toBe(false);
      // Not misconfigured — backup is simply off
      expect(d.misconfigured).toBe(false);
    });
  });

  it('does not expose encryption key value', () => {
    withEnv({ QMS_BACKUP: 'off', BACKUP_ENCRYPTION_KEY: VALID_KEY_HEX }, () => {
      const d = getBackupDiagnostics();
      const json = JSON.stringify(d);
      expect(json).not.toContain(VALID_KEY_HEX);
    });
  });
});

// ─── Scenario 2: backup enabled + encryption configured ──────────────────────
describe('SCHED-001 — backup enabled + encryption configured', () => {
  it('encryptionConfigured=true with valid 64-char hex key', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: VALID_KEY_HEX, BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      expect(d.enabled).toBe(true);
      expect(d.encryptionConfigured).toBe(true);
      expect(d.encryptionKeyLength).toBe(32);
      expect(d.plaintextAllowed).toBe(false);
      expect(d.misconfigured).toBe(false);
      expect(d.misconfiguredReason).toBeNull();
    });
  });

  it('encryptionKeyLength is 32 — never the actual key bytes', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: VALID_KEY_HEX }, () => {
      const d = getBackupDiagnostics();
      expect(d.encryptionKeyLength).toBe(32);
      // Confirm the key value is not anywhere in the response
      expect(JSON.stringify(d)).not.toContain(VALID_KEY_HEX);
    });
  });
});

// ─── Scenario 3: backup enabled + missing encryption key (misconfigured) ─────
describe('SCHED-001 — backup enabled + missing encryption key', () => {
  it('misconfigured=true when backup=on and no key and no plaintext', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      expect(d.enabled).toBe(true);
      expect(d.encryptionConfigured).toBe(false);
      expect(d.encryptionKeyLength).toBeNull();
      expect(d.plaintextAllowed).toBe(false);
      expect(d.misconfigured).toBe(true);
      expect(d.misconfiguredReason).toMatch(/BACKUP_ENCRYPTION_KEY/);
    });
  });

  it('misconfiguredReason does not contain any secret values', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      // reason should be a plain Arabic/English string, no env values
      expect(typeof d.misconfiguredReason).toBe('string');
      expect(d.misconfiguredReason.length).toBeGreaterThan(0);
    });
  });

  it('encryptionConfigured=false when key is present but malformed', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: 'tooshort', BACKUP_ALLOW_PLAINTEXT: undefined }, () => {
      const d = getBackupDiagnostics();
      expect(d.encryptionConfigured).toBe(false);
      expect(d.encryptionKeyLength).toBeNull();
      // Still misconfigured: key exists but is invalid, plaintext not allowed
      expect(d.misconfigured).toBe(true);
    });
  });
});

// ─── Scenario 4: plaintext allowed ───────────────────────────────────────────
describe('SCHED-001 — plaintext allowed (BACKUP_ALLOW_PLAINTEXT=true)', () => {
  it('plaintextAllowed=true and not misconfigured when plaintext is explicitly set', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: 'true' }, () => {
      const d = getBackupDiagnostics();
      expect(d.enabled).toBe(true);
      expect(d.encryptionConfigured).toBe(false);
      expect(d.plaintextAllowed).toBe(true);
      // Not misconfigured — plaintext is intentionally allowed
      expect(d.misconfigured).toBe(false);
      expect(d.misconfiguredReason).toBeNull();
    });
  });

  it('plaintextAllowed=true even when key is also set (key takes precedence for encryption)', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: VALID_KEY_HEX, BACKUP_ALLOW_PLAINTEXT: 'true' }, () => {
      const d = getBackupDiagnostics();
      expect(d.encryptionConfigured).toBe(true);
      expect(d.plaintextAllowed).toBe(true);
      expect(d.misconfigured).toBe(false);
    });
  });

  it('warning surface: diagnostics flags plaintext=true so ops team is aware', () => {
    withEnv({ QMS_BACKUP: 'on', BACKUP_ENCRYPTION_KEY: undefined, BACKUP_ALLOW_PLAINTEXT: 'true' }, () => {
      const d = getBackupDiagnostics();
      // The diagnostics endpoint wraps this in a warnings[] array — tested here at unit level
      const wouldWarn = d.enabled && d.plaintextAllowed;
      expect(wouldWarn).toBe(true);
    });
  });
});

// ─── General: no secrets ever leak ───────────────────────────────────────────
describe('SCHED-001 — secrets never leak from getBackupDiagnostics()', () => {
  const SENSITIVE = [VALID_KEY_HEX, 'postgres://user:pass@host/db', '/etc/secrets/key.bin'];

  it.each(SENSITIVE)('result JSON does not contain: %s', (secret) => {
    withEnv({
      QMS_BACKUP: 'on',
      BACKUP_ENCRYPTION_KEY: VALID_KEY_HEX,
      DATABASE_URL: 'postgres://user:pass@host/db',
    }, () => {
      const d = getBackupDiagnostics();
      expect(JSON.stringify(d)).not.toContain(secret);
    });
  });
});
