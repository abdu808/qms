#!/usr/bin/env node
/**
 * check-schemas.js — حارس CI يتأكد أن كل مسار يستعمل crudRouter
 * يمرّر إليه `schemas: { create, update }`. بدون سكيما، Zod لا يعمل،
 * وأي حقل ضار يمرّ إلى Prisma (سبب نصف الـ 500 اللي قابلناها).
 *
 * استعمل: `node scripts/check-schemas.js`
 * يخرج بكود 1 إذا وجد route بدون schemas (فيه allowlist مؤقت للـ legacy routes).
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = join(__dirname, '..', 'src', 'routes');

// قائمة بيضاء مؤقتة: routes شرعية بدون crudRouter schemas (مثلاً workflow فقط).
// تُفرَّغ تدريجياً بإضافة schemas لكل route. لا تضف مسار جديد هنا — أضف schema.
const LEGACY_ALLOW = new Set([
  'ackDocuments.js',
  'communication.js',
  'competence.js',
  'departments.js',
  'donationEvals.js',
  'improvementProjects.js',
  'interestedParties.js',
  'operationalActivities.js',
  'performanceReviews.js',
  'processes.js',
  'programs.js',
  'qualityPolicy.js',
  'strategicGoals.js',
  'supplierEvals.js',
  'swot.js',
  'training.js',
  'auditChecklists.js', // يطبّق تحقق مخصص في normalize() بدلاً من schemas
]);

const files = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
const offenders = [];

for (const file of files) {
  const src = readFileSync(join(ROUTES_DIR, file), 'utf8');
  if (!/\bcrudRouter\s*\(/.test(src)) continue;        // not using factory
  if (/schemas\s*:\s*\{/.test(src)) continue;          // already wired
  if (LEGACY_ALLOW.has(file)) continue;                // known, tracked
  offenders.push(file);
}

if (offenders.length) {
  console.error('❌ Routes use crudRouter without schemas (new-route regression):\n');
  for (const f of offenders) console.error('  - apps/api/src/routes/' + f);
  console.error('\nAdd `schemas: { create, update }` to the crudRouter() config,');
  console.error('or add the file to LEGACY_ALLOW if you cannot yet.');
  process.exit(1);
}

console.log(`✓ schema-check: ${files.length} route files scanned, 0 regressions.`);
console.log(`  (${LEGACY_ALLOW.size} legacy routes tracked for follow-up.)`);
