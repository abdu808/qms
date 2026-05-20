import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');
const serverPath = path.join(apiRoot, 'src', 'server.js');
const matrixPath = path.join(apiRoot, 'src', 'lib', 'permissions-matrix.js');
const routesRoot = path.join(apiRoot, 'src', 'routes');
const writeReport = process.argv.includes('--write-report');

const AUTH_MARKER = /^\s*app\.use\('\/api',\s*authenticate/m;

const SELF_SCOPED_ROUTES = new Map([
  ['myWork', 'self-scoped work center; payload is built from req.user role and department'],
  ['notifications', 'current-user notification inbox only'],
  ['userPreferences', 'current-user UI preferences only'],
  ['policyAck', 'current-user acknowledgement flow with scoped reporting routes'],
  ['stateMachines', 'read-only workflow metadata, still behind JWT'],
  ['dashboard', 'role-aware dashboard summary, still behind JWT'],
]);

const CUSTOM_GUARDED_ROUTES = new Map([
  ['aiSettings', 'explicit role checks per endpoint'],
  ['automation', 'webhook secret guard plus internal role controls'],
  ['consultant', 'role checks, rate limits, and tool permissions'],
  ['consultSessions', 'session ownership isolation plus role checks'],
  ['import', 'requireImportRole restricts imports to QUALITY_MANAGER/SUPER_ADMIN'],
  ['integrationDelivery', 'integration delivery admin routes use authorize guards'],
  ['kpiFollowUp', 'KPI follow-up read/QM access guards'],
  ['notificationRules', 'notification rule admin guards'],
  ['notificationTemplates', 'notification template admin guards'],
  ['portalAdmin', 'portal admin role guards'],
  ['progressReports', 'department/QM workflow guards'],
  ['reports', 'parent reports router applies requireAction(reports, read)'],
  ['scheduler', 'super-admin scheduler guard'],
  ['webhookSettings', 'super-admin webhook settings guard'],
]);

const PUBLIC_ROUTE_NOTES = new Map([
  ['/api/auth', 'login/refresh/logout endpoints'],
  ['/api/meta', 'non-sensitive app metadata'],
  ['/api/public', 'public read-only portal endpoints'],
  ['/api/integrations', 'n8n callback before JWT; authenticated by X-Webhook-Secret'],
  ['/eval', 'public evaluation token flow'],
  ['/survey', 'public survey token flow'],
  ['/ack', 'public acknowledgement token flow'],
]);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalizeRoutePath(routePath) {
  return routePath.replace(/\\/g, '/').replace(/\.js$/, '');
}

function routeFileFor(routePath) {
  return path.join(routesRoot, `${routePath}.js`);
}

function extractImportMap(serverSource) {
  const imports = new Map();
  const re = /import\s+([A-Za-z0-9_]+)\s+from\s+'\.\/routes\/([^']+)\.js';/g;
  for (const match of serverSource.matchAll(re)) {
    imports.set(match[1], normalizeRoutePath(match[2]));
  }
  return imports;
}

function extractMounts(serverSource, imports) {
  const authIndex = serverSource.search(AUTH_MARKER);
  if (authIndex < 0) {
    throw new Error(`Could not find auth middleware marker: ${AUTH_MARKER}`);
  }

  const mounts = [];
  for (const block of findAppUseBlocks(serverSource)) {
    const mountMatch = block.source.match(/app\.use\(\s*'([^']+)'/);
    if (!mountMatch) continue;
    const mountPath = mountMatch[1];
    const args = block.source;
    const routeVars = [...args.matchAll(/\b([A-Za-z0-9_]+Routes|consultSessionsRouter)\b/g)].map(m => m[1]);
    if (!routeVars.length) continue;
    if (mountPath === '/api' && !routeVars.length && /\bauthenticate\b/.test(args)) continue;
    const varName = routeVars.at(-1) || args.trim().split(/[\s,]+/)[0];
    if (mountPath === '/api' && varName === 'authenticate') continue;
    mounts.push({
      mountPath,
      varName,
      routePath: imports.get(varName) || null,
      isPreAuth: block.index < authIndex,
      line: lineOf(serverSource, block.index),
      raw: block.source,
    });
  }
  return mounts;
}

