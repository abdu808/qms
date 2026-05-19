import { prisma } from '../src/db.js';

const APPLY = process.argv.includes('--apply');

const TODAY = new Date();
const NEXT_YEAR = new Date(TODAY);
NEXT_YEAR.setFullYear(NEXT_YEAR.getFullYear() + 1);

const CORE_ACKS = [
  {
    code: 'ACK-CORE-QP-001-2026',
    title: 'إقرار الاطلاع على سياسة الجودة',
    category: 'QUALITY_POLICY',
    audience: ['EMPLOYEE', 'VOLUNTEER', 'BOARD_MEMBER'],
    documentKeywords: ['سياسة الجودة'],
    content: `# إقرار الاطلاع على سياسة الجودة

أقر بأنني اطلعت على سياسة الجودة المعتمدة في جمعية البر بمحافظة صبيا، وفهمت أن الجودة ليست ملفاً منفصلاً عن العمل اليومي، بل هي طريقة تنفيذ الخدمة ومتابعتها وتحسينها.

أفهم أن التزامي يشمل:
- أداء عملي وفق الإجراءات المعتمدة.
- المحافظة على دقة البيانات والسجلات.
- التعاون في إدخال المؤشرات والرد على المتابعات في وقتها.
- الإبلاغ عن فرص التحسين أو المشكلات التي تؤثر على جودة الخدمة.

يعد هذا الإقرار جزءاً من سجلات التوعية والالتزام بمتطلبات نظام إدارة الجودة ISO 9001:2015.`,
    commitments: [
      'ألتزم بتطبيق سياسة الجودة ضمن نطاق عملي.',
      'ألتزم بالمشاركة في التحسين المستمر وعدم تعطيل سجلات المتابعة.',
      'أبلغ عن أي مشكلة أو فرصة تحسين تؤثر على جودة الخدمة.',
    ],
  },
  {
    code: 'ACK-CORE-ETH-001-2026',
    title: 'إقرار الميثاق الأخلاقي والسلوك المهني',
    category: 'CODE_OF_ETHICS',
    audience: ['EMPLOYEE', 'VOLUNTEER', 'BOARD_MEMBER'],
    documentKeywords: ['الميثاق', 'الأخلاقي', 'السلوك'],
    content: `# إقرار الميثاق الأخلاقي والسلوك المهني

أقر بأنني اطلعت على الميثاق الأخلاقي والسلوك المهني المعتمد في الجمعية، وفهمت أن التعامل مع المستفيدين والداعمين والزملاء يجب أن يقوم على الاحترام، النزاهة، العدالة، وحفظ الكرامة.

أفهم أن الالتزام يشمل:
- عدم استغلال الصلاحيات أو المعلومات.
- تجنب تضارب المصالح والإفصاح عنه عند وجوده.
- احترام سرية العمل وخصوصية الأطراف ذات العلاقة.
- التعامل المهني مع الشكاوى والملاحظات.

يعد هذا الإقرار مرجعاً لسلوك الموظف أو المتطوع داخل الجمعية وفي أي تمثيل رسمي لها.`,
    commitments: [
      'ألتزم بالسلوك المهني والاحترام في جميع تعاملاتي.',
      'أفصح عن أي تضارب مصالح محتمل.',
      'لا أستخدم صلاحياتي أو معلومات الجمعية لأغراض شخصية.',
    ],
  },
  {
    code: 'ACK-CORE-DP-001-2026',
    title: 'إقرار السرية وحماية بيانات المستفيدين',
    category: 'DATA_PROTECTION',
    audience: ['EMPLOYEE', 'VOLUNTEER', 'BOARD_MEMBER'],
    documentKeywords: ['حماية البيانات', 'السرية', 'المستفيدين', 'خصوصية'],
    content: `# إقرار السرية وحماية بيانات المستفيدين

أقر بأنني اطلعت على متطلبات السرية وحماية بيانات المستفيدين، وفهمت أن بيانات المستفيدين والكافلين والداعمين لا يجوز استخدامها أو مشاركتها إلا لغرض العمل المصرح به.

أفهم أن الالتزام يشمل:
- عدم مشاركة بيانات المستفيدين خارج القنوات المعتمدة.
- عدم تصوير أو نسخ أو نقل أي بيانات دون تصريح.
- استخدام الأنظمة الرسمية فقط في حفظ البيانات ومتابعتها.
- الإبلاغ فوراً عن أي فقدان أو تسريب أو اشتباه في وصول غير مصرح.

هذا الإقرار يدعم متطلبات الخصوصية، وحماية المستفيد، وضبط المعلومات الموثقة ضمن نظام إدارة الجودة.`,
    commitments: [
      'ألتزم بسرية بيانات المستفيدين والداعمين والكافلين.',
      'لا أشارك أي بيانات إلا عبر القنوات المعتمدة ولغرض العمل.',
      'أبلغ فوراً عن أي حادثة أو اشتباه يتعلق بسرية البيانات.',
    ],
  },
];

