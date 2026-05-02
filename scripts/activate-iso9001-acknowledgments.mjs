import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const APPROVAL_RESULTS_PATH = path.join(ROOT, 'docs', `iso9001-production-approval-results-${TODAY}.json`);
const OUTPUT_PATH = path.join(ROOT, 'docs', `iso9001-acknowledgment-activation-results-${TODAY}.json`);

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CONFIRMED = args.has('--yes-i-understand-production-write');

const ACK_TARGETS = [
  {
    sourceCode: 'QP-001-2026',
    ackCode: 'ACK-ISO-QP-001-2026',
    category: 'QUALITY_POLICY',
    commitments: [
      'أقر بالاطلاع على سياسة الجودة المعتمدة والالتزام بتطبيقها في نطاق عملي.',
      'ألتزم بالمشاركة في تحقيق أهداف الجودة والتحسين المستمر.',
      'أبلغ عن أي ملاحظة أو فرصة تحسين تؤثر على جودة الخدمة.',
    ],
  },
  {
    sourceCode: 'QP-004-2026',
    ackCode: 'ACK-ISO-QP-004-2026',
    category: 'OTHER',
    commitments: [
      'أقر بالالتزام بضبط الوثائق والسجلات واستخدام النسخ المعتمدة فقط.',
      'ألتزم بعدم تداول نسخ غير محدثة أو غير معتمدة من وثائق نظام الجودة.',
      'أحافظ على السجلات المطلوبة بما يضمن سهولة الرجوع إليها وحمايتها.',
    ],
  },
  {
    sourceCode: 'QP-003-2026',
    ackCode: 'ACK-ISO-QP-003-2026',
    category: 'OTHER',
    commitments: [
      'أقر بالالتزام بمنهجية إدارة المخاطر والفرص ضمن نطاق عملي.',
      'أرفع المخاطر أو الفرص المؤثرة على الخدمة أو المستفيدين أو الامتثال.',
      'أتابع الإجراءات المتفق عليها لمعالجة المخاطر وتحسين الأداء.',
    ],
  },
  {
    sourceCode: 'QS-004-2026',
    ackCode: 'ACK-ISO-QS-004-2026',
    category: 'BENEFICIARY_RIGHTS',
    commitments: [
      'أقر بالالتزام بحماية المستفيدين واحترام حقوقهم وخصوصيتهم.',
      'أتعامل مع الشكاوى بسرية ومهنية ووفق المسار المعتمد.',
      'أبلغ الإدارة المختصة عن أي حالة قد تؤثر على سلامة المستفيد أو جودة الخدمة.',
    ],
  },
  {
    sourceCode: 'CA-001-2026',
    ackCode: 'ACK-ISO-CA-001-2026',
    category: 'OTHER',
    commitments: [
      'أقر بالالتزام بإجراء عدم المطابقة والإجراءات التصحيحية.',
      'أوثق حالات عدم المطابقة عند اكتشافها وأتعاون في تحليل السبب الجذري.',
      'أتابع تنفيذ الإجراءات التصحيحية والتحقق من فعاليتها حسب المسؤولية المسندة لي.',
    ],
  },
];

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbSetCookie(jar, headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return;
  for (const part of raw.split(/,(?=[^ ;]+=)/)) {
    const first = part.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
}

async function request(baseUrl, pathName, options, jar) {
  const headers = new Headers(options.headers || {});
  if (jar.size) headers.set('cookie', cookieHeader(jar));
  const res = await fetch(new URL(pathName, baseUrl), { ...options, headers });
  absorbSetCookie(jar, res.headers);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${options.method || 'GET'} ${pathName} -> ${res.status}: ${message}`);
  }
  return body;
}

async function login(baseUrl, email, password, jar) {
  const body = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, jar);
  if (!body.token) throw new Error('Login succeeded but no token was returned.');
  return body.token;
}

async function ensureCsrf(baseUrl, token, jar) {
  await request(baseUrl, '/api/documents?limit=1', {
    headers: { authorization: `Bearer ${token}` },
  }, jar);
  const csrf = jar.get('csrf');
  if (!csrf) throw new Error('CSRF cookie was not issued.');
  return csrf;
}

async function api(baseUrl, token, csrf, jar, method, pathName, body) {
  return request(baseUrl, pathName, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(method === 'GET' ? {} : { 'x-csrf-token': csrf }),
    },
    body: body ? JSON.stringify(body) : undefined,
  }, jar);
}

function buildContent(target, publishedDoc) {
  const commitmentLines = target.commitments.map(item => `- ${item}`).join('\n');
  return [
    `# ${publishedDoc.title}`,
    '',
    `وثيقة نظام الجودة المرجعية: ${publishedDoc.documentCode}`,
    `رمز المصدر: ${publishedDoc.sourceCode}`,
    `الإصدار: ${publishedDoc.version || 'المعتمد في سجل الوثائق'}`,
    '',
    'أقر بأنني اطلعت على الوثيقة المنشورة في وحدة الوثائق والسجلات وفهمت الالتزامات المرتبطة بها.',
    '',
    '## التعهدات',
    commitmentLines,
    '',
    'يعد هذا الإقرار جزءاً من سجلات التوعية والالتزام بمتطلبات نظام إدارة الجودة ISO 9001.',
  ].join('\n');
}

