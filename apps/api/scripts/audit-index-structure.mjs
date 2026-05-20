import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const indexPath = path.join(repoRoot, 'apps', 'web', 'public', 'index.html');
const writeReport = process.argv.includes('--write-report');

const source = fs.readFileSync(indexPath, 'utf8');
const lines = source.split(/\r?\n/);

function lineOf(index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function count(pattern) {
  return [...source.matchAll(pattern)].length;
}

function unique(values) {
  return [...new Set(values)];
}

function extractScriptAssets() {
  return [...source.matchAll(/<script\s+src=["']([^"']+)["'][^>]*><\/script>/g)].map(match => ({
    src: match[1],
    line: lineOf(match.index),
  }));
}

function extractPageBlocks() {
  const matches = [...source.matchAll(/<(?:div|template)\b[^>]*(?:x-show|x-if)=["'][^"']*page\s*={2,3}\s*'([^']+)'[^"']*["'][^>]*>/g)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const startLine = lineOf(matches[i].index);
    const tag = matches[i][0].match(/^<([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() || 'div';
    const closedAt = findMatchingClose(matches[i].index, tag);
    const fallbackEndLine = i + 1 < matches.length ? lineOf(matches[i + 1].index) - 1 : lines.length;
    const endLine = closedAt > matches[i].index ? lineOf(closedAt) : fallbackEndLine;
    const page = matches[i][1];
    const span = Math.max(1, endLine - startLine + 1);
    blocks.push({ page, startLine, endLine, span });
  }
  return blocks;
}

function findMatchingClose(startIndex, tagName) {
  const tagRe = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = startIndex;
  let depth = 0;
  for (const match of source.matchAll(tagRe)) {
    const full = match[0];
    const isClosing = full.startsWith(`</`);
    const isSelfClosing = /\/>$/.test(full);
    if (!isClosing && !isSelfClosing) depth += 1;
    if (isClosing) depth -= 1;
    if (depth === 0) return match.index;
  }
  return -1;
}

function extractMarkedSections() {
  const markers = [];
  const markerRe = /<!--\s*([\s\S]*?)\s*-->/g;
  for (const match of source.matchAll(markerRe)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    const line = lineOf(match.index);
    if (
      /Modal|Dashboard|Settings|AI|Webhook|CAPA|Review|Snapshot|لوحة|مراجعة|إعدادات|تنفيذي|مدير/.test(text)
    ) {
      markers.push({ line, text });
    }
  }
  return markers;
}

function extractIdDuplicates() {
  const ids = [...source.matchAll(/\sid=["']([^"']+)["']/g)].map(match => ({
    id: match[1],
    line: lineOf(match.index),
  }));
  const byId = new Map();
  for (const item of ids) {
    if (!byId.has(item.id)) byId.set(item.id, []);
    byId.get(item.id).push(item.line);
  }
  return [...byId.entries()]
    .filter(([, itemLines]) => itemLines.length > 1)
    .map(([id, itemLines]) => ({ id, lines: itemLines }));
}

function classifyPage(page) {
  if (['consultant', 'progressReports', 'portalAdmin', 'dashboard', 'planMap', 'userGuide'].includes(page)) {
    return 'special-page';
  }
  if (['aiSettings', 'integrationsSettings'].includes(page)) return 'settings-page';
  return 'inline-or-generic';
}

const pageBlocks = extractPageBlocks();
const scripts = extractScriptAssets();
const markedSections = extractMarkedSections();
const duplicateIds = extractIdDuplicates();
const largeBlocks = pageBlocks
  .filter(block => block.span >= 250)
  .sort((a, b) => b.span - a.span);

const summary = {
  bytes: Buffer.byteLength(source, 'utf8'),
  lines: lines.length,
  xShow: count(/\bx-show=/g),
  xIf: count(/\bx-if=/g),
  xFor: count(/\bx-for=/g),
  explicitPageBlocks: pageBlocks.length,
  uniqueExplicitPages: unique(pageBlocks.map(block => block.page)).length,
  scriptAssets: scripts.length,
  markedSections: markedSections.length,
  duplicateIds: duplicateIds.length,
  largeBlocks: largeBlocks.length,
};

const extractedTemplates = fs.existsSync(path.join(repoRoot, 'apps', 'web', 'public', 'modules', 'templates'))
  ? fs.readdirSync(path.join(repoRoot, 'apps', 'web', 'public', 'modules', 'templates')).filter(name => name.endsWith('.js'))
  : [];

const completedTemplatePlan = [
  ['consultant', 'consultant-page.js'],
  ['progressReports', 'progress-reports-page.js'],
  ['portalAdmin', 'portal-admin-page.js'],
  ['planMap', 'plan-map-page.js'],
  ['integrationsSettings', 'integrations-settings-page.js'],
  ['myWork', 'my-work-page.js'],
  ['kpiTracking', 'kpi-tracking-page.js'],
  ['userGuide', 'user-guide-page.js'],
  ['aiSettings modal', 'ai-settings-modal.js'],
  ['reviewSnapshot modal', 'review-snapshot-modal.js'],
];

const completedMoves = completedTemplatePlan
  .filter(([, fileName]) => extractedTemplates.includes(fileName))
  .map(([item, fileName]) => ({
    item,
    status: 'extracted',
    file: `/modules/templates/${fileName}`,
  }));

const remainingLargeBlocks = largeBlocks
  .filter(block => !completedTemplatePlan.some(([item]) => item === block.page || item.startsWith(block.page)))
  .slice(0, 5);

const recommendedFirstMoves = remainingLargeBlocks.length
  ? remainingLargeBlocks.map((block, index) => ({
    priority: index + 1,
    item: block.page,
    reason: `Remaining inline block spans ${block.span} lines; review before extracting because the first template wave is already complete.`,
  }))
  : [{
    priority: 1,
    item: 'No immediate extraction target',
    reason: 'The large standalone page/modal templates have been extracted. Next work should focus on smaller reusable components, not another broad move.',
  }];

function mdTable(rows, columns) {
  const header = `| ${columns.map(c => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(c => String(c.value(row) ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function writeMarkdownReport() {
  const reportPath = path.join(repoRoot, 'docs', 'index-structure-audit.md');
  const pageRows = pageBlocks
    .map(block => ({ ...block, kind: classifyPage(block.page) }))
    .sort((a, b) => b.span - a.span)
    .slice(0, 30);
  const scriptRows = scripts.map((script, idx) => ({ idx: idx + 1, ...script }));
  const markerRows = markedSections.slice(0, 40);

  const linesOut = [
    '# جرد بنية index.html',
    '',
    `آخر تحديث: ${new Date().toISOString()}`,
    '',
    '## الخلاصة',
    '',
    `- الحجم: ${(summary.bytes / 1024).toFixed(1)} KB`,
    `- عدد الأسطر: ${summary.lines}`,
    `- x-show: ${summary.xShow}`,
    `- x-if: ${summary.xIf}`,
    `- x-for: ${summary.xFor}`,
    `- كتل صفحات صريحة داخل الملف: ${summary.explicitPageBlocks}`,
    `- صفحات صريحة فريدة: ${summary.uniqueExplicitPages}`,
    `- سكربتات محملة: ${summary.scriptAssets}`,
    `- أقسام/مودالات معنونة: ${summary.markedSections}`,
    `- معرفات HTML مكررة: ${summary.duplicateIds}`,
    `- كتل كبيرة فوق 250 سطر: ${summary.largeBlocks}`,
    '',
    '## ما تم فصله',
    '',
    completedMoves.length
      ? mdTable(completedMoves, [
        { label: 'الجزء', value: r => r.item },
        { label: 'الحالة', value: r => r.status },
        { label: 'الملف', value: r => r.file },
      ])
      : '- لا توجد أجزاء مفصولة بعد.',
    '',
    '## أكبر كتل الصفحات',
    '',
    mdTable(pageRows, [
      { label: 'الصفحة', value: r => r.page },
      { label: 'النوع', value: r => r.kind },
      { label: 'من سطر', value: r => r.startLine },
      { label: 'إلى سطر', value: r => r.endLine },
      { label: 'عدد الأسطر', value: r => r.span },
    ]),
    '',
    '## المرشحون الآمنون للفصل',
    '',
    mdTable(recommendedFirstMoves, [
      { label: 'الأولوية', value: r => r.priority },
      { label: 'الجزء', value: r => r.item },
      { label: 'سبب الاختيار', value: r => r.reason },
    ]),
    '',
    '## السكربتات المحملة',
    '',
    mdTable(scriptRows, [
      { label: '#', value: r => r.idx },
      { label: 'السطر', value: r => r.line },
      { label: 'الملف', value: r => r.src },
    ]),
    '',
    '## الأقسام والمودالات المعنونة',
    '',
    markerRows.length
      ? mdTable(markerRows, [
        { label: 'السطر', value: r => r.line },
        { label: 'الوسم', value: r => r.text },
      ])
      : '- لا توجد وسوم كافية.',
    '',
    '## معرفات HTML مكررة',
    '',
    duplicateIds.length
      ? mdTable(duplicateIds, [
        { label: 'id', value: r => r.id },
        { label: 'الأسطر', value: r => r.lines.join(', ') },
      ])
      : '- لا توجد معرفات مكررة.',
    '',
    '## قرار المرحلة الأولى',
    '',
    '- لا يتم فصل أي جزء قبل نجاح فحص الواجهة والصلاحيات والاختبارات.',
    '- البداية المقترحة: فصل صفحة `consultant` فقط، ثم اختبارها، ثم الانتقال إلى `progressReports`.',
    '- لا يتم تغيير أسماء الدوال أو حالات Alpine في مرحلة الفصل الأولى.',
    '',
  ];
  fs.writeFileSync(reportPath, `${linesOut.join('\n')}\n`, 'utf8');
  return reportPath;
}

if (writeReport) {
  const reportPath = writeMarkdownReport();
  console.log(`index structure report written: ${path.relative(repoRoot, reportPath)}`);
}

console.log(JSON.stringify({
  ok: duplicateIds.length === 0,
  summary,
  largestBlocks: largeBlocks.slice(0, 10),
  duplicateIds,
  recommendedFirstMoves,
}, null, 2));

if (duplicateIds.length) process.exitCode = 1;
