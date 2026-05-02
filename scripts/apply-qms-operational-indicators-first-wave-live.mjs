import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
const EMAIL = process.env.QMS_EMAIL;
const PASSWORD = process.env.QMS_PASSWORD;
const DATE = '2026-05-02';

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
    'content-type': 'application/json',
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

function findUser(users, names) {
  for (const name of names) {
    const target = norm(name);
    const exact = users.find(user => norm(user.name) === target);
    if (exact) return exact;
    const partial = users.find(user => norm(user.name).includes(target) || target.includes(norm(user.name)));
    if (partial) return partial;
  }
  return null;
}

function enumFrequency(value) {
  if (String(value).includes('ربع')) return 'QUARTERLY';
  if (String(value).includes('سنوي')) return 'ANNUALLY';
  return 'MONTHLY';
}

function unitToDirection(unit, indicator) {
  const text = `${unit || ''} ${indicator || ''}`;
  if (text.includes('زمن') || text.includes('وقت') || text.includes('أيام') || text.includes('ساعات')) return 'LOWER_BETTER';
  return 'HIGHER_BETTER';
}

function unitToKpiType(unit) {
  return unit === 'عدد' ? 'CUMULATIVE' : 'SNAPSHOT';
}

const USER_BY_OWNER = {
  'وحدة الاستراتيجية والتميز المؤسسي': ['ايلاف حسن', 'إيلاف حسن'],
  'وحدة الرقابة الداخلية': ['عبدالرحمن عقيل'],
  'قسم تقنية المعلومات': ['عبدالرحمن عقيل'],
};

async function main() {
  const catalogPath = join(process.cwd(), 'docs', `qms-operational-indicators-catalog-${DATE}.json`);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const firstWave = catalog.rows.filter(row => row.recommendation === 'يضاف للنظام');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const csrf = await ensureCsrf(login.token);
  const auth = { authorization: `Bearer ${login.token}` };
  const writeHeaders = { ...auth, 'x-csrf-token': csrf };

  const [usersRes, indicatorsRes] = await Promise.all([
    request('/api/users', { headers: auth }),
    request('/api/indicators?limit=100', { headers: auth }),
  ]);
  const users = (usersRes.items || []).filter(user => user.active !== false);
  const existingIndicators = indicatorsRes.items || [];

  const created = [];
  const updated = [];
  const unchanged = [];
  const skipped = [];

  for (const row of firstWave) {
    const qopToken = `[${row.indicator_code}]`;
    const existing = existingIndicators.find(item =>
      norm(item.nameAr) === norm(row.indicator)
      || String(item.notes || '').includes(qopToken)
    );

    const owner = findUser(users, USER_BY_OWNER[row.owner] || ['ايلاف حسن', 'إيلاف حسن']);
    const dataEntry = row.data_owner === 'جميع الإدارات حسب المؤشر' || row.data_owner === 'الإدارات المالكة للإجراء'
      ? owner
      : findUser(users, USER_BY_OWNER[row.data_owner] || USER_BY_OWNER[row.owner] || ['ايلاف حسن', 'إيلاف حسن']);
    const approver = row.approver === 'لجنة المراجعة'
      ? findUser(users, ['عبدالرحمن عقيل'])
      : findUser(users, USER_BY_OWNER[row.approver] || ['عبدالرحمن عقيل', 'ايلاف حسن', 'إيلاف حسن']);

    if (!owner || !dataEntry || !approver) {
      skipped.push({
        qopCode: row.indicator_code,
        indicator: row.indicator,
        reason: 'missing_user',
        ownerFound: !!owner,
        dataEntryFound: !!dataEntry,
        approverFound: !!approver,
      });
      continue;
    }

    const payload = {
      nameAr: row.indicator,
      definition: row.definition,
      formula: row.formula,
      unit: row.unit,
      direction: unitToDirection(row.unit, row.indicator),
      frequency: enumFrequency(row.frequency),
      kpiType: unitToKpiType(row.unit),
      seasonality: 'UNIFORM',
      indicatorType: 'LEADING',
      dataSource: 'MANUAL',
      baseline: null,
      weight: 0,
      greenThreshold: 95,
      yellowThreshold: 75,
      notes: [
        `${qopToken} مؤشر تشغيلي داخلي لبرامج نظام الجودة، لا يدخل في وزن الخطة الاستراتيجية.`,
        `البرنامج: ${row.program_code} — ${row.program}.`,
        `مصدر البيانات: ${row.source}.`,
        `مستهدف 2026: ${row.target_2026}.`,
      ].join('\n'),
      ownerId: owner.id,
      dataEntryUserId: dataEntry.id,
      approverUserId: approver.id,
    };

    if (!existing) {
      const res = await request('/api/indicators', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify(payload),
      });
      created.push({
        qopCode: row.indicator_code,
        liveCode: res.item.code,
        name: res.item.nameAr,
        owner: owner.name,
      });
      continue;
    }

    const patch = {};
    for (const key of ['definition', 'formula', 'unit', 'direction', 'frequency', 'kpiType', 'seasonality', 'indicatorType', 'dataSource', 'weight', 'greenThreshold', 'yellowThreshold', 'notes', 'ownerId', 'dataEntryUserId', 'approverUserId']) {
      const current = existing[key] ?? null;
      const next = payload[key] ?? null;
      if (current !== next) patch[key] = next;
    }
    if (Object.keys(patch).length) {
      const res = await request(`/api/indicators/${existing.id}`, {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify(patch),
      });
      updated.push({
        qopCode: row.indicator_code,
        liveCode: res.item.code,
        name: res.item.nameAr,
        owner: owner.name,
      });
    } else {
      unchanged.push({
        qopCode: row.indicator_code,
        liveCode: existing.code,
        name: existing.nameAr,
        owner: existing.owner?.name || owner.name,
      });
    }
  }

  const verify = await request('/api/indicators?limit=100', { headers: auth });
  const qopIndicators = (verify.items || []).filter(item => String(item.notes || '').includes('[QOP-2026-'));
  const missingOwnership = qopIndicators.filter(item => !item.ownerId || !item.dataEntryUserId || !item.approverUserId);
  const weightCheck = await request('/api/indicators/weight-check', { headers: auth });

  const result = {
    ok: skipped.length === 0 && missingOwnership.length === 0,
    date: DATE,
    policy: 'إضافة الدفعة الأولى فقط من مؤشرات برامج نظام الجودة، بوزن صفر حتى لا تؤثر على وزن الخطة الاستراتيجية.',
    created,
    updated,
    unchanged,
    skipped,
    verification: {
      totalIndicators: verify.total,
      qopIndicators: qopIndicators.length,
      missingQopOwnership: missingOwnership.map(item => ({ code: item.code, name: item.nameAr })),
      strategicWeightTotal: weightCheck.total,
      strategicWeightValid: weightCheck.isValid,
    },
  };

  const output = join(process.cwd(), 'docs', `qms-operational-indicators-first-wave-live-results-${DATE}.json`);
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({ ...result, output }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
