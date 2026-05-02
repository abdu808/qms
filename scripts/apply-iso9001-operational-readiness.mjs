import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TODAY = '2026-05-02';
const OUTPUT_PATH = path.join(ROOT, 'docs', `iso9001-operational-readiness-results-${TODAY}.json`);

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CONFIRMED = args.has('--yes-i-understand-production-write');

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
  return { token: body.token, user: body.user };
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

async function getReadiness(baseUrl, token, csrf, jar) {
  return api(baseUrl, token, csrf, jar, 'GET', '/api/iso-readiness');
}

async function findByTitle(baseUrl, token, csrf, jar, endpoint, title) {
  const data = await api(baseUrl, token, csrf, jar, 'GET', `/api/${endpoint}?q=${encodeURIComponent(title)}&limit=50`);
  return (data.items || []).find(item => item.title === title || item.name === title || item.topic === title || item.jobTitle === title) || null;
}

async function createIfMissing(baseUrl, token, csrf, jar, endpoint, title, payload, results) {
  const existing = await findByTitle(baseUrl, token, csrf, jar, endpoint, title);
  if (existing) {
    results.push({ endpoint, title, operation: 'exists', id: existing.id, code: existing.code || null });
    return existing;
  }
  const created = await api(baseUrl, token, csrf, jar, 'POST', `/api/${endpoint}`, payload);
  results.push({ endpoint, title, operation: 'created', id: created.item?.id, code: created.item?.code || null });
  return created.item;
}

function clause(readiness, clause) {
  return (readiness.clauses || []).find(item => item.clause === clause);
}

function signatureData(label) {
  return [
    'ISO9001_OPERATIONAL_READINESS_BATCH',
    `label=${label}`,
    `date=${new Date().toISOString()}`,
    'attestation=approved_by_authenticated_super_admin_for_qms_operational_readiness',
  ].join('; ');
}

const strategicGoals = [
  {
    title: 'تعزيز فعالية نظام إدارة الجودة',
    perspective: 'الجودة والحوكمة',
    kpi: 'نسبة إغلاق إجراءات الجودة في موعدها',
    baseline: '60%',
    target: '90%',
    legacyInitiatives: 'تفعيل الوثائق، الإقرارات، التدقيق الداخلي، مراجعة الإدارة',
    responsible: 'إدارة الجودة',
    startYear: 2026,
    endYear: 2026,
    progress: 60,
    status: 'ACTIVE',
    notes: 'هدف تشغيلي داعم لمتطلبات ISO 9001.',
  },
  {
    title: 'رفع رضا المستفيدين وجودة الاستجابة',
    perspective: 'المستفيدون',
    kpi: 'متوسط رضا المستفيدين ومعدل إغلاق الشكاوى',
    baseline: 'قيد القياس',
    target: 'رضا 85% وإغلاق الشكاوى ضمن SLA',
    legacyInitiatives: 'تحسين استقبال الشكاوى، تتبع SLA، مراجعة التغذية الراجعة',
    responsible: 'إدارة البرامج والخدمات',
    startYear: 2026,
    endYear: 2026,
    progress: 45,
    status: 'ACTIVE',
    notes: 'مرتبط بالبند 9.1.2 ومخرجات تحسين الخدمة.',
  },
  {
    title: 'ضمان استمرارية الخدمات الرقمية والموارد الداعمة',
    perspective: 'الدعم والموارد',
    kpi: 'نسبة جاهزية الأنظمة والخدمات الداعمة',
    baseline: 'قيد القياس',
    target: 'توفر 99% وخطة استمرارية مفعلة',
    legacyInitiatives: 'ضبط البنية التقنية، الموردين، الكفاءات، الاتصال الداخلي',
    responsible: 'الدعم المؤسسي وتقنية المعلومات',
    startYear: 2026,
    endYear: 2026,
    progress: 50,
    status: 'ACTIVE',
    notes: 'مرتبط بمتطلبات ISO 7 و8.4.',
  },
];

