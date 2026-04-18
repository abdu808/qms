import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from './asyncHandler.js';
import { NotFound, BadRequest } from './errors.js';
import { nextCode } from './codeGen.js';

/**
 * Generic CRUD router factory
 * opts: {
 *   model: 'objective',          // Prisma model name (lowercase)
 *   codePrefix: 'OBJ',           // auto-generate code
 *   searchFields: ['title'],     // for ?q=
 *   include: {},                 // prisma include
 *   beforeCreate: async (data, req) => data,
 *   beforeUpdate: async (data, req) => data,
 *   allowedSortFields: ['createdAt'],
 * }
 */
export function crudRouter(opts) {
  const {
    model, codePrefix, searchFields = [], include,
    beforeCreate, beforeUpdate, allowedSortFields = ['createdAt'],
    allowedFilters,   // قائمة بيضاء بالحقول المسموح بتصفيتها — undefined = الكل مسموح (legacy)
  } = opts;

  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    const page    = Math.max(1, Number(req.query.page) || 1);
    const limit   = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const q       = (req.query.q || '').toString().trim();
    const sort    = allowedSortFields.includes(req.query.sort) ? req.query.sort : 'createdAt';
    const order   = req.query.order === 'asc' ? 'asc' : 'desc';

    const where = {};
    if (q && searchFields.length) {
      where.OR = searchFields.map(f => ({ [f]: { contains: q, mode: 'insensitive' } }));
    }
    // filter by field: ?filter[status]=OPEN — only whitelisted fields accepted
    if (req.query.filter && typeof req.query.filter === 'object') {
      for (const [k, v] of Object.entries(req.query.filter)) {
        // إذا حُدِّدت قائمة بيضاء، اقبل الحقل فقط إن كان فيها
        if (allowedFilters && !allowedFilters.includes(k)) continue;
        where[k] = v;
      }
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

  router.get('/:id', asyncHandler(async (req, res) => {
    const item = await prisma[model].findUnique({
      where: { id: req.params.id }, include,
    });
    if (!item) throw NotFound();
    res.json({ ok: true, item });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    let data = { ...req.body };
    if (codePrefix && !data.code) {
      data.code = await nextCode(model, codePrefix);
    }
    if (beforeCreate) data = await beforeCreate(data, req);
    const item = await prisma[model].create({ data, include });
    res.status(201).json({ ok: true, item });
  }));

  // Protected fields that must never be updated via client payload
  const stripProtected = (data) => {
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.code;            // auto-generated sequential code
    delete data.createdById;     // creator ownership
    delete data.reporterId;      // NCR reporter
    delete data.evaluatorId;     // evaluation owner
    return data;
  };

  router.put('/:id', asyncHandler(async (req, res) => {
    let data = stripProtected({ ...req.body });
    if (beforeUpdate) data = await beforeUpdate(data, req);
    const item = await prisma[model].update({
      where: { id: req.params.id }, data, include,
    });
    res.json({ ok: true, item });
  }));

  router.patch('/:id', asyncHandler(async (req, res) => {
    let data = stripProtected({ ...req.body });
    if (beforeUpdate) data = await beforeUpdate(data, req);
    const item = await prisma[model].update({
      where: { id: req.params.id }, data, include,
    });
    res.json({ ok: true, item });
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    await prisma[model].delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }));

  return router;
}
