import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const OUTPUT_PATH = path.join(ROOT, 'docs', `iso9001-external-auditor-evidence-pack-${TODAY}.md`);

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

async function api(baseUrl, token, jar, pathName) {
  return request(baseUrl, pathName, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  }, jar);
}

function arNow() {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
}

function table(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${headers.map(h => String(row[h] ?? '').replace(/\n/g, '<br>')).join(' | ')} |`),
  ].join('\n');
}

function topCodes(items, count = 5) {
  return (items || [])
    .slice(0, count)
    .map(i => i.code ? `${i.code} - ${i.title || i.name || i.subject || i.topic || i.jobTitle}` : (i.title || i.name || i.subject || i.topic || i.jobTitle))
    .filter(Boolean)
    .join('<br>');
}

async function main() {
  const baseUrl = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
  const email = process.env.QMS_EMAIL;
  const password = process.env.QMS_PASSWORD;
  if (!email || !password) throw new Error('Set QMS_EMAIL and QMS_PASSWORD in environment.');

  const jar = new Map();
  const token = await login(baseUrl, email, password, jar);

  const [
    readiness,
    documents,
    ackMatrix,
    swot,
    parties,
    processes,
    policy,
    goals,
    objectives,
    risks,
    competences,
    communication,
    suppliers,
    complaints,
    audits,
    managementReviews,
    ncr,
  ] = await Promise.all([
    api(baseUrl, token, jar, '/api/iso-readiness'),
    api(baseUrl, token, jar, '/api/documents?limit=100'),
    api(baseUrl, token, jar, '/api/ack-documents/matrix').catch(() => null),
    api(baseUrl, token, jar, '/api/swot?limit=100').catch(() => ({ items: [] })),
    api(baseUrl, token, jar, '/api/interested-parties?limit=100').catch(() => ({ items: [] })),
    api(baseUrl, token, jar, '/api/processes?limit=100').catch(() => ({ items: [] })),
    api(baseUrl, token, jar, '/api/quality-policy/active').catch(() => null),
    api(baseUrl, token, jar, '/api/strategic-goals?limit=100'),
    api(baseUrl, token, jar, '/api/objectives?limit=100'),
    api(baseUrl, token, jar, '/api/risks?limit=100'),
    api(baseUrl, token, jar, '/api/competence?limit=100'),
    api(baseUrl, token, jar, '/api/communication?limit=100'),
    api(baseUrl, token, jar, '/api/suppliers?limit=100'),
    api(baseUrl, token, jar, '/api/complaints?limit=100'),
    api(baseUrl, token, jar, '/api/audits?limit=100'),
    api(baseUrl, token, jar, '/api/management-review?limit=100'),
    api(baseUrl, token, jar, '/api/ncr?limit=100'),
  ]);

  const publishedDocs = (documents.items || []).filter(i => i.status === 'PUBLISHED');
  const completedAudits = (audits.items || []).filter(i => i.status === 'COMPLETED');
  const completedReviews = (managementReviews.items || []).filter(i => i.status === 'COMPLETED');
  const resolvedComplaints = (complaints.items || []).filter(i => ['RESOLVED', 'CLOSED'].includes(i.status));
  const approvedSuppliers = (suppliers.items || []).filter(i => i.status === 'APPROVED');
  const closedNcr = (ncr.items || []).filter(i => i.status === 'CLOSED');

  const rows = [
    {
      'بند ISO': '4.1',
      'ما يطلبه المدقق': 'فهم سياق المنظمة',
      'أين يجده في النظام': 'السياق والقيادة > SWOT',
      'أدلة جاهزة': `${swot.total ?? swot.items?.length ?? 0} بند SWOT`,
      'ملاحظات للمقابلة': 'اشرح أن التحليل مرتبط بالخطة والمخاطر والتحسين.',
    },
    {
      'بند ISO': '4.2',
      'ما يطلبه المدقق': 'الأطراف ذات العلاقة واحتياجاتها',
      'أين يجده في النظام': 'السياق والقيادة > الأطراف ذات العلاقة',
      'أدلة جاهزة': `${parties.total ?? parties.items?.length ?? 0} طرف مسجل`,
      'ملاحظات للمقابلة': 'ركز على المستفيدين، الجهات التنظيمية، المتبرعين، الموردين، الموظفين.',
    },
    {
      'بند ISO': '4.4',
      'ما يطلبه المدقق': 'خريطة العمليات وتفاعلها',
      'أين يجده في النظام': 'السياق والقيادة > خريطة العمليات',
      'أدلة جاهزة': `${processes.total ?? processes.items?.length ?? 0} عملية`,
      'ملاحظات للمقابلة': 'اربط العمليات بالوثائق والمؤشرات والمسؤوليات.',
    },
    {
      'بند ISO': '5.2',
      'ما يطلبه المدقق': 'سياسة الجودة',
      'أين يجده في النظام': 'سياسة الجودة + الوثائق والسجلات',
      'أدلة جاهزة': policy?.policy?.title || policy?.item?.title || 'سياسة جودة فعالة',
      'ملاحظات للمقابلة': 'السياسة منشورة داخلياً، والنشر الخارجي سيكون عبر الموقع الرسمي للجمعية.',
    },
    {
      'بند ISO': '6.1',
      'ما يطلبه المدقق': 'المخاطر والفرص',
      'أين يجده في النظام': 'التخطيط والأداء > المخاطر',
      'أدلة جاهزة': `${risks.total ?? risks.items?.length ?? 0} مخاطر/فرص`,
      'ملاحظات للمقابلة': 'استعرض أعلى المخاطر وخطط المعالجة ومواعيد المراجعة.',
    },
    {
      'بند ISO': '6.2',
      'ما يطلبه المدقق': 'أهداف الجودة القابلة للقياس',
      'أين يجده في النظام': 'التخطيط والأداء > الأهداف التشغيلية / المؤشرات',
      'أدلة جاهزة': `${objectives.total ?? objectives.items?.length ?? 0} هدف`,
      'ملاحظات للمقابلة': 'اعرض الهدف، المؤشر، المستهدف، المالك، والحالة.',
    },
    {
      'بند ISO': '7.2',
      'ما يطلبه المدقق': 'الكفاءة والتدريب',
      'أين يجده في النظام': 'الدعم > الكفاءة + التدريب',
      'أدلة جاهزة': `${competences.total ?? competences.items?.length ?? 0} متطلبات كفاءة`,
      'ملاحظات للمقابلة': 'أكمل لاحقاً سجلات حضور التدريب للموظفين كدليل أقوى.',
    },
    {
      'بند ISO': '7.4',
      'ما يطلبه المدقق': 'خطة الاتصال',
      'أين يجده في النظام': 'الدعم > التواصل',
      'أدلة جاهزة': `${communication.total ?? communication.items?.length ?? 0} خطط اتصال`,
      'ملاحظات للمقابلة': 'اذكر أن الموقع الرسمي هو قناة النشر العامة، وليس بوابة النظام.',
    },
    {
      'بند ISO': '7.5',
      'ما يطلبه المدقق': 'المعلومات الموثقة وضبط الوثائق',
      'أين يجده في النظام': 'الدعم > الوثائق والسجلات > الإصدارات',
      'أدلة جاهزة': `${publishedDocs.length} وثيقة منشورة`,
      'ملاحظات للمقابلة': 'افتح سجل الإصدارات وحمّل ملفاً أو ملفين أمام المدقق.',
    },
    {
      'بند ISO': '8.4',
      'ما يطلبه المدقق': 'ضبط الموردين',
      'أين يجده في النظام': 'التشغيل > الموردون',
      'أدلة جاهزة': `${approvedSuppliers.length} مورد معتمد`,
      'ملاحظات للمقابلة': 'حدث بيانات المورد المرجعي بمورد فعلي قبل التدقيق الخارجي إن أمكن.',
    },
    {
      'بند ISO': '9.1.2',
      'ما يطلبه المدقق': 'رضا المستفيدين والشكاوى',
      'أين يجده في النظام': 'الجودة والتحسين > الشكاوى / الاستبيانات',
      'أدلة جاهزة': `${resolvedComplaints.length} شكوى/ملاحظة محلولة`,
      'ملاحظات للمقابلة': 'السجل الحالي تأسيسي؛ يفضل دعمه بسجل فعلي من قنوات المستفيدين.',
    },
    {
      'بند ISO': '9.2',
      'ما يطلبه المدقق': 'التدقيق الداخلي',
      'أين يجده في النظام': 'الجودة والتحسين > التدقيقات',
      'أدلة جاهزة': `${completedAudits.length} تدقيق مكتمل`,
      'ملاحظات للمقابلة': 'اعرض النطاق، المعايير، النتائج، والتوقيع الرقمي.',
    },
    {
      'بند ISO': '9.3',
      'ما يطلبه المدقق': 'مراجعة الإدارة',
      'أين يجده في النظام': 'الجودة والتحسين > مراجعة الإدارة',
      'أدلة جاهزة': `${completedReviews.length} مراجعة مكتملة`,
      'ملاحظات للمقابلة': 'اعرض المدخلات، القرارات، ومهمة المتابعة الناتجة.',
    },
    {
      'بند ISO': '10.2',
      'ما يطلبه المدقق': 'عدم المطابقة والإجراء التصحيحي',
      'أين يجده في النظام': 'الجودة والتحسين > NCR / CAPA',
      'أدلة جاهزة': `${closedNcr.length} NCR مغلق`,
      'ملاحظات للمقابلة': 'لا توجد NCR مفتوحة حالياً؛ اشرح مسار التحويل من الشكوى إلى NCR عند الحاجة.',
    },
  ];

  const docRows = publishedDocs.slice(0, 20).map(d => ({
    'رقم الوثيقة': d.code,
    'العنوان': d.title,
    'الحالة': d.status,
    'الإصدار': d.currentVersion,
  }));

  const md = `# ملف أدلة المدقق الخارجي ISO 9001

**التاريخ:** ${arNow()}  
**النظام:** ${baseUrl}  
**نتيجة الجاهزية الحية:** ${readiness.percentage}% - ${readiness.level}  
**الغرض:** خريطة عملية تساعد المدقق أو فريق الجودة على الوصول السريع للأدلة داخل النظام.

## طريقة استخدام الملف

1. افتح النظام وسجل الدخول بحساب له صلاحيات قراءة الجودة.
2. استخدم عمود "أين يجده في النظام" للوصول إلى الشاشة.
3. افتح سجلين أو ثلاثة لكل بند عالي الأهمية، ولا تكتف بعرض النسبة العامة.
4. عند سؤال المدقق عن السجلات التأسيسية، كن واضحاً: بعضها أنشئ لتشغيل دورة ISO رقمياً، وسيتم استبداله ببيانات تشغيل فعلية عند توفرها.

## خريطة الأدلة حسب بند ISO

${table(rows)}

## وثائق أساسية منشورة يمكن فتحها أثناء التدقيق

${table(docRows)}

## عينات مقترحة للعرض أمام المدقق

- الوثائق: افتح وثيقة سياسة الجودة، ضبط الوثائق، إدارة المخاطر، التدقيق الداخلي، ومراجعة الإدارة من صفحة **الوثائق والسجلات** ثم زر **الإصدارات**.
- الإقرارات: افتح **مصفوفة الإقرارات الشاملة** ووضح أن الإطار مفعل وأن تغطية الإقرار الحالية ${ackMatrix?.overall?.coverage ?? 0}%.
- التدقيق الداخلي: افتح أول تدقيق مكتمل واعرض النطاق والمعايير والنتائج.
- مراجعة الإدارة: افتح أول مراجعة مكتملة واعرض القرارات ومهمة المتابعة.
- الشكاوى/الرضا: افتح سجل الملاحظة المحلولة ووضح أنه دليل تأسيسي، ثم استبدله لاحقاً بسجل فعلي.
- الموردون: افتح المورد المعتمد، وحدث بياناته عند توفر مورد فعلي معتمد.

## قائمة تحضير قبل زيارة خارجية

- رفع تغطية الإقرارات إلى 80% على الأقل، والأفضل 100%.
- تحديث سجل المورد المرجعي ببيانات فعلية.
- إضافة ردود رضا أو شكوى فعلية من قناة مستفيد رسمية.
- مراجعة عينة الوثائق المنشورة والتأكد من أن الملفات المرفوعة صحيحة.
- تجهيز صاحب كل شاشة لشرحها: الوثائق، المخاطر، التدقيق، مراجعة الإدارة، الشكاوى.

## ملاحظات شفافة للمراجع الداخلي

- الجاهزية الآلية مكتملة، لكنها لا تغني عن اكتمال الإقرارات البشرية.
- بعض السجلات تأسيسية لتشغيل الدورة الأولى، وهذا مقبول كمرحلة انتقالية إذا وُضعت خطة لاستبدالها ببيانات تشغيل حقيقية.
- البوابة العامة داخل النظام غير مفعلة بقرار إداري؛ النشر الخارجي يكون عبر الموقع الرسمي للجمعية.

## ملخص أرقام حية

- الوثائق المنشورة: ${publishedDocs.length}
- الإقرارات، نسبة التغطية: ${ackMatrix?.overall?.coverage ?? 0}%
- المخاطر والفرص: ${risks.total ?? risks.items?.length ?? 0}
- الأهداف: ${objectives.total ?? objectives.items?.length ?? 0}
- التدقيقات المكتملة: ${completedAudits.length}
- مراجعات الإدارة المكتملة: ${completedReviews.length}
- الشكاوى/الملاحظات المحلولة: ${resolvedComplaints.length}
`;

  await fs.writeFile(OUTPUT_PATH, md, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    result: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/'),
    readiness: readiness.percentage,
    clauses: rows.length,
    publishedDocuments: publishedDocs.length,
    acknowledgmentCoverage: ackMatrix?.overall?.coverage ?? null,
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
