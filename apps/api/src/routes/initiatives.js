import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/initiative.schema.js';

export default crudRouter({
  resource: 'initiatives',
  model: 'initiative',
  codePrefix: 'INI',
  allowedFilters: ['goalId', 'status', 'ownerId', 'departmentId', 'deletedAt'],
  softDelete: true,
  schemas: { create: createSchema, update: updateSchema },
  // Field-Level Security: تعديل البيانات الحاكمة للمبادرة محصور بالـ QM
  lockedFieldsForRole: {
    DEPT_MANAGER: ['name','description','goalId','startDate','endDate','budget'],
    EMPLOYEE:     ['name','description','goalId','startDate','endDate','budget','ownerId','departmentId'],
  },
  // Plan Freeze enforcement
  enforceFreezeFor: async (id, prisma) => {
    const i = await prisma.initiative.findUnique({
      where: { id }, select: { goal: { select: { planId: true } } },
    });
    return i?.goal?.planId || null;
  },
  transactionFields: ['progress','spent','status','notes'],
  include: {
    goal: { select: { id: true, title: true } },
    owner: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
  },
});