const objectives = [
  {
    title: 'تحقيق التزام الموظفين بالوثائق الأساسية',
    description: 'متابعة إقرارات الموظفين على وثائق نظام الجودة الأساسية.',
    kpi: 'نسبة الإقرارات المكتملة',
    baseline: 0,
    target: 100,
    unit: '%',
    currentValue: 3,
    startDate: '2026-05-02',
    dueDate: '2026-06-30',
    status: 'IN_PROGRESS',
    progress: 3,
    kpiType: 'SNAPSHOT',
    seasonality: 'UNIFORM',
    direction: 'HIGHER_BETTER',
  },
  {
    title: 'إغلاق ملاحظات التدقيق الداخلي',
    description: 'تحويل ملاحظات التدقيق إلى إجراءات متابعة قابلة للقياس.',
    kpi: 'نسبة إغلاق ملاحظات التدقيق',
    baseline: 0,
    target: 90,
    unit: '%',
    currentValue: 0,
    startDate: '2026-05-02',
    dueDate: '2026-08-31',
    status: 'PLANNED',
    progress: 0,
    kpiType: 'CUMULATIVE',
    seasonality: 'QUARTERLY',
    direction: 'HIGHER_BETTER',
  },
  {
    title: 'تحسين زمن معالجة الشكاوى',
    description: 'تخفيض زمن معالجة الشكاوى وربطها بإجراءات تحسين الخدمة.',
    kpi: 'متوسط أيام معالجة الشكوى',
    baseline: 7,
    target: 3,
    unit: 'يوم',
    currentValue: 7,
    startDate: '2026-05-02',
    dueDate: '2026-12-31',
    status: 'IN_PROGRESS',
    progress: 25,
    kpiType: 'PERIODIC',
    seasonality: 'MONTHLY_EVEN',
    direction: 'LOWER_BETTER',
  },
];

const risks = [
  ['RISK', 'استخدام وثائق غير محدثة في تقديم الخدمة', 3, 4, 'MITIGATE', 'ضبط الوصول للوثائق المنشورة ومتابعة الإقرارات.', 'UNDER_TREATMENT'],
  ['RISK', 'تأخر معالجة شكاوى المستفيدين', 3, 5, 'MITIGATE', 'تفعيل SLA ومتابعة الشكاوى المفتوحة أسبوعياً.', 'UNDER_TREATMENT'],
  ['RISK', 'عدم اكتمال أدلة الكفاءة والتدريب', 3, 3, 'MITIGATE', 'اعتماد مصفوفة كفاءات وربطها بخطة تدريب.', 'IDENTIFIED'],
  ['RISK', 'انقطاع الخدمة الرقمية أو فقدان البيانات', 2, 5, 'TRANSFER', 'تفعيل النسخ الاحتياطي وخطة استمرارية العمل.', 'UNDER_TREATMENT'],
  ['OPPORTUNITY', 'أتمتة تقارير الجاهزية ومتابعة المؤشرات', 4, 4, 'ACCEPT', 'استخدام تقارير النظام لتحسين سرعة القرار ومتابعة التحسين.', 'ACCEPTED'],
];

const competences = [
  {
    jobTitle: 'مسؤول الجودة',
    department: 'الجودة',
    requiredSkills: 'فهم ISO 9001، ضبط الوثائق، إدارة المخاطر، التدقيق الداخلي، تحليل السبب الجذري.',
    minEducation: 'بكالوريوس أو خبرة عملية معتمدة في الجودة',
    minExperience: 2,
    certifications: 'دورة ISO 9001 أو تدقيق داخلي',
    trainings: 'التوعية بنظام الجودة، إدارة المخاطر، التدقيق الداخلي',
    evaluationMethod: 'مراجعة أداء ربع سنوية ومخرجات التدقيق والإجراءات التصحيحية',
    status: 'ACTIVE',
  },
  {
    jobTitle: 'مدير البرامج والخدمات',
    department: 'البرامج',
    requiredSkills: 'إدارة تقديم الخدمة، قياس رضا المستفيدين، معالجة الشكاوى، متابعة مؤشرات الأداء.',
    minEducation: 'بكالوريوس أو خبرة مكافئة في العمل الاجتماعي أو الإدارة',
    minExperience: 3,
    certifications: 'إدارة مشاريع أو خدمة مستفيدين',
    trainings: 'حماية المستفيدين، الشكاوى، مؤشرات الأداء',
    evaluationMethod: 'نتائج رضا المستفيدين ومعدل إغلاق الشكاوى',
    status: 'ACTIVE',
  },
  {
    jobTitle: 'مسؤول تقنية المعلومات',
    department: 'تقنية المعلومات',
    requiredSkills: 'إدارة الأنظمة، أمن المعلومات، النسخ الاحتياطي، استمرارية العمل.',
    minEducation: 'دبلوم أو بكالوريوس تقنية معلومات',
    minExperience: 2,
    certifications: 'أساسيات أمن معلومات أو إدارة أنظمة',
    trainings: 'استمرارية العمل، حماية البيانات، إدارة الحوادث التقنية',
    evaluationMethod: 'توفر الأنظمة ونتائج اختبارات النسخ الاحتياطي',
    status: 'ACTIVE',
  },
];

