import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../../..');
const appJsPath = path.join(root, 'apps/web/public/app.js');
const indexPath = path.join(root, 'apps/web/public/index.html');
const reportPath = path.join(root, 'docs/persona-experience-review.md');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const roleNames = ['EMPLOYEE', 'DEPT_MANAGER', 'COMMITTEE_MEMBER', 'QUALITY_MANAGER', 'SUPER_ADMIN', 'GUEST_AUDITOR'];

const personas = {
  VISITOR: {
    label: 'زائر / مستخدم جديد',
    role: 'EMPLOYEE',
    mustSeeText: ['دليل المستخدم', 'إنجازي اليوم'],
    mustGuided: ['myWork', 'userGuide'],
    expectedHome: 'myKpi',
    shouldNotGuided: ['dashboard', 'dataHealth', 'operationalReports', 'reportBuilder', 'portalAdmin'],
    intent: 'يدخل بدون خوف: يعرف أين يبدأ، وما المطلوب منه اليوم، وكيف يطلب المساعدة.',
  },
  ISO_AUDITOR: {
    label: 'مدقق ISO',
    role: 'GUEST_AUDITOR',
    mustSeeText: ['متطلبات ISO', 'نطاق نظام الجودة', 'الهيكل التنظيمي'],
    mustMenu: ['auditorDashboard', 'iso-readiness', 'isoRequirements', 'planMap', 'qualityScope', 'organizationalChart', 'documents', 'managementReview', 'audits', 'auditChecklists', 'surveys', 'complaints', 'ncr'],
    intent: 'يرى سلسلة الدليل كاملة: النطاق، المتطلبات، الوثائق، التدقيق، المراجعة، والتحسين.',
  },
  EMPLOYEE: {
    label: 'موظف',
    role: 'EMPLOYEE',
    mustGuided: ['myWork', 'myKpi', 'myAcknowledgments', 'complaints', 'ncr', 'userGuide'],
    expectedHome: 'myKpi',
    shouldNotGuided: ['dashboard', 'managementReview', 'dataHealth', 'operationalReports', 'reportBuilder', 'users', 'departments', 'portalAdmin'],
    intent: 'يرى عمله الشخصي فقط، بدون لوحات تنفيذية أو مصطلحات إدارية تخوفه.',
  },
  DEPT_MANAGER: {
    label: 'رئيس قسم',
    role: 'DEPT_MANAGER',
    mustGuided: ['myWork', 'kpiFollowUp', 'slaBoard', 'myKpi', 'kpiTracking', 'progressReports', 'complaints', 'ncr', 'risks'],
    expectedHome: 'myWork',
    shouldNotGuided: ['dashboard', 'dataHealth', 'operationalReports', 'reportBuilder', 'beneficiaries', 'donations', 'programs', 'suppliers', 'portalAdmin'],
    intent: 'يرى قسمه وفريقه ومؤشراته وحالات الجودة التي تخصه، لا بيانات المؤسسة كلها.',
  },
  QUALITY_MANAGER: {
    label: 'مدير الجودة',
    role: 'QUALITY_MANAGER',
    mustGuided: ['myWork', 'kpiFollowUp', 'dataHealth', 'monthlyReadiness', 'iso-readiness', 'isoRequirements', 'complaints', 'ncr', 'capa', 'risks', 'managementReview', 'planMap', 'documents', 'audits', 'surveys', 'userGuide'],
    expectedHome: 'myWork',
    shouldNotGuided: ['portalAdmin'],
    intent: 'يمتلك مركز قيادة للجودة: تأخير المؤشرات، جاهزية ISO، الحالات، الأدلة، وخريطة الترابط.',
  },
};

function extractObjectBlock(source, anchor) {
  const start = source.indexOf(anchor);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  return '';
}

function extractRoleItems(section, role) {
  const roleAnchor = `${role}: [`;
  const start = section.indexOf(roleAnchor);
  if (start < 0) return [];
  const open = section.indexOf('[', start);
  let depth = 0;
  for (let i = open; i < section.length; i += 1) {
    const char = section[i];
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) {
      return [...section.slice(open, i + 1).matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
    }
  }
  return [];
}

