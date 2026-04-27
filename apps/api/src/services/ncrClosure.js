/**
 * services/ncrClosure.js — قواعد إغلاق عدم المطابقة (ISO 10.2).
 *
 * المرحلة 2 — Service Layer.
 * يجمع كل قواعد الإغلاق في مكان واحد:
 *   ▸ normalizeNcr          — تحويل الأنواع واستيفاء verifiedAt تلقائياً
 *   ▸ guardClosure          — المتطلبات قبل CLOSE: effective=true + verifiedAt
 *   ▸ guardNcrUpdate        — state machine + توقيع رقمي + سجل التحقق من الفعالية
 */
import { prisma } from '../db.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { NCR_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';

export function normalizeNcr(data) {
  if (data.effective === 'true')       data.effective = true;
  else if (data.effective === 'false') data.effective = false;
  else if (data.effective === '' || data.effective === null) data.effective = null;

  // عند تسجيل الفعالية نختم verifiedAt تلقائياً إن لم يُرسَل
  if (data.effective !== null && data.effective !== undefined && !data.verifiedAt) {
    data.verifiedAt = new Date();
  }
  return data;
}

/**
 * Helper: يجمع الحقول الناقصة في رسالة عربية واحدة قابلة للقراءة.
 */
function assertRequiredFields(label, merged, fields) {
  const missing = fields.filter(f => {
    const v = merged[f];
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length === 0) return;
  const labels = {
    assigneeId:       'المسؤول',
    rootCause:        'السبب الجذري',
    correctiveAction: 'الإجراء التصحيحي',
    dueDate:          'تاريخ الاستحقاق',
    verifiedAt:       'تاريخ التحقق',
    verifiedNote:     'ملاحظة التحقق',
    effective:        'نتيجة الفعالية',
  };
  const ar = missing.map(f => labels[f] || f).join('، ');
  throw BadRequest(`لا يمكن الانتقال إلى ${label} — الحقول الناقصة: ${ar}`);
}

/**
 * guardStateTransition — يفرض متطلبات كل انتقال حالة لـ NCR (ISO 10.2).
 * يأخذ data المُرسَلة + current من DB ويتحقق أن المتطلبات موجودة في
 * الاتحاد بينهما (ما هو موجود مسبقاً + ما يُرسَل الآن).
 *
 *   ROOT_CAUSE     ← assigneeId
 *   ACTION_PLANNED ← rootCause
 *   IN_PROGRESS    ← correctiveAction, dueDate (يتطلب وجود خطة قبل بدء التنفيذ)
 *   VERIFICATION   ← دليل تنفيذ (correction أو correctiveAction مع status سابق=IN_PROGRESS)
 *   CLOSED         ← effective=true + verifiedAt + verifiedNote
 */
export function guardStateTransition(data, current) {
  if (!data.status) return;
  // الاتحاد بين قيم DB والقيم القادمة
  const merged = { ...current, ...data };

  switch (data.status) {
    case 'ROOT_CAUSE':
      assertRequiredFields('تحليل السبب الجذري (ROOT_CAUSE)', merged, ['assigneeId']);
      break;
    case 'ACTION_PLANNED':
      assertRequiredFields('تخطيط الإجراء (ACTION_PLANNED)', merged, ['assigneeId', 'rootCause']);
      break;
    case 'IN_PROGRESS':
      assertRequiredFields('قيد التنفيذ (IN_PROGRESS)', merged, ['assigneeId', 'rootCause', 'correctiveAction', 'dueDate']);
      break;
    case 'VERIFICATION':
      assertRequiredFields('التحقق (VERIFICATION)', merged, ['assigneeId', 'rootCause', 'correctiveAction', 'dueDate']);
      break;
    case 'CLOSED':
      // تحقق من اكتمال كل المتطلبات قبل الإغلاق (ISO 10.2)
      assertRequiredFields('الإغلاق (CLOSED)', merged, [
        'assigneeId', 'rootCause', 'correctiveAction', 'dueDate', 'verifiedAt', 'verifiedNote',
      ]);
      if (merged.effective !== true) {
        throw BadRequest('لا يمكن إغلاق عدم المطابقة دون التحقق من فعالية الإجراء التصحيحي (effective = true)');
      }
      break;
  }
}

/**
 * guardClosure — يرفض CLOSE بدون تحقق من الفعالية (ISO 10.2).
 * (يبقى للـ create path حيث لا يوجد current state)
 */
export function guardClosure(data) {
  if (data.status !== 'CLOSED') return;
  if (data.effective !== true) {
    throw BadRequest('لا يمكن إغلاق عدم المطابقة دون التحقق من فعالية الإجراء التصحيحي (ISO 10.2)');
  }
  if (!data.verifiedAt) {
    throw BadRequest('مطلوب تاريخ التحقق من الفعالية قبل الإغلاق');
  }
  if (!data.verifiedNote || String(data.verifiedNote).trim() === '') {
    throw BadRequest('مطلوب ملاحظة تحقق (verifiedNote) قبل الإغلاق');
  }
}

/**
 * guardNcrUpdate — حارس CRUD للتحديث.
 * يطبّق state machine + يفرض توقيعاً رقمياً عند الإغلاق
 * + يسجّل حدث VERIFY_NCR_EFFECTIVENESS بشكل منفصل.
 */
export async function guardNcrUpdate(data, { ncrId, req }) {
  normalizeNcr(data);

  if (data.status) {
    const current = await prisma.nCR.findUnique({
      where: { id: ncrId },
      select: {
        status: true, version: true,
        assigneeId: true, rootCause: true, correctiveAction: true, dueDate: true,
        verifiedAt: true, verifiedNote: true, effective: true,
      },
    });
    if (!current) throw NotFound('عدم المطابقة غير موجودة');
    assertTransition(NCR_STATUS, current.status, data.status, {
      label: 'عدم المطابقة', role: req?.user?.role,
    });
    // ISO 10.2 — كل انتقال حالة له متطلبات
    guardStateTransition(data, current);
    // optimistic locking — crudFactory يستهلك __expectedVersion
    data.__expectedVersion = current.version;
  } else {
    // إن لم يُرسَل status، فقط طبّق guardClosure القديم (لا يُغيِّر شيء بدون CLOSED)
    guardClosure(data);
  }

  if (data.status === 'CLOSED') {
    await requireSignatureFor(req, {
      entityType: 'NCR',
      entityId:   ncrId,
      purpose:    'close',
      label:      'إغلاق عدم المطابقة',
    });

    // سجل تحقق من الفعالية — fire-and-forget
    prisma.auditLog.create({
      data: {
        userId:      req?.user?.sub,
        action:      'VERIFY_NCR_EFFECTIVENESS',
        entityType:  'NCR',
        entityId:    ncrId,
        changesJson: JSON.stringify({
          effective:    data.effective,
          verifiedAt:   data.verifiedAt,
          verifiedNote: data.verifiedNote || null,
        }),
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
    }).catch((e) => {
      console.error('[audit] ncrClosure VERIFY_NCR_EFFECTIVENESS auditLog failed:', e?.message || e);
    });
  }
  return data;
}

/**
 * guardNcrCreate — تطبيع + حارس الإغلاق عند الإنشاء (نادر لكنه ممكن).
 */
export function guardNcrCreate(data) {
  normalizeNcr(data);
  guardClosure(data);
  return data;
}
