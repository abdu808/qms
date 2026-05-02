import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
const EMAIL = process.env.QMS_EMAIL;
const PASSWORD = process.env.QMS_PASSWORD;
const DATE = '2026-05-02';

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

function findByName(items, names) {
  for (const name of names) {
    const target = norm(name);
    const exact = items.find(item => norm(item.name) === target);
    if (exact) return exact;
    const partial = items.find(item => norm(item.name).includes(target) || target.includes(norm(item.name)));
    if (partial) return partial;
  }
  return null;
}

const PROGRAMS = [
  {
    name: 'برنامج ISO 9001 والجودة المؤسسية',
    category: 'جودة وتميز',
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    manager: ['ايلاف حسن', 'إيلاف حسن'],
    description: 'برنامج مرجعي داخل نظام الجودة لمتابعة متطلبات ISO 9001، جاهزية التدقيق، الشهادات، وإغلاق متطلبات الجودة دون تكرار بيانات رافد.',
  },
  {
    name: 'برنامج حوكمة الخطة والمؤشرات',
    category: 'استراتيجية ومؤشرات',
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    manager: ['ايلاف حسن', 'إيلاف حسن'],
    description: 'برنامج مرجعي لحوكمة الخطة الاستراتيجية، دورات مراجعة الأداء، تحديث المؤشرات، وتوثيق مالك الأداء ومالك البيانات وجهة الاعتماد.',
  },
  {
    name: 'برنامج إدارة الوثائق والسياسات والإجراءات',
    category: 'توثيق مؤسسي',
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    manager: ['ايلاف حسن', 'إيلاف حسن'],
    description: 'برنامج مرجعي لمتابعة وثائق النظام والسياسات والإجراءات والإصدارات والاعتمادات، مع إبقاء ملفات التشغيل التفصيلية في أنظمتها الأصلية.',
  },
  {
    name: 'برنامج المراجعة الداخلية وإغلاق الملاحظات',
    category: 'رقابة داخلية',
    department: ['وحدة الرقابة الداخلية'],
    manager: ['عبدالرحمن عقيل'],
    description: 'برنامج مرجعي لمتابعة خطط المراجعة الداخلية، الملاحظات، الإجراءات التصحيحية، ومواعيد الإغلاق بالتنسيق مع لجنة المراجعة.',
  },
  {
    name: 'برنامج قياس الرضا وتجربة أصحاب المصلحة',
    category: 'قياس رضا',
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    manager: ['ايلاف حسن', 'إيلاف حسن'],
    description: 'برنامج مرجعي لاستبيانات وقياس رضا المستفيدين والمانحين والموظفين والشركاء داخل نظام الجودة، مع بقاء بيانات المستفيدين التفصيلية في رافد.',
  },
  {
    name: 'برنامج التحسين المستمر والإجراءات التصحيحية',
    category: 'تحسين مستمر',
    department: ['وحدة الاستراتيجية والتميز المؤسسي'],
    manager: ['ايلاف حسن', 'إيلاف حسن'],
    description: 'برنامج مرجعي لتجميع فرص التحسين، CAPA، الدروس المستفادة، ومخرجات المراجعات، وربطها بتحسين نظام الجودة.',
  },
  {
    name: 'برنامج التحول الرقمي ودعم نظام الجودة',
    category: 'تحول رقمي',
    department: ['قسم تقنية المعلومات'],
    manager: ['عبدالرحمن عقيل'],
    description: 'برنامج مرجعي لمتابعة تكاملات نظام الجودة، الأتمتة، الذكاء الاصطناعي، وتوافر الأنظمة الداعمة دون تكرار بيانات التشغيل في رافد.',
  },
];

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const csrf = await ensureCsrf(login.token);
  const auth = { authorization: `Bearer ${login.token}` };
  const writeHeaders = { ...auth, 'x-csrf-token': csrf };

  const [programsRes, departmentsRes, usersRes] = await Promise.all([
    request('/api/programs?limit=100&includeDeleted=1', { headers: auth }),
    request('/api/departments?limit=100', { headers: auth }),
    request('/api/users', { headers: auth }),
  ]);

  const existingPrograms = programsRes.items || [];
  const departments = departmentsRes.items || [];
  const users = (usersRes.items || []).filter(user => user.active !== false);
  const created = [];
  const updated = [];
  const unchanged = [];
  const skipped = [];

  for (const program of PROGRAMS) {
    const existing = existingPrograms.find(item => norm(item.name) === norm(program.name));
    const department = findByName(departments, program.department);
    const manager = findByName(users, program.manager);

    if (!department) {
      skipped.push({ name: program.name, reason: 'department_not_found', candidates: program.department });
      continue;
    }

    const payload = {
      name: program.name,
      description: program.description,
      category: program.category,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: null,
      budget: null,
      spent: 0,
      beneficiariesCount: 0,
      status: 'ACTIVE',
      departmentId: department.id,
      managerId: manager?.id || null,
    };

    if (!existing) {
      const res = await request('/api/programs', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify(payload),
      });
      created.push({
        code: res.item.code,
        name: res.item.name,
        department: department.name,
        manager: manager?.name || null,
      });
      continue;
    }

    const patch = {};
    for (const key of ['description', 'category', 'status', 'departmentId', 'managerId']) {
      if ((existing[key] || null) !== (payload[key] || null)) patch[key] = payload[key];
    }
    if (Number(existing.spent || 0) !== 0) patch.spent = 0;
    if (Number(existing.beneficiariesCount || 0) !== 0) patch.beneficiariesCount = 0;

    if (Object.keys(patch).length) {
      const res = await request(`/api/programs/${existing.id}`, {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify(patch),
      });
      updated.push({
        code: res.item.code,
        name: res.item.name,
        department: department.name,
        manager: manager?.name || null,
        patch,
      });
    } else {
      unchanged.push({
        code: existing.code,
        name: existing.name,
        department: department.name,
        manager: manager?.name || null,
      });
    }
  }

  const verify = await request('/api/programs?limit=100', { headers: auth });
  const result = {
    ok: true,
    date: DATE,
    policy: 'إضافة برامج نظام الجودة فقط، مع إبقاء برامج وخدمات المستفيدين التفصيلية في رافد كمصدر تشغيلي.',
    created,
    updated,
    unchanged,
    skipped,
    totals: {
      created: created.length,
      updated: updated.length,
      unchanged: unchanged.length,
      skipped: skipped.length,
      livePrograms: verify.total,
    },
  };

  const output = join(process.cwd(), 'docs', `qms-native-programs-live-results-${DATE}.json`);
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({ ...result, output }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
