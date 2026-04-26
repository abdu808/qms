#!/usr/bin/env node
/**
 * scripts/migrate-to-indicators.mjs
 *
 * ترحيل بيانات: كل Objective ذو kpi IS NOT NULL → Indicator جديد
 *
 * المنطق:
 *  1. لكل Objective حيث kpi IS NOT NULL:
 *  2. تحقق من idempotency — إذا يوجد Indicator.objectiveId = obj.id بالفعل → تخطّ
 *  3. أنشئ Indicator بـ: nameAr=obj.kpi, kpiType, seasonality, direction, baseline, unit
 *  4. اجمع سنوات KpiEntry للـ objective، أنشئ AnnualTarget بـ targetValue=obj.target لكل سنة
 *  5. حدّث KpiEntry.indicatorId لكل entry تخص هذا objective
 *  6. نفّذ كل هذا داخل prisma.$transaction لكل objective
 *
 * الاستخدام:
 *   node scripts/migrate-to-indicators.mjs [--dry-run] [--limit=N] [--objective-id=CUID]
 *
 * Flags:
 *   --dry-run        قراءة فقط — اطبع ما سيحدث بدون تنفيذ
 *   --limit=N        حدّد عدد Objectives لمعالجتها (للاختبار)
 *   --objective-id=  معالج objective واحد فقط (للتدقيق)
 *
 * PREREQUISITE قبل تطبيق CHECK constraint (009):
 *   SELECT COUNT(*) FROM "KpiEntry"
 *   WHERE "objectiveId" IS NULL AND "activityId" IS NULL AND "indicatorId" IS NULL;
 *   يجب أن يرجع 0 (لا صفوف يتيمة).
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ── رموز بسيطة بدون codeGen (مستقل عن السيرفر) ─────────────────────────────
let _codeSeq = 1;
async function nextIndicatorCode() {
  // ابحث عن آخر IND code في قاعدة البيانات
  const last = await prisma.indicator.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });
  if (last?.code) {
    const m = last.code.match(/(\d+)$/);
    if (m) _codeSeq = parseInt(m[1]) + 1;
  }
  const year = new Date().getFullYear();
  const code = `IND-${year}-${String(_codeSeq++).padStart(3, '0')}`;
  return code;
}

function cuid() {
  return 'c' + randomBytes(16).toString('hex');
}

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const LIMIT_ARG  = args.find(a => a.startsWith('--limit='));
const OBJ_ID_ARG = args.find(a => a.startsWith('--objective-id='));
const LIMIT      = LIMIT_ARG  ? parseInt(LIMIT_ARG.split('=')[1])  : undefined;
const TARGET_OBJ = OBJ_ID_ARG ? OBJ_ID_ARG.split('=')[1]          : undefined;

if (DRY_RUN) console.log('🔍 DRY RUN — لا تغييرات ستُحفظ\n');

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // جلب Objectives المرشحة للترحيل
  const where = {
    kpi: { not: null },
    ...(TARGET_OBJ ? { id: TARGET_OBJ } : {}),
  };

  const objectives = await prisma.objective.findMany({
    where,
    take: LIMIT,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, code: true, kpi: true, target: true, baseline: true, unit: true,
      kpiType: true, seasonality: true, direction: true, ownerId: true,
    },
  });

  console.log(`📦 وُجد ${objectives.length} Objective بـ kpi محدد`);
  if (!objectives.length) { console.log('لا شيء للترحيل.'); return; }

  let created = 0, skipped = 0, errors = 0;

  for (const obj of objectives) {
    // idempotency — هل يوجد Indicator لهذا objective بالفعل؟
    const existing = await prisma.indicator.findFirst({
      where: { objectiveId: obj.id },
      select: { id: true, code: true },
    });
    if (existing) {
      console.log(`⏭️  تخطي ${obj.code}: Indicator موجود بالفعل (${existing.code})`);
      skipped++;
      continue;
    }

    // جمع سنوات KpiEntry لهذا objective
    const kpiYears = await prisma.kpiEntry.findMany({
      where: { objectiveId: obj.id },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'asc' },
    });
    const years = kpiYears.map(r => r.year);

    const code = await nextIndicatorCode();

    console.log(`\n🔄 ${obj.code} → Indicator ${code}`);
    console.log(`   kpi: "${obj.kpi}"`);
    console.log(`   target: ${obj.target}, baseline: ${obj.baseline}, unit: ${obj.unit}`);
    console.log(`   kpiEntries years: [${years.join(', ')}]`);

    if (DRY_RUN) {
      console.log(`   [DRY-RUN] سيُنشئ Indicator + ${years.length} AnnualTarget + يُحدّث KpiEntries`);
      created++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. إنشاء Indicator
        const indicator = await tx.indicator.create({
          data: {
            id: cuid(),
            code,
            nameAr:        obj.kpi,
            direction:     obj.direction   || 'HIGHER_BETTER',
            frequency:     'MONTHLY',
            kpiType:       obj.kpiType     || 'SNAPSHOT',
            seasonality:   obj.seasonality || 'UNIFORM',
            indicatorType: 'LAGGING',
            weight:        0,
            greenThreshold:  95,
            yellowThreshold: 75,
            baseline:      obj.baseline ?? null,
            unit:          obj.unit    ?? null,
            objectiveId:   obj.id,
            ownerId:       obj.ownerId ?? null,
          },
        });

        console.log(`   ✅ Indicator إنشاء: ${indicator.id}`);

        // 2. AnnualTargets لكل سنة (إذا وُجد target على objective)
        if (obj.target && years.length) {
          for (const year of years) {
            // استخدم obj.target كمستهدف سنوي (يمكن مراجعته لاحقاً)
            await tx.annualTarget.upsert({
              where: { indicatorId_year: { indicatorId: indicator.id, year } },
              create: {
                id: cuid(),
                indicatorId:  indicator.id,
                year,
                targetValue:  Number(obj.target),
                // createdById يتطلب مستخدماً — نستخدم أول QUALITY_MANAGER
                createdById: await getSystemUserId(tx),
              },
              update: {},  // لا تعديل عند التكرار
            });
          }
          console.log(`   ✅ AnnualTargets: ${years.length} سنة`);
        }

        // 3. تحديث KpiEntry.indicatorId
        const updated = await tx.kpiEntry.updateMany({
          where: { objectiveId: obj.id, indicatorId: null },
          data: { indicatorId: indicator.id },
        });
        console.log(`   ✅ KpiEntries محدَّثة: ${updated.count}`);
      });

      created++;
    } catch (err) {
      console.error(`   ❌ خطأ في ${obj.code}:`, err.message);
      errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ مُنشأ:   ${created}`);
  console.log(`⏭️  متخطى:  ${skipped}`);
  if (errors) console.log(`❌ أخطاء:  ${errors}`);
  if (DRY_RUN) console.log('\n🔍 DRY RUN — لم يُحفظ أي شيء. أزل --dry-run للتطبيق الفعلي.');

  if (!DRY_RUN && created > 0) {
    console.log('\n📋 الخطوة التالية:');
    console.log('   تحقق من عدم وجود KpiEntry يتيم:');
    console.log('   SELECT COUNT(*) FROM "KpiEntry"');
    console.log('   WHERE "objectiveId" IS NULL AND "activityId" IS NULL AND "indicatorId" IS NULL;');
    console.log('   يجب أن يرجع 0، ثم طبّق 009_kpientry_fk_check.sql');
  }
}

// ── مساعدة: أول مستخدم QUALITY_MANAGER للـ createdById ──────────────────────
let _systemUserId = null;
async function getSystemUserId(tx) {
  if (_systemUserId) return _systemUserId;
  const qm = await tx.user.findFirst({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!qm) throw new Error('لا يوجد مستخدم QUALITY_MANAGER في قاعدة البيانات');
  _systemUserId = qm.id;
  return _systemUserId;
}

main()
  .catch(e => { console.error('خطأ فادح:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
