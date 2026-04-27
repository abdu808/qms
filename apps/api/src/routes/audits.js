import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { AUDIT_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';
import { createSchema as auditCreateSchema, updateSchema as auditUpdateSchema } from '../schemas/audit.schema.js';

// Audit task 9: عند إكمال تدقيق فيه finding من نوع عدم مطابقة، يجب وجود
// NCR مرتبط (auditNcrs[]) أو إنشاؤه. لا يوجد نموذج AuditFinding مستقل في الـ
// schema الحالي — findings حقل String حر. لذلك نكتشف "عدم المطابقة" نصياً
// (NONCONFORMITY أو "عدم مطابقة") ونلزم بوجود NCR واحد على الأقل عبر
// junction AuditNCR. حل أنظف يتطلب schema جديد (AuditFinding) — مؤجَّل لقرار.
const NONCONFORMITY_PATTERNS = [
  /NON[\s_-]?CONFORMIT/i,
  /NONCONF/i,
  /عدم\s*مطابقة/,
  /عدم\s*المطابقة/,
];

function findingsContainNonconformity(findings) {
  if (!findings || typeof findings !== 'string') return false;
  return NONCONFORMITY_PATTERNS.some(re => re.test(findings));
}

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
        select: {
          status: true, findings: true,
          auditNcrs: { select: { id: true } },
        },
      });
      if (!current) throw NotFound('التدقيق غير موجود');
      assertTransition(AUDIT_STATUS, current.status, data.status, {
        label: 'التدقيق', role: req.user?.role,
      });

      // ISO 9.2: إغلاق تدقيق داخلي يتطلب توقيعاً رقمياً من المدقق الرئيس
      if (data.status === 'COMPLETED') {
        // Audit task 9: إذا كانت findings تحتوي إشارة "عدم مطابقة" يجب
        // وجود NCR مرتبط (إما عبر AuditNCR junction، أو يُنشئ المستخدم واحداً ويربطه قبل الإكمال).
        const findings = data.findings ?? current.findings;
        if (findingsContainNonconformity(findings)) {
          const linkedCount = current.auditNcrs?.length || 0;
          if (linkedCount === 0) {
            throw BadRequest(
              'لا يمكن إكمال تدقيق فيه عدم مطابقة دون إنشاء NCR وربطه بالتدقيق. أنشئ سجل عدم مطابقة من قائمة NCR ثم اربطه بهذا التدقيق قبل إكماله.',
            );
          }
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