function findAppUseBlocks(source) {
  const blocks = [];
  let pos = 0;
  while (true) {
    const start = source.indexOf('app.use(', pos);
    if (start < 0) break;

    let depth = 0;
    let quote = null;
    let escape = false;
    let end = -1;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];

      if (quote) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }

      if (ch === '(') depth += 1;
      if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end > start) {
      blocks.push({ index: start, source: source.slice(start, end) });
      pos = end;
    } else {
      pos = start + 'app.use('.length;
    }
  }
  return blocks;
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function extractMatrixResources(matrixSource) {
  const start = matrixSource.indexOf('export const MATRIX');
  if (start < 0) throw new Error('Could not find MATRIX export');

  const source = matrixSource.slice(start);
  const resources = new Set();
  const re = /^\s{2}(?:'([^']+)'|([A-Za-z][A-Za-z0-9_-]*))\s*:/gm;
  for (const match of source.matchAll(re)) {
    const key = match[1] || match[2];
    if (key && key !== 'read' && key !== 'create' && key !== 'update' && key !== 'delete') {
      resources.add(key);
    }
  }
  return resources;
}

function extractCrudResources(routeSource) {
  const resources = new Set();
  const re = /resource\s*:\s*['"]([^'"]+)['"]/g;
  for (const match of routeSource.matchAll(re)) resources.add(match[1]);
  return [...resources].sort();
}

