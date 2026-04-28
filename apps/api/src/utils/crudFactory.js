import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from './asyncHandler.js';
import { NotFound, BadRequest, Forbidden } from './errors.js';
import { nextCode } from './codeGen.js';
import { can } from '../lib/permissions.js';
import { arabicSearchVariants } from './normalize.js';
import { runSchema } from '../schemas/_helpers.js';

/**
 * Generic CRUD router factory
 * opts: {
 *   model: 'objective',          // Prisma model name (camelCase for Prisma client)
 *   codePrefix: 'OBJ',           // auto-generate code
 *   searchFields: ['title'],     // for ?q=
 *   include: {},                 // prisma include
 *   beforeCreate: async (data, req) => data,
 *   beforeUpdate: async (data, req) => data,
 *   allowedSortFields: ['createdAt'],
 *   allowedFilters: ['status',..],
 *   resource: 'objectives',      // matrix key for RBAC gating on mutations
 *   softDelete: true,            // set to false for models that lack `deletedAt`
 * }
 */
export function crudRouter(opts) {
  const {
    model, codePrefix, searchFields = [], include,
    beforeCreate, beforeUpdate, afterCreate, afterUpdate, afterDelete,
    allowedSortFields = ['createdAt'],
    allowedFilters,
    resource,
    softDelete = true,   // default: soft-delete if the model has `deletedAt`
    // Smart filter chips — map of { key: (req, where) => where-patch | null }
    // Exposed via ?quick=<key>. Each function may return a partial where or mutate.
    smartFilters,
    // Role-based scope: (req) => Prisma where patch — always applied on LIST and READ.
    // مثال: DEPT_MANAGER يرى فقط بيانات قسمه، EMPLOYEE يرى بياناته فقط.
    scopeFilter,
    // Zod schemas موحّدة (المرحلة 2 — طبقة تحقق رسمية).
    // { create?, update? } — يُنفَّذ قبل beforeCreate/beforeUpdate.
    schemas,
    // Field-Level Security: حقول مقفولة لأدوار محددة على UPDATE.
    // مثال: { DEPT_MANAGER: ['title','target'], EMPLOYEE: ['title'] }
    // إذا حاول الدور تعديل حقل مقفل، يُحذف بصمت من الـ payload قبل التحقق.
    lockedFieldsForRole,
    // Plan Freeze enforcement: دالة (entityId) => planId | null
    // إذا الكيان ينتمي لخطة مُجمَّدة، يُمنع تعديل master data ويُسمح فقط بـ progress/status/notes
    // مثال: enforceFreezeFor: async (id, prisma) => { const x = await prisma.objective.findUnique({ where:{id}, select:{ strategicGoal:{ select:{ planId: true } } } }); return x?.strategicGoal?.planId; }
    enforceFreezeFor,
    // الحقول المسموحة في حالة plan مُجمَّدة (transaction data)
    // مثال: ['progress','currentValue','status','notes','spent']
    transactionFields,
  } = opts;

  const createValidator = schemas?.create ? runSchema(schemas.create) : null;
  const updateValidator = schemas?.update ? runSchema(schemas.update) : null;

  const router = Router();

  // ── RBAC gate ────────────────────────────────────────────────────
  const gate = (action) => (req, res, next) => {
    if (!resource) return next();
    if (!can(req.user, resource, action)) {
      return next(Forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء على هذا المورد'));
    }
    next();
  };

  // ── Soft-delete visibility helper ────────────────────────────────
  // Adds `deletedAt: null` to every read query unless:
  //   - softDelete is disabled for this router, OR
  //   - caller passes ?includeDeleted=1 AND is QM/SA (else silently ignored)
  //   - caller passes ?onlyDeleted=1 AND is QM/SA
  const applyDeleteFilter = (where, req) => {
    if (!softDelete) return where;
    const role = req.user?.role;
    const privileged = role === 'SUPER_ADMIN' || role === 'QUALITY_MANAGER';
    if (privileged && req.query.onlyDeleted === '1') {
      where.deletedAt = { not: null };
    } else if (privileged && req.query.includeDeleted === '1') {
      // no filter — include both
    } else {
      where.deletedAt = null;
    }
    return where;
  };

  // ── LIST ─────────────────────────────────────────────────────────
  router.get('/', asyncHandler(async (req, res) => {
    const page    = Math.max(1, Number(req.query.page) || 1);
    const limit   = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const q       = (req.query.q || '').toString().trim();
    const sort    = allowedSortFields.includes(req.query.sort) ? req.query.sort : 'createdAt';
    const order   = req.query.order === 'asc' ? 'asc' : 'desc';

    let where = {};
    if (q && searchFields.length) {
      // Arabic-aware search: expand query into variant forms (alef/yaa/taa-marbuta)
      // and OR them across all searchable fields. See utils/normalize.js.
      const variants = arabicSearchVariants(q);
      where.OR = searchFields.flatMap(f =>
        variants.map(v => ({ [f]: { contains: v, mode: 'insensitive' } })),
      );
    }
    if (req.query.filter && typeof req.query.filter === 'object') {
      for (const [k, v] of Object.entries(req.query.filter)) {
        if (allowedFilters && !allowedFilters.includes(k)) continue;
        // Coerce numeric-looking strings to integers (e.g. filter[year]="2026" → 2026)
        where[k] = /^\d+$/.test(v) ? Number(v) : v;
      }
    }
    // Smart filter chips: ?quick=<key> — merge partial where
    if (smartFilters && req.query.quick) {
      const keys = String(req.query.quick).split(',').filter(Boolean);
      for (const key of keys) {
        const fn = smartFilters[key];
        if (typeof fn === 'function') {
          const patch = fn(req, where) || {};
          Object.assign(where, patch);
        }
      }
    }
    where = applyDeleteFilter(where, req);
    // Role-based scope (DEPT_MANAGER / EMPLOYEE)
    if (scopeFilter) {
      const patch = scopeFilter(req);
      if (patch && Object.keys(patch).length) Object.assign(where, patch);
    }

    const [total, items] = await Promise.all([
      prisma[model].count({ where }),
      prisma[model].findMany({
        where, include,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit, take: limit,
      }),
    ]);

    res.json({ ok: true, total, page, limit, items });
  }));

  // ── READ ─────────────────────────────────────────────────────────
  router.get('/:id', asyncHandler(async (req, res) => {
    let scopeWhere = {};
    if (scopeFilter) {
      const patch = scopeFilter(req);
      if (patch && Object.keys(patch).length) scopeWhere = patch;
    }
    // Use findFirst so scopeFilter can be merged into the where clause
    const item = await prisma[model].findFirst({
      where: { id: req.params.id, ...scopeWhere }, include,
    });
    if (!item) throw NotFound();
    // Hide soft-deleted unless privileged caller explicitly asks
    if (softDelete && item.deletedAt) {
      const role = req.user?.role;
      const privileged = role === 'SUPER_ADMIN' || role === 'QUALITY_MANAGER';
      if (!privileged || req.query.includeDeleted !== '1') throw NotFound();
    }
    res.json({ ok: true, item });
  }));

  // ── CREATE ───────────────────────────────────────────────────────
  // nextCode() يقرأ آخر code ثم يزيد +1 — سباق إذا وصل طلبان متزامنان
  // (أو نقرة "حفظ" مضاعفة من المستخدم). لذلك نعيد المحاولة حتى 5 مرات
  // عندما يرجع Prisma P2002 على حقل `code` فقط.
  router.post('/', gate('create'), asyncHandler(async (req, res) => {
    let data = { ...req.body };
    if (createValidator) data = createValidator(data, req);
    if (beforeCreate) data = await beforeCreate(data, req);

    let item;
    const hadClientCode = !!data.code;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    // نحتفظ بنسخة أصلية لأن beforeCreate قد يضيف حقولاً؛ لا نعيد تشغيله
    const baseData = { ...data };
    while (true) {
      attempts++;
      try {
        const payload = { ...baseData };
        if (codePrefix && !hadClientCode) {
          payload.code = await nextCode(model, codePrefix);
        }
        item = await prisma[model].create({ data: payload, include });
        break;
      } catch (err) {
        const target = err?.meta?.target;
        const hitsCode = Array.isArray(target)
          ? target.includes('code')
          : String(target || '').includes('code');
        const isCodeRace = err?.code === 'P2002' && !hadClientCode && hitsCode;
        if (isCodeRace && attempts < MAX_ATTEMPTS) continue;
        throw err;
      }
    }

    if (afterCreate) { await afterCreate(item, req); }
    res.status(201).json({ ok: true, item });
  }));

  // Protected fields that must never be updated via client payload
  const stripProtected = (data) => {
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.deletedAt;       // soft-delete managed only by DELETE/restore
    delete data.code;
    delete data.createdById;
    delete data.reporterId;
    delete data.evaluatorId;
    return data;
  };

  // ── Plan Freeze enforcement helper ────────────────────────────────
  // يفحص: إذا الكيان ينتمي لخطة مُجمَّدة، يحذف master data fields من الـ payload
  // ويُبقي فقط transaction data (progress, status, notes...).
  // SUPER_ADMIN معفى — يستطيع تعديل خطة مُجمَّدة عند الطوارئ.
  const enforceFreezeIfNeeded = async (data, entityId, req) => {
    if (!enforceFreezeFor) return data;
    if (req.user?.role === 'SUPER_ADMIN') return data;  // SA bypass
    const planId = await enforceFreezeFor(entityId, prisma);
    if (!planId) return data;
    const plan = await prisma.strategicPlan.findUnique({
      where: { id: planId },
      select: { frozenAt: true, code: true },
    });
    if (!plan?.frozenAt) return data;
    // الخطة مُجمَّدة: احتفظ فقط بـ transaction fields
    if (transactionFields && Array.isArray(transactionFields)) {
      const allowed = new Set(transactionFields);
      const filtered = {};
      const blocked = [];
      for (const k of Object.keys(data)) {
        if (allowed.has(k)) filtered[k] = data[k];
        else blocked.push(k);
      }
      if (blocked.length > 0) {
        // أضِف ملاحظة في الاستجابة (req.freezeBlockedFields) للعرض في الـ UI لاحقاً
        req.freezeBlockedFields = blocked;
      }
      return filtered;
    }
    // لو لم تُحدَّد transactionFields، ارفض كل التعديل
    const { Forbidden } = await import('./errors.js');
    throw Forbidden(`الخطة ${plan.code} مُجمَّدة — استخدم "طلب تعديل" لتعديل البيانات الحاكمة`);
  };

  // ── UPDATE ───────────────────────────────────────────────────────
  router.put('/:id', gate('update'), asyncHandler(async (req, res) => {
    let data = stripProtected({ ...req.body });
    // Field-Level Security: حذف الحقول المقفولة للدور قبل الـ validate
    if (lockedFieldsForRole && req.user?.role) {
      const lockedFields = lockedFieldsForRole[req.user.role];
      if (Array.isArray(lockedFields)) {
        for (const field of lockedFields) {
          if (field in data) delete data[field];
        }
      }
    }
    // Plan Freeze enforcement
    data = await enforceFreezeIfNeeded(data, req.params.id, req);
    if (updateValidator) data = updateValidator(data, req);
    if (beforeUpdate) data = await beforeUpdate(data, req);
    // Optimistic locking: if beforeUpdate sets __expectedVersion, use it as a where guard.
    const expectedVersion = data.__expectedVersion;
    delete data.__expectedVersion;
    const where = expectedVersion != null
      ? { id: req.params.id, version: expectedVersion }
      : { id: req.params.id };
    const finalData = expectedVersion != null
      ? { ...data, version: { increment: 1 } }
      : data;
    let item;
    try {
      item = await prisma[model].update({ where, data: finalData, include });
    } catch (err) {
      if (err?.code === 'P2025' && expectedVersion != null) {
        const { Conflict } = await import('./errors.js');
        throw Conflict('تغيّرت البيانات من طرف آخر — أعد التحميل وحاول مجدداً');
      }
      throw err;
    }
    if (afterUpdate) { await afterUpdate(item, req); }
    res.json({ ok: true, item });
  }));

  router.patch('/:id', gate('update'), asyncHandler(async (req, res) => {
    let data = stripProtected({ ...req.body });
    // Field-Level Security: حذف الحقول المقفولة للدور قبل الـ validate
    if (lockedFieldsForRole && req.user?.role) {
      const lockedFields = lockedFieldsForRole[req.user.role];
      if (Array.isArray(lockedFields)) {
        for (const field of lockedFields) {
          if (field in data) delete data[field];
        }
      }
    }
    // Plan Freeze enforcement
    data = await enforceFreezeIfNeeded(data, req.params.id, req);
    if (updateValidator) data = updateValidator(data, req);
    if (beforeUpdate) data = await beforeUpdate(data, req);
    // Optimistic locking: if beforeUpdate sets __expectedVersion, use it as a where guard.
    const expectedVersion = data.__expectedVersion;
    delete data.__expectedVersion;
    const where = expectedVersion != null
      ? { id: req.params.id, version: expectedVersion }
      : { id: req.params.id };
    const finalData = expectedVersion != null
      ? { ...data, version: { increment: 1 } }
      : data;
    let item;
    try {
      item = await prisma[model].update({ where, data: finalData, include });
    } catch (err) {
      if (err?.code === 'P2025' && expectedVersion != null) {
        const { Conflict } = await import('./errors.js');
        throw Conflict('تغيّرت البيانات من طرف آخر — أعد التحميل وحاول مجدداً');
      }
      throw err;
    }
    if (afterUpdate) { await afterUpdate(item, req); }
    res.json({ ok: true, item });
  }));

  // ── DELETE (soft by default) ─────────────────────────────────────
  router.delete('/:id', gate('delete'), asyncHandler(async (req, res) => {
    let snapshot = null;
    if (afterDelete) {
      try { snapshot = await prisma[model].findUnique({ where: { id: req.params.id } }); } catch (e) { console.error('[crud] snapshot fetch failed:', e.message); }
    }
    if (softDelete) {
      await prisma[model].update({
        where: { id: req.params.id },
        data:  { deletedAt: new Date() },
      });
    } else {
      await prisma[model].delete({ where: { id: req.params.id } });
    }
    if (afterDelete && snapshot) { await afterDelete(snapshot, req); }
    res.json({ ok: true });
  }));

  // ── RESTORE (only if soft-delete enabled) ────────────────────────
  if (softDelete) {
    router.post('/:id/restore', gate('delete'), asyncHandler(async (req, res) => {
      const item = await prisma[model].update({
        where: { id: req.params.id },
        data:  { deletedAt: null },
        include,
      });
      res.json({ ok: true, item });
    }));

    // Hard-purge — SUPER_ADMIN only (bypasses soft-delete completely).
    // Use when truly needed (GDPR right-to-erasure, duplicate cleanup, etc.).
    router.delete('/:id/purge', asyncHandler(async (req, res, next) => {
      if (req.user?.role !== 'SUPER_ADMIN') {
        return next(Forbidden('الحذف النهائي يتطلب صلاحية المدير الأعلى'));
      }
      await prisma[model].delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }));
  }

  return router;
}
