/**
 * axis-associations-report.mjs
 * تقرير ارتباطات المحاور — للقراءة فقط، لا يُعدِّل أي بيانات.
 *
 * node --env-file=.env apps/api/scripts/axis-associations-report.mjs
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });

const LINE = '─'.repeat(72);
const DLINE = '═'.repeat(72);

function pad(s, n) { return String(s ?? '').padEnd(n); }
function rpad(s, n) { return String(s ?? '').padStart(n); }

// ─────────────────────────────────────────────────────────────────────────────
// 1. الأهداف لكل محور
// ─────────────────────────────────────────────────────────────────────────────
const axes = await prisma.axis.findMany({
  orderBy: { order: 'asc' },
  include: {
    goals: {
      where: { deletedAt: null },
      select: {
        id: true, code: true, title: true, status: true,
        initiatives: { where: { deletedAt: null }, select: { id: true } },
        objectives:  { where: { deletedAt: null }, select: {
          id: true,
          kpiEntries: { select: { id: true } },
          indicators: { select: { id: true } },
        }},
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. الأهداف بدون محور
// ─────────────────────────────────────────────────────────────────────────────
const orphanGoals = await prisma.strategicGoal.findMany({
  where: { deletedAt: null, axisId: null },
  select: { id: true, code: true, title: true, status: true,
    initiatives: { where: { deletedAt: null }, select: { id: true } },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. المحاور محل الفحص الخاص (FINANCIAL, CUSTOMER, PROCESS, LEARNING, GOVERNANCE)
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_CODES = ['FINANCIAL','CUSTOMER','PROCESS','LEARNING','GOVERNANCE'];
const targetAxes = await prisma.axis.findMany({
  where: { code: { in: TARGET_CODES } },
  include: {
    goals: {
      where: { deletedAt: null },
      select: {
        id: true, code: true, title: true,
        initiatives: { where: { deletedAt: null }, select: { id: true } },
        objectives:  { where: { deletedAt: null }, select: {
          id: true,
          indicators: { select: { id: true } },
          kpiEntries: { select: { id: true } },
        }},
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRINT
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${DLINE}`);
console.log(`  تقرير ارتباطات المحاور  — للقراءة فقط  (${new Date().toISOString().slice(0,10)})`);
console.log(`${DLINE}\n`);

// ── §1 جميع المحاور ──────────────────────────────────────────────────────────
console.log('§1 — ملخص جميع المحاور\n');
console.log(
  pad('الكود',14) + pad('الاسم',28) +
  rpad('أهداف',7) + rpad('مبادرات',10) + rpad('مستخدم؟',10),
);
console.log(LINE);

for (const ax of axes) {
  const goalCount = ax.goals.length;
  const initCount = ax.goals.reduce((s, g) => s + g.initiatives.length, 0);
  const used = goalCount > 0 ? 'نعم ✅' : 'لا ❌';
  console.log(
    pad(ax.code,14) + pad(ax.nameAr,28) +
    rpad(goalCount,7) + rpad(initCount,10) + '   ' + used,
  );
}

if (orphanGoals.length) {
  console.log(pad('(بدون محور)',14) + pad('أهداف غير مرتبطة بمحور',28) +
    rpad(orphanGoals.length,7) + rpad(orphanGoals.reduce((s,g)=>s+g.initiatives.length,0),10) + '   —');
}

console.log(`\nإجمالي المحاور: ${axes.length} محور`);
console.log(`أهداف بدون محور: ${orphanGoals.length}\n`);

// ── §2 تفصيل الأهداف لكل محور ───────────────────────────────────────────────
console.log(`\n${LINE}`);
console.log('§2 — تفصيل الأهداف لكل محور\n');

for (const ax of axes) {
  if (!ax.goals.length) {
    console.log(`[${ax.code}] ${ax.nameAr} — لا توجد أهداف مرتبطة`);
    continue;
  }
  console.log(`[${ax.code}] ${ax.nameAr} — ${ax.goals.length} هدف:`);
  for (const g of ax.goals) {
    const objCount  = g.objectives.length;
    const initCount = g.initiatives.length;
    const indCount  = g.objectives.reduce((s,o) => s + o.indicators.length, 0);
    const kpiCount  = g.objectives.reduce((s,o) => s + o.kpiEntries.length, 0);
    console.log(`  • ${g.code} — ${g.title}`);
    console.log(`    [${g.status}] أهداف تشغيلية: ${objCount} · مبادرات: ${initCount} · مؤشرات: ${indCount} · إدخالات KPI: ${kpiCount}`);
  }
  console.log();
}

if (orphanGoals.length) {
  console.log('أهداف بدون محور (axisId = NULL):');
  for (const g of orphanGoals) {
    console.log(`  • ${g.code} — ${g.title} [${g.status}] مبادرات: ${g.initiatives.length}`);
  }
  console.log();
}

// ── §3 فحص محاور BSC الخمسة المستهدفة ──────────────────────────────────────
console.log(`\n${DLINE}`);
console.log('§3 — فحص محاور BSC المستهدفة (FINANCIAL/CUSTOMER/PROCESS/LEARNING/GOVERNANCE)\n');

for (const code of TARGET_CODES) {
  const ax = targetAxes.find(a => a.code === code);
  if (!ax) {
    console.log(`[${code}] ❌ المحور غير موجود في قاعدة البيانات\n`);
    continue;
  }

  const goalCount = ax.goals.length;
  const initCount = ax.goals.reduce((s,g) => s + g.initiatives.length, 0);
  const objCount  = ax.goals.reduce((s,g) => s + g.objectives.length, 0);
  const indCount  = ax.goals.reduce((s,g) => s + g.objectives.reduce((ss,o) => ss + o.indicators.length, 0), 0);
  const kpiCount  = ax.goals.reduce((s,g) => s + g.objectives.reduce((ss,o) => ss + o.kpiEntries.length, 0), 0);

  const safe = goalCount === 0 && initCount === 0 && objCount === 0 && indCount === 0;
  const verdict = safe ? '✅ آمن للحذف/التعطيل' : '⚠️  له ارتباطات — لا يُحذف';

  console.log(`[${code}] ${ax.nameAr}  →  ${verdict}`);
  console.log(`  أهداف استراتيجية مرتبطة : ${goalCount}`);
  console.log(`  أهداف تشغيلية (عبر أهداف): ${objCount}`);
  console.log(`  مبادرات (عبر أهداف)      : ${initCount}`);
  console.log(`  مؤشرات (عبر أهداف تشغيلية): ${indCount}`);
  console.log(`  إدخالات KPI              : ${kpiCount}`);
  if (goalCount > 0) {
    console.log('  الأهداف المرتبطة:');
    for (const g of ax.goals) console.log(`    → ${g.code} — ${g.title}`);
  }
  console.log();
}

// ── §4 ملخص القرار ───────────────────────────────────────────────────────────
console.log(`${DLINE}`);
console.log('§4 — ملخص القرار الموصى به\n');

const safeToDelete  = targetAxes.filter(ax => ax.goals.length === 0);
const hasLinks      = targetAxes.filter(ax => ax.goals.length > 0);
const notFound      = TARGET_CODES.filter(c => !targetAxes.find(a => a.code === c));

if (safeToDelete.length)
  console.log(`آمن للحذف/التعطيل (${safeToDelete.length}):  ${safeToDelete.map(a => a.code).join('  ')}`);
if (hasLinks.length)
  console.log(`له ارتباطات — يحتاج إعادة ربط أولاً (${hasLinks.length}):  ${hasLinks.map(a => a.code).join('  ')}`);
if (notFound.length)
  console.log(`غير موجود في DB (${notFound.length}):  ${notFound.join('  ')}`);

console.log(`\n${DLINE}\n`);

await prisma.$disconnect();
