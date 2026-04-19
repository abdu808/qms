/**
 * schemas/donation.schema.js — تحقق Zod للتبرعات (ISO 8.2 / P-09).
 * itemName إلزامي فقط للنوع IN_KIND؛ amount للنوع CASH.
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, optionalDate } from './_helpers.js';

const TYPES    = ['CASH', 'IN_KIND', 'SERVICE'];
const STATUSES = ['RECEIVED', 'VERIFIED', 'DISTRIBUTED', 'REJECTED'];

const phone = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^[+0-9\s\-()]{6,20}$/, 'رقم هاتف غير صالح').nullable().optional(),
);

const email = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().email('بريد إلكتروني غير صالح').max(200).nullable().optional(),
);

const positiveNumber = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().positive('يجب أن يكون > 0').nullable().optional(),
);

const base = z.object({
  type:       z.enum(TYPES),
  donorName:  trimmedString(2, 200),
  donorPhone: phone,
  donorEmail: email,
  donorType:  optionalTrimmedString(50),
  itemName:   optionalTrimmedString(300),
  quantity:   positiveNumber,
  unit:       optionalTrimmedString(50),
  amount:     positiveNumber,
  currency:   optionalTrimmedString(10),
  receivedAt: optionalDate,
  receivedBy: optionalTrimmedString(200),
  status:     z.enum(STATUSES).default('RECEIVED'),
  notes:      optionalTrimmedString(5000),
}).strip();

// قواعد شرطية: IN_KIND يتطلّب itemName، CASH يتطلّب amount.
const refine = (schema) => schema.superRefine((val, ctx) => {
  if (val.type === 'IN_KIND' && !val.itemName) {
    ctx.addIssue({ path: ['itemName'], code: 'custom',
      message: 'اسم الصنف إلزامي للتبرع العيني' });
  }
  if (val.type === 'CASH' && (val.amount == null || val.amount <= 0)) {
    ctx.addIssue({ path: ['amount'], code: 'custom',
      message: 'المبلغ إلزامي للتبرع النقدي' });
  }
});

export const createSchema = refine(base);
export const updateSchema = refine(base.partial());