function hasRouterMethods(routeSource) {
  return /router\.(get|post|put|patch|delete|use)\s*\(/.test(routeSource);
}

function classifyProtectedRoute(routePath, routeSource) {
  const guards = [];
  const crudResources = extractCrudResources(routeSource);

  if (/crudRouter\s*\(/.test(routeSource)) guards.push('crudRouter');
  if (/requireAction\s*\(/.test(routeSource)) guards.push('requireAction');
  if (/authorize\s*\(/.test(routeSource)) guards.push('authorize');
  if (/require[A-Z][A-Za-z0-9_]*\s*(?:,|\))/g.test(routeSource)) guards.push('custom require* middleware');
  if (/function\s+require[A-Z][A-Za-z0-9_]*\s*\(/.test(routeSource)) guards.push('custom require* function');
  if (SELF_SCOPED_ROUTES.has(routePath)) guards.push('self-scoped');
  if (CUSTOM_GUARDED_ROUTES.has(routePath)) guards.push('custom-guard allowlist');

  const routeKind = crudResources.length
    ? `matrix:${crudResources.join(', ')}`
    : SELF_SCOPED_ROUTES.has(routePath)
      ? 'self-scoped'
      : CUSTOM_GUARDED_ROUTES.has(routePath)
        ? 'custom-guard'
        : guards.length
          ? 'guarded'
          : 'unguarded';

  const note = SELF_SCOPED_ROUTES.get(routePath) || CUSTOM_GUARDED_ROUTES.get(routePath) || '';

  return { guards: [...new Set(guards)], crudResources, routeKind, note };
}

function listRouteFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRouteFiles(full));
    if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function routeNameFromFile(file) {
  return normalizeRoutePath(path.relative(routesRoot, file)).replace(/\.js$/, '');
}

const serverSource = read(serverPath);
const matrixSource = read(matrixPath);
const matrixResources = extractMatrixResources(matrixSource);
const imports = extractImportMap(serverSource);
const mounts = extractMounts(serverSource, imports);

const publicRoutes = [];
const protectedRoutes = [];
const missingFiles = [];
const unguardedProtectedRoutes = [];
const crudResourceWithoutMatrix = [];
const unmountedRouteFiles = [];

for (const mount of mounts) {
  if (mount.isPreAuth) {
    publicRoutes.push({
      mountPath: mount.mountPath,
      routePath: mount.routePath || mount.varName,
      note: PUBLIC_ROUTE_NOTES.get(mount.mountPath) || 'pre-auth route',
    });
    continue;
  }

  if (!mount.routePath) {
    missingFiles.push({ ...mount, issue: 'mount variable has no import mapping' });
    continue;
  }

  const file = routeFileFor(mount.routePath);
  if (!fs.existsSync(file)) {
    missingFiles.push({ ...mount, issue: `route file not found: ${file}` });
    continue;
  }

  const routeSource = read(file);
  const classification = classifyProtectedRoute(mount.routePath, routeSource);
  const missingResources = classification.crudResources.filter(resource => !matrixResources.has(resource));

  if (missingResources.length) {
    crudResourceWithoutMatrix.push({
      mountPath: mount.mountPath,
      routePath: mount.routePath,
      resources: missingResources,
    });
  }

  if (!classification.guards.length && hasRouterMethods(routeSource)) {
    unguardedProtectedRoutes.push({
      mountPath: mount.mountPath,
      routePath: mount.routePath,
      line: mount.line,
    });
  }

  protectedRoutes.push({
    mountPath: mount.mountPath,
    routePath: mount.routePath,
    line: mount.line,
    ...classification,
    missingResources,
  });
}

const mountedRoutePaths = new Set(mounts.map(m => m.routePath).filter(Boolean));
for (const file of listRouteFiles(routesRoot)) {
  const name = routeNameFromFile(file);
  if (name.startsWith('reports/')) continue;
  if (name.startsWith('import/')) continue;
  if (!mountedRoutePaths.has(name) && hasRouterMethods(read(file))) {
    unmountedRouteFiles.push(name);
  }
}

const ok = missingFiles.length === 0 && crudResourceWithoutMatrix.length === 0 && unguardedProtectedRoutes.length === 0;
const summary = {
  publicRoutes: publicRoutes.length,
  protectedRoutes: protectedRoutes.length,
  matrixGuardedRoutes: protectedRoutes.filter(r => r.routeKind.startsWith('matrix:')).length,
  customGuardedRoutes: protectedRoutes.filter(r => r.routeKind === 'custom-guard').length,
  selfScopedRoutes: protectedRoutes.filter(r => r.routeKind === 'self-scoped').length,
  missingFiles: missingFiles.length,
  crudResourceWithoutMatrix: crudResourceWithoutMatrix.length,
  unguardedProtectedRoutes: unguardedProtectedRoutes.length,
  unmountedRouteFiles: unmountedRouteFiles.length,
};

const result = {
  ok,
  summary,
  publicRoutes,
  protectedRoutes,
  missingFiles,
  crudResourceWithoutMatrix,
  unguardedProtectedRoutes,
  unmountedRouteFiles,
};

function mdTable(rows, columns) {
  const header = `| ${columns.map(c => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(c => String(c.value(row) ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function writeMarkdownReport() {
  const reportPath = path.join(repoRoot, 'docs', 'route-security-matrix.md');
  const now = new Date().toISOString();
  const lines = [
    '# مصفوفة أمن مسارات API',
    '',
    `آخر تحديث: ${now}`,
    '',
    '## الخلاصة',
    '',
    `- النتيجة: ${ok ? 'ناجح' : 'يحتاج معالجة'}`,
    `- المسارات العامة المقصودة: ${summary.publicRoutes}`,
    `- المسارات المحمية بعد تسجيل الدخول: ${summary.protectedRoutes}`,
    `- محمية بمصفوفة الصلاحيات: ${summary.matrixGuardedRoutes}`,
    `- محمية بحراس مخصصين: ${summary.customGuardedRoutes}`,
    `- ذاتية النطاق للمستخدم الحالي: ${summary.selfScopedRoutes}`,
    `- موارد CRUD غير موجودة في المصفوفة: ${summary.crudResourceWithoutMatrix}`,
    `- مسارات محمية بلا حارس واضح: ${summary.unguardedProtectedRoutes}`,
    '',
    '## المسارات العامة المقصودة',
    '',
    mdTable(publicRoutes, [
      { label: 'المسار', value: r => r.mountPath },
      { label: 'الملف', value: r => r.routePath },
      { label: 'السبب', value: r => r.note },
    ]),
    '',
    '## المسارات المحمية',
    '',
    mdTable(protectedRoutes, [
      { label: 'المسار', value: r => r.mountPath },
      { label: 'الملف', value: r => r.routePath },
      { label: 'نوع الحماية', value: r => r.routeKind },
      { label: 'الحراس', value: r => r.guards.join(', ') },
      { label: 'ملاحظة', value: r => r.note },
    ]),
    '',
    '## نتائج يجب ألا تظهر',
    '',
    `- ملفات مفقودة: ${missingFiles.length}`,
    `- موارد CRUD بلا مصفوفة: ${crudResourceWithoutMatrix.length}`,
    `- مسارات محمية بلا حارس: ${unguardedProtectedRoutes.length}`,
    '',
    '## ملفات Routes غير مركبة مباشرة',
    '',
    unmountedRouteFiles.length
      ? unmountedRouteFiles.map(name => `- ${name}`).join('\n')
      : '- لا يوجد.',
    '',
  ];

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return reportPath;
}

if (writeReport) {
  const reportPath = writeMarkdownReport();
  console.log(`route security report written: ${path.relative(repoRoot, reportPath)}`);
}

console.log(JSON.stringify({ ok, summary }, null, 2));

if (!ok) {
  console.error(JSON.stringify({
    missingFiles,
    crudResourceWithoutMatrix,
    unguardedProtectedRoutes,
  }, null, 2));
  process.exit(1);
}
