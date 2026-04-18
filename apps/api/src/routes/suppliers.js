import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';

// C7: رقم السجل التجاري يجب أن يكون 10 أرقام بالضبط
const CR_REGEX = /^\d{10}$/;

function validateCrNumber(data) {
  if (data.crNumber != null && data.crNumber !== '') {
    if (!CR_REGEX.test(String(data.crNumber).trim())) {
      throw BadRequest('رقم السجل التجاري يجب أن يتكون من 10 أرقام فقط');
    }
  }
}

const router = crudRouter({
  model: 'supplier',
  codePrefix: 'SUP',
  searchFields: ['name', 'crNumber', 'contactPerson'],
  allowedSortFields: ['createdAt', 'name', 'status', 'overallRating'],
  allowedFilters: ['status', 'type'],
  beforeCreate: async (data) => {
    validateCrNumber(data);
    return data;
  },
  beforeUpdate: async (data, req) => {
    validateCrNumber(data);

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
