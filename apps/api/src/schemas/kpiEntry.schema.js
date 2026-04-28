/**
 * schemas/kpiEntry.schema.js — تحقق Zod لقراءات KPI الشهرية.
 *
 * @@unique([objectiveId, year, month]) / @@unique([activityId, year, month]) / @@unique([indicatorId, year, month])
 * تمنع التكرار على مستوى قاعدة البيانات.
 * يجب تحديد objectiveId أو activityId أو indicatorId — واحد فقط (لا أكثر ولا أقل).
 */
import { z } from 'zod';
import { idString, optionalTrimmedString } from './_helpers.js';

const currentYear = new Date().getFullYear();

const yearField = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(2020).max(currentYear + 2),
);

const monthField = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(1).max(12),
);

const numField = (min = 0) => z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().min(min).nullable().optional(),
);

const requiredNumField = (min = 0) => z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(min),
);

// objectiveId أو activityId أو indicatorId — واحد منها (triple-FK).
const baseShape = {
  objectiveId:  idString.nullable().optional(),
  activityId:   idString.nullable().optional(),
  indicatorId:  idString.nullable().optional(),
  year:         yearField,
  month:        monthField,
  actualValue:  requiredNumField(0),
  spent:        numField(0),
  evidenceUrl:  optionalTrimmedString(500),
  note:         optionalTrimmedString(2000),
  // Audit task 6 (architectural): حقول منفصلة بدلاً من workaround على note
  deviationReason: optionalTrimmedString(4000),
  actionNote:      optionalTrimmedString(4000),
};

// DATA-001: exactly-one-FK counter used by both the Zod refine (createSchema)
// and the standalone guard in lib/kpiEntry-integrity.js (update path).
const fkCount = (d) =>
  (d.objectiveId ? 1 : 0) + (d.activityId ? 1 : 0) + (d.indicatorId ? 1 : 0);

export const createSchema = z.object(baseShape)
  .strip()
  // DATA-001: reject orphan (0 FKs) and mixed combinations (>1 FK).
  .refine(
    d => fkCount(d) === 1,
    { message: 'يجب تحديد objectiveId أو activityId أو indicatorId — مصدر واحد بالضبط (DATA-001)', path: ['objectiveId'] },
  );

export const updateSchema = z.object({
  actualValue:     requiredNumField(0).optional(),
  spent:           numField(0),
  evidenceUrl:     optionalTrimmedString(500),
  note:            optionalTrimmedString(2000),
  deviationReason: optionalTrimmedString(4000),
  actionNote:      optionalTrimmedString(4000),
}).strip();

export const querySchema = z.object({
  objectiveId: idString.optional(),
  activityId:  idString.optional(),
  indicatorId: idString.optional(),
  year:        yearField.optional(),
  month:       monthField.optional(),
}).strip();
