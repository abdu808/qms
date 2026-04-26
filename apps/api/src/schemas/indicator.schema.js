/**
 * schemas/indicator.schema.js — تحقق Zod للمؤشرات المستقلة (Indicator).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString } from './_helpers.js';

const numOptional = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().nullable().optional(),
);

const DIRECTIONS      = ['HIGHER_BETTER', 'LOWER_BETTER'];
const FREQUENCIES     = ['MONTHLY', 'QUARTERLY', 'ANNUALLY'];
const KPI_TYPES       = ['CUMULATIVE', 'PERIODIC', 'SNAPSHOT', 'BINARY'];
const SEASONALITIES   = ['UNIFORM', 'SCHOOL_START', 'EID_SEASONAL', 'RAMADAN_RELIEF', 'QUARTERLY', 'MONTHLY_EVEN'];
const INDICATOR_TYPES = ['LEADING', 'LAGGING'];
const DATA_SOURCES    = ['SYSTEM', 'EXCEL', 'MANUAL'];

export const createSchema = z.object({
  nameAr:           trimmedString(2, 300),
  nameEn:           optionalTrimmedString(300),
  definition:       optionalTrimmedString(5000),
  formula:          optionalTrimmedString(2000),
  unit:             optionalTrimmedString(40),
  direction:        z.enum(DIRECTIONS).optional(),
  frequency:        z.enum(FREQUENCIES).optional(),
  kpiType:          z.enum(KPI_TYPES).optional(),
  seasonality:      z.enum(SEASONALITIES).optional(),
  indicatorType:    z.enum(INDICATOR_TYPES).optional(),
  dataSource:       z.enum(DATA_SOURCES).nullable().optional(),
  baseline:         numOptional,
  weight:           numOptional,
  greenThreshold:   numOptional,
  yellowThreshold:  numOptional,
  isoClause:        optionalTrimmedString(50),
  nationalStandard: optionalTrimmedString(200),
  notes:            optionalTrimmedString(2000),
  objectiveId:      idString.nullable().optional(),
  ownerId:          idString.nullable().optional(),
  dataEntryUserId:  idString.nullable().optional(),
  approverUserId:   idString.nullable().optional(),
}).strip();

export const updateSchema = createSchema.partial();
