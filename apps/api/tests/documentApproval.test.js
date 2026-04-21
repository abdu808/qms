/**
 * tests/documentApproval.test.js — اختبارات وحدة لـ business logic اعتماد الوثائق.
 *
 * نختبر assertDocumentTransition (pure — تعتمد على state machine) والـ guard logic
 * في approveDocument / obsoleteDocument عبر mock prisma — بدون DB حقيقي.
 *
 * ISO 7.5.3 — Document status: DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → OBSOLETE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertDocumentTransition } from '../src/services/documentApproval.js';

// ═══════════════════════════════════════════════════════════════
//  assertDocumentTransition — pure wrapper على state machine
// ═══════════════════════════════════════════════════════════════

describe('assertDocumentTransition (pure)', () => {
  it('يسمح DRAFT → UNDER_REVIEW', () => {
    expect(() => assertDocumentTransition('DRAFT', 'UNDER_REVIEW')).not.toThrow();
  });

  it('يسمح UNDER_REVIEW → APPROVED', () => {
    expect(() => assertDocumentTransition('UNDER_REVIEW', 'APPROVED')).not.toThrow();
  });

  it('يسمح APPROVED → PUBLISHED', () => {
    expect(() => assertDocumentTransition('APPROVED', 'PUBLISHED')).not.toThrow();
  });

  it('يرفض DRAFT → PUBLISHED (تخطي خطوة)', () => {
    expect(() => assertDocumentTransition('DRAFT', 'PUBLISHED')).toThrow();
  });

  it('يرفض DRAFT → APPROVED (تخطي خطوة)', () => {
    expect(() => assertDocumentTransition('DRAFT', 'APPROVED')).toThrow();
  });

  it('يسمح * → OBSOLETE من أي حالة غير نهائية', () => {
    expect(() => assertDocumentTransition('DRAFT', 'OBSOLETE')).not.toThrow();
    expect(() => assertDocumentTransition('UNDER_REVIEW', 'OBSOLETE')).not.toThrow();
    expect(() => assertDocumentTransition('APPROVED', 'OBSOLETE')).not.toThrow();
    expect(() => assertDocumentTransition('PUBLISHED', 'OBSOLETE')).not.toThrow();
  });

  it('يرفض OBSOLETE → APPROVED (حالة نهائية)', () => {
    expect(() => assertDocumentTransition('OBSOLETE', 'APPROVED')).toThrow();
  });

  it('يرفض OBSOLETE → DRAFT (حالة نهائية)', () => {
    expect(() => assertDocumentTransition('OBSOLETE', 'DRAFT')).toThrow();
  });

  it('يرفض PUBLISHED → APPROVED (رجوع غير مسموح)', () => {
    expect(() => assertDocumentTransition('PUBLISHED', 'APPROVED')).toThrow();
  });

  it('يسمح PUBLISHED → UNDER_REVIEW (rollback)', () => {
    expect(() => assertDocumentTransition('PUBLISHED', 'UNDER_REVIEW')).not.toThrow();
  });

  it('لا تأثير عند عدم تغيير الحالة (no-op)', () => {
    expect(() => assertDocumentTransition('DRAFT', 'DRAFT')).not.toThrow();
    expect(() => assertDocumentTransition('APPROVED', 'APPROVED')).not.toThrow();
  });

  it('لا تأثير عند to = undefined', () => {
    expect(() => assertDocumentTransition('DRAFT', undefined)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
//  approveDocument / obsoleteDocument — mock prisma
// ═══════════════════════════════════════════════════════════════

// نعيد تحديد mock prisma قبل استيراد الدالة التي تعتمد عليه
vi.mock('../src/db.js', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/optimisticLock.js', () => ({
  withVersionGuard: vi.fn((_model, { data }) => Promise.resolve({ ...data, id: 'doc-1' })),
}));

// استيراد بعد الـ mock
const { approveDocument, obsoleteDocument } = await import('../src/services/documentApproval.js');
const { prisma } = await import('../src/db.js');
const { withVersionGuard } = await import('../src/utils/optimisticLock.js');

const BASE_DOC = {
  id: 'doc-1',
  status: 'UNDER_REVIEW',
  version: 1,
  deletedAt: null,
  effectiveDate: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approveDocument', () => {
  it('يعتمد وثيقة UNDER_REVIEW بنجاح (→ APPROVED)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'UNDER_REVIEW' });

    await approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER' });

    expect(withVersionGuard).toHaveBeenCalledWith(
      prisma.document,
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    );
  });

  it('يرفض publish=true من UNDER_REVIEW مباشرة (يجب المرور بـ APPROVED أولاً)', async () => {
    // UNDER_REVIEW → PUBLISHED ليست انتقالاً مسموحاً في state machine
    // يجب أن تمر عبر APPROVED أولاً (خطوتان)
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'UNDER_REVIEW' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER', publish: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('ينشر وثيقة APPROVED عبر publish=true (→ PUBLISHED)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'APPROVED' });

    await approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER', publish: true });

    expect(withVersionGuard).toHaveBeenCalledWith(
      prisma.document,
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
  });

  it('يرفض إعادة اعتماد APPROVED بدون publish (تكرار اعتماد بدون فائدة)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'APPROVED' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER', publish: false }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('يرفض اعتماد DRAFT (يجب أن تكون UNDER_REVIEW أولاً)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'DRAFT' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('يرفض اعتماد PUBLISHED', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'PUBLISHED' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('يرفض دور EMPLOYEE من الاعتماد', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'UNDER_REVIEW' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'EMPLOYEE' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('يرفض دور DEPT_MANAGER من الاعتماد', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'UNDER_REVIEW' });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'DEPT_MANAGER' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('يرفض اعتماد وثيقة محذوفة (deletedAt != null)', async () => {
    prisma.document.findUnique.mockResolvedValue({
      ...BASE_DOC,
      status: 'UNDER_REVIEW',
      deletedAt: new Date(),
    });

    await expect(
      approveDocument({ docId: 'doc-1', userId: 'u1', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('يرمي NotFound عند عدم وجود الوثيقة', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await expect(
      approveDocument({ docId: 'non-existent', userId: 'u1', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('obsoleteDocument', () => {
  it('يسحب وثيقة PUBLISHED بنجاح (→ OBSOLETE)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'PUBLISHED' });

    await obsoleteDocument({ docId: 'doc-1', userRole: 'QUALITY_MANAGER' });

    expect(withVersionGuard).toHaveBeenCalledWith(
      prisma.document,
      expect.objectContaining({ data: expect.objectContaining({ status: 'OBSOLETE' }) }),
    );
  });

  it('يسحب وثيقة DRAFT بنجاح (→ OBSOLETE)', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'DRAFT' });

    await obsoleteDocument({ docId: 'doc-1', userRole: 'QUALITY_MANAGER' });

    expect(withVersionGuard).toHaveBeenCalledWith(
      prisma.document,
      expect.objectContaining({ data: expect.objectContaining({ status: 'OBSOLETE' }) }),
    );
  });

  it('يرفض سحب وثيقة هي بالفعل OBSOLETE', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'OBSOLETE' });

    await expect(
      obsoleteDocument({ docId: 'doc-1', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('يرفض دور EMPLOYEE من السحب', async () => {
    prisma.document.findUnique.mockResolvedValue({ ...BASE_DOC, status: 'PUBLISHED' });

    await expect(
      obsoleteDocument({ docId: 'doc-1', userRole: 'EMPLOYEE' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('يرمي NotFound عند عدم وجود الوثيقة', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await expect(
      obsoleteDocument({ docId: 'non-existent', userRole: 'QUALITY_MANAGER' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
