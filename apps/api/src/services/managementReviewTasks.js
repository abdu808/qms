/**
 * services/managementReviewTasks.js — Audit task 8 (architectural)
 * يحوّل قرارات وإجراءات Management Review إلى FollowUpTask عند COMPLETED.
 *
 * اتفاقية البيانات:
 *   - decisions / improvementActions يتوقَّع أن يكونا JSON arrays
 *     [{ title, description?, ownerId, dueDate, priority? }, ...]
 *   - النص الحر مرفوض عند الاعتماد (لا يمكن توليد مهام منه).
 */
import { BadRequest } from '../utils/errors.js';
import { nextCode } from '../utils/codeGen.js';

const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

/**
 * يَفحص الحقل: إن كان فارغاً يُرجع []. إن كان نصاً غير JSON → throw.
 * إن كان JSON array صالحاً يُرجع العناصر بعد التحقق من ownerId/dueDate.
 */
export function parseDecisionsField(fieldName, raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return [];
  let items;
  try { items = JSON.parse(raw); }
  catch {
    throw BadRequest(
      `حقل "${fieldName}" يجب أن يكون JSON array لتوليد مهام المتابعة عند الاعتماد. ` +
      `استخدم صيغة: [{title, ownerId, dueDate}]. تم رفض النص الحر.`,
    );
  }
  if (!Array.isArray(items)) {
    throw BadRequest(`حقل "${fieldName}" يجب أن يكون مصفوفة JSON.`);
  }
  items.forEach((it, idx) => {
    if (!it || typeof it !== 'object') {
      throw BadRequest(`${fieldName} #${idx + 1} ليس كائناً صالحاً.`);
    }
    const missing = [];
    if (!it.title || typeof it.title !== 'string' || it.title.trim() === '') missing.push('title');
    if (!it.ownerId) missing.push('ownerId');
    if (!it.dueDate) missing.push('dueDate');
    if (missing.length) {
      throw BadRequest(`${fieldName} #${idx + 1} ناقص: ${missing.join('، ')}`);
    }
    // تحقق من التاريخ
    const d = new Date(it.dueDate);
    if (isNaN(d.getTime())) {
      throw BadRequest(`${fieldName} #${idx + 1}: dueDate غير صالح.`);
    }
    if (it.priority && !VALID_PRIORITIES.has(it.priority)) {
      throw BadRequest(`${fieldName} #${idx + 1}: priority يجب أن يكون LOW/MEDIUM/HIGH.`);
    }
  });
  return items;
}

/**
 * يولّد FollowUpTask لكل عنصر في decisions و improvementActions.
 * idempotent: لا يُكرِّر إنشاء مهام لنفس (sourceId, source) — يفحص أولاً.
 *
 * @param {object} prismaTx — prisma client أو tx
 * @param {object} review   — سجل ManagementReview المُعتمد
 * @param {string} createdById — userId من أنشأ المهام (المستخدم المعتمد)
 * @returns {Array} المهام المُنشأة
 */
export async function createFollowUpTasksFromReview(prismaTx, review, createdById) {
  const allItems = [
    ...parseDecisionsField('decisions',          review.decisions).map(i => ({ ...i, _from: 'decisions' })),
    ...parseDecisionsField('improvementActions', review.improvementActions).map(i => ({ ...i, _from: 'improvementActions' })),
  ];
  if (allItems.length === 0) return [];

  // idempotency: إذا وُجِدَت مهام سابقة لهذه المراجعة، لا نعيد الإنشاء.
  const existing = await prismaTx.followUpTask.count({
    where: { source: 'MANAGEMENT_REVIEW', sourceId: review.id, deletedAt: null },
  });
  if (existing > 0) {
    return []; // مكتمل سابقاً
  }

  const created = [];
  for (const it of allItems) {
    const code = await nextCode('followUpTask', 'FUT');
    const task = await prismaTx.followUpTask.create({
      data: {
        code,
        title:       String(it.title).trim(),
        description: it.description ? String(it.description).trim() : `[من ${it._from} في مراجعة ${review.code}]`,
        ownerId:     it.ownerId,
        dueDate:     new Date(it.dueDate),
        source:      'MANAGEMENT_REVIEW',
        sourceId:    review.id,
        priority:    it.priority || null,
        status:      'OPEN',
        createdById,
      },
    });
    created.push(task);
  }
  return created;
}
