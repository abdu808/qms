const BASE_URL = process.env.QMS_BASE_URL || 'https://quality.aqiltech.sa/api';
const EMAIL = process.env.QMS_ADMIN_EMAIL || 'admin@bir-sabia.org.sa';
const PASSWORD = process.env.QMS_ADMIN_PASSWORD;

if (!PASSWORD) {
  throw new Error('Set QMS_ADMIN_PASSWORD before running this script.');
}

const loginRes = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (!loginRes.ok) {
  throw new Error(`Login failed ${loginRes.status}: ${await loginRes.text()}`);
}

const login = await loginRes.json();
const token = login.token;
const indicatorsRes = await fetch(`${BASE_URL}/indicators?limit=100&sort=code&order=asc`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!indicatorsRes.ok) {
  throw new Error(`Indicators failed ${indicatorsRes.status}: ${await indicatorsRes.text()}`);
}

const payload = await indicatorsRes.json();
console.log(JSON.stringify({
  baseUrl: BASE_URL,
  total: payload.total,
  count: payload.items?.length || 0,
  codes: (payload.items || []).map((item) => ({ code: item.code, nameAr: item.nameAr, id: item.id })),
}, null, 2));
