/**
 * tests/softDelete.test.js — التحقق من منطق الـ soft-delete.
 *
 * لا يحتاج قاعدة بيانات — يختبر دوال خالصة وسلوك where clause فقط.
 */
import { describe, it, expect, vi } from 'vitest';
import { activeWhere, activeWhereForReq } from '../src/lib/dataHelpers.js';

// ═══════════════════════════════════════════════════════════════
//  activeWhere — pure function
// ═══════════════════════════════════════════════════════════════

describe('activeWhere (pure)', () => {
  it('بدون حالات إضافية → يُرجع { deletedAt: null }', () => {
    expect(activeWhere()).toEqual({ deletedAt: null });
  });

  it('يدمج الحالات الإضافية بشكل صحيح', () => {
    expect(activeWhere({ status: 'OPEN' })).toEqual({ deletedAt: null, status: 'OPEN' });
  });

  it('يدمج حالات متعددة في آنٍ واحد', () => {
    expect(activeWhere({ status: 'NEW', departmentId: 5 })).toEqual({
      deletedAt: null,
      status: 'NEW',
      departmentId: 5,
    });
  });

  it('deletedAt: null دائماً موجود بغض النظر عن المدخلات', () => {
    const result = activeWhere({ foo: 'bar' });
    expect(result).toHaveProperty('deletedAt', null);
  });

  it('المدخل الفارغ يكافئ استدعاءً بلا معاملات', () => {
    expect(activeWhere({})).toEqual({ deletedAt: null });
  });
});

// ═══════════════════════════════════════════════════════════════
//  soft-delete enforcement — Mock prisma
//  نتحقق أن where clause يحتوي deletedAt: null في findMany / findUnique
// ═══════════════════════════════════════════════════════════════

describe('soft-delete enforcement via mock prisma', () => {
  // بناء mock بسيط لـ prisma model
  function makeMockModel(rows) {
    return {
      findMany: vi.fn(({ where } = {}) => {
        const filtered = rows.filter((r) => {
          if (where?.deletedAt === null) return r.deletedAt === null;
          return true;
        });
        return Promise.resolve(filtered);
      }),
      findUnique: vi.fn(({ where } = {}) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) return Promise.resolve(null);
        // نحاكي السلوك: إذا كانت السجل محذوفاً وطُلب deletedAt:null فلا يُرجع
        if (where.deletedAt === null && row.deletedAt !== null) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
    };
  }

  const rows = [
    { id: 1, name: 'active record',  deletedAt: null },
    { id: 2, name: 'deleted record', deletedAt: new Date('2024-01-01') },
  ];

  it('findMany مع deletedAt:null يُقصي السجلات المحذوفة', async () => {
    const model = makeMockModel(rows);
    const results = await model.findMany({ where: activeWhere() });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(model.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: null }),
    });
  });

  it('findUnique على سجل محذوف يُرجع null (مثل NotFound)', async () => {
    const model = makeMockModel(rows);
    // نبحث بـ id + deletedAt:null
    const result = await model.findUnique({ where: { id: 2, ...activeWhere() } });
    expect(result).toBeNull();
  });

  it('findUnique على سجل موجود وغير محذوف يُرجعه بشكل طبيعي', async () => {
    const model = makeMockModel(rows);
    const result = await model.findUnique({ where: { id: 1, ...activeWhere() } });
    expect(result).not.toBeNull();
    expect(result.name).toBe('active record');
  });

  it('activeWhere مع شروط إضافية — يبني where clause صحيح', () => {
    const where = activeWhere({ status: 'OPEN', departmentId: 3 });
    // التحقق أن deletedAt موجودة وأن الشروط الأخرى لم تُحذف
    expect(where).toMatchObject({ deletedAt: null, status: 'OPEN', departmentId: 3 });
  });
});

// ═══════════════════════════════════════════════════════════════
//  activeWhereForReq — سلوك بحسب الدور وقيم query string
// ═══════════════════════════════════════════════════════════════

describe('activeWhereForReq', () => {
  const makeReq = (role, query = {}) => ({ user: { role }, query });

  it('مستخدم عادي (EMPLOYEE) → يُرجع deletedAt:null دائماً', () => {
    const req = makeReq('EMPLOYEE', { includeDeleted: '1', onlyDeleted: '1' });
    expect(activeWhereForReq(req)).toEqual({ deletedAt: null });
  });

  it('QUALITY_MANAGER + onlyDeleted=1 → يُرجع فقط المحذوفة', () => {
    const req = makeReq('QUALITY_MANAGER', { onlyDeleted: '1' });
    expect(activeWhereForReq(req)).toEqual({ deletedAt: { not: null } });
  });

  it('SUPER_ADMIN + includeDeleted=1 → لا قيد على deletedAt', () => {
    const req = makeReq('SUPER_ADMIN', { includeDeleted: '1' });
    // لا يوجد deletedAt في الـ where
    expect(activeWhereForReq(req)).not.toHaveProperty('deletedAt');
  });

  it('SUPER_ADMIN بدون flags → يُرجع deletedAt:null', () => {
    const req = makeReq('SUPER_ADMIN', {});
    expect(activeWhereForReq(req)).toEqual({ deletedAt: null });
  });

  it('يدمج حالات إضافية مع فلتر QUALITY_MANAGER العادي', () => {
    const req = makeReq('QUALITY_MANAGER', {});
    expect(activeWhereForReq(req, { status: 'NEW' })).toEqual({ deletedAt: null, status: 'NEW' });
  });
});
