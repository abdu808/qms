import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest } from '../utils/errors.js';

const router = Router();

const preferenceSchemas = {
  favorites: z.array(z.string().min(1).max(80)).max(80),
  collapsed_groups: z.array(z.string().min(1).max(80)).max(80),
  wizard_done: z.boolean(),
  mode: z.enum(['guided', 'advanced']),
  swot_view_mode: z.enum(['matrix', 'list']),
};

const payloadSchema = z.object({
  preferences: z.record(z.unknown()),
});

function userId(req) {
  return req.user?.id || req.user?.sub;
}

function parsePreference(row) {
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function validatePreferences(input) {
  const result = {};
  for (const [key, value] of Object.entries(input || {})) {
    const schema = preferenceSchemas[key];
    if (!schema) throw BadRequest(`Unsupported preference key: ${key}`);
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw BadRequest(`Invalid preference value for: ${key}`);
    result[key] = parsed.data;
  }
  return result;
}

router.get('/', asyncHandler(async (req, res) => {
  const uid = userId(req);
  const rows = await prisma.userPreference.findMany({
    where: { userId: uid },
    select: { key: true, value: true, updatedAt: true },
    orderBy: { key: 'asc' },
  });

  const preferences = {};
  const updatedAt = {};
  for (const row of rows) {
    if (!preferenceSchemas[row.key]) continue;
    preferences[row.key] = parsePreference(row);
    updatedAt[row.key] = row.updatedAt;
  }

  res.json({ ok: true, preferences, updatedAt });
}));

router.put('/', asyncHandler(async (req, res) => {
  const uid = userId(req);
  const body = payloadSchema.safeParse(req.body || {});
  if (!body.success) throw BadRequest('Invalid preferences payload');

  const preferences = validatePreferences(body.data.preferences);
  const entries = Object.entries(preferences);

  await prisma.$transaction(entries.map(([key, value]) => (
    prisma.userPreference.upsert({
      where: { userId_key: { userId: uid, key } },
      create: { userId: uid, key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    })
  )));

  res.json({ ok: true, preferences });
}));

export default router;
