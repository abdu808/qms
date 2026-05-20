import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const appJsPath = path.join(repoRoot, 'apps', 'web', 'public', 'app.js');
const htmlPath = path.join(repoRoot, 'apps', 'web', 'public', 'index.html');
const writeReport = process.argv.includes('--write-report');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const appSource = read(appJsPath);
const htmlSource = read(htmlPath);

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function extractMenuIds() {
  const ids = [];
  const menuStart = appSource.indexOf('menu: [');
  const groupsStart = appSource.indexOf('menuGroups:', menuStart);
  if (menuStart < 0 || groupsStart < 0) throw new Error('Could not locate menu block');
  const block = appSource.slice(menuStart, groupsStart);
  for (const match of block.matchAll(/\{\s*id:\s*'([^']+)'/g)) ids.push(match[1]);
  return uniqueSorted(ids);
}

function extractMenuGroups() {
  const groups = [];
  const start = appSource.indexOf('menuGroups: [');
  const end = appSource.indexOf('isReadOnly()', start + 1);
  if (start < 0 || end < 0) throw new Error('Could not locate menuGroups block');
  const block = appSource.slice(start, end);
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'[\s\S]*?items:\s*\[([^\]]*)\]/g;
  for (const match of block.matchAll(re)) {
    groups.push({
      id: match[1],
      title: match[2],
      items: [...match[3].matchAll(/'([^']+)'/g)].map(m => m[1]),
    });
  }
  return groups;
}

function extractRoleItems() {
  const roles = new Map();
  const start = appSource.indexOf('const matrix = {');
  const end = appSource.indexOf('};', start);
  if (start < 0 || end < 0) throw new Error('Could not locate role menu matrix');
  const block = appSource.slice(start, end);
  const roleRe = /(SUPER_ADMIN|QUALITY_MANAGER|COMMITTEE_MEMBER|DEPT_MANAGER|EMPLOYEE|GUEST_AUDITOR)\s*:\s*(ALL|\[[\s\S]*?\])/g;
  for (const match of block.matchAll(roleRe)) {
    const role = match[1];
    const body = match[2];
    roles.set(role, body === 'ALL' ? ['ALL_ITEMS'] : [...body.matchAll(/'([^']+)'/g)].map(m => m[1]));
  }
  return roles;
}

function extractAliases() {
  const aliases = new Map();
  const navStart = appSource.indexOf('normalizePageId(id)');
  const start = appSource.indexOf('const aliases = {', navStart);
  const end = appSource.indexOf('};', start);
  if (start < 0 || end < 0) return aliases;
  const block = appSource.slice(start, end);
  for (const match of block.matchAll(/(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*'([^']+)'/g)) {
    aliases.set(match[1] || match[2], match[3]);
  }
  return aliases;
}

function extractHomePages() {
  const ids = [];
  const start = appSource.indexOf('homePageForRole()');
  const end = appSource.indexOf('_uiUserStorageId()', start);
  const block = start >= 0 && end > start ? appSource.slice(start, end) : '';
  for (const match of block.matchAll(/return\s+'([^']+)'/g)) ids.push(match[1]);
  return uniqueSorted(ids);
}

function extractGotoRefs() {
  const refs = [];
  const combined = `${appSource}\n${htmlSource}`;
  const patterns = [
    /goto\(\s*'([^']+)'/g,
    /goToResource\(\s*'([^']+)'/g,
    /href=["']#\/([^"'?#]+)[^"']*["']/g,
    /page:\s*'([^']+)'/g,
  ];
  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) refs.push(match[1]);
  }
  return uniqueSorted(refs);
}

function extractRenderedPages() {
  const ids = [];
  for (const match of htmlSource.matchAll(/page\s*={2,3}\s*'([^']+)'/g)) ids.push(match[1]);
  for (const match of htmlSource.matchAll(/page\s+===\s+'([^']+)'/g)) ids.push(match[1]);
  return uniqueSorted(ids);
}

