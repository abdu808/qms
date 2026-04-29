import { crudRouter } from '../utils/crudFactory.js';
import { createSchema, updateSchema } from '../schemas/axis.schema.js';

// محاور BSC الخمسة (FINANCIAL/CUSTOMER/PROCESS/LEARNING/GOVERNANCE)
// موجودة كبيانات غير مستخدمة في الخطة الحالية (2026-2030).
// مؤجلة لقرار إدارة لاحق — لا تُحذف ولا تُعدَّل.
// الخطة الحالية تعتمد AXIS-01..04 كمحاور رسمية للقطاع الثالث.
// للحصول على المحاور النشطة فقط (لها أهداف مرتبطة): GET /api/axes?quick=active

export default crudRouter({
  resource: 'axes',
  model: 'axis',
  codePrefix: 'AXIS',
  allowedFilters: ['deletedAt'],
  softDelete: true,
  schemas: { create: createSchema, update: updateSchema },
  smartFilters: {
    // active: يُرجع فقط المحاور التي لها أهداف استراتيجية مرتبطة (AXIS-01..04 في الخطة الحالية)
    // يُستخدم في نماذج التخطيط لإخفاء المحاور الخمس غير المستخدمة من الـ axis picker
    active: (_req, where) => ({ ...where, goals: { some: { deletedAt: null } } }),
  },
});