function extractGuidedItems(role) {
  const block = extractObjectBlock(appJs, 'guidedMenuGroupsForRole()');
  const roleAnchor = `${role}: [`;
  const start = block.indexOf(roleAnchor);
  if (start < 0) return [];
  const nextStarts = roleNames
    .filter((name) => name !== role)
    .map((name) => block.indexOf(`${name}: [`, start + 1))
    .filter((index) => index > start);
  const end = nextStarts.length ? Math.min(...nextStarts) : block.indexOf('};', start);
  const roleBlock = block.slice(start, end);
  return [...new Set([...roleBlock.matchAll(/items:\s*\[([^\]]*)\]/g)]
    .flatMap((match) => [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1])))];
}

function extractAllowedItems(role) {
  const block = extractObjectBlock(appJs, '_menuItemsForRole(role)');
  const rolePos = block.indexOf(`${role}:`);
  if (rolePos < 0) return [];
  if (block.slice(rolePos, rolePos + 120).includes('ALL')) return ['ALL_ITEMS'];
  return [...new Set(extractRoleItems(block, role))];
}

function hasText(text) {
  return appJs.includes(text) || indexHtml.includes(text);
}

function homePageForRole(role) {
  const block = extractObjectBlock(appJs, 'homePageForRole()');
  const roleLine = block.match(new RegExp(`case ['"]${role}['"]:\\s*return ['"]([^'"]+)['"]`));
  if (roleLine) return roleLine[1];
  const fallback = block.match(/default:\s*return ['"]([^'"]+)['"]/);
  return fallback ? fallback[1] : null;
}

function evaluatePersona(key, config) {
  const guided = extractGuidedItems(config.role);
  const allowed = extractAllowedItems(config.role);
  const allowedSet = allowed.includes('ALL_ITEMS') ? null : new Set(allowed);
  const findings = [];
  let score = 100;

  for (const item of config.mustGuided || []) {
    if (!guided.includes(item)) {
      findings.push({ type: 'missing-guided', severity: 'major', text: `لا يظهر في القائمة الموجهة: ${item}` });
      score -= 8;
    }
  }

  for (const item of config.mustMenu || []) {
    if (allowedSet && !allowedSet.has(item)) {
      findings.push({ type: 'missing-menu', severity: 'major', text: `غير متاح في صلاحيات الدور: ${item}` });
      score -= 8;
    }
  }

  for (const item of config.shouldNotGuided || []) {
    if (guided.includes(item)) {
      findings.push({ type: 'excess-guided', severity: 'major', text: `يظهر للدور رغم أنه يسبب تشتيتاً أو توسعاً غير مناسب: ${item}` });
      score -= 10;
    }
  }

  for (const item of guided) {
    if (allowedSet && !allowedSet.has(item)) {
      findings.push({ type: 'guided-permission-mismatch', severity: 'critical', text: `القائمة تعرض ${item} لكنه غير موجود في صلاحيات الدور.` });
      score -= 15;
    }
  }

  for (const text of config.mustSeeText || []) {
    if (!hasText(text)) {
      findings.push({ type: 'missing-copy', severity: 'minor', text: `النص الإرشادي غير ظاهر في الواجهة: ${text}` });
      score -= 4;
    }
  }

  if (config.expectedHome) {
    const actualHome = homePageForRole(config.role);
    if (actualHome !== config.expectedHome) {
      findings.push({ type: 'wrong-default-page', severity: 'major', text: `صفحة البداية للدور ${config.role} هي ${actualHome || 'غير محددة'} وليست ${config.expectedHome}.` });
      score -= 12;
    }
  }

  if (key === 'VISITOR' && !guided.includes('myWork')) {
    findings.push({ type: 'missing-guided-today', severity: 'major', text: 'الموظف الجديد لا يجد "إنجازي اليوم" في المسار الموجه.' });
    score -= 12;
  }

  if (config.role === 'DEPT_MANAGER' && appJs.includes('canUseAdvancedMode()')) {
    const advancedBlock = appJs.slice(appJs.indexOf('canUseAdvancedMode()'), appJs.indexOf('async toggleUiMode()'));
    if (advancedBlock.includes('DEPT_MANAGER')) {
      findings.push({ type: 'advanced-mode-leak', severity: 'critical', text: 'رئيس القسم يستطيع فتح الوضع المتقدم.' });
      score -= 15;
    }
  }

  return {
    key,
    label: config.label,
    role: config.role,
    intent: config.intent,
    score: Math.max(0, score),
    guided,
    findings,
  };
}

