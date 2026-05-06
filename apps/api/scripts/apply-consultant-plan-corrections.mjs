/**
 * Apply consultant-approved planning corrections to the live QMS through the API.
 *
 * Purpose:
 * - Keep the approved 2025-2027 plan intact.
 * - Make the plan executable by classifying KPIs into leadership/operational/support layers.
 * - Clarify activity outputs and evidence so teams know exactly what to do.
 * - Reduce reporting burden: only the truly operational indicators stay monthly.
 *
 * Usage:
 *   QMS_BASE_URL=https://quality.aqiltech.sa \
 *   QMS_ADMIN_EMAIL=admin@example.org \
 *   QMS_ADMIN_PASSWORD=... \
 *   node apps/api/scripts/apply-consultant-plan-corrections.mjs --dry-run
 *
 *   ... --apply
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const BASE_URL = (process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa').replace(/\/$/, '');
const EMAIL = process.env.QMS_ADMIN_EMAIL;
const PASSWORD = process.env.QMS_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing QMS_ADMIN_EMAIL or QMS_ADMIN_PASSWORD environment variables.');
  process.exit(1);
}

const OUT_DIR = path.resolve('outputs', 'consultant-plan-corrections');

const KPI_LAYER = {
  LEADERSHIP: 'مؤشر قيادة/أثر',
  MONTHLY_OPS: 'تشغيلي شهري',
  SUPPORT: 'داعم ربعي/سنوي',
};

const leadershipKpis = new Set([
  'IND-2026-022',
  'IND-2026-025',
  'IND-2026-031',
  'IND-2026-035',
  'IND-2026-038',
  'IND-2026-041',
  'IND-2026-045',
  'IND-2026-050',
  'IND-2026-052',
  'IND-2026-054',
]);

const monthlyOperationalKpis = new Set([
  'IND-2026-022',
  'IND-2026-025',
  'IND-2026-026',
  'IND-2026-027',
  'IND-2026-037',
  'IND-2026-042',
  'IND-2026-044',
  'IND-2026-046',
]);

const indicatorOverrides = {
  'IND-2026-039': {
    unit: 'عدد',
    notesExtra: 'تصحيح مستشاري: هذا المؤشر يقيس عدد مصادر الإيراد الفعالة، وليس مبلغاً مالياً مباشراً.',
  },
  'IND-2026-052': {
    frequency: 'SEMI_ANNUAL',
    notesExtra: 'تخفيف عبء المتابعة: يقاس نصف سنوي مع مراجعة تدريبية داخلية عند الحاجة، ولا يطلب إدخال شهري.',
  },
  'IND-2026-055': {
    notesExtra: 'ملكية مزدوجة: الاتصال المؤسسي يوثق الشراكة، وتنمية الموارد/المالية تثبت العائد المالي أو العيني.',
  },
};

const goalNotes = {
  'SG25-001': 'منطق التنفيذ: المحافظة على استقرار الكفالات وجودة بيانات الأيتام والكافلين، لا التوسع العددي وحده.',
  'SG25-002': 'منطق التنفيذ: تقديم رعاية موثقة للأسر الأشد حاجة مع قياس الرضا وجودة الاستحقاق.',
  'SG25-003': 'منطق التنفيذ: تحويل جزء من الأسر القابلة للتمكين إلى مسارات تأهيل أو توظيف موثقة، بدون تحميل الفريق وعوداً غير واقعية.',
  'SG25-004': 'منطق التنفيذ: تنمية الإيرادات غير المقيدة عبر قنوات عملية قابلة للتتبع، لا حملات كثيرة بلا أثر مالي.',
  'SG25-005': 'منطق التنفيذ: حوكمة الأصول والاستثمارات بقرار واضح وتوثيق عائد فعلي قابل للمراجعة.',
  'SG25-006': 'منطق التنفيذ: ضبط الإقفال المالي والالتزام النظامي والموازنة كشرط لثقة الإدارة والمجلس.',
  'SG25-007': 'منطق التنفيذ: جاهزية ISO 9001 عبر الأدلة، التدقيق الداخلي، CAPA، والمراجعة الإدارية، لا ملف ورقي منفصل عن العمل.',
  'SG25-008': 'منطق التنفيذ: رقمنة العمليات ذات الأولوية فقط، خصوصاً الإدارة والمالية والجودة، لا ادعاء رقمنة كل شيء.',
  'SG25-009': 'منطق التنفيذ: تحويل الحوكمة إلى متابعة وقرارات وتقارير دورية مفهومة للقيادة.',
  'SG25-010': 'منطق التنفيذ: تدريب الموظفين على ما يخدم الجودة والعمل الفعلي، وليس دورات شكلية.',
  'SG25-011': 'منطق التنفيذ: شراكات ذات مخرجات موثقة وقيمة فعلية للجمعية أو المستفيد.',
  'SG25-012': 'منطق التنفيذ: تطوع تخصصي واتصال مؤسسي يخدم أثر الجمعية ويزيد الثقة المجتمعية.',
};

const activityCorrections = {
  'ACT-2026-101': {
    tier: 'أولوية قيادة Q2-2026',
    output: 'سجل شهري محدث للكفالات والأيتام والكافلين مع توضيح النشط والمتوقف.',
    evidence: 'كشف من رافد/الكفالات أو ملف اعتماد شهري مختصر.',
  },
  'ACT-2026-102': {
    tier: 'داعم نصف سنوي',
    output: 'قائمة مختصرة للأسر القابلة للتمكين ومسار كل حالة.',
    evidence: 'كشف حالات وتمكين/تأهيل مع نتيجة أو إحالة.',
  },
  'ACT-2026-103': {
    tier: 'أولوية تشغيلية Q2-Q3',
    output: 'خطة عملية لقنوات الإيراد غير المقيد والمتجر الإلكتروني مع قراءة شهرية مختصرة.',
    evidence: 'تقرير مالي/متجر أو كشف حملة موثق.',
  },
  'ACT-2026-104': {
    tier: 'أولوية تشغيلية Q2-Q3',
    output: 'قائمة العمليات ذات الأولوية التي تم رقمنتها أو تحسينها.',
    evidence: 'رابط النظام أو لقطة شاشة أو محضر قبول داخلي.',
  },
  'ACT-2026-105': {
    tier: 'داعم ربع سنوي',
    output: 'تقرير حوكمة مختصر يوضح الالتزامات والمنجز والمتأخر.',
    evidence: 'تقرير PDF/محضر مراجعة.',
  },
  'ACT-2026-106': {
    tier: 'داعم نصف سنوي',
    output: 'خطة تدريب أولويات الموظفين وسجل تنفيذ مختصر.',
    evidence: 'كشف حضور أو شهادات أو سجل تدريب داخلي.',
  },
  'ACT-2026-107': {
    tier: 'داعم ربع سنوي',
    output: 'قائمة الشراكات الفعالة وقيمة كل شراكة أو مخرجها.',
    evidence: 'اتفاقية/خطاب/تقرير عائد.',
  },
  'ACT-2026-108': {
    tier: 'داعم ربع سنوي',
    output: 'فرص تطوع تخصصي وفعاليات موثقة بمخرجات.',
    evidence: 'سجل متطوعين تخصصي أو تقرير فعالية.',
  },
  'ACT-2026-109': {
    tier: 'داعم نصف سنوي',
    output: 'تنفيذ الدورات التدريبية ذات الأولوية فقط وربطها بالعمل.',
    evidence: 'سجل تدريب وشهادات/حضور.',
  },
  'ACT-2026-013': {
    tier: 'أولوية تشغيلية مستمرة',
    output: 'إيصال الدعم للحالات العاجزة عن الحضور وفق أمر صرف معتمد.',
    evidence: 'أمر صرف وتسليم/إثبات وصول.',
  },
  'ACT-2026-014': {
    tier: 'قرار إداري 2027',
    output: 'سياسة تخصيص واضحة من الإيرادات غير المقيدة وعوائد الاستثمار.',
    evidence: 'قرار إدارة أو محضر اعتماد.',
  },
  'ACT-2026-015': {
    tier: 'داعم مالي',
    output: 'رفع تحصيل مستحقات الأصول عبر منصة إلكترونية أو سجل منتظم.',
    evidence: 'كشف تحصيل أو تقرير منصة.',
  },
  'ACT-2026-016': {
    tier: 'داعم مالي شهري',
    output: 'متابعة المصاريف التشغيلية وترشيدها دون تعطيل الخدمة.',
    evidence: 'تقرير مالي شهري مختصر.',
  },
  'ACT-2026-017': {
    tier: 'أولوية ISO Q2-2026',
    output: 'تدقيق داخلي استعدادي قبل التدقيق الخارجي.',
    evidence: 'خطة تدقيق، قائمة تحقق، تقرير نتائج.',
  },
  'ACT-2026-018': {
    tier: 'أولوية ISO Q2-2026',
    output: 'مراجعة إدارية رسمية بمحضر واضح وقرارات متابعة.',
    evidence: 'محضر مراجعة إدارية مع الحضور والقرارات.',
  },
  'ACT-2026-019': {
    tier: 'أولوية ISO فورية',
    output: 'تشغيل سجل CAPA وعدم المطابقة عند ظهور فجوة.',
    evidence: 'سجل CAPA يحتوي حالة واحدة مكتملة الدورة على الأقل عند الحاجة.',
  },
  'ACT-2026-021': {
    tier: 'داعم شهري',
    output: 'إصدار تقرير أثر شهري مختصر ومفهوم.',
    evidence: 'تقرير أثر أو لوحة مؤشرات منشورة داخلياً.',
  },
  'ACT-2026-022': {
    tier: 'داعم شهري',
    output: 'اجتماع مراجعة شهري قصير لمتابعة المؤشرات والانحرافات.',
    evidence: 'محضر اجتماع مختصر مع قرارات واضحة.',
  },
  'ACT-2026-023': {
    tier: 'أولوية ISO Q2-Q3',
    output: 'استكمال أدلة ISO 9001 وأهداف الجودة وخطة تحقيقها.',
    evidence: 'قائمة متطلبات محدثة وروابط الوثائق المعتمدة.',
  },
};

function cookieHeader(cookies) {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeSetCookies(cookies, res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=\s*[^;=]+=[^;]+)/)) {
    const [pair] = part.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function api(method, url, { token, cookies, csrf }, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookies?.size) headers.Cookie = cookieHeader(cookies);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method) && csrf) headers['X-CSRF-Token'] = csrf;

  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  storeSetCookies(cookies, res);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || text || `${res.status} ${res.statusText}`;
    throw new Error(`${method} ${url} failed: ${msg}`);
  }
  return data;
}

function consultantNote(lines) {
  return [
    'تصحيح المستشارين 2026:',
    ...lines.filter(Boolean).map((line) => `- ${line}`),
    '- قاعدة عدم الإثقال: يكفي دليل واحد واضح من النظام أو رافد أو المحاسبة أو محضر مختصر.',
  ].join('\n');
}

function classifyIndicator(ind) {
  if (leadershipKpis.has(ind.code)) return KPI_LAYER.LEADERSHIP;
  if (monthlyOperationalKpis.has(ind.code)) return KPI_LAYER.MONTHLY_OPS;
  return KPI_LAYER.SUPPORT;
}

function indicatorNote(ind) {
  const layer = classifyIndicator(ind);
  const reviewRule = layer === KPI_LAYER.LEADERSHIP
    ? 'يعرض في مراجعة القيادة عند الانحراف أو عند نهاية الربع.'
    : layer === KPI_LAYER.MONTHLY_OPS
      ? 'يدخل شهرياً لأنه يقيس تشغيل خدمة أو التزاماً متكرراً.'
      : 'لا يطلب شهرياً؛ يراجع حسب التردد المعتمد أو عند وجود قرار.';
  const override = indicatorOverrides[ind.code]?.notesExtra;
  return consultantNote([
    `تصنيف المتابعة: ${layer}.`,
    `قاعدة العرض: ${reviewRule}`,
    override,
  ]);
}

function activityNote(act) {
  const rule = activityCorrections[act.code];
  if (!rule) return consultantNote([
    'تصنيف التنفيذ: داعم للخطة.',
    'المخرج المطلوب: تنفيذ النشاط وفق مالكه وتوثيق الدليل المناسب.',
  ]);
  return consultantNote([
    `تصنيف التنفيذ: ${rule.tier}.`,
    `المخرج المطلوب: ${rule.output}`,
    `الدليل المقبول: ${rule.evidence}`,
  ]);
}

function goalNote(goal) {
  return consultantNote([
    goalNotes[goal.code] || 'يبقى الهدف ضمن الخطة المعتمدة ويقاس عبر المؤشرات والأنشطة المرتبطة به.',
    'توجيه إداري: لا تفتح مبادرات كثيرة؛ الأولوية للأنشطة القليلة التي تثبت أثر الهدف.',
  ]);
}

async function main() {
  const cookies = new Map();
  const loginRes = await api('POST', '/api/auth/login', { cookies }, { email: EMAIL, password: PASSWORD });
  const token = loginRes.token;

  await api('GET', '/api/indicators?limit=1', { token, cookies });
  const csrf = cookies.get('csrf');
  if (!csrf) throw new Error('CSRF cookie was not issued by the API.');
  const ctx = { token, cookies, csrf };

  const [goalsRes, indicatorsRes, activitiesRes] = await Promise.all([
    api('GET', '/api/strategic-goals?limit=100&sort=code&order=asc', ctx),
    api('GET', '/api/indicators?limit=100&sort=code&order=asc', ctx),
    api('GET', '/api/operational-activities?limit=100&sort=code&order=asc&filter[year]=2026', ctx),
  ]);

  const goals = goalsRes.items || [];
  const indicators = indicatorsRes.items || [];
  const activities = activitiesRes.items || [];

  const changes = [];

  for (const goal of goals) {
    const payload = { notes: goalNote(goal) };
    changes.push({ entity: 'strategicGoal', code: goal.code, title: goal.title, changes: payload });
    if (APPLY) await api('PUT', `/api/strategic-goals/${goal.id}`, ctx, payload);
  }

  for (const ind of indicators) {
    const override = indicatorOverrides[ind.code] || {};
    const payload = {
      notes: indicatorNote(ind),
      ...(override.frequency ? { frequency: override.frequency } : {}),
      ...(override.unit ? { unit: override.unit } : {}),
    };
    changes.push({
      entity: 'indicator',
      code: ind.code,
      name: ind.nameAr,
      layer: classifyIndicator(ind),
      changes: payload,
    });
    if (APPLY) await api('PUT', `/api/indicators/${ind.id}`, ctx, payload);
  }

  for (const act of activities) {
    const payload = { notes: activityNote(act) };
    changes.push({ entity: 'activity', code: act.code, title: act.title, changes: payload });
    if (APPLY) await api('PUT', `/api/operational-activities/${act.id}`, ctx, payload);
  }

  const afterHealth = APPLY
    ? await api('GET', '/api/strategic-goals/plan-health?year=2026', ctx)
    : null;

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(OUT_DIR, `consultant-plan-corrections-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  const report = {
    ok: true,
    mode: APPLY ? 'apply' : 'dry-run',
    baseUrl: BASE_URL,
    totals: {
      goals: goals.length,
      indicators: indicators.length,
      activities: activities.length,
      leadershipKpis: indicators.filter((i) => classifyIndicator(i) === KPI_LAYER.LEADERSHIP).length,
      monthlyOperationalKpis: indicators.filter((i) => monthlyOperationalKpis.has(i.code)).length,
      supportKpis: indicators.filter((i) => classifyIndicator(i) === KPI_LAYER.SUPPORT).length,
    },
    changes,
    afterHealth: afterHealth?.summary || null,
  };
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, mode: report.mode, totals: report.totals, afterHealth: report.afterHealth, reportFile }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
