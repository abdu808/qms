import { nextCode } from '../utils/codeGen.js';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS'];

function percent(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null;
  return Math.round(Number(ratio) * 100);
}

function dueDateFor(ratio) {
  const days = ratio < 0.6 ? 7 : 14;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function priorityFor(ratio) {
  if (ratio < 0.6) return 'HIGH';
  if (ratio < 0.8) return 'MEDIUM';
  return 'LOW';
}

async function loadParent(tx, { objectiveId, activityId, indicatorId }) {
  if (indicatorId) {
    const item = await tx.indicator.findUnique({
      where: { id: indicatorId },
      select: {
        id: true,
        code: true,
        nameAr: true,
        ownerId: true,
        dataEntryUserId: true,
      },
    });
    return item && {
      kind: 'indicator',
      code: item.code,
      title: item.nameAr,
      ownerId: item.dataEntryUserId || item.ownerId,
    };
  }

  if (activityId) {
    const item = await tx.operationalActivity.findUnique({
      where: { id: activityId },
      select: { id: true, code: true, title: true, ownerId: true },
    });
    return item && {
      kind: 'activity',
      code: item.code,
      title: item.title,
      ownerId: item.ownerId,
    };
  }

  if (objectiveId) {
    const item = await tx.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, code: true, title: true, ownerId: true },
    });
    return item && {
      kind: 'objective',
      code: item.code,
      title: item.title,
      ownerId: item.ownerId,
    };
  }

  return null;
}

/**
 * Creates one open follow-up task for a KPI entry deviation.
 * This keeps KPI dashboards useful without turning every red number into noise.
 */
export async function ensureKpiDeviationTask({
  tx,
  entry,
  feedback,
  objectiveId,
  activityId,
  indicatorId,
  userId,
}) {
  const ratio = feedback?.ratio;
  if (ratio == null || ratio >= 0.8 || !entry?.id) return null;

  const existing = await tx.followUpTask.findFirst({
    where: {
      deletedAt: null,
      source: 'KPI_DEVIATION',
      sourceId: entry.id,
      status: { in: ACTIVE_TASK_STATUSES },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, reused: true };

  const parent = await loadParent(tx, { objectiveId, activityId, indicatorId });
  const ownerId = parent?.ownerId || userId;
  if (!ownerId) return null;

  const ratioPct = percent(ratio);
  const code = await nextCode('followUpTask', 'FUT');
  const title = `متابعة انحراف مؤشر: ${parent?.code || 'KPI'} - ${parent?.title || 'قراءة أداء'}`;
  const description = [
    `تم إنشاء هذه المهمة تلقائياً بسبب قراءة أقل من 80%.`,
    `الفترة: ${entry.month}/${entry.year}.`,
    `نسبة التحقق: ${ratioPct}%.`,
    entry.deviationReason ? `سبب الانحراف: ${entry.deviationReason}` : null,
    entry.actionNote ? `الإجراء المقترح: ${entry.actionNote}` : null,
  ].filter(Boolean).join('\n');

  const task = await tx.followUpTask.create({
    data: {
      code,
      title,
      description,
      ownerId,
      dueDate: dueDateFor(ratio),
      source: 'KPI_DEVIATION',
      sourceId: entry.id,
      priority: priorityFor(ratio),
      createdById: userId,
    },
    select: { id: true, code: true, priority: true, dueDate: true },
  });

  return { ...task, created: true };
}
