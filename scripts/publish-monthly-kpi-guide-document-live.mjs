import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
const EMAIL = process.env.QMS_EMAIL;
const PASSWORD = process.env.QMS_PASSWORD;
const DATE = '2026-05-02';
const TITLE = 'دليل التشغيل الشهري للمؤشرات وتصحيح الانحرافات';

if (!EMAIL || !PASSWORD) {
  throw new Error('Set QMS_EMAIL and QMS_PASSWORD.');
}

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function absorbSetCookie(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return;
  for (const part of raw.split(/,(?=[^ ;]+=)/)) {
    const first = part.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
}

async function request(path, options = {}) {
  const headers = new Headers({
    ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
    ...(options.headers || {}),
  });
  if (jar.size) headers.set('cookie', cookieHeader());
  const res = await fetch(new URL(path, BASE_URL), { ...options, headers });
  absorbSetCookie(res.headers);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function ensureCsrf(token) {
  await request('/api/dashboard', { headers: { authorization: `Bearer ${token}` } });
  const csrf = jar.get('csrf');
  if (!csrf) throw new Error('CSRF cookie was not issued.');
  return csrf;
}

function norm(value) {
  return String(value || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const csrf = await ensureCsrf(login.token);
  const auth = { authorization: `Bearer ${login.token}` };
  const writeHeaders = { ...auth, 'x-csrf-token': csrf };

  const departments = await request('/api/departments?limit=100', { headers: auth });
  const strategyDept = (departments.items || []).find(d => norm(d.name) === norm('وحدة الاستراتيجية والتميز المؤسسي'))
    || (departments.items || []).find(d => norm(d.name).includes(norm('الاستراتيجية')));
  if (!strategyDept) throw new Error('Strategy/excellence department not found.');

  const docs = await request(`/api/documents?limit=100&q=${encodeURIComponent(TITLE)}&includeDeleted=1`, { headers: auth });
  let doc = (docs.items || []).find(item => norm(item.title) === norm(TITLE));

  const payload = {
    title: TITLE,
    category: 'WORK_INSTRUCTION',
    departmentId: strategyDept.id,
    currentVersion: '1.0',
    effectiveDate: '2026-05-02T00:00:00.000Z',
    reviewDate: '2026-12-31T00:00:00.000Z',
    retentionYears: 5,
    isoClause: '9.1.1',
  };

  let action;
  if (!doc) {
    const created = await request('/api/documents', {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(payload),
    });
    doc = created.item;
    action = 'created';
  } else {
    const updated = await request(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: writeHeaders,
      body: JSON.stringify(payload),
    });
    doc = updated.item;
    action = 'updated';
  }

  const filePath = join(
    process.cwd(),
    'ISO9001',
    'الخطط والمشرات',
    `دليل_التشغيل_الشهري_للمؤشرات_وتصحيح_الانحرافات_${DATE}.xlsx`,
  );
  const buf = await readFile(filePath);
  let versions = await request(`/api/documents/${doc.id}/versions`, { headers: auth });
  let uploadedVersion = (versions.versions || []).find(v => v.version === '1.0' && Number(v.fileSize) === buf.length);
  if (!uploadedVersion) {
    const form = new FormData();
    form.append(
      'file',
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      basename(filePath),
    );
    form.append('version', '1.0');
    form.append('changeLog', 'الإصدار الأول لدليل التشغيل الشهري للمؤشرات وتصحيح الانحرافات بعد ضبط الخطة والملكيات وبرامج نظام الجودة.');

    const uploaded = await request(`/api/documents/${doc.id}/upload`, {
      method: 'POST',
      headers: writeHeaders,
      body: form,
    });
    uploadedVersion = uploaded.version;
  }

  if (doc.status !== 'UNDER_REVIEW' && doc.status !== 'APPROVED' && doc.status !== 'PUBLISHED') {
    const review = await request(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: writeHeaders,
      body: JSON.stringify({ status: 'UNDER_REVIEW' }),
    });
    doc = review.item;
  }

  let approved = { item: doc };
  if (doc.status === 'UNDER_REVIEW') {
    approved = await request(`/api/documents/${doc.id}/approve`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ publish: false }),
    });
  }
  if (approved.item.status !== 'PUBLISHED') {
    approved = await request(`/api/documents/${doc.id}/approve`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ publish: true }),
    });
  }

  versions = await request(`/api/documents/${doc.id}/versions`, { headers: auth });

  const result = {
    ok: true,
    action,
    document: {
      id: approved.item.id,
      code: approved.item.code,
      title: approved.item.title,
      category: approved.item.category,
      status: approved.item.status,
      currentVersion: approved.item.currentVersion,
      department: strategyDept.name,
      isoClause: approved.item.isoClause,
    },
    uploadedVersion: {
      id: uploadedVersion.id,
      version: uploadedVersion.version,
      fileSize: uploadedVersion.fileSize,
      mimeType: uploadedVersion.mimeType,
    },
    versionsCount: versions.versions?.length || 0,
  };

  const output = join(process.cwd(), 'docs', `monthly-kpi-guide-document-live-results-${DATE}.json`);
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({ ...result, output }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
