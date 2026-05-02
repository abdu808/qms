import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ISO_DIR = path.join(ROOT, 'ISO9001');
const DOCS_DIR = path.join(ROOT, 'docs');
const REVIEW_JSON = path.join(ISO_DIR, '_review.json');
const TODAY = '2026-05-02';

const OUT_MANIFEST = path.join(DOCS_DIR, `iso9001-import-manifest-${TODAY}.json`);
const OUT_PRIORITY = path.join(DOCS_DIR, `iso9001-priority-documents-${TODAY}.csv`);
const OUT_PUBLIC_DIR = path.join(DOCS_DIR, `public-website-package-${TODAY}`);
const OUT_PUBLIC_FILES = path.join(OUT_PUBLIC_DIR, 'files');
const OUT_PUBLIC_MANIFEST = path.join(OUT_PUBLIC_DIR, 'manifest.csv');
const OUT_PUBLIC_README = path.join(OUT_PUBLIC_DIR, 'README.md');

const CATEGORY_MAP = {
  manual: 'MANUAL',
  policy: 'POLICY',
  procedure: 'PROCEDURE',
  operational_plan: 'WORK_INSTRUCTION',
  strategic_plan: 'RECORD',
  form: 'FORM',
  report: 'RECORD',
};

const PRIORITY_CODES = [
  'QM-001', 'QM-002',
  'QP-001', 'QP-002', 'QP-003', 'QP-004', 'QP-005',
  'HR-001', 'IT-001', 'PUR-001', 'QS-001', 'QS-004',
  'IA-001', 'IA-002', 'CA-001', 'CA-002', 'MR-001', 'MR-002',
  'TR-002', 'AUD-001', 'AUD-002', 'AUD-003',
];

const PUBLIC_FOLDER = '05_وثائق_النشر_العام';

