/**
 * lib/kpiEntry-integrity.js — DATA-001
 * ──────────────────────────────────────────────────────────────────────────────
 * Enforces the "exactly-one-FK" rule on KpiEntry:
 *   Every entry must be tied to EXACTLY ONE source: indicatorId, objectiveId,
 *   or activityId. Any combination other than exactly one non-null FK is
 *   rejected.
 *
 * Rules:
 *   REJECT — no FK at all (orphan)
 *   REJECT — indicatorId + objectiveId (mixed)
 *   REJECT — indicatorId + activityId  (mixed)
 *   REJECT — objectiveId + activityId  (mixed)
 *   ACCEPT — exactly one of the three FKs is non-null
 *
 * Usage — CREATE:
 *   validateKpiEntryFKs(incomingData)   // throws AppError(400) if invalid
 *
 * Usage — UPDATE (PATCH semantics):
 *   const merged = mergeKpiEntryFKs(existingEntry, patch)
 *   validateKpiEntryFKs(merged)         // throws AppError(400) if result invalid
 *
 * The helper is intentionally framework-free (no express, no prisma) so that
 * it can be unit-tested without any I/O.
 */

import { BadRequest } from '../utils/errors.js';

/**
 * Count how many of the three FK fields are non-null in `data`.
 * @param {{ indicatorId?: string|null, objectiveId?: string|null, activityId?: string|null }} data
 * @returns {number}
 */
export function countKpiEntryFKs(data) {
  return (
    (data.indicatorId ? 1 : 0) +
    (data.objectiveId ? 1 : 0) +
    (data.activityId  ? 1 : 0)
  );
}

/**
 * Validate that `data` contains exactly one non-null FK.
 * Throws a 400 AppError on violation; returns void on success.
 *
 * @param {{ indicatorId?: string|null, objectiveId?: string|null, activityId?: string|null }} data
 * @throws {AppError} 400 BAD_REQUEST
 */
export function validateKpiEntryFKs(data) {
  const n = countKpiEntryFKs(data);

  if (n === 0) {
    throw BadRequest(
      'يجب تحديد مصدر واحد بالضبط للقراءة: objectiveId أو activityId أو indicatorId (لم يُحدَّد أيٌّ منها)',
    );
  }

  if (n > 1) {
    const present = [
      data.indicatorId && 'indicatorId',
      data.objectiveId && 'objectiveId',
      data.activityId  && 'activityId',
    ].filter(Boolean).join(' + ');
    throw BadRequest(
      `يجب تحديد مصدر واحد فقط للقراءة — وُجد أكثر من مصدر: ${present}`,
    );
  }
}

/**
 * Merge PATCH fields onto an existing KpiEntry record to produce a candidate
 * object that can be validated.
 *
 * For update paths the client may only send a partial patch (e.g. just
 * `actualValue`), so we keep the existing FKs unless the patch explicitly
 * overrides them.  A patch that sets a FK to `null` is treated as "remove
 * that FK from the entry", and the merged result must still pass the
 * exactly-one-FK rule.
 *
 * @param {object} existing  – full KpiEntry row from the DB
 * @param {object} patch     – incoming request body (partial)
 * @returns {{ indicatorId: string|null, objectiveId: string|null, activityId: string|null }}
 */
export function mergeKpiEntryFKs(existing, patch) {
  return {
    indicatorId: 'indicatorId' in patch ? (patch.indicatorId ?? null) : (existing.indicatorId ?? null),
    objectiveId: 'objectiveId' in patch ? (patch.objectiveId ?? null) : (existing.objectiveId ?? null),
    activityId:  'activityId'  in patch ? (patch.activityId  ?? null) : (existing.activityId  ?? null),
  };
}
