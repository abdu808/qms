/**
 * استيراد بيانات العمليات: الموردون، البرامج، المستفيدون، المخاطر
 */
import { prisma }   from '../../db.js';
import { nextCode } from '../../utils/codeGen.js';

// ─── خرائط تحويل القيم ───────────────────────────────────────────────────────
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

const RISK_TYPE_MAP = {
  'مخاطرة': 'RISK',
  'فرصة':   'OPPORTUNITY',
};

// ─── تعريف كيانات هذا القسم ──────────────────────────────────────────────────
export const ENTITIES = {

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

};

// ─── دوال الاستيراد ───────────────────────────────────────────────────────────

export async function importSuppliers(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];

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
        // nextCode يستخدم DB sequence آمن من race conditions
        const code = data.code || await nextCode('supplier', 'SUP');
        await prisma.supplier.create({
          data: { code, name: data.name, type, crNumber: data.crNumber || null, vatNumber: data.vatNumber || null, contactPerson: data.contactPerson || null, phone: data.phone || null, email: data.email || null, city: data.city || null, notes: data.notes || null },
        });
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

export async function importPrograms(records, userId) {
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

export async function importBeneficiaries(records, _userId) {
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

export async function importRisks(records, userId) {
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

export const IMPORTERS = {
  'suppliers':     importSuppliers,
  'programs':      importPrograms,
  'beneficiaries': importBeneficiaries,
  'risks':         importRisks,
};
