const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
const EMAIL = process.env.QMS_EMAIL;
const PASSWORD = process.env.QMS_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!EMAIL || !PASSWORD) {
  throw new Error('Set QMS_EMAIL and QMS_PASSWORD.');
}

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function absorbSetCookie(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return;
  for (const part of raw.split(/,(?=[^ ;]+=)/)) {
    const first = part.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
}

async function request(path, options = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    ...(options.headers || {}),
  });
  if (jar.size) headers.set('cookie', cookieHeader());

  const res = await fetch(new URL(path, BASE_URL), { ...options, headers });
  absorbSetCookie(res.headers);

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function ensureCsrf(token) {
  await request('/api/dashboard', { headers: { authorization: `Bearer ${token}` } });
  const csrf = jar.get('csrf');
  if (!csrf) throw new Error('CSRF cookie was not issued.');
  return csrf;
}

function norm(value) {
  return String(value || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function appendNote(existing, line) {
  const current = String(existing || '').trim();
  if (current.includes(line)) return current;
  return current ? `${current}\n${line}` : line;
}

function pickUser(users, candidates) {
  const active = users.filter(u => u.active !== false);
  for (const candidate of candidates) {
    const target = norm(candidate);
    const exact = active.find(u => norm(u.name) === target);
    if (exact) return exact;
    const contains = active.find(u => norm(u.name).includes(target) || target.includes(norm(u.name)));
    if (contains) return contains;
  }
  return null;
}

function findDepartment(departments, candidates) {
  for (const candidate of candidates) {
    const target = norm(candidate);
    const exact = departments.find(d => norm(d.name) === target || norm(d.code) === target);
    if (exact) return exact;
    const contains = departments.find(d => norm(d.name).includes(target) || target.includes(norm(d.name)));
    if (contains) return contains;
  }
  return null;
}

const DEPARTMENT_DEFINITIONS = [
  { code: 'COMSRV', aliases: ['SOC', 'قسم الرعاية الاجتماعية'], name: 'إدارة الخدمة المجتمعية', nameEn: 'Community Service Department' },
  { code: 'KAF', aliases: ['قسم الكفالات'], name: 'قسم الدعم والرعاية', nameEn: 'Support and Care Section' },
  { code: 'EMP', aliases: ['قسم التمكين والتنمية'], name: 'قسم التمكين والتنمية', nameEn: 'Empowerment and Development Section' },
  { code: 'INKIND', aliases: [], name: 'إدارة المساعدات العينية والمستودع', nameEn: 'In-kind Aid and Warehouse Department' },
  { code: 'INV', aliases: ['وحدة الاستثمار والأصول'], name: 'وحدة الاستثمار', nameEn: 'Investment Unit' },
  { code: 'RESDEV', aliases: ['RES', 'إدارة تنمية الموارد المالية'], name: 'إدارة تنمية الموارد والمشاريع', nameEn: 'Resource Development and Projects Department' },
  { code: 'COMM', aliases: ['COM', 'إدارة الاتصال المؤسسي والتطوع'], name: 'إدارة الاتصال المؤسسي والشراكات', nameEn: 'Corporate Communication and Partnerships Department' },
  { code: 'SUPPORT', aliases: [], name: 'إدارة الدعم المؤسسي', nameEn: 'Corporate Support Department' },
  { code: 'HR', aliases: ['إدارة الموارد البشرية'], name: 'قسم الموارد البشرية', nameEn: 'Human Resources Section' },
  { code: 'IT', aliases: ['وحدة تقنية المعلومات'], name: 'قسم تقنية المعلومات', nameEn: 'Information Technology Section' },
  { code: 'STRAT', aliases: ['QM', 'وحدة التميز المؤسسي والجودة'], name: 'وحدة الاستراتيجية والتميز المؤسسي', nameEn: 'Strategy and Institutional Excellence Unit' },
  { code: 'FIN', aliases: ['إدارة الشؤون المالية'], name: 'الإدارة المالية', nameEn: 'Finance Department' },
  { code: 'IA', aliases: [], name: 'وحدة الرقابة الداخلية', nameEn: 'Internal Audit Unit' },
];

const DOMAIN_RULES = [
  {
    key: 'beneficiary-impact',
    matches: ['مستفيد', 'مستفيدين', 'أسر', 'اسر', 'احتياج', 'الحاجات', 'أثر', 'اثر'],
    department: ['إدارة الخدمة المجتمعية', 'قسم البيانات والبحث الاجتماعي'],
    owner: ['خاتمة محرق', 'خاتمة'],
    dataEntry: ['خاتمة محرق', 'خاتمة'],
    approver: ['ايلاف حسن', 'إيلاف حسن', 'ايلاف', 'إيلاف'],
    note: 'مصفوفة الملكية 2026-05-02: مالك الأداء إدارة الخدمة المجتمعية، ومالك البيانات قسم البيانات والبحث الاجتماعي، والاعتماد عبر وحدة الاستراتيجية/المدير التنفيذي.',
  },
  {
    key: 'sponsorship',
    matches: ['يتيم', 'ايتام', 'كفالة', 'كفالات', 'الكافلين'],
    department: ['إدارة الخدمة المجتمعية'],
    owner: ['خاتمة محرق', 'خاتمة'],
    dataEntry: ['خاتمة محرق', 'خاتمة'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي', 'ايلاف حسن', 'إيلاف حسن'],
    note: 'مصفوفة الملكية 2026-05-02: الكفالات والأيتام تتبع إدارة الخدمة المجتمعية، والمالك الصحيح خاتمة، مع فصل لاحق بين استبقاء الكافلين وأثر/مصروف الكفالة عند الحاجة.',
  },
  {
    key: 'in-kind',
    matches: ['سلة', 'سلال', 'عيني', 'المستودع', 'توزيع', 'الجرد', 'الفاقد', 'التالف'],
    department: ['إدارة المساعدات العينية والمستودع'],
    owner: ['طلال الحربي', 'طلال'],
    dataEntry: ['طلال الحربي', 'طلال'],
    approver: ['خاتمة محرق', 'خاتمة', 'عبدالرحمن عقيل'],
    note: 'مصفوفة الملكية 2026-05-02: المساعدات العينية والمستودع تملك التنفيذ والتوزيع والجرد، بينما الاستحقاق وقوائم المستفيدين من الخدمة المجتمعية.',
  },
  {
    key: 'investment',
    matches: ['استثمار', 'الاستثمار', 'العوائد', 'الأصول', 'الاصول', 'محفظة', 'عقارات', 'roi'],
    department: ['وحدة الاستثمار'],
    owner: ['عبدالرحمن سحاقي', 'نادية قلم', 'ناديه قلم', 'عبدالرحمن عقيل'],
    dataEntry: ['عبدالرحمن سحاقي', 'نادية قلم', 'ناديه قلم'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: الاستثمار والمحفظة والعوائد تتبع وحدة الاستثمار، ولا تنسب لتنمية الموارد إلا إذا كان ذلك تكليفًا رسميًا لوحدة الاستثمار.',
  },
  {
    key: 'fundraising',
    matches: ['تبرع', 'تبرعات', 'مانح', 'مانحين', 'حملة', 'حملات', 'الداعمين', 'الكبار'],
    department: ['إدارة تنمية الموارد والمشاريع'],
    owner: ['نادية قلم', 'ناديه قلم', 'فاطمة عقيبي'],
    dataEntry: ['نادية قلم', 'ناديه قلم'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: التبرعات والحملات والمانحون تتبع إدارة تنمية الموارد والمشاريع، مع مطابقة مالية من الإدارة المالية.',
  },
  {
    key: 'partnerships-media',
    matches: ['شراكات', 'الشراكات', 'شريك', 'شركاء', 'إعلام', 'اعلام', 'نشر', 'مواد إعلامية', 'متابعين'],
    department: ['إدارة الاتصال المؤسسي والشراكات'],
    owner: ['فاطمة عقيبي', 'فاطمة'],
    dataEntry: ['فاطمة عقيبي', 'فاطمة'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: الشراكات والإعلام والنشر تتبع إدارة الاتصال المؤسسي والشراكات، والنشر الرسمي يكون عبر موقع الجمعية الرسمي.',
  },
  {
    key: 'volunteering-hr',
    matches: ['تطوع', 'متطوع', 'الموظفين', 'الموظف', 'تدريب', 'شهادات', 'رضا الموظفين', 'مراجعات الأداء'],
    department: ['إدارة الدعم المؤسسي', 'قسم الموارد البشرية'],
    owner: ['خليل هادي', 'خليل'],
    dataEntry: ['خليل هادي', 'خليل'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: رأس المال البشري وتدريب الموظفين يتبع إدارة الدعم المؤسسي/الموارد البشرية، مع فصل تدريب الموظفين عن تدريب المستفيدين.',
  },
  {
    key: 'digital-ai',
    matches: ['رقمي', 'التحول الرقمي', 'أتمتة', 'اتمتة', 'AI', 'ai', 'ذكاء', 'الأنظمة', 'الانظمة', 'تقنية'],
    department: ['إدارة الدعم المؤسسي', 'قسم تقنية المعلومات'],
    owner: ['عبدالرحمن عقيل', 'خليل هادي', 'خليل'],
    dataEntry: ['خليل هادي', 'خليل', 'عبدالرحمن عقيل'],
    approver: ['ايلاف حسن', 'إيلاف حسن', 'عبدالرحمن عقيل'],
    note: 'مصفوفة الملكية 2026-05-02: التحول الرقمي والذكاء الاصطناعي تنفيذه تشغيليًا لدى تقنية المعلومات/الدعم المؤسسي، ومتابعته منهجيًا لدى وحدة الاستراتيجية.',
  },
  {
    key: 'quality-iso',
    matches: ['ISO', 'iso', 'جودة', 'التميز', 'توثيق', 'السياسات', 'الإجراءات', 'الاجراءات', 'شهادات التميز'],
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    owner: ['ايلاف حسن', 'إيلاف حسن', 'ايلاف', 'إيلاف'],
    dataEntry: ['ايلاف حسن', 'إيلاف حسن', 'ايلاف', 'إيلاف'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: ISO 9001 والجودة والتوثيق تتبع وحدة الاستراتيجية والتميز المؤسسي، مع مشاركة الإدارات في إجراءاتها.',
  },
  {
    key: 'finance',
    matches: ['موازنة', 'الصرف', 'مالي', 'مالية', 'تقارير مالية', 'الإقفال', 'الاقفال', 'مصروفات', 'التعادل المالي'],
    department: ['الإدارة المالية', 'إدارة الشؤون المالية'],
    owner: ['عبدالرحمن سحاقي', 'المدير المالي'],
    dataEntry: ['عبدالرحمن سحاقي', 'المدير المالي'],
    approver: ['عبدالرحمن عقيل', 'المدير التنفيذي'],
    note: 'مصفوفة الملكية 2026-05-02: المالية تثبت القيود والتقارير والأثر المالي، ولا تملك علاقات المانحين أو الاستثمار إلا في جانب التسجيل والمطابقة.',
  },
];

const CODE_RULES = {
  indicators: {
    'IND-2026-023': { rule: 'hr', department: ['قسم الموارد البشرية', 'إدارة الدعم المؤسسي'], owner: ['خليل هادي'], dataEntry: ['خليل هادي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-022': { rule: 'beneficiary-impact', department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-021': { rule: 'digital-ai', department: ['قسم تقنية المعلومات', 'إدارة الدعم المؤسسي'], owner: ['عبدالرحمن عقيل'], dataEntry: ['عبدالرحمن عقيل'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-020': { rule: 'training-beneficiaries', department: ['قسم التمكين والتنمية', 'إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-019': { rule: 'hr', department: ['قسم الموارد البشرية', 'إدارة الدعم المؤسسي'], owner: ['خليل هادي'], dataEntry: ['خليل هادي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-018': { rule: 'hr', department: ['قسم الموارد البشرية', 'إدارة الدعم المؤسسي'], owner: ['خليل هادي'], dataEntry: ['خليل هادي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-017': { rule: 'volunteering', department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'], dataEntry: ['فاطمة عقيبي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-016': { rule: 'partnerships', department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'], dataEntry: ['فاطمة عقيبي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-015': { rule: 'quality-iso', department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'], dataEntry: ['ايلاف حسن', 'إيلاف حسن'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-014': { rule: 'digital-ai', department: ['قسم تقنية المعلومات', 'إدارة الدعم المؤسسي'], owner: ['عبدالرحمن عقيل'], dataEntry: ['عبدالرحمن عقيل'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-013': { rule: 'strategy-follow-up', department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'], dataEntry: ['ايلاف حسن', 'إيلاف حسن'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-011': { rule: 'beneficiary-experience', department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-010': { rule: 'empowerment', department: ['قسم التمكين والتنمية', 'إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-009': { rule: 'beneficiary-care', department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-008': { rule: 'beneficiary-experience', department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'], dataEntry: ['خاتمة محرق'], approver: ['ايلاف حسن', 'إيلاف حسن'] },
    'IND-2026-006': { rule: 'training-revenue', department: ['قسم التمكين والتنمية'], owner: ['نادية قلم', 'ناديه قلم'], dataEntry: ['عبدالرحمن سحاقي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-005': { rule: 'resource-development', department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'], dataEntry: ['نادية قلم', 'ناديه قلم'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-004': { rule: 'financial-sustainability', department: ['الإدارة المالية'], owner: ['عبدالرحمن سحاقي'], dataEntry: ['عبدالرحمن سحاقي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-003': { rule: 'resource-development', department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'], dataEntry: ['عبدالرحمن سحاقي'], approver: ['عبدالرحمن عقيل'] },
    'IND-2026-002': { rule: 'resource-development', department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'], dataEntry: ['عبدالرحمن سحاقي'], approver: ['عبدالرحمن عقيل'] },
  },
  objectives: {
    'OBJ-2026-037': { department: ['قسم الموارد البشرية'], owner: ['خليل هادي'] },
    'OBJ-2026-036': { department: ['قسم الموارد البشرية'], owner: ['خليل هادي'] },
    'OBJ-2026-035': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-034': { department: ['قسم الموارد البشرية'], owner: ['خليل هادي'] },
    'OBJ-2026-033': { department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'] },
    'OBJ-2026-032': { department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'] },
    'OBJ-2026-031': { department: ['قسم تقنية المعلومات'], owner: ['عبدالرحمن عقيل'] },
    'OBJ-2026-030': { department: ['قسم تقنية المعلومات'], owner: ['عبدالرحمن عقيل'] },
    'OBJ-2026-029': { department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'] },
    'OBJ-2026-028': { department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'] },
    'OBJ-2026-027': { department: ['قسم التمكين والتنمية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-026': { department: ['قسم التمكين والتنمية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-025': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-024': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-023': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-022': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'OBJ-2026-021': { department: ['قسم التمكين والتنمية'], owner: ['نادية قلم', 'ناديه قلم'] },
    'OBJ-2026-020': { department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'] },
    'OBJ-2026-019': { department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'] },
  },
  initiatives: {
    'INI-2026-033': { department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'] },
    'INI-2026-032': { department: ['إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'INI-2026-031': { department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'] },
    'INI-2026-030': { department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'] },
    'INI-2026-028': { department: ['قسم الموارد البشرية'], owner: ['خليل هادي'] },
    'INI-2026-027': { department: ['قسم الموارد البشرية'], owner: ['خليل هادي'] },
    'INI-2026-023': { department: ['إدارة الاتصال المؤسسي والشراكات'], owner: ['فاطمة عقيبي'] },
    'INI-2026-018': { department: ['قسم تقنية المعلومات'], owner: ['خليل هادي'] },
    'INI-2026-017': { department: ['قسم تقنية المعلومات'], owner: ['عبدالرحمن عقيل'] },
    'INI-2026-015': { department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'] },
    'INI-2026-012': { department: ['قسم التمكين والتنمية'], owner: ['نادية قلم', 'ناديه قلم'] },
    'INI-2026-011': { department: ['إدارة تنمية الموارد والمشاريع'], owner: ['نادية قلم', 'ناديه قلم'] },
    'INI-2026-010': { department: ['وحدة الاستراتيجية والتميز المؤسسي'], owner: ['ايلاف حسن', 'إيلاف حسن'] },
    'INI-2026-009': { department: ['قسم التمكين والتنمية'], owner: ['خاتمة محرق'] },
    'INI-2026-008': { department: ['قسم التمكين والتنمية'], owner: ['نادية قلم', 'ناديه قلم'] },
    'INI-2026-007': { department: ['قسم التمكين والتنمية'], owner: ['خاتمة محرق'] },
    'INI-2026-006': { department: ['إدارة المساعدات العينية والمستودع'], owner: ['طلال الحربي'] },
    'INI-2026-005': { department: ['قسم الدعم والرعاية', 'إدارة الخدمة المجتمعية'], owner: ['خاتمة محرق'] },
    'INI-2026-004': { department: ['إدارة تنمية الموارد والمشاريع'], owner: ['فاطمة عقيبي'] },
    'INI-2026-003': { department: ['وحدة الاستثمار'], owner: ['عبدالرحمن سحاقي'] },
    'INI-2026-001': { department: ['الإدارة المالية'], owner: ['عبدالرحمن سحاقي'] },
  },
  goals: {
    'STR-2026-017': { responsible: 'إدارة الدعم المؤسسي', owner: ['خليل هادي'] },
    'STR-2026-016': { responsible: 'إدارة الاتصال المؤسسي والشراكات', owner: ['فاطمة عقيبي'] },
    'STR-2026-013': { responsible: 'إدارة الدعم المؤسسي / قسم تقنية المعلومات', owner: ['عبدالرحمن عقيل'] },
    'STR-2026-012': { responsible: 'وحدة الاستراتيجية والتميز المؤسسي', owner: ['ايلاف حسن', 'إيلاف حسن'] },
    'STR-2026-007': { responsible: 'إدارة تنمية الموارد والمشاريع / وحدة الاستثمار / الإدارة المالية', owner: ['نادية قلم', 'ناديه قلم'] },
    'STR-2026-006': { responsible: 'إدارة الخدمة المجتمعية', owner: ['خاتمة محرق'] },
    'STR-2026-004': { responsible: 'إدارة الخدمة المجتمعية / قسم التمكين والتنمية', owner: ['خاتمة محرق'] },
    'STR-2026-003': { responsible: 'إدارة الخدمة المجتمعية', owner: ['خاتمة محرق'] },
  },
};

const RULE_NOTES = {
  hr: 'مصفوفة الملكية 2026-05-02: رأس المال البشري وتدريب الموظفين يتبع إدارة الدعم المؤسسي/الموارد البشرية، مع فصل تدريب الموظفين عن تدريب المستفيدين.',
  'beneficiary-impact': 'مصفوفة الملكية 2026-05-02: مالك الأداء إدارة الخدمة المجتمعية، ومالك البيانات قسم البيانات والبحث الاجتماعي، والاعتماد عبر وحدة الاستراتيجية/المدير التنفيذي.',
  'digital-ai': 'مصفوفة الملكية 2026-05-02: التحول الرقمي والذكاء الاصطناعي تنفيذه تشغيليًا لدى تقنية المعلومات/الدعم المؤسسي، ومتابعته منهجيًا لدى وحدة الاستراتيجية.',
  'training-beneficiaries': 'مصفوفة الملكية 2026-05-02: تدريب وتأهيل المستفيدين يتبع مسار التمكين والخدمة المجتمعية، لا تدريب الموظفين.',
  volunteering: 'مصفوفة الملكية 2026-05-02: التطوع والمشاركة المجتمعية ضمن إدارة الاتصال المؤسسي والشراكات حسب الهيكل الحالي.',
  partnerships: 'مصفوفة الملكية 2026-05-02: الشراكات تتبع إدارة الاتصال المؤسسي والشراكات، مع عدم تحميلها مؤشرات مالية مباشرة إلا بقدر قيمة الشراكة المثبتة.',
  'quality-iso': 'مصفوفة الملكية 2026-05-02: ISO 9001 والجودة والتوثيق تتبع وحدة الاستراتيجية والتميز المؤسسي، مع مشاركة الإدارات في إجراءاتها.',
  'strategy-follow-up': 'مصفوفة الملكية 2026-05-02: متابعة الخطة والمؤشرات مرجعيتها وحدة الاستراتيجية والتميز المؤسسي، والبيانات تأتي من الإدارات المالكة.',
  'beneficiary-experience': 'مصفوفة الملكية 2026-05-02: تجربة المستفيد وSLA ورضا المستفيد تتبع إدارة الخدمة المجتمعية، مع اعتماد منهجي من وحدة الاستراتيجية.',
  empowerment: 'مصفوفة الملكية 2026-05-02: التمكين والتأهيل والتشغيل تتبع الخدمة المجتمعية/قسم التمكين والتنمية، مع تنسيق مركز التدريب عند التنفيذ التدريبي.',
  'beneficiary-care': 'مصفوفة الملكية 2026-05-02: الرعاية وتغطية احتياجات الأسر تتبع إدارة الخدمة المجتمعية، والبيانات من الدعم والرعاية/البحث الاجتماعي.',
  'training-revenue': 'مصفوفة الملكية 2026-05-02: فائض مركز التدريب له مالك عائد مالي ومالك تشغيل تدريبي؛ يعتمد ماليًا مع تنمية الموارد/المالية ولا يصنف استثمارًا خالصًا.',
  'resource-development': 'مصفوفة الملكية 2026-05-02: تنمية الإيرادات غير الاستثمارية والمانحين والحملات تتبع إدارة تنمية الموارد والمشاريع، مع مطابقة مالية من الإدارة المالية.',
  'financial-sustainability': 'مصفوفة الملكية 2026-05-02: مؤشرات التعادل والصرف والتقارير المالية تتبع الإدارة المالية، مع اعتماد الإدارة التنفيذية.',
};

function codeRule(resource, code) {
  return CODE_RULES[resource]?.[code] || null;
}

function classify(text) {
  const haystack = norm(text);
  return DOMAIN_RULES.find(rule => rule.matches.some(match => haystack.includes(norm(match)))) || null;
}

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const csrf = await ensureCsrf(login.token);
  const auth = { authorization: `Bearer ${login.token}` };
  const writeHeaders = { ...auth, 'x-csrf-token': csrf };

  const [usersRes, departmentsRes, indicatorsRes, objectivesRes, initiativesRes, goalsRes] = await Promise.all([
    request('/api/users', { headers: auth }),
    request('/api/departments?limit=100', { headers: auth }),
    request('/api/indicators?limit=100', { headers: auth }),
    request('/api/objectives?limit=100', { headers: auth }),
    request('/api/initiatives?limit=100&includeDeleted=1', { headers: auth }),
    request('/api/strategic-goals?limit=100', { headers: auth }),
  ]);

  const users = usersRes.items || [];
  let departments = departmentsRes.items || [];
  const indicators = indicatorsRes.items || [];
  const objectives = objectivesRes.items || [];
  const initiatives = initiativesRes.items || [];
  const goals = goalsRes.items || [];

  const result = {
    ok: true,
    dryRun: DRY_RUN,
    counts: {
      users: users.length,
      departments: departments.length,
      indicators: indicators.length,
      objectives: objectives.length,
      initiatives: initiatives.length,
      goals: goals.length,
    },
    departments: [],
    indicators: [],
    objectives: [],
    initiatives: [],
    goals: [],
    skipped: [],
  };

  for (const def of DEPARTMENT_DEFINITIONS) {
    let existing = departments.find(d => d.code === def.code || (def.aliases || []).includes(d.code))
      || findDepartment(departments, [def.name, ...(def.aliases || [])]);
    if (existing) {
      const patch = {};
      if (existing.name !== def.name) patch.name = def.name;
      if (def.nameEn && existing.nameEn !== def.nameEn) patch.nameEn = def.nameEn;
      if (Object.keys(patch).length) {
        if (!DRY_RUN) {
          const updated = await request(`/api/departments/${existing.id}`, {
            method: 'PATCH',
            headers: writeHeaders,
            body: JSON.stringify(patch),
          });
          existing = updated.item;
        }
        result.departments.push({ action: DRY_RUN ? 'would_update' : 'updated', code: def.code, id: existing.id, patch });
      } else {
        result.departments.push({ action: 'unchanged', code: def.code, id: existing.id });
      }
      continue;
    }
    if (!DRY_RUN) {
      const { aliases, ...createPayload } = def;
      const created = await request('/api/departments', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify(createPayload),
      });
      existing = created.item;
      departments.push(existing);
    }
    result.departments.push({ action: DRY_RUN ? 'would_create' : 'created', code: def.code, name: def.name, id: existing?.id || null });
  }

  const updatedDepartments = (await request('/api/departments?limit=100', { headers: auth })).items || departments;

  async function patchResource(resource, item, patch, bucket) {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) {
      bucket.push({ action: 'unchanged', code: item.code, id: item.id });
      return;
    }
    if (!DRY_RUN) {
      const updated = await request(`/api/${resource}/${item.id}`, {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify(clean),
      });
      bucket.push({ action: 'updated', code: item.code, id: item.id, patch: clean, blockedFields: updated.blockedFields || null });
    } else {
      bucket.push({ action: 'would_update', code: item.code, id: item.id, patch: clean });
    }
  }

  for (const ind of indicators) {
    const text = [ind.code, ind.nameAr, ind.definition, ind.formula, ind.notes, ind.objective?.title].filter(Boolean).join(' ');
    const rule = codeRule('indicators', ind.code) || classify(text);
    if (!rule) {
      result.skipped.push({ resource: 'indicator', code: ind.code, reason: 'no_domain_rule', name: ind.nameAr });
      continue;
    }
    const owner = pickUser(users, rule.owner);
    const dataEntry = pickUser(users, rule.dataEntry);
    const approver = pickUser(users, rule.approver);
    const missing = [];
    if (!owner) missing.push(`owner:${rule.owner.join('/')}`);
    if (!dataEntry) missing.push(`dataEntry:${rule.dataEntry.join('/')}`);
    if (!approver) missing.push(`approver:${rule.approver.join('/')}`);
    if (missing.length) {
      result.skipped.push({ resource: 'indicator', code: ind.code, reason: 'missing_users', missing, name: ind.nameAr });
      continue;
    }
    const patch = {};
    if (ind.ownerId !== owner.id) patch.ownerId = owner.id;
    if (ind.dataEntryUserId !== dataEntry.id) patch.dataEntryUserId = dataEntry.id;
    if (ind.approverUserId !== approver.id) patch.approverUserId = approver.id;
    const note = rule.note || RULE_NOTES[rule.rule];
    const notes = note ? appendNote(ind.notes, note) : (ind.notes || '');
    if (notes !== (ind.notes || '')) patch.notes = notes;
    await patchResource('indicators', ind, patch, result.indicators);
  }

  for (const obj of objectives) {
    const text = [obj.code, obj.title, obj.description, obj.kpi, obj.notes].filter(Boolean).join(' ');
    const rule = codeRule('objectives', obj.code) || classify(text);
    if (!rule) {
      result.skipped.push({ resource: 'objective', code: obj.code, reason: 'no_domain_rule', title: obj.title });
      continue;
    }
    const dept = findDepartment(updatedDepartments, rule.department);
    const owner = pickUser(users, rule.owner);
    const patch = {};
    if (dept && obj.departmentId !== dept.id) patch.departmentId = dept.id;
    if (owner && obj.ownerId !== owner.id) patch.ownerId = owner.id;
    if (!dept || !owner) {
      result.skipped.push({
        resource: 'objective',
        code: obj.code,
        reason: 'missing_owner_or_department',
        ownerFound: !!owner,
        departmentFound: !!dept,
        title: obj.title,
      });
      continue;
    }
    await patchResource('objectives', obj, patch, result.objectives);
  }

  for (const ini of initiatives.filter(i => !i.deletedAt)) {
    const text = [ini.code, ini.name, ini.description, ini.notes, ini.goal?.title].filter(Boolean).join(' ');
    const rule = codeRule('initiatives', ini.code) || classify(text);
    if (!rule) {
      result.skipped.push({ resource: 'initiative', code: ini.code, reason: 'no_domain_rule', name: ini.name });
      continue;
    }
    const dept = findDepartment(updatedDepartments, rule.department);
    const owner = pickUser(users, rule.owner);
    if (!dept || !owner) {
      result.skipped.push({
        resource: 'initiative',
        code: ini.code,
        reason: 'missing_owner_or_department',
        ownerFound: !!owner,
        departmentFound: !!dept,
        name: ini.name,
      });
      continue;
    }
    const patch = {};
    if (ini.departmentId !== dept.id) patch.departmentId = dept.id;
    if (ini.ownerId !== owner.id) patch.ownerId = owner.id;
    const note = rule.note || RULE_NOTES[rule.rule];
    const notes = note ? appendNote(ini.notes, note) : (ini.notes || '');
    if (notes !== (ini.notes || '')) patch.notes = notes;
    await patchResource('initiatives', ini, patch, result.initiatives);
  }

  for (const goal of goals) {
    const text = [goal.code, goal.title, goal.perspective, goal.kpi, goal.responsible].filter(Boolean).join(' ');
    const rule = codeRule('goals', goal.code) || classify(text);
    if (!rule) {
      result.skipped.push({ resource: 'strategic-goal', code: goal.code, reason: 'no_domain_rule', title: goal.title });
      continue;
    }
    const owner = pickUser(users, rule.owner);
    if (!owner) {
      result.skipped.push({ resource: 'strategic-goal', code: goal.code, reason: 'missing_owner', title: goal.title });
      continue;
    }
    const responsible = rule.responsible || rule.department?.[0];
    const patch = {};
    if (goal.ownerUserId !== owner.id) patch.ownerUserId = owner.id;
    if (goal.responsible !== responsible) patch.responsible = responsible;
    await patchResource('strategic-goals', goal, patch, result.goals);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
