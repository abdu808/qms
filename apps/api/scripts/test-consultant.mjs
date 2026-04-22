/**
 * اختبار سريع للمستشار — login + context + chat
 */
const BASE = 'http://localhost:3000';

async function main() {
  // 1. Login
  console.log('1) تسجيل الدخول...');
  const loginR = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bir-sabia.org.sa', password: 'Admin@12345' }),
  });
  const login = await loginR.json();
  if (!login.token) { console.error('❌ فشل الدخول:', login); return; }
  const token = login.token;
  console.log('   ✓ token:', token.slice(0, 30), '...');

  // 2. Context
  console.log('\n2) جلب السياق...');
  const ctxR = await fetch(`${BASE}/api/consultant/context`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ctx = await ctxR.json();
  if (!ctx.ok) { console.error('❌', ctx); return; }
  console.log('   ✓ Summary:', JSON.stringify(ctx.context.summary, null, 2));
  console.log('   ✓ Gaps:', JSON.stringify(ctx.context.gaps.counts, null, 2));

  // 3. Chat
  console.log('\n3) سؤال المستشار...');
  const chatR = await fetch(`${BASE}/api/consultant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: 'حلِّل خطتي الاستراتيجية بإيجاز. ما أبرز 3 فجوات وما أولوية الإصلاح؟',
      }],
    }),
  });
  const chat = await chatR.json();
  if (!chat.ok) { console.error('❌', chat); return; }
  console.log('\n--- رد المستشار ---');
  console.log(chat.reply);
  console.log('-------------------');
  console.log('\nالنموذج:', chat.model, '| الاستخدام:', chat.usage);
  console.log('عدد الإجراءات المقترحة:', chat.actions?.length || 0);
  if (chat.actions?.length) {
    console.log('\n--- الإجراءات ---');
    console.log(JSON.stringify(chat.actions, null, 2));
  }
}

main().catch(e => console.error('❌', e));
