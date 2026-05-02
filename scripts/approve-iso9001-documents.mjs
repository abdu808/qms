import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const IMPORT_RESULTS_PATH = path.join(ROOT, 'docs', `iso9001-production-import-results-${TODAY}.json`);
const APPROVAL_RESULTS_PATH = path.join(ROOT, 'docs', `iso9001-production-approval-results-${TODAY}.json`);

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CONFIRMED = args.has('--yes-i-understand-production-write');

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

async function updateStatus(baseUrl, token, csrf, jar, documentId, status) {
  return request(baseUrl, `/api/documents/${documentId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ status }),
  }, jar);
}

async function approveAndPublish(baseUrl, token, csrf, jar, documentId) {
  return request(baseUrl, `/api/documents/${documentId}/approve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ publish: true }),
  }, jar);
}

async function approveOnly(baseUrl, token, csrf, jar, documentId) {
  return request(baseUrl, `/api/documents/${documentId}/approve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ publish: false }),
  }, jar);
}

async function getDocument(baseUrl, token, jar, documentId) {
  return request(baseUrl, `/api/documents/${documentId}`, {
    headers: { authorization: `Bearer ${token}` },
  }, jar);
}

async function listDocuments(baseUrl, token, jar) {
  return request(baseUrl, '/api/documents?limit=100', {
    headers: { authorization: `Bearer ${token}` },
  }, jar);
}

async function getIsoReadiness(baseUrl, token, jar) {
  return request(baseUrl, '/api/iso-readiness', {
    headers: { authorization: `Bearer ${token}` },
  }, jar);
}

function summarizeImportedDocuments(importResults) {
  return (importResults.results || [])
    .filter(item => item.documentId)
    .map(item => ({
      sourceCode: item.code,
      title: item.title,
      documentId: item.documentId,
      documentCode: item.documentCode,
    }));
}

async function main() {
  const importResults = JSON.parse(await fs.readFile(IMPORT_RESULTS_PATH, 'utf8'));
  const documents = summarizeImportedDocuments(importResults);

  const dryRunOutput = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    target: process.env.QMS_BASE_URL || importResults.target || 'https://quality.aqiltech.sa',
    count: documents.length,
    plannedTransitions: documents.map(item => ({
      ...item,
      transitions: ['UNDER_REVIEW', 'PUBLISHED'],
    })),
  };

  if (!APPLY) {
    await fs.writeFile(APPROVAL_RESULTS_PATH, JSON.stringify(dryRunOutput, null, 2), 'utf8');
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      result: path.relative(ROOT, APPROVAL_RESULTS_PATH).replace(/\\/g, '/'),
      count: documents.length,
    }, null, 2));
    return;
  }

  if (!CONFIRMED) {
    throw new Error('Refusing production write. Re-run with --apply --yes-i-understand-production-write after explicit approval.');
  }

  const baseUrl = process.env.QMS_BASE_URL || importResults.target || 'https://quality.aqiltech.sa';
  const email = process.env.QMS_EMAIL;
  const password = process.env.QMS_PASSWORD;
  if (!email || !password) throw new Error('Set QMS_EMAIL and QMS_PASSWORD in environment.');

  const jar = new Map();
  const token = await login(baseUrl, email, password, jar);
  const csrf = await ensureCsrf(baseUrl, token, jar);

  const results = [];
  for (const doc of documents) {
    const initial = await getDocument(baseUrl, token, jar, doc.documentId);
    let currentStatus = initial.item?.status;
    const transitions = [];

    if (currentStatus === 'DRAFT') {
      const review = await updateStatus(baseUrl, token, csrf, jar, doc.documentId, 'UNDER_REVIEW');
      currentStatus = review.item?.status;
      transitions.push(currentStatus);
    }

    if (currentStatus === 'UNDER_REVIEW') {
      const approved = await approveOnly(baseUrl, token, csrf, jar, doc.documentId);
      currentStatus = approved.item?.status;
      transitions.push(currentStatus);
    }

    let final = currentStatus === 'PUBLISHED'
      ? initial
      : await approveAndPublish(baseUrl, token, csrf, jar, doc.documentId);
    currentStatus = final.item?.status;
    transitions.push(currentStatus);

    results.push({
      ...doc,
      initialStatus: initial.item?.status,
      transitions,
      finalStatus: currentStatus,
      approvedAt: final.item?.approvedAt || null,
      effectiveDate: final.item?.effectiveDate || null,
    });
  }

  const documentList = await listDocuments(baseUrl, token, jar);
  const readiness = await getIsoReadiness(baseUrl, token, jar);
  const importedIds = new Set(documents.map(item => item.documentId));
  const importedDocuments = (documentList.items || []).filter(item => importedIds.has(item.id));

  await fs.writeFile(APPROVAL_RESULTS_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: 'apply',
    target: baseUrl,
    count: results.length,
    results,
    verification: {
      importedPublished: importedDocuments.filter(item => item.status === 'PUBLISHED').length,
      importedTotal: importedDocuments.length,
      statusCounts: importedDocuments.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
      isoReadinessScore: readiness.score,
      isoReadinessPercentage: readiness.percentage,
    },
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    result: path.relative(ROOT, APPROVAL_RESULTS_PATH).replace(/\\/g, '/'),
    count: results.length,
    published: importedDocuments.filter(item => item.status === 'PUBLISHED').length,
    readiness: {
      score: readiness.score,
      percentage: readiness.percentage,
    },
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