function buildPayload(target, publishedDoc) {
  return {
    code: target.ackCode,
    title: `${publishedDoc.sourceCode} - ${publishedDoc.title}`,
    category: target.category,
    audience: ['ALL'],
    version: publishedDoc.version || '1.0',
    content: buildContent(target, publishedDoc),
    commitments: target.commitments.join('\n'),
    mandatory: true,
    renewFrequency: 'ON_CHANGE',
    effectiveDate: new Date().toISOString(),
    reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    active: false,
  };
}

async function findExistingAck(baseUrl, token, csrf, jar, code) {
  const data = await api(baseUrl, token, csrf, jar, 'GET', `/api/ack-documents?q=${encodeURIComponent(code)}&limit=20`);
  return (data.items || []).find(item => item.code === code) || null;
}

async function main() {
  const approvalResults = JSON.parse(await fs.readFile(APPROVAL_RESULTS_PATH, 'utf8'));
  const publishedBySourceCode = new Map((approvalResults.results || []).map(item => [item.sourceCode, item]));
  const plan = ACK_TARGETS.map(target => {
    const publishedDoc = publishedBySourceCode.get(target.sourceCode);
    if (!publishedDoc) throw new Error(`Missing approved document for ${target.sourceCode}.`);
    return { target, publishedDoc, payload: buildPayload(target, publishedDoc) };
  });

  if (!APPLY) {
    await fs.writeFile(OUTPUT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: 'dry-run',
      count: plan.length,
      planned: plan.map(({ target, publishedDoc, payload }) => ({
        sourceCode: target.sourceCode,
        documentCode: publishedDoc.documentCode,
        ackCode: target.ackCode,
        title: payload.title,
        category: payload.category,
        audience: payload.audience,
      })),
    }, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', count: plan.length }, null, 2));
    return;
  }

  if (!CONFIRMED) {
    throw new Error('Refusing production write. Re-run with --apply --yes-i-understand-production-write after explicit approval.');
  }

  const baseUrl = process.env.QMS_BASE_URL || approvalResults.target || 'https://quality.aqiltech.sa';
  const email = process.env.QMS_EMAIL;
  const password = process.env.QMS_PASSWORD;
  if (!email || !password) throw new Error('Set QMS_EMAIL and QMS_PASSWORD in environment.');

  const jar = new Map();
  const token = await login(baseUrl, email, password, jar);
  const csrf = await ensureCsrf(baseUrl, token, jar);

  const results = [];
  for (const item of plan) {
    const existing = await findExistingAck(baseUrl, token, csrf, jar, item.target.ackCode);
    let saved;
    let operation;
    if (existing) {
      saved = await api(baseUrl, token, csrf, jar, 'PUT', `/api/ack-documents/${existing.id}`, item.payload);
      operation = 'updated';
    } else {
      saved = await api(baseUrl, token, csrf, jar, 'POST', '/api/ack-documents', item.payload);
      operation = 'created';
    }

    const ackDoc = saved.item;
    const activated = ackDoc.active
      ? { doc: ackDoc }
      : await api(baseUrl, token, csrf, jar, 'POST', `/api/ack-documents/${ackDoc.id}/activate`, {
          approvedBy: 'إدارة الجودة',
        });

    const report = await api(baseUrl, token, csrf, jar, 'GET', `/api/ack-documents/${ackDoc.id}/report`);
    results.push({
      sourceCode: item.target.sourceCode,
      documentCode: item.publishedDoc.documentCode,
      ackCode: item.target.ackCode,
      ackDocumentId: ackDoc.id,
      operation,
      active: activated.doc?.active === true,
      mandatory: activated.doc?.mandatory === true,
      audience: activated.doc?.audience || [],
      stats: report.stats,
    });
  }

  const matrix = await api(baseUrl, token, csrf, jar, 'GET', '/api/ack-documents/matrix');
  await fs.writeFile(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: 'apply',
    target: baseUrl,
    count: results.length,
    results,
    matrix: {
      activeDocuments: matrix.docs?.length || 0,
      users: matrix.users || 0,
      overall: matrix.overall || null,
    },
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    result: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/'),
    count: results.length,
    active: results.filter(item => item.active).length,
    users: matrix.users || 0,
    coverage: matrix.overall?.coverage,
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
