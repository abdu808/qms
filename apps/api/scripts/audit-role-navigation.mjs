import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../../..');
const webPublic = path.join(root, 'apps/web/public');
const apiSrc = path.join(root, 'apps/api/src');

const roles = ['EMPLOYEE', 'DEPT_MANAGER', 'COMMITTEE_MEMBER', 'QUALITY_MANAGER', 'SUPER_ADMIN'];
const roleLabels = {
  EMPLOYEE: 'الموظف',
  DEPT_MANAGER: 'رئيس القسم',
  COMMITTEE_MEMBER: 'عضو اللجنة',
  QUALITY_MANAGER: 'مدير الجودة',
  SUPER_ADMIN: 'مسؤول النظام',
};
const roleIntent = {
  EMPLOYEE: 'يرى عمله الشخصي فقط: القراءات المطلوبة منه، إقراراته، البلاغات/الشكاوى/NCR المسندة، ودليل المستخدم.',
  DEPT_MANAGER: 'يرى متابعة قسمه وتنفيذ فريقه وحالات الجودة ضمن نطاقه، ولا يرى لوحة الإدارة العامة أو بيانات تشغيل الأقسام الأخرى.',
  COMMITTEE_MEMBER: 'يرى ملخصات المراجعة والجاهزية والامتثال وما يحتاج قراراً أو متابعة، بدون إدارة النظام.',
  QUALITY_MANAGER: 'يرى مركز قيادة الجودة والجاهزية والمتأخرات وحالات التحسين، مع صلاحيات متابعة واعتماد أوسع.',
  SUPER_ADMIN: 'يرى كل وحدات النظام لإدارة الإعدادات والصلاحيات والتكاملات والدعم الكامل.',
};
const deptManagerForbiddenPages = [
  'dashboard',
  'dataHealth',
  'operationalReports',
  'reportBuilder',
  'beneficiaries',
  'donations',
  'programs',
  'suppliers',
];
const roleForbiddenPages = {
  DEPT_MANAGER: deptManagerForbiddenPages,
  QUALITY_MANAGER: ['portalAdmin'],
};
const customPages = new Set([
  'dashboard',
  'myWork',
  'myKpi',
  'myAcknowledgments',
  'acknowledgmentsMatrix',
  'audit-log',
  'annualTargets',
  'planMap',
  'iso-readiness',
  'isoRequirements',
  'monthlyReadiness',
  'templateLibrary',
  'qualityScope',
  'organizationalChart',
  'dataHealth',
  'kpiTracking',
  'kpiFollowUp',
  'operationalReports',
  'progressReports',
  'slaBoard',
  'reportBuilder',
  'surveys',
  'consultant',
  'aiSettings',
  'integrationsSettings',
  'portalAdmin',
  'dataImport',
  'userGuide',
  'auditorDashboard',
]);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function listFiles(dir, predicate) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full, predicate);
      return predicate(full) ? [full] : [];
    });
}

function extractModuleIds() {
  const configFiles = listFiles(path.join(webPublic, 'modules-config'), (file) => file.endsWith('.js'));
  const ids = new Set();
  const endpoints = new Map();
  for (const file of configFiles) {
    const source = read(file);
    const re = /(?:^|\n)\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*\{[\s\S]*?endpoint\s*:\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(re)) {
      ids.add(match[1]);
      endpoints.set(match[1], match[2]);
    }
  }
  return { ids, endpoints };
}

function extractGuidedGroups() {
  const source = read(path.join(webPublic, 'app.js'));
  const section = source.slice(source.indexOf('guidedMenuGroupsForRole()'), source.indexOf('visibleMenuGroups()'));
  const result = new Map();
  for (const role of roles) {
    const roleStart = section.indexOf(`${role}: [`);
    if (roleStart === -1) continue;
    const nextRoleStarts = roles
      .filter((r) => r !== role)
      .map((r) => section.indexOf(`${r}: [`, roleStart + 1))
      .filter((i) => i > roleStart);
    const roleEnd = nextRoleStarts.length ? Math.min(...nextRoleStarts) : section.indexOf('};', roleStart);
    const roleBlock = section.slice(roleStart, roleEnd);
    const items = [...roleBlock.matchAll(/items:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]));
    result.set(role, [...new Set(items)]);
  }
  return result;
}

