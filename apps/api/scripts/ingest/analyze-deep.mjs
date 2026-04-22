#!/usr/bin/env node
/**
 * analyze-deep.mjs — تقرير تحليلي شامل من بيانات QMS بعد الاستيعاب
 *
 * يُنتج _analysis/ في مجلد المشروع يحتوي:
 *   01_inventory.md         — جرد كامل (documents, policies, goals, activities)
 *   02_iso_coverage.md      — مصفوفة تغطية بنود ISO 9001:2015
 *   03_kpi_catalog.md       — فهرس مؤشرات الأداء
 *   04_gaps.md              — الفجوات (بنود ISO غير المغطاة، سياسات ناقصة، …)
 *   05_strategic_map.md     — خريطة الأهداف والأنشطة
 *   00_summary.md           — ملخص تنفيذي
 *
 * الاستخدام:
 *   node scripts/ingest/analyze-deep.mjs
 *   node scripts/ingest/analyze-deep.mjs --out /path/to/outdir
 */
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : path.join(process.cwd(), '_analysis');

// بنود ISO 9001:2015 الرئيسية
const ISO_CLAUSES = {
  '4':   'سياق المنظمة',
  '4.1': 'فهم المنظمة وسياقها',
  '4.2': 'الأطراف المهتمة',
  '4.3': 'نطاق نظام إدارة الجودة',
  '4.4': 'نظام إدارة الجودة والعمليات',
  '5':   'القيادة',
  '5.1': 'القيادة والالتزام',
  '5.2': 'سياسة الجودة',
  '5.3': 'الأدوار والمسؤوليات',
  '6':   'التخطيط',
  '6.1': 'المخاطر والفرص',
  '6.2': 'أهداف الجودة',
  '6.3': 'تخطيط التغييرات',
  '7':   'الدعم',
  '7.1': 'الموارد',
  '7.2': 'الكفاءة',
  '7.3': 'الوعي',
  '7.4': 'الاتصال',
  '7.5': 'المعلومات الموثقة',
  '8':   'التشغيل',
  '8.1': 'التخطيط والتحكم التشغيلي',
  '8.2': 'متطلبات المنتجات/الخدمات',
  '8.3': 'التصميم والتطوير',
  '8.4': 'ضوابط الموردين الخارجيين',
  '8.5': 'تقديم الخدمة',
  '8.6': 'الإفراج عن الخدمة',
  '8.7': 'ضبط المخرجات غير المطابقة',
  '9':   'تقييم الأداء',
  '9.1': 'الرصد والقياس والتحليل',
  '9.2': 'التدقيق الداخلي',
  '9.3': 'مراجعة الإدارة',
  '10':  'التحسين',
  '10.1':'عام',
  '10.2':'عدم المطابقة والإجراء التصحيحي',
  '10.3':'التحسين المستمر',
};

function tbl(headers, rows) {
  const h = `| ${headers.join(' | ')} |`;
  const s = `|${headers.map(() => '---').join('|')}|`;
  const r = rows.map(r => `| ${r.map(c => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`).join('\n');
  return `${h}\n${s}\n${r}`;
}

