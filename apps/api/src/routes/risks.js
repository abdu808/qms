import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { attachWorkflow } from '../lib/workflow.js';
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema as riskCreateSchema, updateSchema as riskUpdateSchema } from '../schemas/risk.schema.js';

function computeLevel(score) {
  if (score >= 20) return 'حرج';
  if (score >= 12) return 'مرتفع';
  if (score >= 6)  return 'متوسط';
  return 'منخفض';
}

// Audit task 7: المخاطر العالية/الحرجة لا تُحفَظ ولا تُعتمد بدون بيانات معالجة كاملة
// مقاييس الحرج بالعربي والإنجليزي معاً (level قد يكون 'مرتفع'/'حرج' أو 'HIGH'/'CRITICAL')
function isHighOrCritical(level) {
  if (!level) return false;
  const v = String(level).trim().toUpperCase();
  return v === 'HIGH' || v === 'CRITICAL' || level === 'مرتفع' || level === 'حرج';
}

function assertHighRiskFields(merged, action) {
  if (!isHighOrCritical(merged.level)) return;
  const labels = {
    ownerId:      'مالك المخاطرة',
    departmentId: 'الإدارة المسؤولة',
    treatment:    'خطة المعالجة',
    reviewDate:   'تاريخ المراجعة',
  };
  const missing = [];
  for (const f of ['ownerId', 'departmentId', 'treatment', 'reviewDate']) {
    const v = merged[f];
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      missing.push(labels[f]);
    }
  }
  if (missing.length) {
    throw BadRequest(`خطر بمستوى ${merged.level} لا يمكن ${action} بدون: ${missing.join('، ')}`);
  }
}

const crud = crudRouter({
  resource: 'risks',
  model: 'risk',
  codePrefix: 'RSK',
  searchFields: ['title', 'description'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'score', 'status'],
  allowedFilters: ['status', 'level', 'departmentId', 'ownerId', 'workflowState'],
  schemas: { create: riskCreateSchema, update: riskUpdateSchema },
  // Field-Level Security: الموظف ينشئ المخاطرة لكنه لا يعدّل الحقول الحاكمة لاحقاً
  lockedFieldsForRole: {
    EMPLOYEE: ['title','description','type','source','probability','impact','strategicGoalId'],
    DEPT_MANAGER: ['strategicGoalId'],
  },
  beforeCreate: async (data, req) => {
    const p = Math.min(5, Math.max(1, Number(data.probability) || 1));
    const i = Math.min(5, Math.max(1, Number(data.impact) || 1));
    const score = p * i;
    const level = computeLevel(score);
    const out = { ...data, probability: p, impact: i, score, level, createdById: req.user.sub };
    // Audit task 7: HIGH/CRITICAL تتطلب بيانات معالجة عند الإنشاء
    assertHighRiskFields(out, 'حفظ');
    return out;
  },
  beforeUpdate: async (data, req) => {
    // إعادة حساب الدرجة مع التحقق من الحدود (1-5)
    if (data.probability != null || data.impact != null) {
      const p = Math.min(5, Math.max(1, Number(data.probability) || 1));
      const i = Math.min(5, Math.max(1, Number(data.impact) || 1));
      data.probability = p;
      data.impact      = i;
      data.score       = p * i;
      data.level       = computeLevel(data.score);
    }
    // Audit task 7: قبل أي تعديل، إذا أصبح/كان HIGH/CRITICAL، تأكد من اكتمال البيانات
    const existing = await prisma.risk.findUnique({
      where: { id: req.params.id, deletedAt: null },
      select: {
        ownerId: true, departmentId: true, treatment: true, treatmentType: true,
        level: true, reviewDate: true,
      },
    });
    const merged = { ...existing, ...data };
    assertHighRiskFields(merged, 'تعديل');
    // ISO 6.1: لا إغلاق المخاطرة دون توثيق خطة المعالجة
    if (data.status === 'CLOSED') {
      const hasTreatment = data.treatment || existing?.treatment;
      if (!hasTreatment) {
        throw BadRequest('لا يمكن إغلاق المخاطرة دون توثيق خطة المعالجة (ISO 6.1)');
      }
    }
    return data;
  },
});

const router = Router();
attachWorkflow(router, { model: 'risk', resource: 'risks' });
router.use(crud);
export default router;