function csvCell(value) {
  const s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function extractCode(filename) {
  const match = filename.match(/^([A-Z]+-\d{3}(?:-\d{4})?|[A-Z]+-SMART-\d{3}|AUD-\d{3}|REG-\d{3}-\d{4}-VAL|PUB-\d{3}-\d{4})/);
  return match?.[1] || '';
}

function primaryIsoClause(raw) {
  const first = String(raw || '')
    .split(/[،,]/)
    .map(s => s.trim())
    .find(Boolean);
  return /^\d+(\.\d+){0,3}[a-z]?$/i.test(first || '') ? first : null;
}

function normalizeVersion(version) {
  const v = String(version || '').trim();
  return /^\d+(\.\d+){0,2}$/.test(v) ? v : '1.0';
}

function isPublicFolder(folder) {
  return String(folder || '').includes(PUBLIC_FOLDER);
}

function isPublicFilePreferred(file) {
  const ext = path.extname(file.filename).toLowerCase();
  return isPublicFolder(file.folder) && ['.pdf', '.docx', '.md', '.html'].includes(ext);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildItem(raw) {
  const analysis = raw.analysis || {};
  const code = extractCode(raw.filename);
  const category = analysis.category || '';
  const suggestedModule = analysis.suggestedModule || '';
  const docCategory = CATEGORY_MAP[category] || 'EXTERNAL';
  const isoClauseRaw = analysis.isoClause || '';

  return {
    code,
    title: analysis.title || raw.filename.replace(/\.[^.]+$/, ''),
    filename: raw.filename,
    folder: raw.folder,
    filePath: raw.filePath,
    ext: raw.ext,
    size: raw.size,
    category,
    suggestedModule,
    documentCategory: docCategory,
    isoClauseRaw,
    isoClause: primaryIsoClause(isoClauseRaw),
    version: normalizeVersion(analysis.version),
    approvedBy: analysis.approvedBy || '',
    extractedDate: analysis.extractedDate || '',
    confidence: analysis.confidence || '',
    summary: analysis.summary || '',
    isPublicCandidate: isPublicFolder(raw.folder),
    uploadPrevious: raw.upload ? {
      success: Boolean(raw.upload.success),
      model: raw.upload.model || '',
      id: raw.upload.id || '',
      code: raw.upload.code || '',
      title: raw.upload.title || '',
    } : null,
  };
}

function dedupeForInternal(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = item.code || `${item.title}|${item.folder}|${item.ext}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const score = (x) => {
      let s = 0;
      if (!x.isPublicCandidate) s += 4;
      if (x.ext === '.docx') s += 3;
      if (x.ext === '.pdf') s += 2;
      if (x.confidence === 'high') s += 1;
      return s;
    };
    if (score(item) > score(existing)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => (a.code || a.title).localeCompare(b.code || b.title, 'ar'));
}

function buildApiPayload(item) {
  return {
    title: item.code ? `${item.code} - ${item.title}` : item.title,
    category: item.documentCategory,
    currentVersion: item.version,
    status: 'DRAFT',
    effectiveDate: item.extractedDate && /^\d{4}-\d{2}-\d{2}$/.test(item.extractedDate) ? item.extractedDate : null,
    reviewDate: null,
    retentionYears: 5,
    isoClause: item.isoClause,
  };
}

async function copyPublicFiles(publicItems) {
  await fs.mkdir(OUT_PUBLIC_FILES, { recursive: true });

  const copied = [];
  const seenNames = new Set();
  for (const item of publicItems) {
    if (!(await fileExists(item.filePath))) continue;
    const safeNameBase = `${item.code || 'DOC'}-${item.title}`
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 140);
    let outName = `${safeNameBase}${item.ext}`;
    let n = 2;
    while (seenNames.has(outName)) {
      outName = `${safeNameBase}-${n}${item.ext}`;
      n += 1;
    }
    seenNames.add(outName);

    await fs.copyFile(item.filePath, path.join(OUT_PUBLIC_FILES, outName));
    copied.push({ ...item, publicFilename: outName });
  }
  return copied;
}

async function main() {
  const review = JSON.parse(await fs.readFile(REVIEW_JSON, 'utf8'));
  const allItems = (review.items || [])
    .filter(item => ['.docx', '.pdf', '.md', '.html'].includes(String(item.ext || '').toLowerCase()))
    .filter(item => !String(item.filename || '').startsWith('~$'))
    .filter(item => Number(item.size || 0) > 512)
    .map(buildItem);

  const internalDocs = dedupeForInternal(allItems);
  const publicCandidates = allItems
    .filter(isPublicFilePreferred)
    .sort((a, b) => (a.code || a.title).localeCompare(b.code || b.title, 'ar'));
  const publicCopied = await copyPublicFiles(publicCandidates);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'ISO9001/_review.json',
    note: 'Preparation only. Does not mutate production. Public portal is out of scope; public files are prepared for the official association website.',
    counts: {
      sourceItems: allItems.length,
      internalDocumentCandidates: internalDocs.length,
      publicWebsiteCandidates: publicCandidates.length,
      publicFilesCopied: publicCopied.length,
    },
    internalDocumentCandidates: internalDocs.map(item => ({
      ...item,
      apiCreatePayload: buildApiPayload(item),
      nextStep: 'Review, then create a Document record and upload the file version if approved.',
    })),
    publicWebsitePackage: {
      directory: path.relative(ROOT, OUT_PUBLIC_DIR).replace(/\\/g, '/'),
      files: publicCopied.map(item => ({
        code: item.code,
        title: item.title,
        source: path.relative(ROOT, item.filePath).replace(/\\/g, '/'),
        output: `files/${item.publicFilename}`,
        isoClause: item.isoClauseRaw,
        category: item.category,
      })),
    },
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  const priorityRows = internalDocs.filter(item => PRIORITY_CODES.some(code => item.code?.startsWith(code)));
  const priorityHeader = [
    'priority',
    'code',
    'title',
    'folder',
    'filename',
    'category',
    'documentCategory',
    'suggestedModule',
    'isoClause',
    'version',
    'publicCandidate',
    'recommendedAction',
  ];
  const priorityLines = [priorityHeader.join(',')];
  priorityRows.forEach((item, idx) => {
    priorityLines.push([
      idx + 1,
      item.code,
      item.title,
      item.folder,
      item.filename,
      item.category,
      item.documentCategory,
      item.suggestedModule,
      item.isoClauseRaw,
      item.version,
      item.isPublicCandidate ? 'yes' : 'no',
      item.suggestedModule === 'Document'
        ? 'Create Document record and upload version'
        : 'Review whether to register as Document evidence or module-specific record',
    ].map(csvCell).join(','));
  });
  await fs.writeFile(OUT_PRIORITY, `\ufeff${priorityLines.join('\n')}`, 'utf8');

  const publicHeader = ['code', 'title', 'source', 'output', 'category', 'isoClause'];
  const publicLines = [publicHeader.join(',')];
  for (const item of publicCopied) {
    publicLines.push([
      item.code,
      item.title,
      path.relative(ROOT, item.filePath).replace(/\\/g, '/'),
      `files/${item.publicFilename}`,
      item.category,
      item.isoClauseRaw,
    ].map(csvCell).join(','));
  }
  await fs.writeFile(OUT_PUBLIC_MANIFEST, `\ufeff${publicLines.join('\n')}`, 'utf8');

  await fs.writeFile(OUT_PUBLIC_README, [
    '# حزمة النشر للموقع الرسمي',
    '',
    `تاريخ التجهيز: ${TODAY}`,
    '',
    'هذه الحزمة مخصصة للموقع الرسمي للجمعية، وليست لبوابة النظام العامة.',
    '',
    '- `manifest.csv`: فهرس الملفات العامة.',
    '- `files/`: الملفات المقترحة للنشر العام كما هي من مجلد `ISO9001/05_وثائق_النشر_العام`.',
    '',
    'قبل النشر على الموقع الرسمي، راجع الاعتماد النهائي، الإصدار، وتاريخ السريان لكل وثيقة.',
    '',
  ].join('\n'), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    outputs: {
      manifest: path.relative(ROOT, OUT_MANIFEST).replace(/\\/g, '/'),
      priorityCsv: path.relative(ROOT, OUT_PRIORITY).replace(/\\/g, '/'),
      publicPackage: path.relative(ROOT, OUT_PUBLIC_DIR).replace(/\\/g, '/'),
    },
    counts: manifest.counts,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
