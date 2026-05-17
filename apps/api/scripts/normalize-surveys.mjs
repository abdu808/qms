#!/usr/bin/env node
/**
 * Normalize existing survey question definitions to the current schema.
 *
 * Safe by default:
 *   node scripts/normalize-surveys.mjs          # dry-run
 *   node scripts/normalize-surveys.mjs --apply # update records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function normalizeQuestion(raw, idx) {
  const legacyScale = raw.scale || raw.max || raw.ratingScale;
  const type = String(raw.type || (legacyScale ? 'rating' : 'text')).toLowerCase();
  return {
    key: String(raw.key || raw.id || `q${idx + 1}`).trim(),
    label: String(raw.label || raw.text || raw.question || raw.q || raw.title || '').trim(),
    type: ['rating', 'yesno', 'text'].includes(type) ? type : 'text',
    required: raw.required === undefined ? !!legacyScale : !!raw.required,
  };
}

function normalizeQuestionsJson(rawJson) {
  let rows = [];
  try {
    rows = JSON.parse(rawJson || '[]');
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) rows = [];
  const used = new Set();
  return rows.map((q, idx) => {
    const normalized = normalizeQuestion(q || {}, idx);
    let key = normalized.key || `q${idx + 1}`;
    let suffix = 2;
    while (used.has(key)) {
      key = `${normalized.key || `q${idx + 1}`}_${suffix++}`;
    }
    used.add(key);
    return { ...normalized, key };
  }).filter(q => q.label);
}

async function main() {
  const surveys = await prisma.survey.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const changed = [];
  for (const survey of surveys) {
    const normalized = normalizeQuestionsJson(survey.questionsJson);
    const nextJson = JSON.stringify(normalized);
    if (nextJson !== survey.questionsJson) {
      changed.push({
        id: survey.id,
        code: survey.code,
        title: survey.title,
        questions: normalized.length,
      });
      if (APPLY) {
        await prisma.survey.update({
          where: { id: survey.id },
          data: { questionsJson: nextJson },
        });
      }
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    totalSurveys: surveys.length,
    changedSurveys: changed.length,
    changed,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
