import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const MANIFEST_PATH = path.join(ROOT, 'docs', `iso9001-import-manifest-${TODAY}.json`);
const PLAN_PATH = path.join(ROOT, 'docs', `iso9001-production-import-plan-${TODAY}.json`);

const PRIORITY_CODES = [
  'QM-001', 'QM-002',
  'QP-001', 'QP-002', 'QP-003', 'QP-004', 'QP-005',
  'HR-001', 'IT-001', 'PUR-001', 'QS-001', 'QS-004',
  'IA-001', 'IA-002', 'CA-001', 'CA-002', 'MR-001', 'MR-002',
];

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CONFIRMED = args.has('--yes-i-understand-production-write');
const LIMIT_ARG = [...args].find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice('--limit='.length)) : null;

function isPriority(item) {
  return PRIORITY_CODES.some(code => item.code?.startsWith(code));
}

function shouldUpload(item) {
  return ['.docx', '.pdf', '.md', '.html'].includes(String(item.ext || '').toLowerCase());
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbSetCookie(jar, headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return;
  for (const part of raw.split(/,(?=[^ ;]+=)/)) {
    const first = part.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
}

async function request(baseUrl, pathName, options, jar) {
  const headers = new Headers(options.headers || {});
  if (jar.size) headers.set('cookie', cookieHeader(jar));
  const res = await fetch(new URL(pathName, baseUrl), { ...options, headers });
  absorbSetCookie(jar, res.headers);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${options.method || 'GET'} ${pathName} -> ${res.status}: ${message}`);
  }
  return body;
}

async function login(baseUrl, email, password, jar) {
  const body = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, jar);
  if (!body.token) throw new Error('Login succeeded but no token was returned.');
  return body.token;
}

async function ensureCsrf(baseUrl, token, jar) {
  await request(baseUrl, '/api/documents?limit=1', {
    headers: { authorization: `Bearer ${token}` },
  }, jar);
  const csrf = jar.get('csrf');
  if (!csrf) throw new Error('CSRF cookie was not issued.');
  return csrf;
}

async function createDocument(baseUrl, token, csrf, jar, payload) {
  return request(baseUrl, '/api/documents', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify(payload),
  }, jar);
}

async function uploadVersion(baseUrl, token, csrf, jar, documentId, item) {
  const form = new FormData();
  form.set('version', item.version || '1.0');
  form.set('changeLog', 'Initial import from ISO9001 controlled source.');
  const mimeByExt = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.html': 'text/html',
  };
  const file = new Blob([await fs.readFile(item.filePath)], {
    type: mimeByExt[String(item.ext || '').toLowerCase()] || 'application/octet-stream',
  });
  form.set('file', file, item.filename);

  return request(baseUrl, `/api/documents/${documentId}/upload`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrf,
    },
    body: form,
  }, jar);
}

function buildPlan(manifest) {
  const candidates = manifest.internalDocumentCandidates
    .filter(isPriority)
    .filter(shouldUpload)
    .filter(item => ['manual', 'policy', 'procedure', 'form', 'report', 'operational_plan', 'strategic_plan'].includes(item.category))
    .sort((a, b) => PRIORITY_CODES.findIndex(c => a.code?.startsWith(c)) - PRIORITY_CODES.findIndex(c => b.code?.startsWith(c)));

  const deduped = [];
  const seen = new Set();
  for (const item of candidates) {
    const key = item.code || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return (LIMIT ? deduped.slice(0, LIMIT) : deduped).map(item => ({
    code: item.code,
    title: item.title,
    source: path.relative(ROOT, item.filePath).replace(/\\/g, '/'),
    ext: item.ext,
    isoClause: item.isoClauseRaw,
    payload: item.apiCreatePayload,
    upload: true,
    filePath: item.filePath,
    filename: item.filename,
    version: item.version,
  }));
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const plan = buildPlan(manifest);

  const output = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    note: 'Creating records or uploading files to production requires explicit final approval. This script is dry-run unless --apply and --yes-i-understand-production-write are both provided.',
    target: process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa',
    count: plan.length,
    items: plan.map(({ filePath, ...item }) => item),
  };
  await fs.writeFile(PLAN_PATH, JSON.stringify(output, null, 2), 'utf8');

  if (!APPLY) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      plan: path.relative(ROOT, PLAN_PATH).replace(/\\/g, '/'),
      count: plan.length,
    }, null, 2));
    return;
  }

  if (!CONFIRMED) {
    throw new Error('Refusing production write. Re-run with --apply --yes-i-understand-production-write after explicit approval.');
  }

  const baseUrl = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
  const email = process.env.QMS_EMAIL;
  const password = process.env.QMS_PASSWORD;
  if (!email || !password) throw new Error('Set QMS_EMAIL and QMS_PASSWORD in environment.');

  const jar = new Map();
  const token = await login(baseUrl, email, password, jar);
  const csrf = await ensureCsrf(baseUrl, token, jar);

  const results = [];
  for (const item of plan) {
    const created = await createDocument(baseUrl, token, csrf, jar, item.payload);
    const documentId = created.item?.id;
    let uploaded = null;
    if (documentId) uploaded = await uploadVersion(baseUrl, token, csrf, jar, documentId, item);
    results.push({
      code: item.code,
      title: item.title,
      documentId,
      documentCode: created.item?.code,
      uploadVersionId: uploaded?.version?.id || null,
    });
  }

  const resultPath = path.join(ROOT, 'docs', `iso9001-production-import-results-${TODAY}.json`);
  await fs.writeFile(resultPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    target: baseUrl,
    results,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    result: path.relative(ROOT, resultPath).replace(/\\/g, '/'),
    count: results.length,
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
