/**
 * اختبار دورة كاملة: login → chat → apply → verify
 */
const BASE = 'http://localhost:3000';

async function main() {
  // 1. Login
  const loginR = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bir-sabia.org.sa', password: 'Admin@12345' }),
  });
  const token = (await loginR.json()).token;
  console.log('✓ Logged in');

  // 2. Chat — اطلب تحسيناً صغيراً محدداً
  console.log('\n📤 السؤال: املأ الأهداف الاستراتيجية الثلاثة الفارغة (target, responsible, kpi فقط)');
  const chatR = await fetch(`${BASE}/api/consultant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: 'املأ الأهداف الاستراتيجية الثلاثة الحالية الفارغة فقط: أضف لكل هدف target (نصي) + responsible (اسم مسؤول عربي) + kpi (مؤشر نصي). لا تلمس شيئاً آخر.',
      }],
    }),
  });
  const chat = await chatR.json();
  console.log('\n--- رد المستشار ---');
  console.log(chat.reply?.slice(0, 800));
  console.log('... actions:', chat.actions?.length || 0);

  if (!chat.actions?.length) {
    console.log('⚠️ لا توجد actions — لن نُطبِّق');
    return;
  }
  console.log('\n📋 أول إجراء:', JSON.stringify(chat.actions[0], null, 2));

  // 3. Apply
  console.log('\n🔧 تطبيق...');
  const applyR = await fetch(`${BASE}/api/consultant/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ actions: chat.actions }),
  });
  const apply = await applyR.json();
  console.log('Summary:', apply.summary);
  apply.results?.forEach((r, i) => {
    if (r.ok) console.log(`  ✓ ${i + 1}. ${r.message}`);
    else     console.log(`  ✗ ${i + 1}. ${r.error} (action: ${r.action?.type})`);
  });

  // 4. Verify — اجلب السياق المُحدَّث
  console.log('\n🔍 التحقق: السياق بعد التطبيق...');
  const ctxR = await fetch(`${BASE}/api/consultant/context`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ctx = await ctxR.json();
  console.log('Gaps بعد:', ctx.context.gaps.counts);
}

main().catch(e => console.error('❌', e));