async function report_inventory() {
  const [docs, pols, goals, acts, ann] = await Promise.all([
    prisma.document.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } }),
    prisma.qualityPolicy.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.strategicGoal.findMany({ orderBy: { code: 'asc' } }),
    prisma.operationalActivity.findMany({ orderBy: { code: 'asc' } }),
    prisma.announcement.findMany({ where: { deletedAt: null } }),
  ]);

  const byCat = {};
  for (const d of docs) byCat[d.category] = (byCat[d.category] || 0) + 1;

  const out = [];
  out.push('# 📋 جرد كامل لنظام إدارة الجودة\n');
  out.push(`**تاريخ التقرير:** ${new Date().toLocaleString('ar-SA')}\n`);
  out.push('## الإحصائيات العامة\n');
  out.push(tbl(['الكيان', 'العدد'], [
    ['الوثائق', docs.length],
    ['سياسات الجودة', pols.length],
    ['الأهداف الاستراتيجية', goals.length],
    ['الأنشطة التشغيلية', acts.length],
    ['الإعلانات', ann.length],
  ]));

  out.push('\n## الوثائق حسب الفئة\n');
  out.push(tbl(['الفئة', 'العدد'],
    Object.entries(byCat).sort((a, b) => b[1] - a[1])));

  out.push('\n## الوثائق (مختصر)\n');
  out.push(tbl(['الكود', 'العنوان', 'الفئة', 'الحالة', 'بند ISO'],
    docs.map(d => [d.code, d.title.slice(0, 50), d.category, d.status, d.isoClause || '—'])));

  out.push('\n## سياسات الجودة\n');
  out.push(tbl(['الإصدار', 'العنوان', 'نشطة', 'معتمدة'],
    pols.map(p => [p.version, p.title.slice(0, 60), p.active ? '✓' : '—', p.approvedBy || '—'])));

  out.push('\n## الأهداف الاستراتيجية\n');
  out.push(tbl(['الكود', 'العنوان', 'الحالة'],
    goals.map(g => [g.code, g.title.slice(0, 60), g.status])));

  out.push('\n## الأنشطة التشغيلية\n');
  out.push(tbl(['الكود', 'العنوان', 'الحالة', 'السنة'],
    acts.map(a => [a.code, a.title.slice(0, 60), a.status, a.year])));

  return out.join('\n');
}

