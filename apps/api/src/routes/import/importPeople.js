/**
 * استيراد بيانات الموظفين والكفاءات والتدريب
 */
import bcrypt        from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma }    from '../../db.js';
import { nextCode }  from '../../utils/codeGen.js';

/**
 * يولّد كلمة مرور مؤقتة عشوائية قوية (12 حرفاً URL-safe)
 * كل مستخدم مُستورَد يحصل على كلمة مختلفة — لا قيمة مُضمَّنة.
 * الكلمة تُعاد في نتيجة الاستيراد ليسلّمها المسؤول للموظف عبر قناة آمنة.
 */
function generateTempPassword() {
  return randomBytes(9).toString('base64url');
}

// ─── خرائط تحويل القيم ───────────────────────────────────────────────────────
export const ROLE_MAP = {
  'مسؤول النظام':    'SUPER_ADMIN',
  'مدير الجودة':     'QUALITY_MANAGER',
  'عضو لجنة الجودة': 'COMMITTEE_MEMBER',
  'مدير قسم':        'DEPT_MANAGER',
  'موظف':            'EMPLOYEE',
  'مدقق ضيف':        'GUEST_AUDITOR',
};

// ─── تعريف كيانات هذا القسم ──────────────────────────────────────────────────
export const ENTITIES = {

  users: {
    label: 'الموظفون',
    sheetName: 'الموظفون',
    columns: [
      { key: 'name',           label: 'الاسم الكامل',        required: true,  example: 'أحمد محمد علي',          width: 25 },
      { key: 'email',          label: 'البريد الإلكتروني',   required: true,  example: 'ahmed@birsabia.sa',       width: 30 },
      { key: 'password',       label: 'كلمة المرور',         required: false, example: '',                        width: 18, note: 'اتركها فارغة — سيُولّد النظام كلمة عشوائية مؤقتة لكل مستخدم ويُلزمه بتغييرها عند أول دخول' },
      { key: 'jobTitle',       label: 'المسمى الوظيفي',      required: false, example: 'أخصائي اجتماعي',         width: 22 },
      { key: 'departmentCode', label: 'كود القسم',           required: false, example: 'SOC',                     width: 14, note: 'QM / HR / FIN / ADM / SOC / KAF / EMP / RES / INV / COM / MKT / IT' },
      { key: 'role',           label: 'الدور في النظام',     required: true,  example: 'موظف',                   width: 22, note: 'مسؤول النظام / مدير الجودة / عضو لجنة الجودة / مدير قسم / موظف / مدقق ضيف' },
      { key: 'phone',          label: 'رقم الجوال',          required: false, example: '0512345678',              width: 16 },
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

};

// ─── دوال الاستيراد ───────────────────────────────────────────────────────────

export async function importUsers(records, _userId) {
  const depts  = await prisma.department.findMany({ select: { id: true, code: true } });
  const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]));

  let created = 0, updated = 0;
  const errors = [];
  // كلمات مرور مؤقتة للمستخدمين الجدد — يُعيدها لمن قام بالاستيراد
  // ليسلّمها لكل موظف عبر قناة آمنة (لا تُخزَّن بنص صريح في السيرفر).
  const tempCredentials = [];

  for (const { row, data } of records) {
    try {
      const role   = ROLE_MAP[data.role] || 'EMPLOYEE';
      const deptId = deptMap[data.departmentCode] || null;
      let tempPw = null;
      let hash;
      if (data.password) {
        hash = await bcrypt.hash(data.password, 10);
      } else {
        tempPw = generateTempPassword();
        hash   = await bcrypt.hash(tempPw, 10);
      }
      const existing = await prisma.user.findUnique({ where: { email: data.email } });

      if (existing) {
        await prisma.user.update({
          where: { email: data.email },
          data: { name: data.name, jobTitle: data.jobTitle || null, departmentId: deptId, role, phone: data.phone || null },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: { name: data.name, email: data.email, passwordHash: hash, jobTitle: data.jobTitle || null, departmentId: deptId, role, phone: data.phone || null, mustChangePassword: true },
        });
        created++;
        if (tempPw) tempCredentials.push({ email: data.email, name: data.name, tempPassword: tempPw });
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors, tempCredentials };
}

export async function importTraining(records, _userId) {
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

export async function importCompetence(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];

  for (const { row, data } of records) {
    try {
      const code = data.code || await nextCode('competenceRequirement', 'COMP');
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
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

export const IMPORTERS = {
  'users':      importUsers,
  'training':   importTraining,
  'competence': importCompetence,
};
