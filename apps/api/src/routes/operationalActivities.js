import { crudRouter } from '../utils/crudFactory.js';
import { recomputeStrategicGoal } from '../services/rollup.js';

export default crudRouter({
  resource: 'operational-activities',
  model: 'operationalActivity',
  codePrefix: 'ACT',
  searchFields: ['title', 'description', 'responsible', 'department', 'perspective'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'year', 'startDate', 'endDate'],
  allowedFilters: ['status', 'year', 'strategicGoalId', 'ownerId', 'deptId'],
  include: {
    owner: { select: { id: true, name: true, jobTitle: true } },
    dept:  { select: { id: true, name: true, code: true } },
    strategicGoal: { select: { id: true, code: true, title: true } },
  },
  // RBAC: مسؤول القسم → نشاطات قسمه | الموظف → ما كُلِّف به أو قسمه
  scopeFilter: (req) => {
    const { role, departmentId, sub } = req.user || {};
    if (role === 'DEPT_MANAGER' && departmentId) return { deptId: departmentId };
    if (role === 'EMPLOYEE') return { OR: [{ ownerId: sub }, { deptId: departmentId }] };
    return {};
  },
  // Field-Level Security: تعديل البيانات الحاكمة محصور بالـ QM (يتم عبر Change Request)
  lockedFieldsForRole: {
    DEPT_MANAGER: ['title','description','perspective','year','startDate','endDate','budget','strategicGoalId','targetValue','targetUnit','kpiType','seasonality','direction'],
    EMPLOYEE:     ['title','description','perspective','year','startDate','endDate','budget','strategicGoalId','targetValue','targetUnit','kpiType','seasonality','direction','ownerId','deptId'],
  },
  // Plan Freeze enforcement
  enforceFreezeFor: async (id, prisma) => {
    const a = await prisma.operationalActivity.findUnique({
      where: { id }, select: { strategicGoal: { select: { planId: true } } },
    });
    return a?.strategicGoal?.planId || null;
  },
  transactionFields: ['progress','spent','status','notes'],
  // ROLLUP-001: cascade تلقائي → StrategicGoal.progress عند تعديل أو حذف النشاط التشغيلي
  afterUpdate: async (item) => {
    if (item.strategicGoalId) {
      await recomputeStrategicGoal(item.strategicGoalId).catch(e =>
        console.error('[rollup] afterUpdate activity', item.id, e.message),
      );
    }
  },
  afterDelete: async (snapshot) => {
    if (snapshot.strategicGoalId) {
      await recomputeStrategicGoal(snapshot.strategicGoalId).catch(e =>
        console.error('[rollup] afterDelete activity', snapshot.id, e.message),
      );
    }
  },
});
