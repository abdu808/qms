#!/usr/bin/env node
/**
 * migrate-perspective-to-axis.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA-002 Phase 1 — يربط StrategicGoal.axisId بناءً على perspective النصي
 *
 * الاستخدام:
 *   node apps/api/scripts/migrate-perspective-to-axis.mjs --dry-run   # معاينة فقط
 *   node apps/api/scripts/migrate-perspective-to-axis.mjs             # تنفيذ فعلي
 *
 * الضمانات:
 *   - لا يحذف perspective
 *   - لا يعدّل أهداف لديها axisId مسبقاً
 *   - idempotent: تشغيل مرتين لا يكرر ولا يغير المربوط مسبقاً
 *   - يدعم --dry-run للمعاينة الآمنة
 *   - يطبع تقريراً كاملاً في كلا الوضعين
 *
 * تتطلب تشغيل seed-axis.mjs أولاً لإنشاء سجلات Axis.
 */
import { PrismaClient } from '@prisma/client';

const prisma   = new PrismaClient({ log: ['warn', 'error'] });
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');

// ─── Mapping: قيمة perspective النصية → code محور Axis ───────────────────────
// يقبل القيم الإنجليزية (الموجودة في DB حالياً) والعربية (للاستيراد القديم)
export const PERSPECTIVE_TO_AXIS_CODE = {
  // English enum values (stored in current DB)
  'FINANCIAL':   'FINANCIAL',
  'CUSTOMER':    'CUSTOMER',
  'PROCESS':     'PROCESS',
  'LEARNING':    'LEARNING',
  'GOVERNANCE':  'GOVERNANCE',

  // Arabic aliases (from legacy import/seed data)
  'مالي':                      'FINANCIAL',
  'مالي واستدامي':             'FINANCIAL',
  'المالي':                    'FINANCIAL',
  'المالي واستدامي':           'FINANCIAL',
  'مستفيدون':                  'CUSTOMER',
  'المستفيدون':                'CUSTOMER',
  'المستفيدون والمجتمع':       'CUSTOMER',
  'عمليات':                    'PROCESS',
  'عمليات داخلية':             'PROCESS',
  'العمليات الداخلية':         'PROCESS',
  'تعلم':                      'LEARNING',
  'تعلم ونمو':                 'LEARNING',
  'التعلم والنمو':             'LEARNING',
  'حوكمة':                     'GOVERNANCE',
  'حوكمة وامتثال':             'GOVERNANCE',
  'الحوكمة والامتثال':        'GOVERNANCE',
};

