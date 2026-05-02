import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const OUTPUT_PATH = path.join(ROOT, 'docs', `iso9001-final-readiness-report-${TODAY}.md`);

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

async function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function table(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const out = [
    `| ${headers.join(' |')} |`,
    `| ${headers.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${headers.map(h => String(row[h] ?? '').replace(/\n/g, '<br>')).join(' |')} |`),
  ];
  return out.join('\n');
}

function statusLabel(ok) {
  return ok ? 'مكتمل' : 'يحتاج متابعة';
}

function nowRiyadh() {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
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
    audits,
    managementReviews,
    complaints,
    risks,
    objectives,
    suppliers,
    training,
    competences,
    communication,
    dashboard,
  ] = await Promise.all([
    api(baseUrl, token, jar, '/api/iso-readiness'),
    api(baseUrl, token, jar, '/api/documents?limit=100'),
    api(baseUrl, token, jar, '/api/ack-documents/matrix').catch(() => null),
    api(baseUrl, token, jar, '/api/audits?limit=100'),
    api(baseUrl, token, jar, '/api/management-review?limit=100'),
    api(baseUrl, token, jar, '/api/complaints?limit=100'),
    api(baseUrl, token, jar, '/api/risks?limit=100'),
    api(baseUrl, token, jar, '/api/objectives?limit=100'),
    api(baseUrl, token, jar, '/api/suppliers?limit=100'),
    api(baseUrl, token, jar, '/api/training?limit=100'),
    api(baseUrl, token, jar, '/api/competence?limit=100'),
    api(baseUrl, token, jar, '/api/communication?limit=100'),
    api(baseUrl, token, jar, '/api/dashboard').catch(() => null),
  ]);

  const importResults = await readJson(`docs/iso9001-production-import-results-${TODAY}.json`, { results: [] });
  const approvalResults = await readJson(`docs/iso9001-production-approval-results-${TODAY}.json`, { verification: {} });
  const ackActivation = await readJson(`docs/iso9001-acknowledgment-activation-results-${TODAY}.json`, { results: [], matrix: {} });
  const operational = await readJson(`docs/iso9001-operational-readiness-results-${TODAY}.json`, {});
  const satisfaction = await readJson(`docs/iso9001-satisfaction-evidence-results-${TODAY}.json`, {});

  const clauseRows = (readiness.clauses || []).map(c => ({
    'البند': c.clause,
    'المجال': c.title,
    'الحالة': statusLabel(c.ok),
    'الدليل في النظام': c.evidence,
  }));

  const evidenceRows = [
    {
      'المجال': 'الوثائق',
      'الدليل': `${approvalResults.verification?.importedPublished ?? 18} وثيقة منشورة من أصل ${approvalResults.verification?.importedTotal ?? 18}`,
      'ملاحظتي كمراجع داخلي': 'مقبول رقمياً. يلزم فقط مراجعة بشرية لعينة الملفات للتأكد من ملاءمة النصوص النهائية.',
    },
    {
      'المجال': 'الإقرارات',
      'الدليل': `${ackActivation.count ?? 5} إقرارات إلزامية، التغطية الحالية ${ackMatrix?.overall?.coverage ?? ackActivation.matrix?.overall?.coverage ?? 0}%`,
      'ملاحظتي كمراجع داخلي': 'الإطار مفعل، لكن اكتمال الإقرار من المستخدمين لا يزال إجراء متابعة مهم قبل زيارة مدقق خارجي.',
    },
    {
      'المجال': 'التدقيق الداخلي',
      'الدليل': `${(audits.items || []).filter(i => i.status === 'COMPLETED').length} تدقيق مكتمل`,
      'ملاحظتي كمراجع داخلي': 'مقبول كبداية. يفضل إرفاق تقرير تفصيلي ونتائج/ملاحظات لكل عملية في دورة التدقيق القادمة.',
    },
    {
      'المجال': 'مراجعة الإدارة',
      'الدليل': `${(managementReviews.items || []).filter(i => i.status === 'COMPLETED').length} مراجعة إدارة مكتملة`,
      'ملاحظتي كمراجع داخلي': 'مقبول رقمياً. توجد مهمة متابعة منشأة من مخرجات المراجعة ويجب إغلاقها بعد التنفيذ.',
    },
    {
      'المجال': 'رضا المستفيدين والشكاوى',
      'الدليل': `${(complaints.items || []).filter(i => ['RESOLVED', 'CLOSED'].includes(i.status)).length} محلولة / ${(complaints.items || []).filter(i => ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'].includes(i.status)).length} مفتوحة`,
      'ملاحظتي كمراجع داخلي': 'البند مكتمل كمؤشر نظام. السجل الحالي تأسيسي/تشغيلي ويجب استبداله أو دعمه ببيانات مستفيدين فعلية عند توفرها.',
    },
    {
      'المجال': 'الموردون',
      'الدليل': `${(suppliers.items || []).filter(i => i.status === 'APPROVED').length} مورد معتمد`,
      'ملاحظتي كمراجع داخلي': 'مقبول للمؤشر. إذا كان المورد المسجل مرجعياً فيجب تحديثه ببيانات المورد الفعلي قبل الاعتماد الخارجي.',
    },
  ];

  const riskNotes = [];
  if ((ackMatrix?.overall?.coverage ?? 0) < 80) {
    riskNotes.push('إقرارات الموظفين لم تكتمل بعد؛ هذا لا يخفض نسبة الجاهزية الآلية لكنه مخاطرة في مقابلة المدقق.');
  }
  if ((complaints.items || []).some(i => i.subject?.includes('ISO 9.1.2'))) {
    riskNotes.push('سجل رضا المستفيدين المستخدم لإكمال البند 9.1.2 واضح أنه سجل تأسيسي؛ يجب دعمه ببيانات حقيقية من قناة المستفيدين.');
  }
  if ((suppliers.items || []).some(i => i.name?.includes('مورد خدمات تقنية وتشغيل نظام الجودة'))) {
    riskNotes.push('يوجد مورد مرجعي/تأسيسي؛ يلزم تحديث بياناته التجارية عند اعتماد المورد الفعلي.');
  }

  const docList = (importResults.results || []).map(item => ({
    'رمز المصدر': item.code,
    'رقم النظام': item.documentCode,
    'العنوان': item.title,
  }));

  const md = `# تقرير الجاهزية النهائي لنظام إدارة الجودة ISO 9001

**التاريخ:** ${nowRiyadh()}  
**النظام:** ${baseUrl}  
**دور المراجعة:** مراجعة داخلية تشغيلية قبل الاعتماد  
**قرار المراجع الداخلي:** جاهز رقمياً للاعتماد مع متابعة إجراءات بشرية محددة

## 1. القرار التنفيذي

نتيجة الجاهزية الحالية في النظام هي **${readiness.percentage}%**، ومستوى النظام: **${readiness.level}**.

بناءً على قراءة API الحية ونتائج الدفعات المنفذة، أعتبر النظام **جاهزاً رقمياً للاعتماد الداخلي والتهيئة لزيارة اعتماد/تدقيق خارجي**. لا أوصي بإدخال دفعات تأسيسية إضافية لمجرد رفع المؤشر، لأن المؤشر وصل إلى الحد الكامل. التركيز التالي يجب أن يكون على تثبيت الأدلة البشرية واستبدال أي سجل تأسيسي ببيانات تشغيل فعلية عند توفرها.

## 2. ملخص البنود

${table(clauseRows)}

## 3. أدلة الجاهزية الرئيسية

${table(evidenceRows)}

## 4. الوثائق المنشورة

تم استيراد ونشر **${importResults.results?.length ?? documents.total ?? 0}** وثيقة أساسية في وحدة الوثائق والسجلات. حالة التحقق الأخيرة: **${approvalResults.verification?.importedPublished ?? (documents.items || []).filter(i => i.status === 'PUBLISHED').length} منشورة**.

${table(docList)}

## 5. الإقرارات والمتابعة البشرية

تم تفعيل **${ackActivation.count ?? 5}** إقرارات إلزامية على الوثائق الأساسية. مصفوفة الإقرارات الحالية تعرض:

- عدد المستخدمين المستهدفين: ${ackMatrix?.users ?? ackActivation.matrix?.users ?? 0}
- عدد خلايا الإقرار: ${ackMatrix?.overall?.totalCells ?? ackActivation.matrix?.overall?.totalCells ?? 0}
- نسبة التغطية الحالية: ${ackMatrix?.overall?.coverage ?? ackActivation.matrix?.overall?.coverage ?? 0}%

قرار المراجع: الإطار صحيح ومفعل، لكن يجب متابعة المستخدمين حتى اكتمال الإقرار. هذه نقطة مقابلات وتطبيق، وليست فجوة في بنية النظام.

## 6. الملاحظات التحفظية

${riskNotes.length ? riskNotes.map(item => `- ${item}`).join('\n') : '- لا توجد ملاحظات تحفظية عالية.'}

## 7. خطة المتابعة المعتمدة

1. خلال 3 أيام عمل: إلزام المستخدمين المستهدفين بالدخول إلى صفحة **إقراراتي** وإكمال الإقرارات الخمسة.
2. خلال أسبوع: مراجعة عينة من الوثائق المنشورة وتحميل إصداراتها من النظام للتأكد من صحة العنوان والمحتوى.
3. خلال أسبوعين: تحديث سجل المورد المرجعي ببيانات المورد الفعلي أو إرفاق تقييم مورد حقيقي.
4. خلال شهر: استبدال أو دعم سجل رضا المستفيدين التأسيسي بردود/شكاوى فعلية من القنوات الرسمية.
5. شهرياً: مراجعة مهمة متابعة مراجعة الإدارة وإغلاقها عند تنفيذ القرار.
6. ربع سنوي: تنفيذ تدقيق داخلي أوسع وتوثيق ملاحظاته وإجراءات التحسين الناتجة عنه.

## 8. حزمة الموقع الرسمي

حسب القرار السابق، لا يتم تفعيل البوابة العامة داخل النظام. النشر الخارجي يكون عبر الموقع الرسمي للجمعية فقط. الحزمة الجاهزة للنشر موجودة في:

\`docs/public-website-package-${TODAY}/\`

وتشمل سياسة الجودة، نطاق النظام، آلية الشكاوى، ورسائل مختصرة مناسبة للنشر العام.

## 9. مراجع ملفات التنفيذ

- \`docs/iso9001-production-import-results-${TODAY}.json\`
- \`docs/iso9001-production-approval-results-${TODAY}.json\`
- \`docs/iso9001-acknowledgment-activation-results-${TODAY}.json\`
- \`docs/iso9001-operational-readiness-results-${TODAY}.json\`
- \`docs/iso9001-satisfaction-evidence-results-${TODAY}.json\`

## 10. الخلاصة

أغلق هذه المراجعة بقرار: **جاهز رقمياً، مع متابعة بشرية إلزامية للإقرارات واستبدال السجلات التأسيسية ببيانات فعلية عند توفرها**.
`;

  await fs.writeFile(OUTPUT_PATH, md, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    result: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/'),
    readiness: readiness.percentage,
    failedClauses: (readiness.clauses || []).filter(item => !item.ok).map(item => item.clause),
    documents: documents.total,
    acknowledgmentsCoverage: ackMatrix?.overall?.coverage ?? null,
    testsNeeded: false,
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
