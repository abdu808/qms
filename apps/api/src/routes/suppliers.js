import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';

const router = crudRouter({
  model: 'supplier',
  codePrefix: 'SUP',
  searchFields: ['name', 'crNumber', 'contactPerson'],
  allowedSortFields: ['createdAt', 'name', 'status', 'overallRating'],
  allowedFilters: ['status', 'type'],
  beforeUpdate: async (data, req) => {
    // ISO 8.4: لا يمكن اعتماد مورد دون وجود تقييم ناجح مسبق
    if (data.status === 'APPROVED') {
      const hasApprovedEval = await prisma.supplierEval.findFirst({
        where: {
          supplierId: req.params.id,
          decision: { in: ['معتمد', 'معتمد مشروط'] },
        },
        select: { id: true },
      });
      if (!hasApprovedEval) {
        throw BadRequest('لا يمكن اعتماد المورد دون وجود تقييم ناجح (ISO 8.4) — أرسل رابط التقييم للمورد أولاً');
      }
    }
    return data;
  },
});

export default router;
