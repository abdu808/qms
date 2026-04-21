/**
 * استيراد بيانات التخطيط الاستراتيجي: الأهداف، المؤشرات، الأنشطة، تحليل SWOT
 */
import { prisma }   from '../../db.js';
import { nextCode } from '../../utils/codeGen.js';

// ─── خرائط تحويل القيم ───────────────────────────────────────────────────────
const SWOT_TYPE_MAP = {
  'قوة':    'STRENGTH',
  'ضعف':    'WEAKNESS',
  'فرصة':   'OPPORTUNITY',
  'تهديد':  'THREAT',
};

// ─── تعريف كيانات هذا القسم ──────────────────────────────────────────────────
export const ENTITIES = {

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

// ─── دوال الاستيراد ───────────────────────────────────────────────────────────

export async function importStrategicGoals(records, _userId) {
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

export async function importObjectives(records, userId) {
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

export async function importOperationalActivities(records, _userId) {
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

export async function importKpiEntries(records, userId) {
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

export async function importSwot(records, _userId) {
  let created = 0, updated = 0;
  const errors = [];
  for (const { row, data } of records) {
    try {
      const code = data.code || await nextCode('swotItem', 'SWOT');
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
        created++;
      }
    } catch (e) {
      errors.push({ row, message: e.message });
    }
  }
  return { created, updated, errors };
}

export const IMPORTERS = {
  'strategic-goals':        importStrategicGoals,
  'objectives':             importObjectives,
  'operational-activities': importOperationalActivities,
  'kpi-entries':            importKpiEntries,
  'swot':                   importSwot,
};
