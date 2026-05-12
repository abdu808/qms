/**
 * Zero-token AI pre-router.
 *
 * This layer answers greetings and stable knowledge questions before any model
 * is called. It intentionally avoids live database facts; live operational
 * questions still go through scoped API/tools.
 */

const GREETING_PATTERNS = [
  /^(السلام عليكم|سلام عليكم|السلام|سلام)$/i,
  /^(صباح الخير|صباح النور)$/i,
  /^(مساء الخير|مساء النور)$/i,
  /^(اهلا|أهلا|هلا|مرحبا|حياك|كيفك)$/i,
  /^(شكرا|شكراً|يعطيك العافية|تمام|ممتاز|احسنت|أحسنت)$/i,
];

const KNOWLEDGE_ENTRIES = [
  {
    id: 'kpi-entry',
    title: 'إدخال قراءة KPI',
    keywords: ['ادخل قراءة', 'إدخال قراءة', 'قراءة kpi', 'قراءاتي', 'قيم المؤشرات', 'kpi'],
    answer: [
      'لإدخال قراءة مؤشر: افتح "قراءات KPI المطلوبة مني" أو "متابعة الأداء" ثم اختر السنة والشهر أو الربع.',
      'اختر المؤشر، أدخل القيمة الفعلية، وأضف ملاحظة مختصرة إذا كانت القيمة أقل من المستهدف أو تحتاج تفسيراً.',
      'إذا ظهر تنبيه تأخر، فالمطلوب إدخال القراءة أو كتابة سبب واضح ليتمكن مدير الجودة من المتابعة.',
    ].join('\n'),
  },
  {
    id: 'kpi-delay',
    title: 'تنبيهات تأخر المؤشرات',
    keywords: ['تنبيه متأخر', 'متأخرات', 'تأخر القراءة', 'kpi follow', 'متابعة المؤشرات'],
    answer: [
      'تنبيه تأخر المؤشر يعني أن فترة القياس انتهت أو اقترب موعدها ولم تُسجل القراءة المطلوبة.',
      'الإجراء الصحيح: افتح التنبيه، تحقق من الفترة، أدخل القراءة إن كانت متاحة، أو أضف ملاحظة متابعة إذا كانت البيانات تنتظر تقريراً أو اعتماداً.',
      'لا يُغلق التنبيه نهائياً إلا بسبب موثق أو عند إدخال القراءة.',
    ].join('\n'),
  },
  {
    id: 'ncr-capa',
    title: 'الفرق بين NCR و CAPA',
    keywords: ['ncr', 'capa', 'عدم المطابقة', 'اجراء تصحيحي', 'إجراء تصحيحي'],
    answer: [
      'NCR هو سجل عدم مطابقة: نستخدمه عندما يحدث خلل أو مخالفة لمتطلب أو إجراء معتمد.',
      'CAPA هو إجراء تصحيحي/وقائي: نستخدمه لمعالجة السبب الجذري ومنع تكرار المشكلة.',
      'ببساطة: NCR يثبت المشكلة، وCAPA يعالج السبب.',
    ].join('\n'),
  },
  {
    id: 'management-review',
    title: 'المراجعة الإدارية',
    keywords: ['مراجعة ادارية', 'مراجعة إدارية', 'management review', 'محضر المراجعة'],
    answer: [
      'المراجعة الإدارية اجتماع دوري للإدارة لمراجعة أداء نظام الجودة.',
      'أهم محاورها: نتائج التدقيق، رضا المستفيدين، أداء المؤشرات، المخاطر والفرص، الشكاوى، عدم المطابقة، واحتياجات التحسين.',
      'الأفضل تجهيزها بمحاور محددة مسبقاً ومحضر جاهز حتى لا تكون عبئاً على الفريق.',
    ].join('\n'),
  },
  {
    id: 'iso-scope',
    title: 'نطاق ISO 9001',
    keywords: ['scope', 'النطاق', 'نطاق الايزو', 'نطاق iso', 'مجال التطبيق'],
    answer: [
      'نطاق ISO يوضح ما الذي يغطيه نظام إدارة الجودة داخل الجمعية.',
      'عادة يشمل الخدمات والعمليات الرئيسية التي تؤثر على المستفيدين والجودة، مثل الرعاية، الكفالات، المساعدات، التمكين، والمتابعة المؤسسية.',
      'وجود النطاق في النظام يساعد المدقق والفريق على فهم حدود التطبيق وعدم خلطه بكل أنشطة الجمعية غير الداخلة في الاعتماد.',
    ].join('\n'),
  },
  {
    id: 'ai-role',
    title: 'دور مساعد AI',
    keywords: ['ما دورك', 'من انت', 'من أنت', 'ماذا تستطيع', 'صلاحياتك', 'ai'],
    answer: [
      'أنا مساعد داخل نظام الجودة والأداء. أساعدك في الشرح، تلخيص المتابعات، فهم المؤشرات، وتجهيز مقترحات التحسين.',
      'صلاحياتي تختلف حسب دور المستخدم: الموظف يحصل على شرح وتوجيه، مدير القسم يرى نطاق قسمه، ومدير الجودة يرى المتابعة الشاملة.',
      'لا أنفذ تعديلات حساسة أو سجلات رسمية دون صلاحية ومراجعة بشرية.',
    ].join('\n'),
  },
  {
    id: 'supplier-evaluation',
    title: 'تقييم الموردين',
    keywords: ['تقييم الموردين', 'الموردين', 'supplier'],
    answer: [
      'تقييم الموردين يفضل أن يبقى كسجل/استبيان مستقل داخل الجودة، لأنه يخص أداء جهة خارجية وليس رضا مستفيد.',
      'أهم عناصره: الالتزام بالوقت، جودة الخدمة أو المنتج، الاستجابة، اكتمال المستندات، والملاحظات.',
      'يمكن تحويل نتائجه لاحقاً إلى مؤشر عام لمتابعة الموردين دون ربط مباشر قد يسبب تضخم في المؤشرات.',
    ].join('\n'),
  },
];

