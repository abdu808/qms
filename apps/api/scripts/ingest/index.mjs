#!/usr/bin/env node
/**
 * scripts/ingest/index.mjs — CLI لاستيعاب ملفات الجمعية (DOCX/PPTX) عبر AI
 *
 * المراحل:
 *   1) scan    — يمسح ingest-inbox/ ويُعطي قائمة الملفات المدعومة
 *   2) extract — يستخرج النص من كل ملف
 *   3) analyze — يُحلِّل عبر aiComplete ويُنتج metadata
 *   4) review  — يكتب _review.json و _review.md لمراجعة بشرية
 *   5) commit  — (مع --commit) يرفع للنظام عبر uploader
 *
 * الأوامر:
 *   node scripts/ingest/index.mjs              → التحليل فقط (dry-run)
 *   node scripts/ingest/index.mjs --commit     → تحليل + رفع للنظام
 *   node scripts/ingest/index.mjs --inbox PATH → مجلد آخر
 *   node scripts/ingest/index.mjs --only NAME  → ملف واحد فقط (بالاسم)
 *   node scripts/ingest/index.mjs --skip-ai    → تخطي AI (يستخدم fallback)
 *
 * الناتج:
 *   ingest-inbox/_review.json   — كل نتائج التحليل + حالة الرفع
 *   ingest-inbox/_review.md     — تقرير قابل للقراءة
 */
import { readdir, stat, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import readline from 'readline';
import { extractText } from './extractors.mjs';
import { analyzeFile } from './analyzer.mjs';
import { uploadItem, getAdminUserId, disconnect } from './uploader.mjs';

const argv = process.argv.slice(2);
const COMMIT    = argv.includes('--commit');
const SKIP_AI   = argv.includes('--skip-ai');
const FORCE     = argv.includes('--force');
const inboxIdx  = argv.indexOf('--inbox');
const onlyIdx   = argv.indexOf('--only');
const excludeIdx = argv.indexOf('--exclude');
const INBOX     = inboxIdx >= 0 ? argv[inboxIdx + 1] : path.join(process.cwd(), 'ingest-inbox');
const ONLY      = onlyIdx  >= 0 ? argv[onlyIdx + 1]  : null;
// --exclude pattern1,pattern2,... — يتجاهل أي مجلد يحتوي أي نمط
const EXCLUDES  = excludeIdx >= 0 ? argv[excludeIdx + 1].split(',').map(s => s.trim()).filter(Boolean) : [];

const SUPPORTED = ['.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md'];

/** يمسح مجلد inbox بشكل recursive */
async function scanInbox(root) {
  if (!existsSync(root)) {
    throw new Error(`مجلد غير موجود: ${root}`);
  }
  const results = [];
  async function walk(dir, folder = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // تخطي المجلدات المستثناة
        if (EXCLUDES.some(p => entry.name.includes(p))) continue;
        await walk(full, folder ? `${folder}/${entry.name}` : entry.name);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED.includes(ext)) {
          const s = await stat(full);
          results.push({
            filename: entry.name,
            folder: folder || '(root)',
            filePath: full,
            ext,
            size: s.size,
          });
        }
      }
    }
  }
  await walk(root);
  return results;
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fmtCost(usd) {
  if (!usd) return '$0.000';
  return `$${usd.toFixed(4)}`;
}

async function confirm(q) {
  if (FORCE) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(q, (a) => { rl.close(); resolve(a.trim().toLowerCase()); });
  });
}

