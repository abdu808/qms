/**
 * auditChecklists.js — قوالب التدقيق القابلة لإعادة الاستخدام
 * ISO 9001 §9.2 · P-12 §3.2
 */
import { Router } from 'express';
import { BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';

function normalize(data) {
  // itemsJson لازم يكون JSON صالح ومصفوفة
  if (data.itemsJson !== undefined && data.itemsJson !== null && data.itemsJson !== '') {
    try {
      const parsed = typeof data.itemsJson === 'string' ? JSON.parse(data.itemsJson) : data.itemsJson;
      if (!Array.isArray(parsed)) throw new Error('not array');
      data.itemsJson = JSON.stringify(parsed);
    } catch {
      throw BadRequest('itemsJson يجب أن يكون مصفوفة JSON صالحة من عناصر { q, clause, evidenceType, critical }');
    }
  }
  return data;
}

const base = crudRouter({
  resource: 'audit-checklists',
  model: 'auditChecklistTemplate',
  codePrefix: 'CHK',
  searchFields: ['title', 'description', 'isoClauses'],
  allowedSortFields: ['createdAt', 'title'],
  allowedFilters: ['active'],
  beforeCreate: async (d) => normalize(d),
  beforeUpdate: async (d) => normalize(d),
});

const router = Router();
router.use('/', base);
export default router;
