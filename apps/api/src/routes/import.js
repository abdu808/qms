/**
 * routes/import.js — استيراد البيانات من Excel
 *
 * GET  /api/import/template/:entity   → تحميل نموذج Excel فارغ
 * POST /api/import/preview/:entity    → رفع ملف + معاينة (بدون حفظ)
 * POST /api/import/confirm/:entity    → رفع ملف + استيراد فعلي
 *
 * الكيانات المدعومة:
 *   users | suppliers | programs | beneficiaries | risks
 *   strategic-goals | objectives | operational-activities
 *   kpi-entries | training | competence | swot
 */

import { Router }    from 'express';
import multer        from 'multer';
import ExcelJS       from 'exceljs';
import bcrypt        from 'bcrypt';
import { prisma }    from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest }   from '../utils/errors.js';
import { nextCode }     from '../utils/codeGen.js';

const router = Router();

// ─── Multer: ذاكرة فقط، حد 10MB ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (
      file.mimetype.includes('spreadsheet') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('يجب أن يكون الملف بصيغة Excel (.xlsx)'));
    }
  },
});

// ─── صلاحية الاستيراد ────────────────────────────────────────────────────────
function requireImportRole(req, res, next) {
  if (!['SUPER_ADMIN', 'QUALITY_MANAGER'].includes(req.user?.role)) {
    return res.status(403).json({ ok: false, message: 'يتطلب صلاحية مدير الجودة أو أعلى' });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// تعريفات الكيانات — الأعمدة + الأمثلة + الملاحظات
// ═══════════════════════════════════════════════════════════════════════════════

const ROLE_MAP = {
  'مسؤول النظام':    'SUPER_ADMIN',
  'مدير الجودة':     'QUALITY_MANAGER',
  'عضو لجنة الجودة': 'COMMITTEE_MEMBER',
  'مدير قسم':        'DEPT_MANAGER',
  'موظف':            'EMPLOYEE',
  'مدقق ضيف':        'GUEST_AUDITOR',
};

const SUPPLIER_TYPE_MAP = {
  'بضائع':         'GOODS',
  'خدمات':         'SERVICES',
  'مقاولات':       'CONSTRUCTION',
  'تقنية معلومات': 'IT_SERVICES',
  'تبرعات عينية':  'IN_KIND_DONOR',
  'نقل':           'TRANSPORT',
  'استشارات':      'CONSULTING',
  'أخرى':          'OTHER',
};

const BENEFICIARY_CAT_MAP = {
  'يتيم':       'ORPHAN',
  'أرملة':      'WIDOW',
  'أسرة فقيرة': 'POOR_FAMILY',
  'ذو إعاقة':   'DISABLED',
  'مسن':         'ELDERLY',
  'طالب':        'STUDENT',
  'أخرى':        'OTHER',
};

const BENEFICIARY_STATUS_MAP = {
  'مقدم':     'APPLICANT',
  'نشط':      'ACTIVE',
  'غير نشط':  'INACTIVE',
  'متخرج':    'GRADUATED',
  'مرفوض':    'REJECTED',
};

const SWOT_TYPE_MAP = {
  'قوة':    'STRENGTH',
  'ضعف':    'WEAKNESS',
  'فرصة':   'OPPORTUNITY',
  'تهديد':  'THREAT',
};

const RISK_TYPE_MAP = {
  'مخاطرة': 'RISK',
  'فرصة':   'OPPORTUNITY',
};

// ─── تعريف كل كيان ───────────────────────────────────────────────────────────
const ENTITIES = {

  users: {
    label: 'الموظفون',
    sheetName: 'الموظفون',
    columns: [
      { key: 'name',           label: 'الاسم الكامل',        required: true,  example: 'أحمد محمد علي',          width: 25 },
      { key: 'email',          label: 'البريد الإلكتروني',   required: true,  example: 'ahmed@birsabia.sa',       width: 30 },
      { key: 'password',       label: 'كلمة المرور',         required: false, example: 'Changeme@123',            width: 18, note: 'تُترك فارغة → القيمة الافتراضية: Changeme@123' },
      { key: 'jobTitle',       label: 'المسمى الوظيفي',      required: false, example: 'أخصائي اجتماعي',         width: 22 },
      { key: 'departmentCode', label: 'كود القسم',           required: false, example: 'SOC',                     width: 14, note: 'QM / HR / FIN / ADM / SOC / KAF / EMP / RES / INV / COM / MKT / IT' },
      { key: 'role',           label: 'الدور في النظام',     required: true,  example: 'موظف',                   width: 22, note: 'مسؤول النظام / مدير الجودة / عضو لجنة الجودة / مدير قسم / موظف / مدقق ضيف' },
      { key: 'phone',          label: 'رقم الجوال',          required: false, example: '0512345678',              width: 16 },
    ],
  },

  suppliers: {
    label: 'الموردون',
    sheetName: 'الموردون',
    columns: [
      { key: 'name',          label: 'اسم المورد',         required: true,  example: 'شركة الخليج للمستلزمات',  width: 30 },
      { key: 'type',          label: 'النوع',              required: true,  example: 'خدمات',                   width: 16, note: 'بضائع / خدمات / مقاولات / تقنية معلومات / تبرعات عينية / نقل / استشارات / أخرى' },
      { key: 'crNumber',      label: 'رقم السجل التجاري', required: false, example: '4030123456',               width: 20 },
      { key: 'vatNumber',     label: 'رقم الضريبة',        required: false, example: '300123456700003',          width: 20 },
      { key: 'contactPerson', label: 'جهة التواصل',        required: false, example: 'محمد السالم',              width: 20 },
      { key: 'phone',         label: 'الهاتف',             required: false, example: '0501234567',               width: 16 },
      { key: 'email',         label: 'البريد',             required: false, example: 'info@company.sa',          width: 25 },
      { key: 'city',          label: 'المدينة',            required: false, example: 'جازان',                   width: 14 },
      { key: 'notes',         label: 'ملاحظات',            required: false, example: '',                        width: 30 },
    ],
  },

  programs: {
    label: 'البرامج',
    sheetName: 'البرامج',
    columns: [
      { key: 'code',               label: 'الكود',                    required: false, example: 'PRG-2026-001', width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'name',               label: 'اسم البرنامج',              required: true,  example: 'كفالة الأيتام', width: 25 },
      { key: 'description',        label: 'الوصف',                    required: false, example: '',             width: 35 },
      { key: 'category',           label: 'الفئة',                    required: false, example: 'كفالة',        width: 14, note: 'كفالة / كسوة / إفطار / زكاة / مساعدات / تعليم / صحة' },
      { key: 'budget',             label: 'الميزانية (ريال)',           required: false, example: '500000',       width: 18 },
      { key: 'startDate',          label: 'تاريخ البداية',             required: true,  example: '2026-01-01',   width: 18 },
      { key: 'endDate',            label: 'تاريخ النهاية',             required: false, example: '2026-12-31',   width: 18 },
      { key: 'beneficiariesCount', label: 'عدد المستفيدين الحاليين',   required: false, example: '150',          width: 24 },
    ],
  },

  beneficiaries: {
    label: 'المستفيدون',
    sheetName: 'المستفيدون',
    columns: [
      { key: 'code',          label: 'الكود',                  required: false, example: 'BEN-2026-0001', width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'fullName',      label: 'الاسم الكامل',            required: true,  example: 'فاطمة أحمد علي', width: 25 },
      { key: 'nationalId',    label: 'رقم الهوية',              required: false, example: '1234567890',    width: 18 },
      { key: 'category',      label: 'الفئة',                  required: true,  example: 'أسرة فقيرة',     width: 16, note: 'يتيم / أرملة / أسرة فقيرة / ذو إعاقة / مسن / طالب / أخرى' },
      { key: 'gender',        label: 'الجنس',                  required: false, example: 'أنثى',           width: 12, note: 'ذكر / أنثى' },
      { key: 'phone',         label: 'الهاتف',                 required: false, example: '0512345678',     width: 16 },
      { key: 'city',          label: 'المدينة',                required: false, example: 'صبيا',           width: 14 },
      { key: 'district',      label: 'الحي',                   required: false, example: 'حي النزهة',      width: 18 },
      { key: 'familySize',    label: 'حجم الأسرة',              required: false, example: '5',             width: 14 },
      { key: 'monthlyIncome', label: 'الدخل الشهري (ريال)',     required: false, example: '2000',          width: 20 },
      { key: 'status',        label: 'الحالة',                 required: false, example: 'نشط',            width: 14, note: 'مقدم / نشط / غير نشط / متخرج / مرفوض' },
    ],
  },

  risks: {
    label: 'المخاطر',
    sheetName: 'المخاطر',
    columns: [
      { key: 'code',           label: 'الكود',              required: false, example: 'RSK-2026-001',        width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'type',           label: 'النوع',              required: false, example: 'مخاطرة',              width: 12, note: 'مخاطرة / فرصة' },
      { key: 'title',          label: 'عنوان المخاطرة',     required: true,  example: 'انقطاع التمويل',      width: 28 },
      { key: 'description',    label: 'الوصف',              required: false, example: '',                    width: 35 },
      { key: 'source',         label: 'المصدر',             required: false, example: 'خارجي — اقتصادي',    width: 22 },
      { key: 'departmentCode', label: 'القسم (كود)',        required: false, example: 'FIN',                 width: 14 },
      { key: 'probability',    label: 'الاحتمالية (1-5)',   required: true,  example: '3',                  width: 18 },
      { key: 'impact',         label: 'الأثر (1-5)',        required: true,  example: '4',                  width: 14 },
      { key: 'treatmentType',  label: 'نوع المعالجة',       required: false, example: 'تخفيف',              width: 16, note: 'تجنب / تخفيف / نقل / قبول' },
      { key: 'treatment',      label: 'خطة المعالجة',       required: false, example: 'تنويع مصادر التمويل', width: 35 },
    ],
  },

  'strategic-goals': {
    label: 'الأهداف الاستراتيجية',
    sheetName: 'الاستراتيجية',
    columns: [
      { key: 'code',        label: 'الكود',              required: false, example: 'STR-2026-005',          width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'title',       label: 'عنوان الهدف',         required: true,  example: 'تعزيز الشراكات',       width: 35 },
      { key: 'perspective', label: 'المحور',              required: true,  example: 'مستفيدون',              width: 18, note: 'مستفيدون / مالي / داخلي / تعلم ونمو' },
      { key: 'kpi',         label: 'مؤشر القياس',        required: false, example: 'عدد الشراكات الفاعلة',  width: 25 },
      { key: 'baseline',    label: 'الوضع الراهن',        required: false, example: '5 شراكات',             width: 18 },
      { key: 'target',      label: 'المستهدف',            required: false, example: '12 شراكة',             width: 18 },
      { key: 'initiatives', label: 'المبادرات',           required: false, example: '',                     width: 35 },
      { key: 'responsible', label: 'المسؤول',             required: false, example: 'إدارة التواصل',        width: 22 },
      { key: 'startYear',   label: 'سنة البداية',          required: false, example: '2026',                 width: 14 },
      { key: 'endYear',     label: 'سنة النهاية',          required: false, example: '2028',                 width: 14 },
      { key: 'notes',       label: 'ملاحظات',             required: false, example: '',                     width: 25 },
    ],
  },

  objectives: {
    label: 'المؤشرات التشغيلية',
    sheetName: 'المؤشرات',
    columns: [
      { key: 'code',           label: 'الكود',                  required: false, example: 'OBJ-2026-013',     width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'title',          label: 'عنوان المؤشر',            required: true,  example: 'رفع مستوى الخدمة', width: 30 },
      { key: 'description',    label: 'الوصف',                  required: false, example: '',                 width: 35 },
      { key: 'departmentCode', label: 'القسم (كود)',             required: false, example: 'SOC',              width: 14 },
      { key: 'kpi',            label: 'وصف المؤشر',              required: true,  example: 'نسبة رضا المستفيدين', width: 28 },
      { key: 'baseline',       label: 'الخط الأساسي',            required: false, example: '70',               width: 16 },
      { key: 'target',         label: 'المستهدف',                required: true,  example: '85',               width: 14 },
      { key: 'unit',           label: 'الوحدة',                  required: false, example: '%',                width: 12 },
      { key: 'startDate',      label: 'تاريخ البداية',            required: true,  example: '2026-01-01',       width: 18 },
      { key: 'dueDate',        label: 'تاريخ الانتهاء',           required: true,  example: '2026-12-31',       width: 18 },
      { key: 'kpiType',        label: 'نوع المؤشر',              required: false, example: 'SNAPSHOT',          width: 16, note: 'CUMULATIVE / PERIODIC / SNAPSHOT / BINARY' },
      { key: 'strategicCode',  label: 'كود الهدف الاستراتيجي',   required: false, example: 'STR-2026-001',      width: 24 },
    ],
  },

  'operational-activities': {
    label: 'الأنشطة التشغيلية',
    sheetName: 'الأنشطة',
    columns: [
      { key: 'code',          label: 'الكود',                  required: false, example: 'ACT-2026-015',       width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'title',         label: 'عنوان النشاط',            required: true,  example: 'إطلاق برنامج كسوة', width: 30 },
      { key: 'description',   label: 'الوصف',                  required: false, example: '',                   width: 35 },
      { key: 'perspective',   label: 'المحور',                  required: false, example: 'مستفيدون',           width: 18 },
      { key: 'department',    label: 'الإدارة المنفذة',          required: false, example: 'إدارة الكفالة',      width: 22 },
      { key: 'responsible',   label: 'المسؤول',                 required: false, example: 'مدير الكفالة',       width: 20 },
      { key: 'budget',        label: 'الميزانية (ريال)',          required: false, example: '200000',             width: 18 },
      { key: 'startDate',     label: 'تاريخ البداية',            required: false, example: '2026-03-01',         width: 18 },
      { key: 'endDate',       label: 'تاريخ الانتهاء',           required: false, example: '2026-12-31',         width: 18 },
      { key: 'targetValue',   label: 'القيمة المستهدفة',          required: false, example: '500',                width: 18 },
      { key: 'targetUnit',    label: 'وحدة المستهدف',             required: false, example: 'أسرة',               width: 16 },
      { key: 'strategicCode', label: 'كود الهدف الاستراتيجي',   required: false, example: 'STR-2026-001',        width: 24 },
    ],
  },

  'kpi-entries': {
    label: 'إدخالات المؤشرات الشهرية',
    sheetName: 'إدخالات KPI',
    columns: [
      { key: 'entityCode',  label: 'كود الهدف أو النشاط', required: true,  example: 'OBJ-2026-001', width: 24 },
      { key: 'entityType',  label: 'النوع',                required: true,  example: 'هدف',           width: 12, note: 'هدف / نشاط' },
      { key: 'year',        label: 'السنة',                required: true,  example: '2026',          width: 12 },
      { key: 'month',       label: 'الشهر (1-12)',          required: true,  example: '4',             width: 14 },
      { key: 'actualValue', label: 'القيمة الفعلية',        required: true,  example: '720',           width: 18 },
      { key: 'spent',       label: 'المصروف (ريال)',        required: false, example: '576000',        width: 18, note: 'للأنشطة فقط' },
      { key: 'note',        label: 'ملاحظة',               required: false, example: '',              width: 30 },
    ],
  },

  training: {
    label: 'برامج التدريب',
    sheetName: 'التدريب',
    columns: [
      { key: 'code',             label: 'الكود',              required: false, example: 'TRN-2026-001',          width: 18, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'title',            label: 'عنوان التدريب',       required: true,  example: 'تدريب ISO 9001:2015',   width: 30 },
      { key: 'description',      label: 'الوصف',              required: false, example: '',                      width: 35 },
      { key: 'trainer',          label: 'المدرب / الجهة',     required: false, example: 'معهد الجودة السعودي',   width: 25 },
      { key: 'date',             label: 'التاريخ',             required: true,  example: '2026-05-15',            width: 16 },
      { key: 'duration',         label: 'المدة (ساعات)',       required: false, example: '16',                   width: 16 },
      { key: 'location',         label: 'الموقع',             required: false, example: 'قاعة الاجتماعات',       width: 20 },
      { key: 'category',         label: 'الفئة',              required: false, example: 'جودة',                  width: 16 },
      { key: 'competenceTarget', label: 'الكفاءة المستهدفة',  required: false, example: 'مهارات التدقيق الداخلي', width: 28 },
    ],
  },

  competence: {
    label: 'التوصيف الوظيفي',
    sheetName: 'التوصيف الوظيفي',
    columns: [
      { key: 'code',             label: 'الكود',                   required: false, example: 'COMP-001',                    width: 16, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'jobTitle',         label: 'المسمى الوظيفي',          required: true,  example: 'أخصائي اجتماعي',             width: 25 },
      { key: 'department',       label: 'القسم',                   required: false, example: 'إدارة المستفيدين',            width: 22 },
      { key: 'requiredSkills',   label: 'المهارات المطلوبة',        required: false, example: 'التواصل، تقييم الاحتياجات',  width: 30 },
      { key: 'minEducation',     label: 'الحد الأدنى للتعليم',     required: false, example: 'بكالوريوس خدمة اجتماعية',    width: 28 },
      { key: 'minExperience',    label: 'سنوات الخبرة',            required: false, example: '2',                           width: 16 },
      { key: 'certifications',   label: 'الشهادات المطلوبة',       required: false, example: 'أخصائي اجتماعي معتمد',        width: 30 },
      { key: 'trainings',        label: 'التدريبات المطلوبة',       required: false, example: 'إدارة الحالة، الحماية',      width: 30 },
      { key: 'evaluationMethod', label: 'طريقة التقييم',            required: false, example: 'مقابلة + اختبار عملي',        width: 25 },
    ],
  },

  swot: {
    label: 'تحليل SWOT',
    sheetName: 'SWOT',
    columns: [
      { key: 'code',        label: 'الكود',         required: false, example: 'SWOT-001',                          width: 16, note: 'يُولَّد تلقائياً إن تُرك فارغاً' },
      { key: 'type',        label: 'النوع',          required: true,  example: 'قوة',                               width: 12, note: 'قوة / ضعف / فرصة / تهديد' },
      { key: 'category',    label: 'الفئة',          required: false, example: 'داخلي — تنظيمي',                   width: 22 },
      { key: 'description', label: 'الوصف',          required: true,  example: 'شبكة علاقات واسعة مع المتبرعين',  width: 40 },
      { key: 'impact',      label: 'مستوى الأثر',   required: false, example: 'مرتفع',                            width: 14, note: 'منخفض / متوسط / مرتفع' },
      { key: 'strategy',    label: 'الاستراتيجية',   required: false, example: 'الاستفادة من الشبكة لجذب تمويل',  width: 40 },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// بناء نموذج Excel
// ═══════════════════════════════════════════════════════════════════════════════
async function buildTemplate(entityKey) {
  const def = ENTITIES[entityKey];
  if (!def) throw BadRequest(`نوع البيانات غير مدعوم: ${entityKey}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QMS - جمعية البر بصبيا';
  wb.created = new Date();

  const ws = wb.addWorksheet(def.sheetName, {
    views: [{ rightToLeft: true }],
  });

  // ── الصف 1: رؤوس الأعمدة (أزرق) ──
  const headerRow = ws.addRow(def.columns.map(c => c.label + (c.required ? ' *' : '')));
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
  });
  headerRow.height = 30;

  // ── الصف 2: ملاحظات (أصفر) ──
  const notesRow = ws.addRow(def.columns.map(c => c.note || ''));
  notesRow.eachCell(cell => {
    cell.font      = { italic: true, size: 8, color: { argb: 'FF92400E' }, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.alignment = { horizontal: 'right', wrapText: true, readingOrder: 'rtl' };
  });
  notesRow.height = 20;

  // ── الصف 3: مثال توضيحي (أخضر) ──
  const exampleRow = ws.addRow(def.columns.map(c => c.example ?? ''));
  exampleRow.eachCell(cell => {
    cell.font      = { color: { argb: 'FF065F46' }, size: 10, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    cell.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  });

  // ── عرض الأعمدة ──
  def.columns.forEach((col, i) => {
    const c = ws.getColumn(i + 1);
    c.width = col.width || 20;
    c.alignment = { readingOrder: 'rtl' };
  });

  // ── تجميد الصفوف الثلاثة الأولى ──
  ws.views = [{ state: 'frozen', ySplit: 3, rightToLeft: true }];

  // ── ورقة التعليمات ──
  const wsInfo = wb.addWorksheet('تعليمات', { views: [{ rightToLeft: true }] });
  const infoLines = [
    ['تعليمات استيراد البيانات — QMS جمعية البر بصبيا'],
    [''],
    ['■ الصف الأزرق:   رؤوس الأعمدة — لا تعدّل'],
    ['■ الصف الأصفر:   ملاحظات وقيم مسموحة — لا تعدّل'],
    ['■ الصف الأخضر:  مثال توضيحي — يمكن حذفه أو تعديله'],
    [''],
    ['■ الحقول المحددة بـ * إلزامية'],
    ['■ ابدأ إدخال بياناتك من الصف الرابع'],
    ['■ احفظ الملف بصيغة .xlsx قبل الرفع'],
    [''],
    [`■ الكيان: ${def.label}`],
    [`■ عدد الأعمدة: ${def.columns.length}`],
  ];
  infoLines.forEach((line, i) => {
    const r = wsInfo.addRow(line);
    if (i === 0) r.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
    else         r.font = { size: 11 };
  });
  wsInfo.getColumn(1).width = 65;

  return wb;
}

// ═══════════════════════════════════════════════════════════════════════════════
// تحليل ملف Excel المرفوع
// ═══════════════════════════════════════════════════════════════════════════════
async function parseFile(entityKey, buffer) {
  const def = ENTITIES[entityKey];
  const wb  = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw BadRequest('الملف لا يحتوي على بيانات');

  const records = [];
  const errors  = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 3) return; // تخطّ رؤوس + ملاحظات + مثال

    // استخرج القيم وتجاهل index 0 (ExcelJS يبدأ من 1)
    const vals = [];
    for (let i = 1; i <= def.columns.length; i++) {
      const cell = row.getCell(i);
      vals.push(cell.value != null ? String(cell.value).trim() : '');
    }

    if (vals.every(v => v === '')) return; // صف فارغ — تخطّ

    const obj = {};
    def.columns.forEach((col, i) => { obj[col.key] = vals[i] || ''; });

    const missing = def.columns.filter(c => c.required && !obj[c.key]).map(c => c.label);
    if (missing.length) {
      errors.push({ row: rowNum, message: `حقول إلزامية مفقودة: ${missing.join(', ')}` });
      return;
    }

    records.push({ row: rowNum, data: obj });
  });

  return { records, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// منطق الاستيراد — كيان بكيان
// ═══════════════════════════════════════════════════════════════════════════════

async function importUsers(records, _userId) {
  const depts  = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]));
  const DEFAULT_HASH = await bcrypt.hash('Changeme@123', 10);

  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const role   = ROLE_MAP[data.role] || 'EMPLOYEE';
      const deptId = deptMap[data.departmentCode] || null;
      const hash   = data.password ? await bcrypt.hash(data.password, 10) : DEFAULT_HASH;
      const existing = await prisma.user.findUnique({ where: { email: data.email } });

      if (existing) {
        await prisma.user.update({
          where: { email: data.email },
          data: { name: data.name, jobTitle: data.jobTitle || null, departmentId: deptId, role, phone: data.phone || null },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: { name: data.name, email: data.email, passwordHash: hash, jobTitle: data.jobTitle || null, departmentId: deptId, role, phone: data.phone || null },
        });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importSuppliers(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];
  let counter = await prisma.supplier.count() + 1;

  for (const { row, data } of records) {
    try {
      const type = SUPPLIER_TYPE_MAP[data.type] || 'OTHER';
      const existing = await prisma.supplier.findFirst({ where: { name: data.name, deletedAt: null } });

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: { type, crNumber: data.crNumber || null, vatNumber: data.vatNumber || null, contactPerson: data.contactPerson || null, phone: data.phone || null, email: data.email || null, city: data.city || null, notes: data.notes || null },
        });
        updated++;
      } else {
        const code = `SUP-${String(counter).padStart(3, '0')}`;
        await prisma.supplier.create({
          data: { code, name: data.name, type, crNumber: data.crNumber || null, vatNumber: data.vatNumber || null, contactPerson: data.contactPerson || null, phone: data.phone || null, email: data.email || null, city: data.city || null, notes: data.notes || null },
        });
        counter++;
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importPrograms(records, userId) {
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code = data.code || await nextCode('program', 'PRG');
      const payload = {
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        beneficiariesCount: data.beneficiariesCount ? parseInt(data.beneficiariesCount) : 0,
      };
      const existing = await prisma.program.findUnique({ where: { code } });
      if (existing) {
        await prisma.program.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.program.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importBeneficiaries(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code     = data.code || await nextCode('beneficiary', 'BEN');
      const category = BENEFICIARY_CAT_MAP[data.category] || 'OTHER';
      const status   = BENEFICIARY_STATUS_MAP[data.status] || 'APPLICANT';
      const payload  = {
        fullName:      data.fullName,
        nationalId:    data.nationalId || null,
        category,
        gender:        data.gender || null,
        phone:         data.phone || null,
        city:          data.city || null,
        district:      data.district || null,
        familySize:    data.familySize  ? parseInt(data.familySize)  : null,
        monthlyIncome: data.monthlyIncome ? parseFloat(data.monthlyIncome) : null,
        status,
      };
      const existing = data.code ? await prisma.beneficiary.findUnique({ where: { code } }) : null;
      if (existing) {
        await prisma.beneficiary.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.beneficiary.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importRisks(records, userId) {
  const depts   = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]));
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code        = data.code || await nextCode('risk', 'RSK');
      const probability = parseInt(data.probability) || 1;
      const impact      = parseInt(data.impact)      || 1;
      const score       = probability * impact;
      const level       = score >= 20 ? 'حرج' : score >= 13 ? 'مرتفع' : score >= 7 ? 'متوسط' : 'منخفض';
      const type        = RISK_TYPE_MAP[data.type] || 'RISK';
      const deptId      = deptMap[data.departmentCode] || null;

      const payload = {
        type, title: data.title, description: data.description || null, source: data.source || null,
        departmentId: deptId, probability, impact, score, level,
        treatmentType: data.treatmentType || null, treatment: data.treatment || null,
        createdById: userId,
      };
      const existing = data.code ? await prisma.risk.findUnique({ where: { code } }) : null;
      if (existing) {
        const { createdById, ...updatePayload } = payload;
        await prisma.risk.update({ where: { code }, data: updatePayload });
        updated++;
      } else {
        await prisma.risk.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importStrategicGoals(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code    = data.code || await nextCode('strategicGoal', 'STR');
      const payload = {
        title: data.title, perspective: data.perspective,
        kpi: data.kpi || null, baseline: data.baseline || null, target: data.target || null,
        initiatives: data.initiatives || null, responsible: data.responsible || null,
        startYear: data.startYear ? parseInt(data.startYear) : null,
        endYear:   data.endYear   ? parseInt(data.endYear)   : null,
        notes: data.notes || null,
      };
      const existing = data.code ? await prisma.strategicGoal.findUnique({ where: { code } }) : null;
      if (existing) {
        await prisma.strategicGoal.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.strategicGoal.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importObjectives(records, userId) {
  const depts   = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]));
  const goals   = await prisma.strategicGoal.findMany({ select: { id: true, code: true } });
  const goalMap = Object.fromEntries(goals.map(g => [g.code, g.id]));
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code    = data.code || await nextCode('objective', 'OBJ');
      const payload = {
        title: data.title, description: data.description || null,
        departmentId:   deptMap[data.departmentCode] || null,
        strategicGoalId: goalMap[data.strategicCode] || null,
        kpi: data.kpi, baseline: data.baseline ? parseFloat(data.baseline) : null,
        target: parseFloat(data.target),
        unit: data.unit || null,
        startDate: new Date(data.startDate), dueDate: new Date(data.dueDate),
        kpiType: data.kpiType || 'SNAPSHOT',
        createdById: userId,
      };
      const existing = data.code ? await prisma.objective.findUnique({ where: { code } }) : null;
      if (existing) {
        const { createdById, ...up } = payload;
        await prisma.objective.update({ where: { code }, data: up });
        updated++;
      } else {
        await prisma.objective.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importOperationalActivities(records, _userId) {
  const goals   = await prisma.strategicGoal.findMany({ select: { id: true, code: true } });
  const goalMap = Object.fromEntries(goals.map(g => [g.code, g.id]));
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code    = data.code || await nextCode('operationalActivity', 'ACT');
      const payload = {
        title: data.title, description: data.description || null,
        perspective: data.perspective || null, department: data.department || null,
        responsible: data.responsible || null,
        budget:      data.budget      ? parseFloat(data.budget)      : null,
        targetValue: data.targetValue ? parseFloat(data.targetValue) : null,
        targetUnit:  data.targetUnit  || null,
        startDate:   data.startDate   ? new Date(data.startDate)     : null,
        endDate:     data.endDate     ? new Date(data.endDate)       : null,
        strategicGoalId: goalMap[data.strategicCode] || null,
        year: new Date().getFullYear(),
      };
      const existing = data.code ? await prisma.operationalActivity.findUnique({ where: { code } }) : null;
      if (existing) {
        await prisma.operationalActivity.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.operationalActivity.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importKpiEntries(records, userId) {
  const objectives  = await prisma.objective.findMany({ select: { id: true, code: true } });
  const activities  = await prisma.operationalActivity.findMany({ select: { id: true, code: true } });
  const objMap = Object.fromEntries(objectives.map(o => [o.code, o.id]));
  const actMap = Object.fromEntries(activities.map(a => [a.code, a.id]));
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const year  = parseInt(data.year);
      const month = parseInt(data.month);
      const isObj = data.entityType === 'هدف';
      const objId = isObj ? (objMap[data.entityCode] || null) : null;
      const actId = isObj ? null : (actMap[data.entityCode] || null);

      if (!objId && !actId) throw new Error(`كود غير موجود: ${data.entityCode}`);

      const payload = {
        year, month,
        actualValue: parseFloat(data.actualValue),
        spent:       data.spent ? parseFloat(data.spent) : null,
        note:        data.note  || null,
        enteredById: userId,
      };
      const where = isObj ? { objectiveId: objId, year, month } : { activityId: actId, year, month };

      const existing = await prisma.kpiEntry.findFirst({ where });
      if (existing) {
        await prisma.kpiEntry.update({ where: { id: existing.id }, data: { actualValue: payload.actualValue, spent: payload.spent, note: payload.note } });
        updated++;
      } else {
        await prisma.kpiEntry.create({ data: { objectiveId: objId, activityId: actId, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importTraining(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code    = data.code || await nextCode('training', 'TRN');
      const payload = {
        title: data.title, description: data.description || null,
        trainer: data.trainer || null, date: new Date(data.date),
        duration: data.duration ? parseFloat(data.duration) : null,
        location: data.location || null, category: data.category || null,
        competenceTarget: data.competenceTarget || null,
      };
      const existing = data.code ? await prisma.training.findUnique({ where: { code } }) : null;
      if (existing) {
        await prisma.training.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.training.create({ data: { code, ...payload } });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importCompetence(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];
  let counter = await prisma.competenceRequirement.count() + 1;

  for (const { row, data } of records) {
    try {
      const code = data.code || `COMP-${String(counter).padStart(3, '0')}`;
      const payload = {
        jobTitle: data.jobTitle, department: data.department || null,
        requiredSkills: data.requiredSkills || null, minEducation: data.minEducation || null,
        minExperience: data.minExperience ? parseInt(data.minExperience) : null,
        certifications: data.certifications || null, trainings: data.trainings || null,
        evaluationMethod: data.evaluationMethod || null,
      };
      const existing = await prisma.competenceRequirement.findUnique({ where: { code } });
      if (existing) {
        await prisma.competenceRequirement.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.competenceRequirement.create({ data: { code, ...payload } });
        counter++;
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

async function importSwot(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];
  let counter = await prisma.swotItem.count() + 1;

  for (const { row, data } of records) {
    try {
      const code = data.code || `SWOT-${String(counter).padStart(3, '0')}`;
      const type = SWOT_TYPE_MAP[data.type] || data.type;
      const payload = {
        type, category: data.category || null, description: data.description,
        impact: data.impact || null, strategy: data.strategy || null,
      };
      const existing = await prisma.swotItem.findUnique({ where: { code } });
      if (existing) {
        await prisma.swotItem.update({ where: { code }, data: payload });
        updated++;
      } else {
        await prisma.swotItem.create({ data: { code, ...payload } });
        counter++;
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

// ─── موجّه الاستيراد ─────────────────────────────────────────────────────────
const IMPORTERS = {
  'users':                   importUsers,
  'suppliers':               importSuppliers,
  'programs':                importPrograms,
  'beneficiaries':           importBeneficiaries,
  'risks':                   importRisks,
  'strategic-goals':         importStrategicGoals,
  'objectives':              importObjectives,
  'operational-activities':  importOperationalActivities,
  'kpi-entries':             importKpiEntries,
  'training':                importTraining,
  'competence':              importCompetence,
  'swot':                    importSwot,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════════

// قائمة الكيانات المدعومة
router.get('/entities', requireImportRole, asyncHandler(async (req, res) => {
  const list = Object.entries(ENTITIES).map(([key, def]) => ({
    key,
    label: def.label,
    sheetName: def.sheetName,
    columns: def.columns.length,
    requiredColumns: def.columns.filter(c => c.required).length,
  }));
  res.json({ ok: true, entities: list });
}));

// تحميل نموذج Excel
router.get('/template/:entity', requireImportRole, asyncHandler(async (req, res) => {
  const entity = req.params.entity;
  if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

  const wb = await buildTemplate(entity);
  const buf = await wb.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="template-${entity}.xlsx"`);
  res.send(buf);
}));

// معاينة — تحليل الملف بدون حفظ
router.post('/preview/:entity', requireImportRole, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw BadRequest('يرجى رفع ملف Excel');
  const entity = req.params.entity;
  if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

  const { records, errors } = await parseFile(entity, req.file.buffer);

  res.json({
    ok: true,
    entity,
    label: ENTITIES[entity].label,
    total:    records.length + errors.length,
    valid:    records.length,
    errorCount: errors.length,
    errors,
    preview: records.slice(0, 20).map(r => ({ row: r.row, data: r.data })),
    hasMore: records.length > 20,
  });
}));

// استيراد فعلي
router.post('/confirm/:entity', requireImportRole, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw BadRequest('يرجى رفع ملف Excel');
  const entity = req.params.entity;
  if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

  const importer = IMPORTERS[entity];
  if (!importer) throw BadRequest(`مستورد غير متاح لـ: ${entity}`);

  const { records, errors: parseErrors } = await parseFile(entity, req.file.buffer);

  if (parseErrors.length > 0 && records.length === 0) {
    return res.status(422).json({ ok: false, message: 'الملف يحتوي على أخطاء — لم يُستورد شيء', errors: parseErrors });
  }

  const result = await importer(records, req.user.id);

  res.json({
    ok: true,
    entity,
    label: ENTITIES[entity].label,
    created:    result.created,
    updated:    result.updated,
    parseErrors,
    importErrors: result.errors,
    total: result.created + result.updated,
  });
}));

export default router;
