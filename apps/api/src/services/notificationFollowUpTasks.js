import { prisma } from '../db.js';
import { nextCode } from '../utils/codeGen.js';

let systemUserIdCache = null;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

function taskPolicyFor(eventKey) {
  if (eventKey === 'KPI_ESCALATED_L2') return { days: 0, priority: 'HIGH' };
  if (eventKey === 'KPI_ESCALATED_L1') return { days: 2, priority: 'HIGH' };
  if (eventKey === 'KPI_FIRST_NOTICE') return { days: 2, priority: 'MEDIUM' };
  if (String(eventKey || '').includes('OVERDUE')) return { days: 1, priority: 'HIGH' };
  return { days: 3, priority: 'MEDIUM' };
}

async function resolveSystemUserId(fallbackUserId) {
  if (systemUserIdCache) return systemUserIdCache;

  const admin = await prisma.user.findFirst({
    where: { active: true, role: 'SUPER_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  }).catch(() => null);

  systemUserIdCache = admin?.id || fallbackUserId;
  return systemUserIdCache;
}

async function createTaskWithRetry(data, attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const code = await nextCode('followUpTask', 'FUT');
      return await prisma.followUpTask.create({
        data: { ...data, code },
        select: { id: true, code: true, status: true, dueDate: true },
      });
    } catch (e) {
      lastError = e;
      if (e?.code !== 'P2002') break;
    }
  }
  throw lastError;
}

export async function ensureNotificationFollowUpTask({
  rule,
  eventKey,
  dedupeKey,
  recipient,
  title,
  message,
  entityType,
  entityId,
  link,
}) {
  if (!rule?.createsTask) return { created: false, reason: 'rule-does-not-create-task' };
  if (!recipient?.id) return { created: false, reason: 'missing-recipient' };

  const sourceId = entityId || dedupeKey;
  if (!sourceId) return { created: false, reason: 'missing-source' };

  const existing = await prisma.followUpTask.findFirst({
    where: {
      source: 'NOTIFICATION',
      sourceId,
      ownerId: recipient.id,
      deletedAt: null,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    select: { id: true, code: true, status: true },
  });
  if (existing) return { created: false, reason: 'task-already-open', task: existing };

  const policy = taskPolicyFor(eventKey);
  const createdById = await resolveSystemUserId(recipient.id);
  const task = await createTaskWithRetry({
    title: `متابعة: ${title || eventKey}`.slice(0, 500),
    description: [
      message || '',
      '',
      `الحدث: ${eventKey}`,
      `المصدر: ${entityType || '-'}`,
      `الرابط: ${link || '-'}`,
      `مفتاح منع التكرار: ${dedupeKey || '-'}`,
    ].join('\n').trim(),
    ownerId: recipient.id,
    dueDate: addDays(new Date(), policy.days),
    source: 'NOTIFICATION',
    sourceId,
    priority: policy.priority,
    notes: `تم إنشاؤها تلقائياً من قاعدة تنبيه: ${eventKey}`,
    createdById,
  });

  return { created: true, task };
}