function extractGenericListExclusion() {
  const match = htmlSource.match(/!\[([^\]]+)\]\.includes\(page\)/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

const menuIds = extractMenuIds();
const menuSet = new Set(menuIds);
const menuGroups = extractMenuGroups();
const roleItems = extractRoleItems();
const aliases = extractAliases();
const aliasKeys = new Set(aliases.keys());
const aliasTargets = new Set(aliases.values());
const homePages = extractHomePages();
const gotoRefs = extractGotoRefs();
const renderedPages = extractRenderedPages();
const renderedSet = new Set(renderedPages);
const genericExclusion = extractGenericListExclusion();
const genericExclusionSet = new Set(genericExclusion);

const groupItems = uniqueSorted(menuGroups.flatMap(g => g.items));
const groupUnknownItems = groupItems.filter(id => !menuSet.has(id));
const groupExemptions = new Set([
  // The auditor dashboard is shown through the dedicated GUEST_AUDITOR menu,
  // not through the normal grouped sidebar.
  'auditorDashboard',
]);
const menuNotInAnyGroup = menuIds.filter(id => !groupItems.includes(id) && !groupExemptions.has(id));

const roleUnknownItems = [];
for (const [role, items] of roleItems.entries()) {
  for (const id of items) {
    if (id === 'ALL_ITEMS') continue;
    if (!menuSet.has(id)) roleUnknownItems.push({ role, id });
  }
}

const homeUnknown = homePages.filter(id => !menuSet.has(id));
const aliasUnknownTargets = [...aliasTargets].filter(id => !menuSet.has(id));
const gotoUnknown = gotoRefs.filter(id => !menuSet.has(id) && !aliasKeys.has(id));

const menuWithoutView = menuIds.filter(id => {
  if (renderedSet.has(id)) return false;
  if (!genericExclusionSet.has(id)) return false;
  return true;
});

const excludedWithoutView = genericExclusion.filter(id => !renderedSet.has(id));

const genericListPages = menuIds.filter(id => !genericExclusionSet.has(id));

const warnings = [];
if (menuNotInAnyGroup.length) warnings.push({ type: 'menu_not_in_group', items: menuNotInAnyGroup });

const failures = {
  groupUnknownItems,
  roleUnknownItems,
  homeUnknown,
  aliasUnknownTargets,
  gotoUnknown,
  menuWithoutView,
  excludedWithoutView,
};

const ok = Object.values(failures).every(items => items.length === 0);

const summary = {
  menuItems: menuIds.length,
  groups: menuGroups.length,
  groupedItems: groupItems.length,
  roleMatrices: roleItems.size,
  renderedExplicitPages: renderedPages.length,
  genericListPages: genericListPages.length,
  gotoReferences: gotoRefs.length,
  warnings: warnings.length,
  failures: Object.values(failures).reduce((sum, items) => sum + items.length, 0),
};

function mdTable(rows, columns) {
  const header = `| ${columns.map(c => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(c => String(c.value(row) ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function writeMarkdownReport() {
  const reportPath = path.join(repoRoot, 'docs', 'frontend-navigation-audit.md');
  const groupRows = menuGroups.map(g => ({
    id: g.id,
    title: g.title,
    count: g.items.length,
    items: g.items.join(', '),
  }));
  const roleRows = [...roleItems.entries()].map(([role, items]) => ({
    role,
    count: items[0] === 'ALL_ITEMS' ? 'ALL' : items.length,
    items: items.join(', '),
  }));

  const lines = [
    '# فحص ترابط واجهة النظام',
    '',
    `آخر تحديث: ${new Date().toISOString()}`,
    '',
    '## الخلاصة',
    '',
    `- النتيجة: ${ok ? 'ناجح' : 'يحتاج معالجة'}`,
    `- عناصر القائمة: ${summary.menuItems}`,
    `- مجموعات القائمة: ${summary.groups}`,
    `- صفحات تعرض بقالب خاص: ${summary.renderedExplicitPages}`,
    `- صفحات تستخدم عرض القائمة العام: ${summary.genericListPages}`,
    `- مراجع الانتقال goto/hash: ${summary.gotoReferences}`,
    `- أخطاء مانعة: ${summary.failures}`,
    `- تنبيهات غير مانعة: ${summary.warnings}`,
    '',
    '## مجموعات القائمة',
    '',
    mdTable(groupRows, [
      { label: 'المجموعة', value: r => r.id },
      { label: 'العنوان', value: r => r.title },
      { label: 'العدد', value: r => r.count },
      { label: 'الصفحات', value: r => r.items },
    ]),
    '',
    '## مصفوفة الأدوار في الواجهة',
    '',
    mdTable(roleRows, [
      { label: 'الدور', value: r => r.role },
      { label: 'العدد', value: r => r.count },
      { label: 'الصفحات', value: r => r.items },
    ]),
    '',
    '## نتائج يجب ألا تظهر',
    '',
    `- عناصر في المجموعات وغير موجودة في menu: ${groupUnknownItems.length}`,
    `- عناصر في مصفوفة الأدوار وغير موجودة في menu: ${roleUnknownItems.length}`,
    `- صفحات رئيسية غير موجودة في menu: ${homeUnknown.length}`,
    `- أهداف aliases غير موجودة في menu: ${aliasUnknownTargets.length}`,
    `- روابط goto/hash غير معروفة: ${gotoUnknown.length}`,
    `- صفحات مستثناة من العرض العام بلا قالب خاص: ${excludedWithoutView.length}`,
    '',
    '## تنبيهات غير مانعة',
    '',
    menuNotInAnyGroup.length
      ? menuNotInAnyGroup.map(id => `- ${id}`).join('\n')
      : '- لا يوجد.',
    '',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return reportPath;
}

if (writeReport) {
  const reportPath = writeMarkdownReport();
  console.log(`frontend navigation report written: ${path.relative(repoRoot, reportPath)}`);
}

console.log(JSON.stringify({ ok, summary }, null, 2));

if (!ok) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