const results = Object.entries(personas).map(([key, config]) => evaluatePersona(key, config));
const average = Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
const criticalFindings = results.flatMap((item) => item.findings.filter((finding) => finding.severity === 'critical'));
const majorFindings = results.flatMap((item) => item.findings.filter((finding) => finding.severity === 'major'));

function grade(score) {
  if (score >= 95) return 'ممتاز';
  if (score >= 90) return 'جاهز';
  if (score >= 85) return 'جيد يحتاج تهذيب بسيط';
  if (score >= 75) return 'يحتاج تحسين';
  return 'مربك';
}

function renderReport() {
  const lines = [
    '# تقرير تجربة الشخصيات في نظام الجودة',
    '',
    `**النتيجة العامة:** ${average}/100 - ${grade(average)}`,
    '',
    'هذا التقرير لا يقيم الخطة نفسها، بل يقيم تجربة النظام من عيون مستخدمين مختلفين: زائر جديد، مدقق ISO، موظف، رئيس قسم، ومدير جودة.',
    '',
    '## الخلاصة',
    '',
    '| الشخصية | الدور الفني | الدرجة | الحكم |',
    '|---|---|---:|---|',
    ...results.map((item) => `| ${item.label} | ${item.role} | ${item.score}/100 | ${grade(item.score)} |`),
    '',
    '## قراءة تفصيلية',
    '',
  ];

  for (const item of results) {
    lines.push(`### ${item.label}`);
    lines.push('');
    lines.push(`- الغرض: ${item.intent}`);
    lines.push(`- الصفحات الموجهة: ${item.guided.length ? item.guided.join('، ') : 'لا توجد'}`);
    if (item.findings.length) {
      lines.push('- الملاحظات:');
      for (const finding of item.findings) lines.push(`  - [${finding.severity}] ${finding.text}`);
    } else {
      lines.push('- الملاحظات: لا توجد ملاحظات حرجة أو رئيسية.');
    }
    lines.push('');
  }

  lines.push('## قرار القبول');
  lines.push('');
  if (criticalFindings.length) {
    lines.push('- غير جاهز للاعتماد: توجد ملاحظات حرجة يجب إصلاحها قبل النشر.');
  } else if (average >= 90 && majorFindings.length === 0) {
    lines.push('- جاهز للاعتماد كتجربة موجهة ومريحة لكل دور رئيسي.');
  } else {
    lines.push('- مقبول مع تحسينات: لا توجد ملاحظات حرجة، لكن توجد نقاط تجربة تحتاج تهذيباً.');
  }
  lines.push('');
  lines.push('## توصية تشغيلية');
  lines.push('');
  lines.push('- شغّل هذا الفحص بعد أي تعديل كبير في القوائم أو الصلاحيات أو واجهة إنجازي اليوم.');
  lines.push('- إذا انخفضت أي شخصية عن 90/100، لا تنشر قبل مراجعة سبب الانخفاض.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const payload = {
  average,
  grade: grade(average),
  criticalFindings: criticalFindings.length,
  majorFindings: majorFindings.length,
  results,
};

if (process.argv.includes('--write-report')) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderReport(), 'utf8');
  console.log(`Persona experience report written to ${path.relative(root, reportPath)}`);
} else {
  console.log(JSON.stringify(payload, null, 2));
}

if (criticalFindings.length > 0) {
  process.exitCode = 1;
}
