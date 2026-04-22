/**
 * reset-strategic-data.mjs — حذف بيانات الخطة الاستراتيجية والتشغيلية فقط
 *
 * ما يُحذف:
 *   ✅ KpiEntry (جميع قيم المؤشرات)
 *   ✅ Objective (جميع الأهداف التشغيلية)
 *   ✅ OperationalActivity (جميع الأنشطة التشغيلية)
 *   ✅ StrategicGoal (جميع الأهداف الاستراتيجية)
 *
 * ما يُحفَظ (لا يُمسّ):
 *   🔒 Risk / NCR / CAPA (فقط يُفك ربط المخاطر بالأهداف)
 *   🔒 Users / Departments / Settings
 *   🔒 Documents / QualityPolicy
 *   🔒 Audits / Surveys
 *
 * الاستخدام:
 *   node scripts/reset-strategic-data.mjs            → يطلب تأكيد
 *   node scripts/reset-strategic-data.mjs --force    → بدون تأكيد
 *   node scripts/reset-strategic-data.mjs --dry-run  → إحصاء فقط
 */
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const argv   = process.argv.slice(2);
const FORCE  = argv.includes('--force');
const DRY    = argv.includes('--dry-run');

async function ask(q) {
  if (FORCE) return 'yes';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  🗂  إعادة ضبط بيانات الخطة الاستراتيجية والتشغيلية  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── إحصاء ما سيُحذف ──────────────────────────────────────────────────────
  const [kpi, obj, act, goal, riskLinked] = await Promise.all([
    prisma.kpiEntry.count(),
    prisma.objective.count(),
    prisma.operationalActivity.count(),
    prisma.strategicGoal.count(),
    prisma.risk.count({ where: { strategicGoalId: { not: null } } }),
  ]);

  console.log('📊 الحالة الحالية:');
  console.log(`   KpiEntry           ${kpi}`);
  console.log(`   Objective          ${obj}`);
  console.log(`   OperationalActivity ${act}`);
  console.log(`   StrategicGoal      ${goal}`);
  console.log(`   Risk مرتبط بأهداف  ${riskLinked} (سيُفك الربط فقط — لن تُحذف)`);

  if (DRY) {
    console.log('\n[dry-run] لم يُحذف شيء.\n');
    await prisma.$disconnect();
    return;
  }

  if (!FORCE) {
    console.log('\n⚠️  سيُحذف كل ما هو مذكور أعلاه.');
    const a1 = await ask('اكتب "نعم" للمتابعة: ');
    if (!['نعم', 'yes', 'y'].includes(a1.toLowerCase())) {
      console.log('تم الإلغاء.\n');
      await prisma.$disconnect();
      return;
    }
  }

  console.log('\n🚀 بدء الحذف...\n');

  // 1️⃣ فك ربط المخاطر (لا نحذفها)
  const unlinked = await prisma.risk.updateMany({
    where: { strategicGoalId: { not: null } },
    data:  { strategicGoalId: null },
  });
  console.log(`  ✓ Risk (فك الربط)         ${unlinked.count} سجل`);

  // 2️⃣ KpiEntry
  const k = await prisma.kpiEntry.deleteMany({});
  console.log(`  ✓ KpiEntry                ${k.count} سجل`);

  // 3️⃣ Objective
  const o = await prisma.objective.deleteMany({});
  console.log(`  ✓ Objective               ${o.count} سجل`);

  // 4️⃣ OperationalActivity
  const a = await prisma.operationalActivity.deleteMany({});
  console.log(`  ✓ OperationalActivity      ${a.count} سجل`);

  // 5️⃣ StrategicGoal
  const g = await prisma.strategicGoal.deleteMany({});
  console.log(`  ✓ StrategicGoal           ${g.count} سجل`);

  console.log('\n✅ تم حذف بيانات الخطة بنجاح.');
  console.log('📌 الخطوة التالية: ارفع ملفات الخطة عبر المستشار لإعادة الاستيراد.\n');

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('\n❌ خطأ:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
