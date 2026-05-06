import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { AUDIT_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';
import { createSchema as auditCreateSchema, updateSchema as auditUpdateSchema } from '../schemas/audit.schema.js';

export default crudRouter({
  resource: 'audits',
  model: 'audit',
  codePrefix: 'AUD',
  searchFields: ['title', 'scope'],
  include: {
    leadAuditor:     { select: { id: true, name: true } },
    auditDepartment: { select: { id: true, name: true } },
    process:         { select: { id: true, code: true, name: true } },
    auditNcrs:       { include: { ncr: { select: { id: true, code: true, title: true, status: true } } } },
  },
  allowedSortFields: ['createdAt', 'plannedDate', 'status'],
  allowedFilters: ['type', 'status', 'departmentId', 'processId', 'leadAuditorId'],
  schemas: { create: auditCreateSchema, update: auditUpdateSchema },
  beforeUpdate: async (data, req) => {
    if (data.status) {
      const current = await prisma.audit.findUnique({
        where: { id: req.params.id, deletedAt: null },
        select: { status: true, actualDate: true, findings: true, reportUrl: true },
      });
      if (!current) throw NotFound('التدقيق غير موجود');
      assertTransition(AUDIT_STATUS, current.status, data.status, {
        label: 'التدقيق', role: req.user?.role,
      });

      // ISO 9.2: إغلاق تدقيق داخلي يتطلب توقيعاً رقمياً من المدقق الرئيس
      if (data.status === 'COMPLETED') {
        const actualDate = data.actualDate ?? current.actualDate;
        const findings = data.findings ?? current.findings;
        const reportUrl = data.reportUrl ?? current.reportUrl;
        const openFindings = await prisma.auditFinding.count({
          where: {
            auditId: req.params.id,
            deletedAt: null,
            status: { in: ['OPEN', 'IN_REVIEW'] },
          },
        });
        if (!actualDate) data.actualDate = new Date();
        if ((!findings || String(findings).trim() === '') && (!reportUrl || String(reportUrl).trim() === '')) {
          throw BadRequest('لا يمكن إكمال التدقيق بدون تقرير أو نتائج تدقيق موثقة');
        }
        if (openFindings > 0) {
          throw BadRequest(`لا يمكن إكمال التدقيق قبل معالجة ملاحظات التدقيق المفتوحة (${openFindings})`);
        }
        await requireSignatureFor(req, {
          entityType: 'Audit',
          entityId:   req.params.id,
          purpose:    'complete',
          label:      'اعتماد تقرير التدقيق',
        });
      }
    }
    return data;
  },
});