async function report_iso_coverage() {
  const docs = await prisma.document.findMany({ where: { deletedAt: null, isoClause: { not: null } } });
  const byClause = {};
  for (const d of docs) {
    const clauses = (d.isoClause || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
    for (const c of clauses) {
      (byClause[c] = byClause[c] || []).push(d);
    }
  }

  const out = [];
  out.push('# 📐 مصفوفة تغطية ISO 9001:2015\n');
  out.push(`**تاريخ:** ${new Date().toLocaleString('ar-SA')}\n`);

  const rows = [];
  for (const [clause, name] of Object.entries(ISO_CLAUSES)) {
    const hits = byClause[clause] || [];
    const status = hits.length > 0 ? `✅ ${hits.length}` : '⚠️ غير مغطى';
    const sample = hits.slice(0, 2).map(h => h.code).join('، ') || '—';
    rows.push([clause, name, status, sample]);
  }
  out.push(tbl(['البند', 'الاسم', 'الحالة', 'أمثلة'], rows));

  out.push('\n## البنود المُغطاة تفصيلياً\n');
  for (const [clause, docs_c] of Object.entries(byClause).sort()) {
    out.push(`\n### ${clause} — ${ISO_CLAUSES[clause] || '(غير معرّف)'}`);
    for (const d of docs_c) out.push(`- **${d.code}** — ${d.title}`);
  }

  return out.join('\n');
}

async function report_gaps() {
  const docs = await prisma.document.findMany({ where: { deletedAt: null } });
  const covered = new Set();
  for (const d of docs) {
    (d.isoClause || '').split(/[,،]/).map(s => s.trim()).filter(Boolean).forEach(c => covered.add(c));
  }

  const out = [];
  out.push('# 🔍 تحليل الفجوات\n');
  out.push(`**تاريخ:** ${new Date().toLocaleString('ar-SA')}\n`);

  out.push('## بنود ISO غير المغطاة\n');
  const missing = Object.entries(ISO_CLAUSES).filter(([c]) => !covered.has(c) && c.includes('.'));
  if (missing.length === 0) {
    out.push('✅ كل بنود ISO المفصّلة مغطاة.');
  } else {
    out.push(tbl(['البند', 'الاسم'], missing.map(([c, n]) => [c, n])));
  }

  // سياسات ناقصة (نتوقع السياسات الرئيسية)
  const expectedPolicies = [
    'سياسة الجودة',
    'إدارة المخاطر',
    'ضبط الوثائق',
    'الموارد البشرية',
    'الشكاوى',
    'المشتريات',
    'التدقيق الداخلي',
  ];
  const pols = await prisma.qualityPolicy.findMany();
  const polTitles = pols.map(p => p.title);
  const missingPolicies = expectedPolicies.filter(ep => !polTitles.some(t => t.includes(ep)));

  out.push('\n## سياسات محورية ناقصة (تُقدَّر)\n');
  if (missingPolicies.length === 0) {
    out.push('✅ كل السياسات المحورية موجودة.');
  } else {
    out.push(missingPolicies.map(p => `- ${p}`).join('\n'));
  }

  // وثائق بدون DocVersion (ملف غير مرفوع)
  const docsNoVer = await prisma.document.findMany({
    where: { deletedAt: null, versions: { none: {} } },
    select: { code: true, title: true },
  });
  out.push('\n## وثائق بدون ملف مرفوع\n');
  if (docsNoVer.length === 0) out.push('✅ كل الوثائق لها ملف مرتبط.');
  else out.push(tbl(['الكود', 'العنوان'], docsNoVer.map(d => [d.code, d.title.slice(0, 70)])));

  // سياسة جودة نشطة؟
  const activePol = await prisma.qualityPolicy.count({ where: { active: true } });
  out.push('\n## سياسة الجودة النشطة\n');
  out.push(activePol > 0 ? `✅ يوجد ${activePol} سياسة نشطة.` : '⚠️ **لا توجد سياسة جودة نشطة** — يجب تفعيل واحدة يدوياً.');

  return out.join('\n');
}

async function report_kpi_catalog() {
  const objs = await prisma.objective.findMany().catch(() => []);
  const kpis = await prisma.kpiEntry.findMany().catch(() => []);
  const out = [];
  out.push('# 📊 فهرس المؤشرات والأهداف\n');
  out.push(`**تاريخ:** ${new Date().toLocaleString('ar-SA')}\n`);
  out.push(`**الأهداف (Objective):** ${objs.length}`);
  out.push(`**قيَم KPI مسجَّلة:** ${kpis.length}`);

  if (objs.length > 0) {
    out.push('\n## الأهداف\n');
    out.push(tbl(['العنوان', 'الحالة'],
      objs.map(o => [o.title?.slice(0, 60) || '—', o.status || '—'])));
  } else {
    out.push('\n⚠️ لا توجد أهداف مسجَّلة — يجب إدخالها يدوياً من وثيقة QP-002 (أهداف الجودة) وملف الخطة الاستراتيجية.');
  }
  return out.join('\n');
}

async function report_strategic_map() {
  const [goals, acts] = await Promise.all([
    prisma.strategicGoal.findMany({ orderBy: { code: 'asc' } }),
    prisma.operationalActivity.findMany({ orderBy: { code: 'asc' } }),
  ]);
  const out = [];
  out.push('# 🎯 الخريطة الاستراتيجية\n');
  out.push(`**تاريخ:** ${new Date().toLocaleString('ar-SA')}\n`);
  out.push(`**الأهداف:** ${goals.length} | **الأنشطة:** ${acts.length}\n`);

  out.push('## الأهداف الاستراتيجية\n');
  for (const g of goals) {
    out.push(`### ${g.code} — ${g.title}`);
    out.push(`**الحالة:** ${g.status}`);
    if (g.notes) out.push(`**الوصف:** ${g.notes.slice(0, 300)}`);
    out.push('');
  }
  out.push('\n## الأنشطة التشغيلية\n');
  for (const a of acts) {
    out.push(`- **${a.code}** (${a.year}) — ${a.title} — [${a.status}]`);
  }
  return out.join('\n');
}

async function report_summary(stats) {
  const out = [];
  out.push('# 🗂️ الملخص التنفيذي — تحليل عميق لنظام QMS\n');
  out.push(`**التاريخ:** ${new Date().toLocaleString('ar-SA')}\n`);
  out.push('## أرقام رئيسية\n');
  out.push(tbl(['المؤشر', 'القيمة'], [
    ['الوثائق الفعَّالة', stats.docs],
    ['سياسات الجودة', stats.pols],
    ['السياسة النشطة', stats.activePol > 0 ? `✅ ${stats.activePol}` : '⚠️ غير مُفعَّلة'],
    ['الأهداف الاستراتيجية', stats.goals],
    ['الأنشطة التشغيلية', stats.acts],
    ['تغطية ISO', `${stats.isoCov}/${stats.isoTotal} بند`],
    ['وثائق بلا ملف', stats.noFile],
  ]));

  out.push('\n## التقارير التفصيلية\n');
  out.push('- `01_inventory.md` — الجرد الكامل');
  out.push('- `02_iso_coverage.md` — مصفوفة ISO');
  out.push('- `03_kpi_catalog.md` — المؤشرات');
  out.push('- `04_gaps.md` — الفجوات');
  out.push('- `05_strategic_map.md` — الخريطة الاستراتيجية');

  out.push('\n## توصيات فورية\n');
  if (stats.activePol === 0) out.push('1. ⚠️ **تفعيل سياسة جودة** واحدة من الأدمن (حالياً لا يوجد نشطة).');
  if (stats.noFile > 0) out.push(`2. ⚠️ ربط ${stats.noFile} وثيقة بملفاتها الأصلية.`);
  if (stats.isoCov < stats.isoTotal - 5) out.push(`3. سد ${stats.isoTotal - stats.isoCov} فجوة في تغطية ISO (راجع 04_gaps.md).`);
  out.push('4. التحقق من الأهداف الاستراتيجية وإدخال مؤشرات KPI.');

  return out.join('\n');
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  🔬 تحليل عميق لبيانات QMS                ║');
  console.log('╚═══════════════════════════════════════════╝');
  await mkdir(OUT, { recursive: true });

  console.log('  • تقرير الجرد...');
  await writeFile(path.join(OUT, '01_inventory.md'), await report_inventory(), 'utf8');

  console.log('  • تغطية ISO...');
  await writeFile(path.join(OUT, '02_iso_coverage.md'), await report_iso_coverage(), 'utf8');

  console.log('  • فهرس المؤشرات...');
  await writeFile(path.join(OUT, '03_kpi_catalog.md'), await report_kpi_catalog(), 'utf8');

  console.log('  • تحليل الفجوات...');
  await writeFile(path.join(OUT, '04_gaps.md'), await report_gaps(), 'utf8');

  console.log('  • الخريطة الاستراتيجية...');
  await writeFile(path.join(OUT, '05_strategic_map.md'), await report_strategic_map(), 'utf8');

  // إحصائيات للملخص
  const [docsC, polsC, activeC, goalsC, actsC, noFileC] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.qualityPolicy.count(),
    prisma.qualityPolicy.count({ where: { active: true } }),
    prisma.strategicGoal.count(),
    prisma.operationalActivity.count(),
    prisma.document.count({ where: { deletedAt: null, versions: { none: {} } } }),
  ]);
  const docsIso = await prisma.document.findMany({
    where: { deletedAt: null, isoClause: { not: null } },
    select: { isoClause: true },
  });
  const cov = new Set();
  for (const d of docsIso) (d.isoClause || '').split(/[,،]/).map(s => s.trim()).filter(Boolean).forEach(c => cov.add(c));

  console.log('  • الملخص التنفيذي...');
  await writeFile(path.join(OUT, '00_summary.md'), await report_summary({
    docs: docsC, pols: polsC, activePol: activeC,
    goals: goalsC, acts: actsC,
    isoCov: cov.size, isoTotal: Object.keys(ISO_CLAUSES).length,
    noFile: noFileC,
  }), 'utf8');

  console.log(`\n✅ التقارير في: ${OUT}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