function normalizeArabic(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function latestUserText(messages) {
  const last = [...(messages || [])].reverse().find(m => m?.role === 'user');
  return typeof last?.content === 'string' ? last.content.trim() : '';
}

function greetingReply(text) {
  const normalized = normalizeArabic(text);
  if (!normalized || normalized.length > 60) return null;
  if (!GREETING_PATTERNS.some(re => re.test(normalized))) return null;
  if (normalized.includes('صباح')) return 'صباح النور، كيف أقدر أساعدك في النظام اليوم؟';
  if (normalized.includes('مساء')) return 'مساء النور، حاضر. ما الذي تريد مراجعته أو إدخاله؟';
  if (normalized.includes('شكر') || normalized.includes('تمام') || normalized.includes('ممتاز') || normalized.includes('احسنت')) {
    return 'حياك الله. جاهز لأي متابعة أو توضيح تحتاجه.';
  }
  return 'وعليكم السلام، حياك الله. كيف أقدر أساعدك؟';
}

export function routeKnowledgeQuestion(messages) {
  return routeKnowledgeQuestionWithEntries(messages, []);
}

export function routeKnowledgeQuestionWithEntries(messages, customEntries = []) {
  const text = latestUserText(messages);
  const local = greetingReply(text);
  if (local) {
    return {
      handled: true,
      source: 'local_greeting',
      reply: local,
    };
  }

  const normalized = normalizeArabic(text);
  if (!normalized || normalized.length > 240) return { handled: false };

  const entries = [...normalizeCustomEntries(customEntries), ...KNOWLEDGE_ENTRIES];
  const hit = entries.find(entry =>
    entry.keywords.some(k => normalized.includes(normalizeArabic(k)))
  );

  if (!hit) return { handled: false };
  return {
    handled: true,
    source: `knowledge:${hit.id}`,
    title: hit.title,
    reply: hit.answer,
  };
}

function normalizeCustomEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(e => e && e.enabled !== false && e.id && e.title && e.answer)
    .map(e => ({
      id: `custom-${String(e.id).replace(/^custom-/, '')}`,
      title: String(e.title).slice(0, 120),
      keywords: Array.isArray(e.keywords) ? e.keywords.map(String).filter(Boolean).slice(0, 12) : [],
      answer: String(e.answer).slice(0, 2000),
    }))
    .filter(e => e.keywords.length);
}

export function listKnowledgeEntries() {
  return KNOWLEDGE_ENTRIES.map(({ id, title, keywords }) => ({ id, title, keywords }));
}
