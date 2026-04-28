/**
 * tests/kpiEntryIntegrity.test.js — DATA-001: exactly-one-FK guard
 *
 * Unit tests for lib/kpiEntry-integrity.js (pure, no DB, no HTTP).
 * Covers all rejection and acceptance cases for both CREATE and UPDATE paths.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  validateKpiEntryFKs,
  mergeKpiEntryFKs,
  countKpiEntryFKs,
} from '../src/lib/kpiEntry-integrity.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Call validateKpiEntryFKs and return the error message, or null if accepted. */
function check(data) {
  try {
    validateKpiEntryFKs(data);
    return null; // accepted
  } catch (e) {
    return e.message;
  }
}

const INDICATOR_ID  = 'ind_001';
const OBJECTIVE_ID  = 'obj_001';
const ACTIVITY_ID   = 'act_001';

// ─── countKpiEntryFKs ────────────────────────────────────────────────────────

describe('countKpiEntryFKs', () => {
  it('returns 0 when all FKs are absent', () => {
    expect(countKpiEntryFKs({})).toBe(0);
  });

  it('returns 0 when all FKs are null', () => {
    expect(countKpiEntryFKs({ indicatorId: null, objectiveId: null, activityId: null })).toBe(0);
  });

  it('returns 1 for indicatorId only', () => {
    expect(countKpiEntryFKs({ indicatorId: INDICATOR_ID })).toBe(1);
  });

  it('returns 1 for objectiveId only', () => {
    expect(countKpiEntryFKs({ objectiveId: OBJECTIVE_ID })).toBe(1);
  });

  it('returns 1 for activityId only', () => {
    expect(countKpiEntryFKs({ activityId: ACTIVITY_ID })).toBe(1);
  });

  it('returns 2 for indicatorId + objectiveId', () => {
    expect(countKpiEntryFKs({ indicatorId: INDICATOR_ID, objectiveId: OBJECTIVE_ID })).toBe(2);
  });

  it('returns 3 for all three FKs set', () => {
    expect(countKpiEntryFKs({
      indicatorId: INDICATOR_ID, objectiveId: OBJECTIVE_ID, activityId: ACTIVITY_ID,
    })).toBe(3);
  });
});

// ─── validateKpiEntryFKs — rejection cases ───────────────────────────────────

describe('validateKpiEntryFKs — REJECT cases', () => {
  it('rejects orphan: no FK at all (empty object)', () => {
    const msg = check({});
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/مصدر واحد/);
  });

  it('rejects orphan: all FKs explicitly null', () => {
    const msg = check({ indicatorId: null, objectiveId: null, activityId: null });
    expect(msg).toBeTruthy();
  });

  it('rejects indicatorId + objectiveId combination', () => {
    const msg = check({ indicatorId: INDICATOR_ID, objectiveId: OBJECTIVE_ID });
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/indicatorId/);
    expect(msg).toMatch(/objectiveId/);
  });

  it('rejects indicatorId + activityId combination', () => {
    const msg = check({ indicatorId: INDICATOR_ID, activityId: ACTIVITY_ID });
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/indicatorId/);
    expect(msg).toMatch(/activityId/);
  });

  it('rejects objectiveId + activityId combination', () => {
    const msg = check({ objectiveId: OBJECTIVE_ID, activityId: ACTIVITY_ID });
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/objectiveId/);
    expect(msg).toMatch(/activityId/);
  });

  it('rejects all three FKs set', () => {
    const msg = check({
      indicatorId: INDICATOR_ID, objectiveId: OBJECTIVE_ID, activityId: ACTIVITY_ID,
    });
    expect(msg).toBeTruthy();
  });
});

// ─── validateKpiEntryFKs — acceptance cases ──────────────────────────────────

describe('validateKpiEntryFKs — ACCEPT cases', () => {
  it('accepts indicatorId only', () => {
    expect(check({ indicatorId: INDICATOR_ID })).toBeNull();
  });

  it('accepts indicatorId only (nulls for others)', () => {
    expect(check({ indicatorId: INDICATOR_ID, objectiveId: null, activityId: null })).toBeNull();
  });

  it('accepts objectiveId only (legacy, still supported)', () => {
    expect(check({ objectiveId: OBJECTIVE_ID })).toBeNull();
  });

  it('accepts objectiveId only (nulls for others)', () => {
    expect(check({ objectiveId: OBJECTIVE_ID, indicatorId: null, activityId: null })).toBeNull();
  });

  it('accepts activityId only', () => {
    expect(check({ activityId: ACTIVITY_ID })).toBeNull();
  });

  it('accepts activityId only (nulls for others)', () => {
    expect(check({ activityId: ACTIVITY_ID, indicatorId: null, objectiveId: null })).toBeNull();
  });
});

// ─── mergeKpiEntryFKs ────────────────────────────────────────────────────────

