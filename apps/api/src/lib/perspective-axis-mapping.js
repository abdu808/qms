/**
 * perspective-axis-mapping.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA-002: Mapping من قيمة StrategicGoal.perspective النصية إلى Axis.code
 *
 * يُستخدم من:
 *   - scripts/migrate-perspective-to-axis.mjs (ترحيل البيانات)
 *   - tests/axisMigration.test.js (اختبارات الـ mapping)
 */

/**
 * قاموس: قيمة perspective → Axis.code
 * يقبل القيم الإنجليزية (المخزّنة في DB حالياً) والعربية (من import/seed قديم)
 */
export const PERSPECTIVE_TO_AXIS_CODE = {
  // English enum values (stored in current DB)
  'FINANCIAL':  'FINANCIAL',
  'CUSTOMER':   'CUSTOMER',
  'PROCESS':    'PROCESS',
  'LEARNING':   'LEARNING',
  'GOVERNANCE': 'GOVERNANCE',

  // Arabic aliases (from legacy import/seed data)
  'مالي':                    'FINANCIAL',
  'مالي واستدامي':           'FINANCIAL',
  'المالي':                  'FINANCIAL',
  'المالي واستدامي':         'FINANCIAL',
  'مستفيدون':                'CUSTOMER',
  'المستفيدون':              'CUSTOMER',
  'المستفيدون والمجتمع':     'CUSTOMER',
  'عمليات':                  'PROCESS',
  'عمليات داخلية':           'PROCESS',
  'العمليات الداخلية':       'PROCESS',
  'تعلم':                    'LEARNING',
  'تعلم ونمو':               'LEARNING',
  'التعلم والنمو':           'LEARNING',
  'حوكمة':                   'GOVERNANCE',
  'حوكمة وامتثال':           'GOVERNANCE',
  'الحوكمة والامتثال':       'GOVERNANCE',
};