async function writeReview(outDir, items, totals) {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_review.json');
  const mdPath   = path.join(outDir, '_review.md');

  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), totals, items }, null, 2), 'utf8');

  const lines = [];
  lines.push(`# تقرير استيعاب الملفات\n`);
  lines.push(`**التاريخ:** ${new Date().toLocaleString('ar-SA')}`);
  lines.push(`**المجلد:** \`${INBOX}\``);
  lines.push(`**عدد الملفات:** ${items.length}`);
  lines.push(`**التكلفة الإجمالية:** ${fmtCost(totals.totalCost)}`);
  lines.push(`**tokens:** ${totals.totalInputTokens} in / ${totals.totalOutputTokens} out`);
  if (totals.uploaded !== undefined) {
    lines.push(`**مرفوع:** ${totals.uploaded} / ${items.length}`);
  }
  lines.push(`\n---\n`);
  for (const it of items) {
    lines.push(`## ${it.filename}`);
    lines.push(`- **المجلد:** ${it.folder}`);
    lines.push(`- **الحجم:** ${fmtSize(it.size)}`);
    if (it.extractError) {
      lines.push(`- **❌ خطأ استخراج:** ${it.extractError}`);
    } else {
      lines.push(`- **طول النص:** ${it.textLength || 0} حرف`);
      if (it.analysis) {
        lines.push(`- **العنوان:** ${it.analysis.title}`);
        lines.push(`- **النوع:** ${it.analysis.category}`);
        lines.push(`- **الموديول:** ${it.analysis.suggestedModule}`);
        lines.push(`- **الثقة:** ${it.analysis.confidence}`);
        lines.push(`- **الملخص:** ${it.analysis.summary}`);
        if (it.analysis.keywords?.length) {
          lines.push(`- **كلمات مفتاحية:** ${it.analysis.keywords.join('، ')}`);
        }
        if (it.analysis.isoClause) lines.push(`- **بند ISO:** ${it.analysis.isoClause}`);
        if (it.analysis.notes) lines.push(`- **ملاحظات:** ${it.analysis.notes}`);
      }
      if (it.analyzeError) {
        lines.push(`- **❌ خطأ تحليل:** ${it.analyzeError}`);
      }
      if (it.upload) {
        if (it.upload.success) {
          lines.push(`- **✅ رُفع:** ${it.upload.model} / ${it.upload.code || it.upload.id}`);
        } else {
          lines.push(`- **❌ فشل الرفع:** ${it.upload.error}`);
        }
      }
    }
    lines.push('');
  }
  await writeFile(mdPath, lines.join('\n'), 'utf8');

  return { jsonPath, mdPath };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  📥 QMS Ingestion CLI — استيعاب الملفات عبر AI         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`مجلد الاستيعاب: ${INBOX}`);
  console.log(`الوضع:          ${COMMIT ? '🚀 COMMIT (سيُرفع للنظام)' : '🔍 DRY-RUN (تحليل فقط)'}`);
  console.log(`AI:             ${SKIP_AI ? 'معطَّل (fallback)' : 'مُفعَّل'}`);
  if (ONLY) console.log(`ملف محدد:      ${ONLY}`);
  console.log('');

  // 1) Scan
  console.log('▶ (1/4) مسح المجلد...');
  let files = await scanInbox(INBOX);
  if (ONLY) files = files.filter(f => f.filename.includes(ONLY));
  if (files.length === 0) {
    console.log('⚠️  لا توجد ملفات مدعومة. ضع ملفات .docx / .pptx في المجلد.');
    await disconnect();
    return;
  }
  console.log(`  وجدنا ${files.length} ملف:\n`);
  files.forEach((f, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${f.folder}] ${f.filename} (${fmtSize(f.size)})`);
  });
  console.log('');

  if (COMMIT && !FORCE) {
    const a = await confirm('\n⚠️  سيُرفع المحتوى للنظام بعد التحليل. اكتب "نعم" للمتابعة: ');
    if (a !== 'نعم' && a !== 'yes' && a !== 'y') {
      console.log('تم الإلغاء.');
      await disconnect();
      return;
    }
  }

  // 2) Extract + 3) Analyze
  console.log('\n▶ (2-3/4) استخراج النص + تحليل AI...\n');
  const items = [];
  let totalCost = 0, totalInputTokens = 0, totalOutputTokens = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const prefix = `[${String(i + 1).padStart(2)}/${files.length}] ${f.filename.slice(0, 40).padEnd(40)}`;
    const item = { ...f };

    // Extract
    try {
      const ex = await extractText(f.filePath);
      item.text = ex.text;
      item.textLength = ex.text.length;
      item.textPreview = ex.text.slice(0, 3000);
      item.kind = ex.kind;
    } catch (e) {
      item.extractError = e.message;
      console.log(`${prefix} ❌ extract: ${e.message}`);
      items.push(item);
      continue;
    }

    // Analyze
    if (SKIP_AI) {
      item.analysis = {
        title: f.filename.replace(/\.[^.]+$/, ''),
        category: 'other',
        suggestedModule: 'Document',
        summary: '(تم تخطي AI — يحتاج تحليل يدوي)',
        keywords: [],
        extractedDate: '',
        version: '',
        approvedBy: '',
        confidence: 'low',
        isoClause: '',
        notes: 'skip-ai mode',
      };
      console.log(`${prefix} ⏭  skip-ai`);
    } else {
      try {
        const res = await analyzeFile({
          filename: f.filename,
          folder: f.folder,
          text: item.text,
          kind: item.kind,
        });
        item.analysis = res.analysis;
        item.usage = res.usage;
        item.provider = res.provider;
        item.model = res.model;
        item.parseError = res.parseError || false;
        if (res.usage) {
          totalCost         += res.usage.costUSD || 0;
          totalInputTokens  += res.usage.inputTokens || 0;
          totalOutputTokens += res.usage.outputTokens || 0;
        }
        const tag = item.parseError ? '⚠️ parse' : '✓';
        const extraTag = res.skipped ? 'short' : (res.analysis?.confidence || '?');
        console.log(`${prefix} ${tag} [${extraTag}] ${res.analysis?.suggestedModule || '?'} — ${fmtCost(res.usage?.costUSD)}`);
      } catch (e) {
        item.analyzeError = e.message;
        console.log(`${prefix} ❌ analyze: ${e.message}`);
      }
    }

    // لا نحتفظ بالنص الكامل في JSON — نوفِّر حجم الملف
    delete item.text;

    items.push(item);
  }

  console.log(`\n  ✓ إجمالي التكلفة: ${fmtCost(totalCost)}`);
  console.log(`  ✓ إجمالي tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);

  // 4) Commit (optional)
  const totals = { totalCost, totalInputTokens, totalOutputTokens };
  if (COMMIT) {
    console.log('\n▶ (4/4) رفع للنظام...\n');
    let adminId;
    try {
      adminId = await getAdminUserId();
    } catch (e) {
      console.error(`❌ ${e.message}`);
      await writeReview(INBOX, items, totals);
      await disconnect();
      process.exit(1);
    }

    let uploaded = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const prefix = `[${String(i + 1).padStart(2)}/${items.length}] ${it.filename.slice(0, 40).padEnd(40)}`;
      if (it.extractError || it.analyzeError) {
        it.upload = { success: false, error: it.extractError || it.analyzeError };
        console.log(`${prefix} ⏭  تخطي (خطأ سابق)`);
        continue;
      }
      try {
        const r = await uploadItem(it, adminId);
        it.upload = r;
        if (r.success) {
          uploaded++;
          console.log(`${prefix} ✓ ${r.model} ${r.code || r.id}`);
        } else {
          console.log(`${prefix} ❌ ${r.error}`);
        }
      } catch (e) {
        it.upload = { success: false, error: e.message };
        console.log(`${prefix} ❌ ${e.message}`);
      }
    }
    totals.uploaded = uploaded;
    console.log(`\n  ✓ رُفع ${uploaded} من ${items.length}`);
  } else {
    console.log('\n▶ (4/4) تخطي الرفع (dry-run). استخدم --commit للرفع الفعلي.');
  }

  // Write review
  const { jsonPath, mdPath } = await writeReview(INBOX, items, totals);
  console.log(`\n📄 تقرير JSON:  ${jsonPath}`);
  console.log(`📄 تقرير MD:    ${mdPath}`);
  console.log('\n✅ انتهى.\n');

  await disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ خطأ غير متوقَّع:', e);
  try { await disconnect(); } catch {}
  process.exit(1);
});