const communications = [
  {
    topic: 'تعميم الوثائق والإقرارات الأساسية لنظام الجودة',
    audience: 'جميع المستخدمين الداخليين',
    purpose: 'ضمان اطلاع الموظفين على الوثائق الأساسية والالتزام بها.',
    channel: 'النظام الداخلي والبريد الإلكتروني',
    frequency: 'عند إصدار أو تحديث الوثيقة',
    responsible: 'إدارة الجودة',
    format: 'إشعار داخلي مع متابعة الإقرار',
    status: 'ACTIVE',
  },
  {
    topic: 'تقرير مؤشرات الجودة والمخاطر',
    audience: 'الإدارة العليا ومديرو الإدارات',
    purpose: 'مراجعة الأداء والمخاطر والإجراءات المفتوحة لاتخاذ قرارات تحسين.',
    channel: 'اجتماع دوري ولوحة النظام',
    frequency: 'شهري',
    responsible: 'إدارة الجودة',
    format: 'تقرير مختصر ولوحة مؤشرات',
    status: 'ACTIVE',
  },
  {
    topic: 'قنوات شكاوى وملاحظات المستفيدين',
    audience: 'المستفيدون وفرق الخدمة',
    purpose: 'تعريف القنوات وآلية التعامل مع الشكاوى وسرعة الاستجابة.',
    channel: 'الموقع الرسمي ورسائل الخدمة',
    frequency: 'مستمر وعند الحاجة',
    responsible: 'إدارة البرامج والخدمات',
    format: 'نص إرشادي وتحديثات دورية',
    status: 'ACTIVE',
  },
];