describe('mergeKpiEntryFKs — PATCH merge semantics', () => {
  const existingWithObjective = {
    id: 'entry_1',
    objectiveId: OBJECTIVE_ID,
    activityId:  null,
    indicatorId: null,
    year: 2026,
    month: 3,
    actualValue: 75,
  };

  it('preserves existing FKs when patch has no FK fields', () => {
    const merged = mergeKpiEntryFKs(existingWithObjective, { actualValue: 80 });
    expect(merged.objectiveId).toBe(OBJECTIVE_ID);
    expect(merged.activityId).toBeNull();
    expect(merged.indicatorId).toBeNull();
  });

  it('allows patch to override a FK', () => {
    const merged = mergeKpiEntryFKs(existingWithObjective, { objectiveId: 'obj_002' });
    expect(merged.objectiveId).toBe('obj_002');
  });

  it('allows patch to null out a FK (explicit null in patch)', () => {
    const merged = mergeKpiEntryFKs(existingWithObjective, { objectiveId: null });
    expect(merged.objectiveId).toBeNull();
  });

  it('merged result with patch introducing a second FK fails validation', () => {
    // Existing has objectiveId; patch adds indicatorId → should fail
    const merged = mergeKpiEntryFKs(existingWithObjective, { indicatorId: INDICATOR_ID });
    const msg = check(merged);
    expect(msg).toBeTruthy();
  });

  it('merged result that removes the only FK becomes an orphan → fails validation', () => {
    const merged = mergeKpiEntryFKs(existingWithObjective, { objectiveId: null });
    const msg = check(merged);
    expect(msg).toBeTruthy();
  });

  it('valid patch that replaces objectiveId with activityId passes validation', () => {
    // Null out objectiveId and set activityId in the same patch
    const merged = mergeKpiEntryFKs(existingWithObjective, {
      objectiveId: null,
      activityId: ACTIVITY_ID,
    });
    expect(check(merged)).toBeNull();
  });
});

// ─── DATA-001 upsert-merge scenarios (per review comment) ────────────────────
// These mirror the two scenarios raised during PR review:
//   1. Existing indicatorId record + incoming patch adding objectiveId → REJECT
//   2. Patch that removes the only FK from an indicatorId record → REJECT (orphan)
// NOTE: In the current upsert route the merge guard runs at the service level
// (indicatorId: null is now explicit in upsertKpiEntry.data). These tests
// validate the mergeKpiEntryFKs helper that will protect a future PATCH /entries/:id route.

describe('DATA-001 upsert-merge scenarios (review)', () => {
  const existingWithIndicator = {
    id: 'entry_2',
    indicatorId: INDICATOR_ID,
    objectiveId: null,
    activityId:  null,
    year: 2026,
    month: 4,
    actualValue: 88,
  };

  it('UPSERT/PATCH: adding objectiveId to an indicatorId-based record → REJECTED (mixed FKs)', () => {
    // Simulates: existing row has indicatorId; incoming patch tries to also set objectiveId
    const merged = mergeKpiEntryFKs(existingWithIndicator, { objectiveId: OBJECTIVE_ID });
    const msg = check(merged);
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/indicatorId/);
    expect(msg).toMatch(/objectiveId/);
  });

  it('UPSERT/PATCH: removing indicatorId without providing another FK → REJECTED (orphan)', () => {
    // Simulates: patch nulls out indicatorId but provides no replacement FK
    const merged = mergeKpiEntryFKs(existingWithIndicator, { indicatorId: null });
    const msg = check(merged);
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/مصدر واحد/);
  });
});

// ─── Zod createSchema integration (DATA-001 refine) ──────────────────────────

describe('kpiEntry createSchema — Zod refine (DATA-001)', () => {
  // Import here so this test file is self-contained.
  let createSchema;
  beforeAll(async () => {
    ({ createSchema } = await import('../src/schemas/kpiEntry.schema.js'));
  });

  it('Zod rejects orphan entry (no FK)', () => {
    const r = createSchema.safeParse({ year: 2026, month: 1, actualValue: 50 });
    expect(r.success).toBe(false);
  });

  it('Zod rejects indicatorId + objectiveId', () => {
    const r = createSchema.safeParse({
      indicatorId: INDICATOR_ID, objectiveId: OBJECTIVE_ID,
      year: 2026, month: 1, actualValue: 50,
    });
    expect(r.success).toBe(false);
  });

  it('Zod rejects indicatorId + activityId', () => {
    const r = createSchema.safeParse({
      indicatorId: INDICATOR_ID, activityId: ACTIVITY_ID,
      year: 2026, month: 1, actualValue: 50,
    });
    expect(r.success).toBe(false);
  });

  it('Zod rejects objectiveId + activityId', () => {
    const r = createSchema.safeParse({
      objectiveId: OBJECTIVE_ID, activityId: ACTIVITY_ID,
      year: 2026, month: 1, actualValue: 50,
    });
    expect(r.success).toBe(false);
  });

  it('Zod accepts indicatorId only', () => {
    const r = createSchema.safeParse({
      indicatorId: INDICATOR_ID, year: 2026, month: 1, actualValue: 50,
    });
    expect(r.success).toBe(true);
  });

  it('Zod accepts objectiveId only', () => {
    const r = createSchema.safeParse({
      objectiveId: OBJECTIVE_ID, year: 2026, month: 3, actualValue: 75,
    });
    expect(r.success).toBe(true);
  });

  it('Zod accepts activityId only', () => {
    const r = createSchema.safeParse({
      activityId: ACTIVITY_ID, year: 2026, month: 6, actualValue: 100,
    });
    expect(r.success).toBe(true);
  });
});
