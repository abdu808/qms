import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema as objCreateSchema, updateSchema as objUpdateSchema } from '../schemas/objective.schema.js';
import { recomputeStrategicGoal } from '../services/rollup.js';

export default crudRouter({
  resource: 'objectives',
  model: 'objective',
  codePrefix: 'OBJ',
  searchFields: ['title', 'description', 'kpi'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'dueDate', 'status', 'progress'],
  allowedFilters: ['status', 'departmentId', 'ownerId'],
  schemas: { create: objCreateSchema, update: objUpdateSchema },
  // Field-Level Security: مدير القسم/الموظف لا يعدّلان الحقول الحاكمة (تتطلب Change Request)
  lockedFieldsForRole: {
    DEPT_MANAGER: ['title','kpi','target','unit','startDate','dueDate','strategicGoalId','baseline'],
    EMPLOYEE:     ['title','kpi','target','unit','startDate','dueDate','strategicGoalId','baseline'],
  },
  // Plan Freeze enforcement
  enforceFreezeFor: async (id, prisma) => {
    const o = await prisma.objective.findUnique({
      where: { id }, select: { strategicGoal: { select: { planId: true } } },
    });
    return o?.strategicGoal?.planId || null;
  },
  transactionFields: ['progress','currentValue','status','notes'],
  // RBAC: مسؤول القسم → قسمه فقط | الموظف → ما كُلِّف به فقط
  scopeFilter: (req) => {
    const { role, departmentId, sub } = req.user || {};
    if (role === 'DEPT_MANAGER' && departmentId) return { departmentId };
    if (role === 'EMPLOYEE')  return { OR: [{ ownerId: sub }, { departmentId }] };
    return {};
  },
  smartFilters: {
    mine:       (req) => ({ ownerId: req.user.sub }),
    myDept:     (req) => req.user.departmentId ? { departmentId: req.user.departmentId } : {},
    open:       () => ({ status: { notIn: ['CLOSED', 'CANCELLED'] } }),
    closed:     () => ({ status: 'CLOSED' }),
    overdue:    () => ({
      dueDate: { lt: new Date(), not: null },
      status:  { notIn: ['CLOSED', 'CANCELLED'] },
    }),
    atRisk:     () => ({
      progress: { lt: 50 },
      status:   { notIn: ['CLOSED', 'CANCELLED'] },
    }),
    thisMonth:  () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub }),
  beforeUpdate: async (data) => {
    // ISO 6.2: نسبة التقدم يجب أن تكون بين 0 و 100
    if (data.progress != null) {
      const p = Number(data.progress);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw BadRequest('نسبة التقدم يجب أن تكون بين 0 و 100');
      }
      data.progress = Math.round(p);
    }
    return data;
  },
  // ROLLUP-001: cascade تلقائي → StrategicGoal.progress عند تعديل أو حذف الهدف التشغيلي
  afterUpdate: async (item) => {
    if (item.strategicGoalId) {
      await recomputeStrategicGoal(item.strategicGoalId).catch(e =>
        console.error('[rollup] afterUpdate objective', item.id, e.message),
      );
    }
  },
  afterDelete: async (snapshot) => {
    if (snapshot.strategicGoalId) {
      await recomputeStrategicGoal(snapshot.strategicGoalId).catch(e =>
        console.error('[rollup] afterDelete objective', snapshot.id, e.message),
      );
    }
  },
});