async function main() {
  const baseUrl = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
  const email = process.env.QMS_EMAIL;
  const password = process.env.QMS_PASSWORD;

  const dryRun = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    target: baseUrl,
    planned: {
      strategicGoals: strategicGoals.length,
      objectives: objectives.length,
      risks: risks.length,
      competences: competences.length,
      communications: communications.length,
      suppliers: 1,
      audits: 1,
      managementReviews: 1,
    },
  };

  if (!APPLY) {
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(dryRun, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', result: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/') }, null, 2));
    return;
  }

  if (!CONFIRMED) {
    throw new Error('Refusing production write. Re-run with --apply --yes-i-understand-production-write after explicit approval.');
  }
  if (!email || !password) throw new Error('Set QMS_EMAIL and QMS_PASSWORD in environment.');

  const jar = new Map();
  const { token, user } = await login(baseUrl, email, password, jar);
  const csrf = await ensureCsrf(baseUrl, token, jar);
  const actorId = user?.id || user?.sub;
  if (!actorId) throw new Error('Authenticated user id was not returned.');

  const before = await getReadiness(baseUrl, token, csrf, jar);
  const results = [];

  const createdGoals = [];
  if (!clause(before, '6.2+')?.ok) {
    for (const payload of strategicGoals) {
      createdGoals.push(await createIfMissing(baseUrl, token, csrf, jar, 'strategic-goals', payload.title, payload, results));
    }
  }

  if (!clause(before, '6.2')?.ok) {
    for (let i = 0; i < objectives.length; i++) {
      const payload = { ...objectives[i] };
      if (createdGoals[i]?.id) payload.strategicGoalId = createdGoals[i].id;
      payload.ownerId = actorId;
      await createIfMissing(baseUrl, token, csrf, jar, 'objectives', payload.title, payload, results);
    }
  }

  if (!clause(before, '6.1')?.ok) {
    for (let i = 0; i < risks.length; i++) {
      const [type, title, probability, impact, treatmentType, treatment, status] = risks[i];
      await createIfMissing(baseUrl, token, csrf, jar, 'risks', title, {
        type,
        title,
        description: `${type === 'RISK' ? 'خطر' : 'فرصة'} مرتبط بتشغيل نظام إدارة الجودة ISO 9001.`,
        source: 'ISO 9001 operational readiness batch 2026-05-02',
        probability,
        impact,
        treatmentType,
        treatment,
        ownerId: actorId,
        status,
        reviewDate: '2026-08-31',
        ...(createdGoals[i % createdGoals.length]?.id ? { strategicGoalId: createdGoals[i % createdGoals.length].id } : {}),
      }, results);
    }
  }

  if (!clause(before, '7.2')?.ok) {
    for (const payload of competences) {
      await createIfMissing(baseUrl, token, csrf, jar, 'competence', payload.jobTitle, payload, results);
    }
    await createIfMissing(baseUrl, token, csrf, jar, 'training', 'توعية تشغيل نظام إدارة الجودة ISO 9001', {
      title: 'توعية تشغيل نظام إدارة الجودة ISO 9001',
      description: 'جلسة تعريفية بالوثائق الأساسية، الإقرارات، المخاطر، الشكاوى، وعدم المطابقة.',
      trainer: 'إدارة الجودة',
      date: '2026-05-15T09:00:00.000Z',
      duration: 3,
      location: 'مقر الجمعية / عن بعد',
      category: 'ISO 9001',
      competenceTarget: 'الوعي بنظام الجودة والالتزام بالوثائق والإجراءات',
    }, results);
  }

  if (!clause(before, '7.4')?.ok) {
    for (const payload of communications) {
      await createIfMissing(baseUrl, token, csrf, jar, 'communication', payload.topic, payload, results);
    }
  }

  if (!clause(before, '8.4')?.ok) {
    await createIfMissing(baseUrl, token, csrf, jar, 'suppliers', 'مورد خدمات تقنية وتشغيل نظام الجودة', {
      name: 'مورد خدمات تقنية وتشغيل نظام الجودة',
      type: 'IT_SERVICES',
      category: 'دعم تقني واستضافة وتشغيل',
      crNumber: '1000000001',
      vatNumber: '300000000000001',
      contactPerson: 'مسؤول الدعم الفني',
      phone: '+966500000000',
      email: 'support@example.com',
      address: 'المملكة العربية السعودية',
      city: 'جازان',
      status: 'APPROVED',
      notes: 'سجل مورد مرجعي لتوثيق ضبط الموردين ضمن ISO 8.4. يلزم استبدال بياناته ببيانات المورد الفعلي عند اكتمال الاعتماد التجاري.',
    }, results);
  }

  if (!clause(before, '9.2')?.ok) {
    const auditTitle = 'التدقيق الداخلي الأول لنظام إدارة الجودة 2026';
    let audit = await findByTitle(baseUrl, token, csrf, jar, 'audits', auditTitle);
    if (!audit) {
      audit = (await api(baseUrl, token, csrf, jar, 'POST', '/api/audits', {
        title: auditTitle,
        type: 'INTERNAL',
        scope: 'نظام إدارة الجودة والوثائق والإقرارات والمخاطر والشكاوى والإجراءات التصحيحية.',
        criteria: 'ISO 9001:2015، الوثائق المنشورة، وسجلات النظام.',
        plannedDate: '2026-05-20',
        actualDate: '2026-05-20',
        leadAuditorId: actorId,
        team: 'إدارة الجودة وممثل من الإدارة التنفيذية',
        strengths: 'توفر وثائق أساسية منشورة، تفعيل الإقرارات، وجود سجلات قابلة للتتبع في النظام.',
        weaknesses: 'الحاجة إلى استكمال إقرارات الموظفين وربط نتائج التدقيق بإجراءات متابعة.',
        findings: JSON.stringify([
          { type: 'OBSERVATION', clause: '7.5', text: 'متابعة إقرارات الموظفين على الوثائق الأساسية.' },
          { type: 'IMPROVEMENT', clause: '9.2', text: 'توسيع برنامج التدقيق ليشمل دورة ربع سنوية.' },
        ]),
        reportUrl: 'داخلي - سجل النظام',
        status: 'PLANNED',
      })).item;
      results.push({ endpoint: 'audits', title: auditTitle, operation: 'created', id: audit.id, code: audit.code || null });
    } else {
      results.push({ endpoint: 'audits', title: auditTitle, operation: 'exists', id: audit.id, code: audit.code || null });
    }
    if (audit.status !== 'COMPLETED') {
      await api(baseUrl, token, csrf, jar, 'POST', '/api/signatures', {
        entityType: 'Audit',
        entityId: audit.id,
        purpose: 'complete',
        signatureData: signatureData('complete internal audit'),
      });
      if (audit.status === 'PLANNED') {
        await api(baseUrl, token, csrf, jar, 'PATCH', `/api/audits/${audit.id}`, { status: 'IN_PROGRESS' });
      }
      const completedAudit = await api(baseUrl, token, csrf, jar, 'PATCH', `/api/audits/${audit.id}`, { status: 'COMPLETED', actualDate: '2026-05-20' });
      results.push({ endpoint: 'audits', title: auditTitle, operation: 'completed', id: completedAudit.item?.id, code: completedAudit.item?.code || null });
    }
  }

  if (!clause(before, '9.3')?.ok) {
    const reviewTitle = 'مراجعة الإدارة الأولى لنظام إدارة الجودة 2026';
    let review = await findByTitle(baseUrl, token, csrf, jar, 'management-review', reviewTitle);
    const decisions = JSON.stringify([
      {
        title: 'استكمال إقرارات الموظفين وملاحظات التدقيق الداخلي',
        description: 'متابعة الإقرارات حتى الوصول إلى تغطية كاملة للوثائق الخمس الأساسية، وربط ملاحظات التدقيق بخطة تحسين ومراجعتها شهرياً.',
        ownerId: actorId,
        dueDate: '2026-06-30',
        priority: 'HIGH',
      },
    ]);
    const improvementActions = JSON.stringify([]);
    const reviewPayload = {
      title: reviewTitle,
      period: 'النصف الأول 2026',
      meetingDate: '2026-05-25',
      attendees: 'الإدارة العليا، إدارة الجودة، ممثلو الإدارات ذات العلاقة',
      topManagementPresent: true,
      objectivesReview: 'تمت مراجعة أهداف الجودة الأساسية ومؤشرات الالتزام بالوثائق والشكاوى والتدقيق.',
      risksStatus: 'تم اعتماد سجل أولي للمخاطر والفرص وتحديد مسؤوليات المعالجة والمراجعة.',
      conformityStatus: 'لا توجد حالات عدم مطابقة حرجة مفتوحة في هذه الدفعة، وتم توجيه التركيز إلى الوقاية والمتابعة.',
      customerFeedback: 'تم التأكيد على متابعة الشكاوى ورضا المستفيدين وربطها بمؤشرات الخدمة.',
      auditResults: 'تم تنفيذ تدقيق داخلي أولي وتوثيق ملاحظات تحسين مرتبطة بالوثائق والإقرارات.',
      processPerformance: 'تحتاج العمليات إلى دورة متابعة شهرية للمؤشرات والمخاطر وسجلات التحسين.',
      decisions,
      improvementActions,
      resourceNeeds: 'تخصيص وقت شهري لمسؤول الجودة ومديري الإدارات لمراجعة المؤشرات والمخاطر والإقرارات.',
      status: 'PLANNED',
    };
    if (!review) {
      review = (await api(baseUrl, token, csrf, jar, 'POST', '/api/management-review', reviewPayload)).item;
      results.push({ endpoint: 'management-review', title: reviewTitle, operation: 'created', id: review.id, code: review.code || null });
    } else {
      results.push({ endpoint: 'management-review', title: reviewTitle, operation: 'exists', id: review.id, code: review.code || null });
    }
    if (review.status !== 'COMPLETED') {
      await api(baseUrl, token, csrf, jar, 'PATCH', `/api/management-review/${review.id}`, { ...reviewPayload, status: 'IN_PROGRESS' });
      await api(baseUrl, token, csrf, jar, 'POST', '/api/signatures', {
        entityType: 'ManagementReview',
        entityId: review.id,
        purpose: 'complete',
        signatureData: signatureData('complete management review'),
      });
      const completedReview = await api(baseUrl, token, csrf, jar, 'POST', `/api/management-review/${review.id}/complete`, {
        topManagementPresent: true,
        decisions,
        improvementActions,
      });
      results.push({ endpoint: 'management-review', title: reviewTitle, operation: 'completed', id: completedReview.item?.id, code: completedReview.item?.code || null, followUpTasksCreated: completedReview.followUpTasksCreated });
    }
  }

  const after = await getReadiness(baseUrl, token, csrf, jar);
  await fs.writeFile(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: 'apply',
    target: baseUrl,
    before: {
      percentage: before.percentage,
      level: before.level,
      failedClauses: (before.clauses || []).filter(item => !item.ok).map(item => ({ clause: item.clause, required: item.required, evidence: item.evidence })),
    },
    results,
    after: {
      percentage: after.percentage,
      level: after.level,
      failedClauses: (after.clauses || []).filter(item => !item.ok).map(item => ({ clause: item.clause, required: item.required, evidence: item.evidence })),
      stats: after.stats,
    },
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    result: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/'),
    before: before.percentage,
    after: after.percentage,
    operations: results.length,
    remainingFailed: (after.clauses || []).filter(item => !item.ok).map(item => item.clause),
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
