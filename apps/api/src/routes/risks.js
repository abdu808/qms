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

/**
 * effectiveLevelGuard — يدمج بيانات الـ update مع السجل الحالي ثم يستدعي guardHighCritical.
 * Pure function مُصدَّرة لتسهيل الاختبار.
 *
 * يحل مشكلة: update لا يحمل `level` لكن السجل الحالي هو HIGH/CRITICAL.
 * القيمة المُرسَلة في `data` لها الأسبقية على `existing` لكل حقل.
 *
 * @param {object} data     — جسم طلب الـ update (الحقول المُرسَلة فقط)
 * @param {object} existing — السجل الحالي من DB
 */
export function effectiveLevelGuard(data, existing) {
  // الـ level الفعلي: إما محسوب/مُرسَل في الـ update، أو من السجل الحالي
  const finalLevel = data.level ?? existing?.level;
  if (!finalLevel || !HIGH_LEVELS.includes(finalLevel)) return;
  guardHighCritical({
    level:        finalLevel,
    ownerId:      data.ownerId      !== undefined ? data.ownerId      : existing?.ownerId,
    departmentId: data.departmentId !== undefined ? data.departmentId : existing?.departmentId,
    treatment:    data.treatment    !== undefined ? data.treatment    : existing?.treatment,
    reviewDate:   data.reviewDate   !== undefined ? data.reviewDate   : existing?.reviewDate,
  });
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
  smartFilters: {
    critical: () => ({ level: 'حرج', status: { notIn: ['CLOSED', 'ACCEPTED'] } }),
    stale: () => {
      const cutoff = new Date(Date.now() - 90 * 86400000);
      return {
        status: { notIn: ['CLOSED', 'ACCEPTED'] },
        level: { in: ['حرج', 'مرتفع'] },
        updatedAt: { lt: cutoff },
      };
    },
  },
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

    // نجلب السجل الحالي دائماً — نحتاجه لمعرفة الـ level الموجود حتى لو لم يُرسَل في الـ update
    const existing = await prisma.risk.findUnique({
      where: { id: req.params.id, deletedAt: null },
      select: { level: true, ownerId: true, departmentId: true, treatment: true, reviewDate: true, treatmentType: true },
    });

    // ISO 6.1.1: المخاطرة العالية/الحرجة تتطلب بيانات الحوكمة كاملة
    // effectiveLevelGuard يدمج data مع existing ويتحقق من الحقول الأربعة
    effectiveLevelGuard(data, existing);

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
