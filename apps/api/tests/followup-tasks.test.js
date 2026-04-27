/**
 * tests/followup-tasks.test.js
 * ───────────────────────────────────────────────────────────────
 * يختبر:
 *   1. parseDecisionsField — يقبل/يرفض JSON بحسب الاكتمال
 *   2. createFollowUpTasksFromReview — يولّد المهام، idempotent
 * يستخدم mock لـ prisma و codeGen.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
});

vi.mock('../src/utils/codeGen.js', () => ({
  nextCode: async () => `FUT-2026-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
}));

describe('parseDecisionsField (Audit task 8 — architectural)', () => {
  it('يُرجع [] للحقل الفارغ', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    expect(parseDecisionsField('decisions', null)).toEqual([]);
    expect(parseDecisionsField('decisions', '')).toEqual([]);
    expect(parseDecisionsField('decisions', '   ')).toEqual([]);
  });

  it('يرفض النص الحر (لا يقبل workaround)', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    expect(() => parseDecisionsField('decisions', 'قرار حر')).toThrow(/JSON array/);
  });

  it('يرفض JSON غير array', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    expect(() => parseDecisionsField('decisions', '{"x":1}')).toThrow(/مصفوفة/);
  });

  it('يرفض عنصراً بدون title', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ ownerId: 'u1', dueDate: '2026-12-01' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/title/);
  });

  it('يرفض عنصراً بدون ownerId', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ title: 't', dueDate: '2026-12-01' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/ownerId/);
  });

  it('يرفض عنصراً بدون dueDate', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ title: 't', ownerId: 'u1' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/dueDate/);
  });

  it('يرفض dueDate غير صالح', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ title: 't', ownerId: 'u1', dueDate: 'not-a-date' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/dueDate/);
  });

  it('يرفض priority غير معروف', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([{ title: 't', ownerId: 'u1', dueDate: '2026-12-01', priority: 'URGENT' }]);
    expect(() => parseDecisionsField('decisions', raw)).toThrow(/priority/);
  });

  it('يقبل JSON كاملاً', async () => {
    const { parseDecisionsField } = await import('../src/services/managementReviewTasks.js');
    const raw = JSON.stringify([
      { title: 'مهمة 1', ownerId: 'u1', dueDate: '2026-12-01' },
      { title: 'مهمة 2', ownerId: 'u2', dueDate: '2026-12-31', priority: 'HIGH' },
    ]);
    const items = parseDecisionsField('decisions', raw);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('مهمة 1');
  });
});

describe('createFollowUpTasksFromReview', () => {
  function buildPrismaMock({ existingCount = 0, capture = [] }) {
    return {
      followUpTask: {
        count:  vi.fn(async () => existingCount),
        create: vi.fn(async ({ data }) => { capture.push(data); return { id: `tsk-${capture.length}`, ...data }; }),
      },
    };
  }

  it('idempotent: لا يُنشئ مهاماً إذا وُجِدَت مهام سابقة لنفس المراجعة', async () => {
    const { createFollowUpTasksFromReview } = await import('../src/services/managementReviewTasks.js');
    const captured = [];
    const prisma = buildPrismaMock({ existingCount: 3, capture: captured });
    const review = {
      id: 'mr-1', code: 'MR-1',
      decisions: JSON.stringify([{ title: 't', ownerId: 'u1', dueDate: '2026-12-01' }]),
      improvementActions: null,
    };
    const created = await createFollowUpTasksFromReview(prisma, review, 'creator');
    expect(created).toEqual([]);
    expect(prisma.followUpTask.create).not.toHaveBeenCalled();
  });

  it('يُولّد مهمة لكل عنصر في decisions و improvementActions', async () => {
    const { createFollowUpTasksFromReview } = await import('../src/services/managementReviewTasks.js');
    const captured = [];
    const prisma = buildPrismaMock({ existingCount: 0, capture: captured });
    const review = {
      id: 'mr-2', code: 'MR-2',
      decisions: JSON.stringify([
        { title: 'قرار 1', ownerId: 'u1', dueDate: '2026-12-01' },
        { title: 'قرار 2', ownerId: 'u2', dueDate: '2026-12-15' },
      ]),
      improvementActions: JSON.stringify([
        { title: 'إجراء 1', ownerId: 'u3', dueDate: '2027-01-01', priority: 'HIGH' },
      ]),
    };
    const created = await createFollowUpTasksFromReview(prisma, review, 'creator');
    expect(created).toHaveLength(3);
    expect(captured.every(t => t.source === 'MANAGEMENT_REVIEW')).toBe(true);
    expect(captured.every(t => t.sourceId === 'mr-2')).toBe(true);
    expect(captured.every(t => t.createdById === 'creator')).toBe(true);
    expect(captured.every(t => t.status === 'OPEN')).toBe(true);
    expect(captured.find(t => t.priority === 'HIGH')).toBeTruthy();
  });

  it('يُرجع [] إذا لم تكن decisions/improvementActions موجودة', async () => {
    const { createFollowUpTasksFromReview } = await import('../src/services/managementReviewTasks.js');
    const prisma = buildPrismaMock({ existingCount: 0 });
    const review = { id: 'mr-3', code: 'MR-3', decisions: null, improvementActions: null };
    const created = await createFollowUpTasksFromReview(prisma, review, 'creator');
    expect(created).toEqual([]);
  });
});
