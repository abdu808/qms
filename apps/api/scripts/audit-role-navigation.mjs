import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../../..');
const webPublic = path.join(root, 'apps/web/public');
const apiSrc = path.join(root, 'apps/api/src');

const roles = ['EMPLOYEE', 'DEPT_MANAGER', 'COMMITTEE_MEMBER', 'QUALITY_MANAGER', 'SUPER_ADMIN'];
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
  const section = source.slice(source.indexOf('_menuItemsForRole(role)'), source.indexOf('defaultPageForRole(role)'));
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

const unknownGuidedPages = [];
const guidedOutsideRoleMenu = [];
const duplicateGuidedPages = [];
const operationalObjectivesVisible = [];

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
  }
}

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
    && operationalObjectivesVisible.length === 0,
  guidedGroupsChecked: Object.fromEntries(guided),
  unknownGuidedPages,
  guidedOutsideRoleMenu,
  duplicateGuidedPages,
  operationalObjectivesVisible,
  endpointWarnings,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exit(1);
