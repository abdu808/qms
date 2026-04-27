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

const HIGH_LEVELS = ['مرتفع', 'حرج'];

/**
 * guardHighCritical — ISO 6.1.1: المخاطرة العالية/الحرجة تتطلب حقولاً إضافية.
 * Pure function مُصدَّرة لتسهيل الاختبار.
 *
 * @param {{ level, ownerId, departmentId, treatment, reviewDate }} fields
 */
export function guardHighCritical({ level, ownerId, departmentId, treatment, reviewDate }) {
  if (!HIGH_LEVELS.includes(level)) return; // منخفض/متوسط — لا قيود إضافية
  const missing = [];
  if (!ownerId)                                          missing.push('المسؤول (ownerId)');
  if (!departmentId)                                     missing.push('القسم (departmentId)');
  if (!treatment || String(treatment).trim() === '')     missing.push('خطة المعالجة (treatment)');
  if (!reviewDate)                                       missing.push('تاريخ المراجعة (reviewDate)');
  if (missing.length) {
    throw BadRequest(`المخاطرة ذات المستوى "${level}" تتطلب: ${missing.join('، ')}`);
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
    // ISO 6.1.1: المخاطرة العالية/الحرجة تتطلب بيانات الحوكمة كاملة
    guardHighCritical({ level, ownerId: data.ownerId, departmentId: data.departmentId, treatment: data.treatment, reviewDate: data.reviewDate });
    return { ...data, probability: p, impact: i, score, level, createdById: req.user.sub };
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

    // الـ level بعد هذا التحديث — إما محسوب حديثاً أو مُرسَل صراحةً
    const finalLevel = data.level;

    // نجلب السجل الحالي مرة واحدة لكل الحراسات التي تحتاجه
    const needsFetch = (finalLevel && HIGH_LEVELS.includes(finalLevel)) || data.status === 'CLOSED';
    let existing = null;
    if (needsFetch) {
      existing = await prisma.risk.findUnique({
        where: { id: req.params.id, deletedAt: null },
        select: { ownerId: true, departmentId: true, treatment: true, reviewDate: true, treatmentType: true },
      });
    }

    // ISO 6.1.1: المخاطرة العالية/الحرجة تتطلب بيانات الحوكمة كاملة
    if (finalLevel && HIGH_LEVELS.includes(finalLevel)) {
      // ندمج قيم الـ update مع الموجودة — القيمة المُرسَلة لها الأسبقية
      guardHighCritical({
        level:        finalLevel,
        ownerId:      data.ownerId      !== undefined ? data.ownerId      : existing?.ownerId,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing?.departmentId,
        treatment:    data.treatment    !== undefined ? data.treatment    : existing?.treatment,
        reviewDate:   data.reviewDate   !== undefined ? data.reviewDate   : existing?.reviewDate,
      });
    }

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