function extractRoleMenuMatrix() {
  const source = read(path.join(webPublic, 'app.js'));
  const start = source.indexOf('_menuItemsForRole(role)');
  const endCandidates = [
    source.indexOf('homePageForRole()', start),
    source.indexOf('defaultPageForRole(role)', start),
    source.indexOf('menuGroupsForRole()', start),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : start + 5000;
  const section = source.slice(start, end);
  const result = new Map();
  for (const role of roles) {
    const roleStart = section.indexOf(`${role}:`);
    if (roleStart === -1) continue;
    const allMarker = section.slice(roleStart, roleStart + 80).includes('ALL');
    if (allMarker) {
      result.set(role, 'ALL_ITEMS');
      continue;
    }
    const start = section.indexOf('[', roleStart);
    const end = section.indexOf(']', start);
    const items = [...section.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    result.set(role, items);
  }
  return result;
}

function extractMenuLabels() {
  const source = read(path.join(webPublic, 'app.js'));
  const labels = new Map();
  for (const match of source.matchAll(/\{\s*id:\s*['"]([^'"]+)['"][\s\S]{0,180}?label:\s*['"]([^'"]+)['"]/g)) {
    labels.set(match[1], match[2]);
  }
  const fallbackLabels = {
    dashboard: 'لوحة المعلومات',
    myWork: 'إنجازي اليوم',
    myKpi: 'قراءات KPI المطلوبة مني',
    myAcknowledgments: 'إقراراتي',
    userGuide: 'دليل المستخدم',
  };
  for (const [id, label] of Object.entries(fallbackLabels)) {
    if (!labels.has(id)) labels.set(id, label);
  }
  return labels;
}

function advancedModeAllowsDeptManager() {
  const source = read(path.join(webPublic, 'app.js'));
  const start = source.indexOf('canUseAdvancedMode()');
  if (start === -1) return true;
  const end = source.indexOf('async toggleUiMode()', start);
  const block = source.slice(start, end === -1 ? start + 500 : end);
  return block.includes('DEPT_MANAGER');
}

function extractApiRoutes() {
  const files = listFiles(apiSrc, (file) => file.endsWith('.js'));
  const routes = new Set();
  for (const file of files) {
    const source = read(file);
    for (const m of source.matchAll(/app\.use\(\s*['"]\/api\/([^'"]+)/g)) routes.add(m[1].replace(/\/$/, ''));
    for (const m of source.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*['"]\/([^'"]*)/g)) {
      const routeFile = path.basename(file, '.js');
      if (!['server'].includes(routeFile)) routes.add(`${routeFile}:${m[1] || '/'}`);
    }
  }
  return routes;
}

const { ids: moduleIds, endpoints } = extractModuleIds();
const knownPages = new Set([...moduleIds, ...customPages]);
const guided = extractGuidedGroups();
const roleMatrix = extractRoleMenuMatrix();
const apiRoutes = extractApiRoutes();
const menuLabels = extractMenuLabels();

const unknownGuidedPages = [];
const guidedOutsideRoleMenu = [];
const duplicateGuidedPages = [];
const operationalObjectivesVisible = [];
const deptManagerForbiddenVisible = [];
const roleForbiddenVisible = [];

for (const [role, items] of guided.entries()) {
  const allowed = roleMatrix.get(role);
  const seen = new Set();
  for (const item of items) {
    if (!knownPages.has(item)) unknownGuidedPages.push({ role, item });
    if (allowed !== 'ALL_ITEMS' && !allowed?.includes(item)) guidedOutsideRoleMenu.push({ role, item });
    if (seen.has(item)) duplicateGuidedPages.push({ role, item });
    seen.add(item);
    if (item === 'objectives' && ['EMPLOYEE', 'DEPT_MANAGER', 'COMMITTEE_MEMBER', 'QUALITY_MANAGER'].includes(role)) {
      operationalObjectivesVisible.push({ role, item });
    }
    if (role === 'DEPT_MANAGER' && deptManagerForbiddenPages.includes(item)) {
      deptManagerForbiddenVisible.push({ role, item, surface: 'guidedMenuGroupsForRole' });
    }
    if ((roleForbiddenPages[role] || []).includes(item)) {
      roleForbiddenVisible.push({ role, item, surface: 'guidedMenuGroupsForRole' });
    }
  }
}

for (const [role, forbiddenPages] of Object.entries(roleForbiddenPages)) {
  const configured = roleMatrix.get(role) || [];
  if (configured === 'ALL_ITEMS') {
    roleForbiddenVisible.push({ role, item: 'ALL_ITEMS', surface: '_menuItemsForRole' });
    if (role === 'DEPT_MANAGER') {
      deptManagerForbiddenVisible.push({ role, item: 'ALL_ITEMS', surface: '_menuItemsForRole' });
    }
  } else {
    for (const item of configured) {
      if (forbiddenPages.includes(item)) {
        roleForbiddenVisible.push({ role, item, surface: '_menuItemsForRole' });
        if (role === 'DEPT_MANAGER') {
          deptManagerForbiddenVisible.push({ role, item, surface: '_menuItemsForRole' });
        }
      }
    }
  }
}

const advancedModeLeak = advancedModeAllowsDeptManager();

const endpointWarnings = [];
for (const [moduleId, endpoint] of endpoints.entries()) {
  const routeHint = endpoint.replace(/^\/+/, '');
  const mounted = [...apiRoutes].some((r) => r === routeHint || r.startsWith(`${routeHint}:`) || r.endsWith(`/${routeHint}`));
  if (!mounted) endpointWarnings.push({ moduleId, endpoint, note: 'No direct mounted route hint found; verify if handled by a generic factory.' });
}

const result = {
  ok: unknownGuidedPages.length === 0
    && guidedOutsideRoleMenu.length === 0
    && duplicateGuidedPages.length === 0
    && operationalObjectivesVisible.length === 0
    && deptManagerForbiddenVisible.length === 0
    && roleForbiddenVisible.length === 0
    && !advancedModeLeak,
  guidedGroupsChecked: Object.fromEntries(guided),
  unknownGuidedPages,
  guidedOutsideRoleMenu,
  duplicateGuidedPages,
  operationalObjectivesVisible,
  deptManagerForbiddenVisible,
  roleForbiddenVisible,
  advancedModeLeak,
  endpointWarnings,
};

console.log(JSON.stringify(result, null, 2));

if (process.argv.includes('--write-report')) {
  const reportPath = path.join(root, 'docs/role-access-matrix.md');
  const today = new Date().toISOString().slice(0, 10);
  const roleSections = roles.map((role) => {
    const guidedItems = guided.get(role) || [];
    const allowed = roleMatrix.get(role);
    const allowedItems = allowed === 'ALL_ITEMS' ? ['كل الوحدات حسب الصلاحيات'] : (allowed || []);
    const guidedList = guidedItems.map((id) => `- ${menuLabels.get(id) || id} \`${id}\``).join('\n') || '- لا توجد صفحات موجهة';
    const allowedList = allowedItems.map((id) => `- ${menuLabels.get(id) || id} \`${id}\``).join('\n') || '- لا توجد صفحات';
    return `### ${roleLabels[role]} \`${role}\`\n\n${roleIntent[role]}\n\n**المسار الموجه الظاهر:**\n${guidedList}\n\n**النطاق الكامل المسموح:**\n${allowedList}`;
  }).join('\n\n');
  const text = `# مصفوفة عرض الأدوار والصلاحيات\n\nآخر تحديث: ${today}\n\nهذا الملف مرجع تشغيلي سريع لما يجب أن يظهر لكل دور في واجهة النظام. يتم توليده من تعريفات الواجهة الحالية في \`apps/web/public/app.js\`، ويُراجع عبر \`npm run audit:roles\`.\n\n## قواعد حاكمة\n\n- الموظف لا يرى إلا عمله الشخصي وما أُسند إليه.\n- رئيس القسم لا يرى لوحة الإدارة العامة ولا صفحات بيانات التشغيل العامة للأقسام الأخرى.\n- مدير الجودة يرى وحدات الجاهزية والمتابعة والتحسين، وليس بالضرورة كل إعدادات النظام.\n- مسؤول النظام فقط يملك الرؤية الكاملة لإدارة النظام.\n- أي صفحة غير مسموحة يتم تحويل المستخدم منها إلى صفحته الرئيسية حسب الدور.\n\n## الأدوار\n\n${roleSections}\n\n## حواجز منع التسرب\n\n- \`dashboard\`, \`dataHealth\`, \`operationalReports\`, \`reportBuilder\` ممنوعة على رئيس القسم لأنها أسطح قرار/رقابة مؤسسية.\n- \`beneficiaries\`, \`donations\`, \`programs\`, \`suppliers\` ممنوعة على رئيس القسم كصفحات تشغيل عامة للأقسام الأخرى.\n- الوضع المتقدم ممنوع على الموظف ورئيس القسم.\n- الهدف التشغيلي \`objectives\` مخفي عن الأدوار التشغيلية لأن النظام يعتمد طبقة الأنشطة والمؤشرات بدلاً منه.\n\n## نتيجة آخر فحص\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
  fs.writeFileSync(reportPath, text, 'utf8');
  console.log(`role access report written: ${path.relative(root, reportPath)}`);
}

if (!result.ok) process.exit(1);
