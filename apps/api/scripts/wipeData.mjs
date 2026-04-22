/**
 * scripts/wipeData.mjs — مسح شامل لبيانات النظام مع الحفاظ على الأساسيات
 *
 * ما يُحذف:
 *   - كل بيانات الأعمال (documents, NCRs, CAPAs, risks, complaints, ...)
 *   - كل المستخدمين عدا SUPER_ADMIN
 *   - كل departments (سيُعاد إنشاؤها من seed)
 *   - Audit logs و AI usage logs
 *
 * ما يُحفَظ:
 *   - المستخدم SUPER_ADMIN (الأدمن الأول)
 *   - جدول Setting (مفاتيح AI، webhook، …)
 *   - PortalSettings
 *
 * الاستخدام:
 *   node scripts/wipeData.mjs             → تفاعلي (يطلب تأكيد)
 *   node scripts/wipeData.mjs --force     → بدون تأكيد
 *   node scripts/wipeData.mjs --dry-run   → عرض ما سيُحذف فقط
 */
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const DRY = argv.includes('--dry-run');

// ترتيب الحذف — يجب احترام foreign keys
// نبدأ بالـ children ثم ننتهي بالـ parents
const DELETE_ORDER = [
  // ── Child tables أولاً ─────────────────────────
  'aiUsageLog',
  'auditLog',
  'notification',
  'kpiEntry',
  'acknowledgment',
  'ackToken',
  'ackDocument',
  'policyAcknowledgment',
  'signature',
  'trainingRecord',
  'ack',
  'docVersion',
  'surveyResponse',
  'evalToken',
  'supplierEval',
  'donationEval',
  'refreshToken',

  // ── Main business tables ───────────────────────
  'capa',
  'complaint',
  'nCR',
  'risk',
  'objective',
  'audit',
  'auditChecklistTemplate',
  'survey',
  'document',
  'training',
  'supplier',
  'donation',
  'beneficiary',
  'program',
  'qualityPolicy',
  'managementReview',
  'competenceRequirement',
  'communicationPlan',
  'interestedParty',
  'swotItem',
  'process',
  'improvementProject',
  'performanceReview',
  'announcement',
  'operationalActivity',
  'strategicGoal',

  // ── Users (non-admin) ─────────────────────────
  // يُعالج يدوياً أدناه
];

async function confirm(question) {
  if (FORCE) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); });
  });
}

async function getCounts() {
  const counts = {};
  for (const model of DELETE_ORDER) {
    try {
      counts[model] = await prisma[model].count();
    } catch (e) {
      counts[model] = `N/A (${e.message.slice(0, 40)})`;
    }
  }
  // users stats
  const usersTotal = await prisma.user.count();
  const usersAdmin = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
  counts.user = `${usersTotal} total / ${usersAdmin} admin سيُحفَظ`;
  counts.department = await prisma.department.count();
  return counts;
}

async function printStats(label) {
  console.log(`\n═══ ${label} ═══`);
  const counts = await getCounts();
  for (const [k, v] of Object.entries(counts)) {
    if (typeof v === 'number' && v === 0) continue;
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  🧹 QMS DATA WIPE — حذف شامل مع الاحتفاظ بالأساسيات  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await printStats('الحالة الحالية');

  if (DRY) {
    console.log('\n[dry-run] لم يُحذف شيء. أزل --dry-run للتنفيذ الفعلي.');
    await prisma.$disconnect();
    return;
  }

  if (!FORCE) {
    console.log('\n⚠️  تحذير: هذا الإجراء سيحذف كل بيانات النظام (عدا الأدمن والإعدادات).');
    console.log('⚠️  مفاتيح AI و n8n ستُحفظ، لكن كل الوثائق والشكاوى والمخاطر وغيرها ستُمسح.');
    const a1 = await confirm('\nاكتب "نعم" للمتابعة: ');
    if (a1 !== 'نعم' && a1 !== 'yes' && a1 !== 'y') {
      console.log('تم الإلغاء.');
      await prisma.$disconnect();
      return;
    }
    const a2 = await confirm('تأكيد نهائي — اكتب "WIPE" بالأحرف الكبيرة: ');
    if (a2 !== 'wipe') {
      console.log('تم الإلغاء.');
      await prisma.$disconnect();
      return;
    }
  }

  console.log('\n🚀 بدء الحذف...\n');

  const results = {};
  for (const model of DELETE_ORDER) {
    try {
      const r = await prisma[model].deleteMany({});
      results[model] = r.count;
      console.log(`  ✓ ${model.padEnd(28)} ${r.count} سجل`);
    } catch (e) {
      results[model] = `ERR: ${e.message.slice(0, 60)}`;
      console.log(`  ✗ ${model.padEnd(28)} ${results[model]}`);
    }
  }

  // حذف المستخدمين عدا SUPER_ADMIN
  try {
    const r = await prisma.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } });
    console.log(`  ✓ ${'user (non-admin)'.padEnd(28)} ${r.count} سجل`);
  } catch (e) {
    console.log(`  ✗ user حذف فشل: ${e.message}`);
  }

  // حذف الأقسام (سيُعاد إنشاؤها من seed)
  try {
    // فصل أي مستخدم متبقي عن قسمه
    await prisma.user.updateMany({ data: { departmentId: null } });
    const r = await prisma.department.deleteMany({});
    console.log(`  ✓ ${'department'.padEnd(28)} ${r.count} سجل`);
  } catch (e) {
    console.log(`  ✗ department حذف فشل: ${e.message}`);
  }

  await printStats('الحالة بعد الحذف');

  console.log('\n✅ تم الحذف بنجاح.');
  console.log('📌 الخطوة التالية: شغّل `npm run seed` لإعادة إنشاء الأقسام والبيانات الأساسية.\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ خطأ:', e);
  await prisma.$disconnect();
  process.exit(1);
});
