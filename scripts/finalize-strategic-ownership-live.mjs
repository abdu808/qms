import { writeFile } from 'node:fs/promises';
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

function countBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item) || 'غير محدد';
    if (!map.has(key)) map.set(key, 0);
    map.set(key, map.get(key) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
}

function byCode(items) {
  return Object.fromEntries(items.map(item => [item.code, item]));
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' |')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map(row => `| ${row.map(value => String(value ?? '').replace(/\n/g, '<br>')).join(' |')} |`),
  ].join('\n');
}

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const csrf = await ensureCsrf(login.token);
  const auth = { authorization: `Bearer ${login.token}` };
  const writeHeaders = { ...auth, 'x-csrf-token': csrf };

  const initiativesBefore = await request('/api/initiatives?limit=100&includeDeleted=1', { headers: auth });
  const archiveCodes = ['INI-2026-015', 'INI-2026-025', 'INI-2026-026', 'INI-2026-030'];
  const archived = [];
  const initiativeMapBefore = byCode(initiativesBefore.items || []);

  for (const code of archiveCodes) {
    const item = initiativeMapBefore[code];
    if (!item) {
      archived.push({ code, action: 'not_found' });
      continue;
    }
    if (item.deletedAt) {
      archived.push({ code, action: 'already_archived', id: item.id, name: item.name });
      continue;
    }
    await request(`/api/initiatives/${item.id}`, {
      method: 'DELETE',
      headers: writeHeaders,
    });
    archived.push({ code, action: 'archived', id: item.id, name: item.name });
  }

  const [indicatorsRes, objectivesRes, initiativesRes, goalsRes, departmentsRes] = await Promise.all([
    request('/api/indicators?limit=100', { headers: auth }),
    request('/api/objectives?limit=100', { headers: auth }),
    request('/api/initiatives?limit=100&includeDeleted=1', { headers: auth }),
    request('/api/strategic-goals?limit=100', { headers: auth }),
    request('/api/departments?limit=100', { headers: auth }),
  ]);

  const indicators = indicatorsRes.items || [];
  const objectives = objectivesRes.items || [];
  const initiatives = initiativesRes.items || [];
  const activeInitiatives = initiatives.filter(item => !item.deletedAt);
  const goals = goalsRes.items || [];
  const departments = departmentsRes.items || [];

  const missingIndicatorOwnership = indicators
    .filter(item => !item.ownerId || !item.dataEntryUserId || !item.approverUserId)
    .map(item => ({
      code: item.code,
      name: item.nameAr,
      ownerMissing: !item.ownerId,
      dataEntryMissing: !item.dataEntryUserId,
      approverMissing: !item.approverUserId,
    }));

  const newIndicatorCodes = ['IND-2026-020', 'IND-2026-021', 'IND-2026-022', 'IND-2026-023'];
  const indicatorMap = byCode(indicators);
  const newIndicators = newIndicatorCodes.map(code => {
    const item = indicatorMap[code];
    return {
      code,
      exists: !!item,
      name: item?.nameAr || null,
      owner: item?.owner?.name || null,
      objective: item?.objective?.title || null,
      hasFullOwnership: !!(item?.ownerId && item?.dataEntryUserId && item?.approverUserId),
    };
  });

  const ownerLoad = {
    indicatorsByOwner: countBy(indicators, item => item.owner?.name),
    objectivesByOwner: countBy(objectives, item => item.owner?.name),
    initiativesByOwner: countBy(activeInitiatives, item => item.owner?.name),
    initiativesByDepartment: countBy(activeInitiatives, item => item.department?.name),
  };

  const result = {
    ok: true,
    date: DATE,
    archived,
    totals: {
      indicators: indicators.length,
      objectives: objectives.length,
      activeInitiatives: activeInitiatives.length,
      allInitiatives: initiatives.length,
      goals: goals.length,
      departments: departments.length,
    },
    missingIndicatorOwnership,
    newIndicators,
    ownerLoad,
    strategicGoalResponsibilities: goals.map(goal => ({
      code: goal.code,
      title: goal.title,
      responsible: goal.responsible || null,
    })).sort((a, b) => a.code.localeCompare(b.code)),
  };

  const docsDir = join(process.cwd(), 'docs');
  const jsonPath = join(docsDir, `strategic-ownership-finalization-results-${DATE}.json`);
  const mdPath = join(docsDir, `strategic-ownership-finalization-report-${DATE}.md`);

  await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  const md = [
    '# تقرير اعتماد مصفوفة الملكية في النظام الحي',
    '',
    `**التاريخ:** ${DATE}`,
    '',
    '## ملخص التنفيذ',
    '',
    `- المؤشرات: ${result.totals.indicators}`,
    `- الأهداف التشغيلية: ${result.totals.objectives}`,
    `- المبادرات النشطة بعد الأرشفة: ${result.totals.activeInitiatives}`,
    `- إجمالي المبادرات شامل المؤرشفة: ${result.totals.allInitiatives}`,
    `- الأقسام: ${result.totals.departments}`,
    `- مؤشرات ناقصة الملكية: ${missingIndicatorOwnership.length}`,
    '',
    '## أرشفة المبادرات المحذوفة',
    '',
    mdTable(['الكود', 'الإجراء', 'الاسم'], archived.map(item => [item.code, item.action, item.name || ''])),
    '',
    '## المؤشرات الجديدة وإغلاق الفجوات',
    '',
    mdTable(['الكود', 'موجود', 'المؤشر', 'المالك', 'الهدف المرتبط', 'ملكية مكتملة'], newIndicators.map(item => [
      item.code,
      item.exists ? 'نعم' : 'لا',
      item.name || '',
      item.owner || '',
      item.objective || '',
      item.hasFullOwnership ? 'نعم' : 'لا',
    ])),
    '',
    '## توزيع ملكية المؤشرات',
    '',
    mdTable(['المالك', 'عدد المؤشرات'], ownerLoad.indicatorsByOwner.map(item => [item.name, item.count])),
    '',
    '## توزيع ملكية الأهداف التشغيلية',
    '',
    mdTable(['المالك', 'عدد الأهداف'], ownerLoad.objectivesByOwner.map(item => [item.name, item.count])),
    '',
    '## توزيع ملكية المبادرات النشطة',
    '',
    mdTable(['المالك', 'عدد المبادرات'], ownerLoad.initiativesByOwner.map(item => [item.name, item.count])),
    '',
    '## مسؤوليات الأهداف الاستراتيجية',
    '',
    mdTable(['الكود', 'الهدف الاستراتيجي', 'الجهة المسؤولة'], result.strategicGoalResponsibilities.map(item => [
      item.code,
      item.title,
      item.responsible || '',
    ])),
    '',
    '## الحكم النهائي',
    '',
    missingIndicatorOwnership.length === 0
      ? 'تم إغلاق متطلب الملكية للمؤشرات: كل مؤشر لديه مالك أداء ومالك بيانات وجهة اعتماد.'
      : 'توجد مؤشرات تحتاج استكمال ملكية، ويجب مراجعتها قبل الاعتماد النهائي.',
    '',
  ].join('\n');
  await writeFile(mdPath, md, 'utf8');

  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, summary: result.totals, archived, missingIndicatorOwnership }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
