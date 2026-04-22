#!/usr/bin/env node
/**
 * link-files.mjs — يُكمل نسخ الملفات وإنشاء DocVersion للسجلات التي رُفعت
 * بدون ملفات فعلية (بسبب bug سابق في uploader).
 *
 * يقرأ _review.json من المجلد المصدر ويستخدم upload.id لربط كل ملف
 * بسجل Document الموجود فعلاً.
 *
 * الاستخدام:
 *   node scripts/ingest/link-files.mjs --review "C:/path/_review.json" --source "C:/path/to/files"
 *   node scripts/ingest/link-files.mjs --all     → يمسح ingest-inbox وكل مجلد فرعي
 */
import { PrismaClient } from '@prisma/client';
import { readFile, copyFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const reviewIdx = argv.indexOf('--review');
const sourceIdx = argv.indexOf('--source');
const REVIEW = reviewIdx >= 0 ? argv[reviewIdx + 1] : null;
const SOURCE = sourceIdx >= 0 ? argv[sourceIdx + 1] : null;

function mimeFor(filename) {
  const l = filename.toLowerCase();
  if (l.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (l.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (l.endsWith('.md'))   return 'text/markdown';
  if (l.endsWith('.txt'))  return 'text/plain';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

async function linkOne(item, sourceBase) {
  if (!item.upload?.success) return { skipped: 'no upload' };
  if (item.upload.model !== 'Document') return { skipped: 'not Document (policy/activity use different storage)' };

  const docId = item.upload.id;
  const filename = item.filename;

  // ابحث عن الملف في مجلد المصدر (قد يكون في subfolder)
  const guessPath = item.filePath || path.join(sourceBase, item.folder, filename);
  if (!existsSync(guessPath)) {
    return { error: `source file not found: ${guessPath}` };
  }

  // تحقق: هل يوجد DocVersion مسبقاً؟
  const existing = await prisma.docVersion.findFirst({ where: { documentId: docId } });
  if (existing) return { skipped: 'already has DocVersion' };

  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { id: true, currentVersion: true } });
  if (!doc) return { error: 'doc record missing' };

  const storageDir = path.join(process.cwd(), 'storage', 'documents', docId);
  await mkdir(storageDir, { recursive: true });
  const destName = `v${doc.currentVersion}_${filename}`;
  const dest = path.join(storageDir, destName);
  await copyFile(guessPath, dest);
  const fileStat = await stat(guessPath);

  await prisma.docVersion.create({
    data: {
      documentId: docId,
      version: doc.currentVersion,
      filePath: path.relative(process.cwd(), dest).replace(/\\/g, '/'),
      fileSize: fileStat.size,
      mimeType: mimeFor(filename),
      changeLog: `ربط ملف أصلي — ${filename}`,
    },
  });

  return { linked: true, size: fileStat.size, code: item.upload.code };
}

async function processReview(reviewPath, sourceBase) {
  if (!existsSync(reviewPath)) {
    console.log(`⚠️  ${reviewPath} غير موجود — تخطي`);
    return { total: 0, linked: 0, errors: 0, skipped: 0 };
  }
  const data = JSON.parse(await readFile(reviewPath, 'utf8'));
  const items = data.items || [];
  console.log(`\n📂 ${path.basename(path.dirname(reviewPath))} — ${items.length} سجل`);

  const stats = { total: items.length, linked: 0, errors: 0, skipped: 0 };
  for (const it of items) {
    const r = await linkOne(it, sourceBase || path.dirname(reviewPath));
    if (r.linked) {
      stats.linked++;
      console.log(`  ✓ ${it.filename.slice(0, 50).padEnd(50)} → ${r.code}`);
    } else if (r.error) {
      stats.errors++;
      console.log(`  ✗ ${it.filename.slice(0, 50).padEnd(50)} → ${r.error}`);
    } else {
      stats.skipped++;
    }
  }
  console.log(`  ملخَّص: ✓${stats.linked} ✗${stats.errors} ⏭${stats.skipped}`);
  return stats;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  🔗 ربط الملفات الفعلية بسجلات Document    ║');
  console.log('╚══════════════════════════════════════════════╝');

  const reviews = [];
  if (REVIEW) {
    reviews.push({ review: REVIEW, source: SOURCE || path.dirname(REVIEW) });
  } else {
    // ابحث عن كل _review.json في ISO9001
    const base = 'C:/Users/abdu8/Documents/dev/qms/ISO9001';
    reviews.push({ review: path.join(base, '_review.json'), source: base });
    reviews.push({ review: path.join(base, 'الخطط والمشرات', '_review.json'), source: path.join(base, 'الخطط والمشرات') });
  }

  const grand = { total: 0, linked: 0, errors: 0, skipped: 0 };
  for (const { review, source } of reviews) {
    const s = await processReview(review, source);
    grand.total  += s.total;
    grand.linked += s.linked;
    grand.errors += s.errors;
    grand.skipped += s.skipped;
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`الإجمالي: ${grand.total}`);
  console.log(`  ✓ مربوط جديد: ${grand.linked}`);
  console.log(`  ⏭ متخطَّى (مربوط أو ليس Document): ${grand.skipped}`);
  console.log(`  ✗ أخطاء: ${grand.errors}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