async function main() {
  const mode = DRY_RUN ? '🔍 DRY-RUN (معاينة فقط — لا تغيير فعلي)' : '⚡ LIVE (تنفيذ فعلي)';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   migrate-perspective-to-axis — DATA-002 Phase 1         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  الوضع:    ${mode}`);
  console.log(`  التاريخ:  ${new Date().toISOString()}\n`);

  // ─── 1. تحقق من وجود محاور Axis ──────────────────────────────────────────
  const axes = await prisma.axis.findMany({ where: { deletedAt: null } });
  if (axes.length === 0) {
    console.error('❌ لا توجد محاور Axis في قاعدة البيانات.');
    console.error('   شغّل أولاً: node apps/api/scripts/seed-axis.mjs');
    process.exit(1);
  }

  // بناء خريطة code → id
  const axisCodeToId = Object.fromEntries(axes.map(a => [a.code, a.id]));

  // ─── 2. جلب الأهداف المرشحة للترحيل ──────────────────────────────────────
  const [totalGoals, goalsWithPerspective, goalsWithAxis] = await Promise.all([
    prisma.strategicGoal.count({ where: { deletedAt: null } }),
    prisma.strategicGoal.count({ where: { deletedAt: null, perspective: { not: null } } }),
    prisma.strategicGoal.count({ where: { deletedAt: null, axisId: { not: null } } }),
  ]);

  // الأهداف التي تحتاج ترحيل: لديها perspective وليس لديها axisId
  const candidates = await prisma.strategicGoal.findMany({
    where: { deletedAt: null, perspective: { not: null }, axisId: null },
    select: { id: true, code: true, title: true, perspective: true },
  });

  console.log('─── حالة البيانات قبل الترحيل ───');
  console.log(`  الأهداف الكلية:              ${totalGoals}`);
  console.log(`  لديها perspective:           ${goalsWithPerspective}`);
  console.log(`  لديها axisId (مربوطة):       ${goalsWithAxis}`);
  console.log(`  مرشحة للترحيل:              ${candidates.length}`);
  console.log('');

  if (candidates.length === 0) {
    console.log('  ✅ لا توجد أهداف تحتاج ترحيل — جميع الأهداف مربوطة مسبقاً أو بلا perspective.');
    await summarize(totalGoals, goalsWithPerspective, goalsWithAxis, 0, 0, 0, 0);
    return;
  }

  // ─── 3. تصنيف المرشحين ────────────────────────────────────────────────────
  const toMigrate       = [];  // { goal, targetAxisId }
  const unknownPersp    = [];  // { goal, perspective }

  for (const goal of candidates) {
    const axisCode = PERSPECTIVE_TO_AXIS_CODE[goal.perspective?.trim()];
    if (!axisCode) {
      unknownPersp.push({ goal, perspective: goal.perspective });
      continue;
    }
    const axisId = axisCodeToId[axisCode];
    if (!axisId) {
      // الكود معروف في الـ mapping لكن ليس في DB (Axis غير مُنشأ)
      unknownPersp.push({ goal, perspective: goal.perspective });
      continue;
    }
    toMigrate.push({ goal, targetAxisId: axisId, axisCode });
  }

  // ─── 4. طباعة تفاصيل ما سيحدث ────────────────────────────────────────────
  console.log('─── تفاصيل الترحيل ───');
  for (const { goal, axisCode, targetAxisId } of toMigrate) {
    const axisName = axes.find(a => a.id === targetAxisId)?.nameAr || axisCode;
    const status = DRY_RUN ? '  [DRY]' : '  ✅';
    console.log(`${status} ${goal.code} | perspective="${goal.perspective}" → axis="${axisName}" (${axisCode})`);
  }

  if (unknownPersp.length > 0) {
    console.log('\n─── perspective غير معروف (لن يُرحَّل) ───');
    for (const { goal, perspective } of unknownPersp) {
      console.log(`  ⚠️  ${goal.code} | perspective="${perspective}" — لا يوجد mapping`);
    }
  }

  // ─── 5. تنفيذ الترحيل (إذا لم يكن dry-run) ───────────────────────────────
  let migrated = 0;
  if (!DRY_RUN && toMigrate.length > 0) {
    console.log('\n─── تنفيذ الترحيل ───');
    await prisma.$transaction(async (tx) => {
      for (const { goal, targetAxisId } of toMigrate) {
        await tx.strategicGoal.update({
          where: { id: goal.id },
          data:  { axisId: targetAxisId },
        });
        migrated++;
      }
    });
    console.log(`  ✅ تم ترحيل ${migrated} هدف/أهداف بنجاح داخل transaction.`);
  }

  // ─── 6. التحقق بعد التنفيذ ────────────────────────────────────────────────
  const goalsWithAxisAfter = DRY_RUN
    ? goalsWithAxis + toMigrate.length   // تقدير للـ dry-run
    : await prisma.strategicGoal.count({ where: { deletedAt: null, axisId: { not: null } } });

  await summarize(
    totalGoals,
    goalsWithPerspective,
    goalsWithAxis,
    DRY_RUN ? toMigrate.length : migrated,
    candidates.length - toMigrate.length,  // skipped (لديها axisId مسبقاً — صفر هنا لأننا فلترنا)
    unknownPersp.length,
    goalsWithAxisAfter,
  );
}

async function summarize(total, withPersp, withAxisBefore, migrated, skipped, unknown, withAxisAfter) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  تقرير الترحيل النهائي');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  total goals               ${total}`);
  console.log(`  with perspective          ${withPersp}`);
  console.log(`  with axisId (قبل)         ${withAxisBefore}`);
  console.log(`  migrated                  ${migrated}`);
  console.log(`  skipped (axisId موجود)    ${skipped}`);
  console.log(`  unknownPerspective        ${unknown}`);
  console.log(`  with axisId (بعد)         ${withAxisAfter}`);
  console.log('───────────────────────────────────────────────────');

  if (DRY_RUN) {
    console.log('\n  🔍 DRY-RUN — لم يُنفَّذ أي تغيير فعلي.');
    console.log('  لتطبيق الترحيل: node apps/api/scripts/migrate-perspective-to-axis.mjs\n');
  } else {
    const allLinked = withAxisAfter === withPersp;
    if (allLinked) {
      console.log('\n  ✅ جميع الأهداف ذات perspective مربوطة الآن بمحور Axis.\n');
    } else if (unknown > 0) {
      console.log(`\n  ⚠️  ${unknown} هدف/أهداف بـ perspective غير معروف تبقّت بدون axisId.`);
      console.log('     راجع تفاصيل unknownPerspective أعلاه وأضف mapping يدوياً.\n');
    }
  }
}

main()
  .catch(e => {
    console.error('❌ فشل migrate-perspective-to-axis:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
