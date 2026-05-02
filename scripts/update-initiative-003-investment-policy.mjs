const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa';
const EMAIL = process.env.QMS_EMAIL;
const PASSWORD = process.env.QMS_PASSWORD;
const CODE = 'INI-2026-003';

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
  const res = await fetch(new URL(path, BASE_URL), {
    ...options,
    headers,
  });
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

const login = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

const csrf = await ensureCsrf(login.token);
const auth = { authorization: `Bearer ${login.token}` };
const list = await request('/api/initiatives?limit=100', { headers: auth });
const initiative = (list.items || []).find(item => item.code === CODE);
if (!initiative) {
  throw new Error(`${CODE} not found.`);
}

const payload = {
  name: 'تخصيص بند سنوي لبناء محفظة استثمارية آمنة من الإيرادات غير المقيدة وعوائد الاستثمارات',
  description: [
    'تخصيص بند سنوي لبناء محفظة استثمارية آمنة، على أن يكون مصدر التمويل فقط من الإيرادات غير المقيدة للجمعية وعوائد الاستثمارات القائمة.',
    'لا يشمل البند الزكاة أو التبرعات المقيدة أو أي مبالغ مخصصة للمستفيدين أو البرامج المقيدة.',
    'لا يتم تحويل أي مبلغ إلى المحفظة إلا بعد مراجعة السيولة والالتزامات التشغيلية واعتماد مجلس الإدارة.',
    'يوجه عائد المحفظة مستقبلاً لدعم برامج الأسر الأشد احتياجاً وتعزيز الاستدامة المالية.',
  ].join('\n'),
  notes: 'مراجعة 2026-05-02: تم استبدال صياغة إعادة استثمار 25% من الفوائض بصياغة حوكمية محافظة تعتمد بنداً سنوياً من الإيرادات غير المقيدة وعوائد الاستثمارات فقط، مع التحويل بعد النظر والمراجعة والاعتماد.',
  status: 'ON_HOLD',
};

const updated = await request(`/api/initiatives/${initiative.id}`, {
  method: 'PATCH',
  headers: { ...auth, 'x-csrf-token': csrf },
  body: JSON.stringify(payload),
});

console.log(JSON.stringify({
  ok: true,
  code: CODE,
  id: initiative.id,
  before: {
    name: initiative.name,
    status: initiative.status,
  },
  after: {
    name: updated.item?.name,
    status: updated.item?.status,
    notes: updated.item?.notes,
  },
}, null, 2));