function likeTerms(keywords) {
  return keywords.map(word => ({
    title: { contains: word, mode: 'insensitive' },
  }));
}

async function findReferenceDocument(keywords) {
  const doc = await prisma.document.findFirst({
    where: {
      deletedAt: null,
      status: { in: ['PUBLISHED', 'APPROVED'] },
      OR: likeTerms(keywords),
    },
    orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, code: true, title: true, currentVersion: true, approvalReference: true, publicationUrl: true },
  });
  if (!doc) return null;
  return {
    referenceTitle: `${doc.code} - ${doc.title}`,
    referenceUrl: doc.publicationUrl || `/api/documents/${doc.id}`,
    referenceNote: [
      `وثيقة رسمية معتمدة في سجل الوثائق.`,
      doc.currentVersion ? `الإصدار: ${doc.currentVersion}` : null,
      doc.approvalReference ? `مرجع الاعتماد: ${doc.approvalReference}` : null,
    ].filter(Boolean).join('\n'),
  };
}

async function buildPayload(item) {
  const reference = await findReferenceDocument(item.documentKeywords);
  return {
    code: item.code,
    title: item.title,
    category: item.category,
    audience: item.audience,
    version: '1.0',
    content: item.content,
    commitments: item.commitments.join('\n'),
    referenceTitle: reference?.referenceTitle || item.title,
    referenceUrl: reference?.referenceUrl || null,
    referenceNote: reference?.referenceNote || 'لم يتم العثور على وثيقة رسمية منشورة مطابقة؛ يراجع مدير الجودة الرابط بعد اعتماد الوثيقة.',
    mandatory: true,
    renewFrequency: 'ON_CHANGE',
    effectiveDate: TODAY,
    reviewDate: NEXT_YEAR,
    active: true,
    approvedBy: 'الإدارة التنفيذية / مدير الجودة',
    approvedAt: TODAY,
  };
}

async function main() {
  const planned = [];
  for (const item of CORE_ACKS) {
    const payload = await buildPayload(item);
    const existing = await prisma.ackDocument.findUnique({
      where: { code: item.code },
      select: { id: true, code: true },
    });
    planned.push({
      code: item.code,
      action: existing ? 'update' : 'create',
      title: payload.title,
      category: payload.category,
      audience: payload.audience,
      hasReferenceUrl: Boolean(payload.referenceUrl),
      referenceTitle: payload.referenceTitle,
    });

    if (!APPLY) continue;

    await prisma.ackDocument.upsert({
      where: { code: item.code },
      create: payload,
      update: {
        title: payload.title,
        category: payload.category,
        audience: payload.audience,
        content: payload.content,
        commitments: payload.commitments,
        referenceTitle: payload.referenceTitle,
        referenceUrl: payload.referenceUrl,
        referenceNote: payload.referenceNote,
        mandatory: payload.mandatory,
        renewFrequency: payload.renewFrequency,
        effectiveDate: payload.effectiveDate,
        reviewDate: payload.reviewDate,
        active: payload.active,
        approvedBy: payload.approvedBy,
        approvedAt: payload.approvedAt,
      },
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: APPLY ? 'apply' : 'dry-run',
    count: planned.length,
    planned,
  }, null, 2));
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
