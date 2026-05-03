const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa/api';
const EMAIL = process.env.QMS_ADMIN_EMAIL || 'admin@bir-sabia.org.sa';
const PASSWORD = process.env.QMS_ADMIN_PASSWORD;
const READY_ROWS_PATH = new URL('../../../outputs/kpi-data-template/ready-2025-all-rows.json', import.meta.url);
const YEAR = 2025;
const MONTH = 12;

const apply = process.argv.includes('--apply');
const onlyFirst = process.argv.includes('--one');

if (!PASSWORD) {
  throw new Error('Set QMS_ADMIN_PASSWORD before running this script.');
}

async function loadBaselineRows() {
  const { readFile } = await import('node:fs/promises');
  const payload = JSON.parse(await readFile(READY_ROWS_PATH, 'utf8'));
  const rows = payload.rows || [];
  if (rows.length !== 21) throw new Error(`Expected 21 ready rows, found ${rows.length}`);
  return rows.map((row) => ({
    code: row.code,
    actualValue: Number(row.actual2025),
    source: row.evidence || row.source || 'نموذج تعبئة بيانات مؤشرات الخطة 2025',
    note: row.note || 'قراءة تأسيسية لعام 2025.',
  }));
}

const cookies = new Map();
function storeCookies(res) {
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const header of setCookie) {
    const [pair] = header.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (cookies.size) headers.set('Cookie', cookieHeader());
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
    headers.set('Content-Type', 'application/json');
    if (cookies.get('csrf')) headers.set('X-CSRF-Token', cookies.get('csrf'));
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  storeCookies(res);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${options.method || 'GET'} ${path} failed ${res.status}: ${detail}`);
  }
  return body;
}

let token = null;

async function main() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  storeCookies(loginRes);
  const loginText = await loginRes.text();
  const login = JSON.parse(loginText);
  if (!loginRes.ok || !login.token) throw new Error(`Login failed: ${loginText}`);
  token = login.token;

  const baselineRows = await loadBaselineRows();
  const indicatorsPayload = await request('/indicators?limit=100&sort=code&order=asc');
  const indicators = indicatorsPayload.items || [];
  const byCode = new Map(indicators.map((indicator) => [indicator.code, indicator]));

  const missing = baselineRows.filter((row) => !byCode.has(row.code)).map((row) => row.code);
  if (missing.length) throw new Error(`Missing live indicators: ${missing.join(', ')}`);

  const existingPayload = await request(`/kpi/entries?year=${YEAR}&month=${MONTH}`);
  const existing = existingPayload.items || existingPayload.entries || [];
  const existingByIndicator = new Map(existing.filter((entry) => entry.indicatorId).map((entry) => [entry.indicatorId, entry]));

  const rows = onlyFirst ? baselineRows.slice(0, 1) : baselineRows;
  const planned = rows.map((row) => {
    const indicator = byCode.get(row.code);
    return {
      ...row,
      indicatorId: indicator.id,
      indicatorName: indicator.nameAr,
      existingEntryId: existingByIndicator.get(indicator.id)?.id || null,
    };
  });

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      baseUrl: BASE_URL,
      csrf: Boolean(cookies.get('csrf')),
      liveIndicators: indicators.length,
      plannedRows: planned.length,
      existingEntriesForPeriod: existing.length,
      planned,
      next: 'Run with --apply to write. Add --one to write only the first row.',
    }, null, 2));
    return;
  }

  const results = [];
  for (const row of planned) {
    const payload = {
      indicatorId: row.indicatorId,
      year: YEAR,
      month: MONTH,
      actualValue: row.actualValue,
      evidenceUrl: row.source,
      note: `Baseline 2025 closing reading. Source: ${row.source}. ${row.note}`,
    };
    const written = await request('/kpi/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const entryId = written.entry?.id || written.item?.id;
    const entryStatus = written.entry?.entryStatus || written.item?.entryStatus || null;
    let approved = null;
    let approveSkipped = false;
    if (entryId && entryStatus !== 'APPROVED') {
      approved = await request(`/kpi/entries/${entryId}/approve`, { method: 'POST', body: JSON.stringify({}) });
    } else if (entryStatus === 'APPROVED') {
      approveSkipped = true;
    }
    results.push({
      code: row.code,
      indicatorId: row.indicatorId,
      actualValue: row.actualValue,
      entryId,
      entryStatus,
      approved: Boolean(approved?.item) || approveSkipped,
    });
  }

  const verifyPayload = await request(`/kpi/entries?year=${YEAR}&month=${MONTH}`);
  const verifyEntries = verifyPayload.items || verifyPayload.entries || [];
  const verifyCodes = verifyEntries
    .filter((entry) => entry.indicatorId)
    .map((entry) => indicators.find((indicator) => indicator.id === entry.indicatorId)?.code)
    .filter(Boolean)
    .sort();

  console.log(JSON.stringify({
    mode: 'apply',
    written: results.length,
    verifiedEntriesForPeriod: verifyEntries.length,
    verifiedCodes: verifyCodes,
    results,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
