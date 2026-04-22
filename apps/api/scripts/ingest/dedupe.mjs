#!/usr/bin/env node
/**
 * dedupe.mjs — يكشف ويعالج السجلات المكررة بعد الاستيعاب
 *
 * Documents: عناوين متطابقة → يُبقي الأحدث (currentVersion أعلى أو createdAt أحدث)،
 *            ويحذف الباقي soft-delete (deletedAt).
 * QualityPolicy: عناوين متطابقة → يُبقي النشطة (active=true) أو الأحدث،
 *                ويحذف الباقي hard-delete (لا يوجد soft-delete في السكيما).
 *
 * الاستخدام:
 *   node scripts/ingest/dedupe.mjs --dry-run   → عرض فقط
 *   node scripts/ingest/dedupe.mjs             → تنفيذ
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

function pickKeeperDoc(arr) {
  // أحدث createdAt أولاً
  return arr.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
}
function pickKeeperPolicy(arr) {
  const active = arr.find(x => x.active);
  if (active) return active;
  return arr.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  🧹 تنظيف المكررات                        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(DRY ? '[dry-run] لن يُحذف شيء\n' : '[تنفيذ فعلي]\n');

  // Documents
  const docs = await prisma.document.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, title: true, createdAt: true, currentVersion: true },
  });
  const byTitle = {};
  for (const d of docs) {
    const k = d.title.trim();
    (byTitle[k] = byTitle[k] || []).push(d);
  }
  const docGroups = Object.entries(byTitle).filter(([_, a]) => a.length > 1);

  console.log(`📄 Documents مكررة: ${docGroups.length} مجموعة`);
  let docDeleted = 0;
  for (const [title, arr] of docGroups) {
    const keeper = pickKeeperDoc(arr);
    console.log(`  • ${title.slice(0, 60)}`);
    console.log(`     ✓ يُبقي: ${keeper.code}`);
    for (const d of arr) {
      if (d.id === keeper.id) continue;
      console.log(`     ✗ يحذف: ${d.code}`);
      if (!DRY) {
        await prisma.document.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
        docDeleted++;
      }
    }
  }

  // Policies
  const pols = await prisma.qualityPolicy.findMany({
    select: { id: true, version: true, title: true, active: true, createdAt: true },
  });
  const byPT = {};
  for (const x of pols) {
    const k = x.title.trim();
    (byPT[k] = byPT[k] || []).push(x);
  }
  const polGroups = Object.entries(byPT).filter(([_, a]) => a.length > 1);

  console.log(`\n📜 QualityPolicy مكررة: ${polGroups.length} مجموعة`);
  let polDeleted = 0;
  for (const [title, arr] of polGroups) {
    const keeper = pickKeeperPolicy(arr);
    console.log(`  • ${title.slice(0, 60)}`);
    console.log(`     ✓ يُبقي: v${keeper.version}${keeper.active ? ' (نشطة)' : ''}`);
    for (const x of arr) {
      if (x.id === keeper.id) continue;
      console.log(`     ✗ يحذف: v${x.version}`);
      if (!DRY) {
        // احذف الإقرارات المرتبطة أولاً (FK)
        await prisma.policyAcknowledgment.deleteMany({ where: { policyId: x.id } }).catch(() => {});
        await prisma.qualityPolicy.delete({ where: { id: x.id } });
        polDeleted++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`Documents حُذف (soft): ${docDeleted}`);
  console.log(`Policies حُذف (hard): ${polDeleted}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
