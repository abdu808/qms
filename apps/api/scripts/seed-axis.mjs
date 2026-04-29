#!/usr/bin/env node
/**
 * seed-axis.mjs — seed المحاور الاستراتيجية الأساسية (BSC)
 *
 * الاستخدام:
 *   node apps/api/scripts/seed-axis.mjs
 *
 * الخصائص:
 *   - Idempotent: يتخطى المحاور الموجودة مسبقاً (مقارنة بـ code)
 *   - لا يحذف أي محاور موجودة
 *   - آمن للتشغيل المتكرر
 *
 * DATA-002 Phase 1 — يُشغَّل قبل migrate-perspective-to-axis.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─── تعريف المحاور الأساسية ────────────────────────────────────────────────
// code يجب أن يطابق مفاتيح PERSPECTIVE_TO_AXIS_CODE في سكربت الترحيل
const AXES = [
  {
    code:   'FINANCIAL',
    nameAr: 'المالي والاستدامة المالية',
    nameEn: 'Financial & Sustainability',
    color:  '#10B981',   // أخضر
    weight: 20,
    order:  1,
  },
  {
    code:   'CUSTOMER',
    nameAr: 'المستفيدون والمجتمع',
    nameEn: 'Customers & Community',
    color:  '#3B82F6',   // أزرق
    weight: 30,
    order:  2,
  },
  {
    code:   'PROCESS',
    nameAr: 'العمليات الداخلية',
    nameEn: 'Internal Processes',
    color:  '#F59E0B',   // برتقالي
    weight: 25,
    order:  3,
  },
  {
    code:   'LEARNING',
    nameAr: 'التعلم والنمو',
    nameEn: 'Learning & Growth',
    color:  '#8B5CF6',   // بنفسجي
    weight: 15,
    order:  4,
  },
  {
    code:   'GOVERNANCE',
    nameAr: 'الحوكمة والامتثال',
    nameEn: 'Governance & Compliance',
    color:  '#EF4444',   // أحمر
    weight: 10,
    order:  5,
  },
];

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║      seed-axis — إنشاء المحاور الاستراتيجية      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  التاريخ: ${new Date().toISOString()}\n`);

  let created = 0;
  let skipped = 0;

  for (const axis of AXES) {
    const existing = await prisma.axis.findUnique({ where: { code: axis.code } });
    if (existing) {
      console.log(`  ⏭️  موجود مسبقاً — ${axis.code} (${existing.nameAr})`);
      skipped++;
    } else {
      await prisma.axis.create({ data: axis });
      console.log(`  ✅ أُنشئ — ${axis.code} (${axis.nameAr})`);
      created++;
    }
  }

  console.log('\n─── الملخص ───');
  console.log(`  أُنشئ:   ${created}`);
  console.log(`  تخطّي:   ${skipped}`);
  console.log(`  المجموع: ${AXES.length}`);

  if (created > 0) {
    console.log('\n  ✅ تم seed المحاور بنجاح.');
  } else {
    console.log('\n  ✅ جميع المحاور موجودة مسبقاً — لا تغيير.');
  }
}

main()
  .catch(e => {
    console.error('❌ فشل seed-axis:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
