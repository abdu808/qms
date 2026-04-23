/**
 * benchmark.mjs — مقارنة أداء Haiku vs GPT-4o-mini vs Gemini Flash
 * على ملف الخطة الاستراتيجية
 *
 * تشغيل:
 *   node benchmark.mjs "مسار/الملف.xlsx"
 *   node benchmark.mjs   ← يستخدم الملفات الافتراضية
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load api .env first (has Neon cloud DATABASE_URL + JWT_SECRET)
// then root .env for any additional vars (without override)
const rootEnv = path.join(__dirname, '.env');
const apiEnv  = path.join(__dirname, 'apps/api/.env');
config({ path: apiEnv });
config({ path: rootEnv }); // supplement missing vars without override
import { createHash, createDecipheriv } from 'crypto';
import fs   from 'fs';
import { performance } from 'perf_hooks';

// ── مسارات الملفات الافتراضية ─────────────────────────────────────────────
const DEFAULT_FILES = [
  "C:/Users/abdu8/OneDrive/2025/الاستراتيجية/الخطة الاستراتيجية جمعية البر صبياء محدثة.xlsx",
  "C:/Users/abdu8/OneDrive/2025/الاستراتيجية/وثيقة_الخطة_الاستراتيجية_لجمعية_صبيا.pptx",
  "C:/Users/abdu8/OneDrive/2025/الاستراتيجية/KPI_Playbook_v10.xlsx",
];

// ── استخراج النص ──────────────────────────────────────────────────────────
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const rows = [];
    wb.eachSheet(ws => {
      ws.eachRow(row => {
        const vals = [];
        row.eachCell(cell => {
          let v = cell.value;
          if (v && typeof v === 'object') {
            if (v.result !== undefined) v = v.result;
            else if (v.text) v = v.text;
            else if (v instanceof Date) v = v.toISOString().slice(0,10);
            else v = JSON.stringify(v);
          }
          if (v != null && v !== '') vals.push(String(v).trim());
        });
        if (vals.length) rows.push(vals.join(' | '));
      });
    });
    return rows.join('\n').slice(0, 30_000);
  }
  if (ext === '.pptx') {
    const officeparser = (await import('officeparser')).default;
    const text = await new Promise((res, rej) =>
      officeparser.parseOffice(filePath, (d, e) => e ? rej(e) : res(d || ''))
    );
    return String(text).slice(0, 30_000);
  }
  if (ext === '.docx') {
    const mammoth = (await import('mammoth')).default;
    const buf = fs.readFileSync(filePath);
    const r = await mammoth.extractRawText({ buffer: buf });
    return (r.value || '').slice(0, 30_000);
  }
  if (ext === '.pdf') {
    const officeparser = (await import('officeparser')).default;
    const text = await new Promise((res, rej) =>
      officeparser.parseOffice(filePath, (d, e) => e ? rej(e) : res(d || ''))
    );
    return String(text).slice(0, 30_000);
  }
  throw new Error(`امتداد غير مدعوم: ${ext}`);
}

// ── فك تشفير مفاتيح API ──────────────────────────────────────────────────
function decrypt(encrypted) {
  if (!encrypted?.startsWith('v1:')) return '';
  try {
    const [, ivHex, tagHex, ctHex] = encrypted.split(':');
    const key = createHash('sha256')
      .update(process.env.JWT_SECRET || 'local-test-secret-not-for-prod')
      .digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch { return ''; }
}

// ── قراءة المفاتيح من قاعدة البيانات أو متغيرات البيئة ──────────────
async function getApiKeys() {
  // Use Prisma (already set up in the api package)
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let dbKeys = { anthropic: '', openai: '', google: '' };
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['ai_anthropic_api_key','ai_openai_api_key','ai_google_api_key'] } },
      select: { key: true, value: true },
    });
    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
    dbKeys = {
      anthropic: decrypt(m.ai_anthropic_api_key || ''),
      openai:    decrypt(m.ai_openai_api_key    || ''),
      google:    decrypt(m.ai_google_api_key    || ''),
    };
  } finally {
    await prisma.$disconnect();
  }
  // ENV vars override / supplement DB keys
  return {
    anthropic: process.env.ANTHROPIC_API_KEY || dbKeys.anthropic,
    openai:    process.env.OPENAI_API_KEY    || dbKeys.openai,
    google:    process.env.GOOGLE_API_KEY    || dbKeys.google,
  };
}

// ── الـ PROMPT الموحَّد ───────────────────────────────────────────────────
function buildPrompt(text) {
  return `أنت خبير في تحليل الخطط الاستراتيجية لمنظمات ISO 9001:2015.

المطلوب: حلِّل هذه الخطة الاستراتيجية واستخرج المعلومات التالية بالعربية:

1. عنوان الخطة وسنوات التطبيق
2. الرؤية والرسالة (إن وُجدتا)
3. قائمة الأهداف الاستراتيجية — لكل هدف:
   - العنوان
   - المحور (مستفيدون / مالي / داخلي / تعلم ونمو)
   - مؤشر القياس الرئيسي (KPI)
   - المستهدف الرقمي إن وُجد
4. عدد الأهداف الإجمالي
5. نقاط القوة في الخطة (3 نقاط)
6. نقاط الضعف أو الثغرات (3 نقاط)
7. تقييمك العام للخطة من 10

محتوى الوثيقة:
"""
${text}
"""

أجب بشكل منظم ومباشر.`;
}

// ── استدعاء كل موديل ─────────────────────────────────────────────────────
async function callAnthropic(apiKey, prompt) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  const t0 = performance.now();
  const model = 'claude-opus-4-7';
  const r = await client.messages.create({
    model,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  // Opus pricing: $15/$75 per million tokens
  return {
    model,
    provider: 'Anthropic',
    text:     r.content?.[0]?.text || '',
    inTokens:  r.usage?.input_tokens  || 0,
    outTokens: r.usage?.output_tokens || 0,
    ms:       Math.round(performance.now() - t0),
    cost:     (r.usage?.input_tokens  || 0) * 0.000015 +
              (r.usage?.output_tokens || 0) * 0.000075,
  };
}

async function callOpenAI(apiKey, prompt) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });
  const t0 = performance.now();
  const model = 'gpt-5.4';
  const r = await client.chat.completions.create({
    model,
    max_completion_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  // gpt-5.4 pricing estimate (similar to flagship tier)
  return {
    model,
    provider: 'OpenAI',
    text:     r.choices?.[0]?.message?.content || '',
    inTokens:  r.usage?.prompt_tokens     || 0,
    outTokens: r.usage?.completion_tokens || 0,
    ms:       Math.round(performance.now() - t0),
    cost:     (r.usage?.prompt_tokens     || 0) * 0.000010 +
              (r.usage?.completion_tokens || 0) * 0.000030,
  };
}

async function callGoogle(apiKey, prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  const t0 = performance.now();
  const r = await model.generateContent(prompt);
  const usage = r.response?.usageMetadata || {};
  return {
    model:    'gemini-2.5-pro',
    provider: 'Google',
    text:     r.response?.text() || '',
    inTokens:  usage.promptTokenCount     || 0,
    outTokens: usage.candidatesTokenCount || 0,
    ms:       Math.round(performance.now() - t0),
    cost:     (usage.promptTokenCount     || 0) * 0.00000010 +
              (usage.candidatesTokenCount || 0) * 0.00000040,
  };
}

// ── القاضي (Claude Sonnet) ────────────────────────────────────────────────
async function judge(anthropicKey, results) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: anthropicKey });

  // ── معيار تقييم مطلق وثابت (لا يتأثر بقوة المنافسين) ──────────────────
  const rubric = `
معيار التقييم المطلق (من 10 لكل بند — ثابت بغض النظر عن المنافسين):

① دقة استخراج الأهداف (10 نقاط):
   10 = استخرج جميع الأهداف الـ14 كاملةً
   7  = استخرج 10-13 هدفاً
   4  = استخرج 5-9 أهداف
   1  = أقل من 5 أهداف أو إجابة مقطوعة

② تصنيف المحاور BSC (10 نقاط):
   10 = صنّف جميع الأهداف بدقة في المحاور الأربعة (مستفيدون/مالي/داخلي/تعلم ونمو)
   7  = تصنيف صحيح لـ 80%+ من الأهداف
   4  = تصنيف جزئي أو أخطاء ملحوظة
   1  = تصنيف خاطئ أو غائب

③ جودة KPIs (10 نقاط):
   10 = لكل هدف: المؤشر + خط الأساس + مستهدف 2025 + 2026 + 2027
   7  = المؤشر + المستهدف النهائي فقط
   4  = بعض المؤشرات ناقصة أو غير دقيقة
   1  = مؤشرات شبه غائبة

④ فهم السياق المؤسسي (10 نقاط):
   10 = ربط بـ ISO 9001 + BSC + تحليل نقدي للثغرات
   7  = ربط بـ BSC + ملاحظات ذكية
   4  = فهم عام بدون تحليل نقدي
   1  = وصف سطحي

⑤ اكتمال ووضوح الإجابة (10 نقاط):
   10 = إجابة مكتملة + منظمة + لا نص مقطوع
   7  = منظمة لكن فيها اختصار
   4  = مقطوعة أو غير منظمة
   1  = فوضوية أو ناقصة جداً`;

  const judgePrompt = `أنت محكِّم خبير محايد. قيِّم كل استجابة بمعيار مطلق وثابت — لا تقارن الاستجابات ببعضها، قيِّم كل واحدة على حدة بنفس المعيار.

${rubric}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${results.map((r, i) => `
━━━ الاستجابة ${i+1}: ${r.provider} (${r.model}) ━━━
${r.text}
`).join('\n')}

التعليمات:
- قيِّم كل استجابة بالمعيار المطلق أعلاه — لا تقل "هذه أفضل من تلك"، قل "هذه تستحق X لأن..."
- إذا كانت الإجابة مقطوعة → بند الاكتمال = 4 أو أقل حتماً
- أجب بهذا الشكل بالضبط:

| المعيار | Anthropic | OpenAI | Google |
|---------|-----------|--------|--------|
| دقة الأهداف | X/10 | X/10 | X/10 |
| تصنيف المحاور | X/10 | X/10 | X/10 |
| جودة KPIs | X/10 | X/10 | X/10 |
| فهم السياق | X/10 | X/10 | X/10 |
| اكتمال الإجابة | X/10 | X/10 | X/10 |
| **المجموع** | X/50 | X/50 | X/50 |

**الفائز:** [الاسم]
**السبب:** [جملتان تستند لأرقام محددة من المعيار]`;

  const t0 = performance.now();
  const r = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: judgePrompt }],
  });
  return {
    text: r.content?.[0]?.text || '',
    ms:   Math.round(performance.now() - t0),
    cost: (r.usage?.input_tokens||0) * 0.000003 + (r.usage?.output_tokens||0) * 0.000015,
  };
}

// ── عرض النتائج ──────────────────────────────────────────────────────────
function printResults(results, judgeResult, files) {
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 نتائج المقارنة — تحليل الخطة الاستراتيجية');
  console.log('═'.repeat(70));

  console.log(`\n📁 الملفات المُحلَّلة:`);
  files.forEach(f => console.log(`   • ${path.basename(f)}`));

  console.log('\n┌─────────────────┬──────────────┬────────┬──────────────┬──────────┐');
  console.log('│ الموديل         │ الوقت        │ التوكن │ التكلفة      │ الحالة   │');
  console.log('├─────────────────┼──────────────┼────────┼──────────────┼──────────┤');
  for (const r of results) {
    const status = r.error ? '❌ فشل' : '✅ نجح';
    const tokens = r.error ? '-' : `${r.inTokens}↑ ${r.outTokens}↓`;
    const cost   = r.error ? '-' : `$${r.cost.toFixed(5)}`;
    const ms     = r.error ? '-' : `${r.ms}ms`;
    const model  = `${r.provider}/${r.model}`.padEnd(16).slice(0,16);
    console.log(`│ ${model} │ ${ms.padEnd(12)} │ ${tokens.padEnd(6)} │ ${cost.padEnd(12)} │ ${status}   │`);
  }
  console.log('└─────────────────┴──────────────┴────────┴──────────────┴──────────┘');

  const totalCost = results.reduce((s, r) => s + (r.cost||0), 0) + (judgeResult?.cost||0);
  console.log(`\n💰 التكلفة الإجمالية (مع القاضي): $${totalCost.toFixed(5)}`);

  console.log('\n' + '─'.repeat(70));
  console.log('⚖️  حكم القاضي (Claude Sonnet):');
  console.log('─'.repeat(70));
  console.log(judgeResult?.text || 'لم يتمكن القاضي من الحكم');

  console.log('\n' + '─'.repeat(70));
  console.log('📝 الاستجابات الكاملة:');
  for (const r of results) {
    if (r.error) continue;
    console.log(`\n━━━ ${r.provider} (${r.model}) ━━━`);
    console.log(r.text.slice(0, 1500) + (r.text.length > 1500 ? '\n...[مقتطع]' : ''));
  }

  // حفظ النتائج في ملف
  const output = {
    timestamp: new Date().toISOString(),
    files: files.map(f => path.basename(f)),
    results,
    judge: judgeResult,
    totalCost,
  };
  const outFile = `benchmark-result-${Date.now()}.json`;
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅ النتائج الكاملة محفوظة في: ${outFile}`);
}

// ── نقطة الدخول ──────────────────────────────────────────────────────────
async function main() {
  console.log('🔑 جاري قراءة مفاتيح API من قاعدة البيانات...');
  const keys = await getApiKeys();

  const available = Object.entries(keys)
    .filter(([,v]) => v)
    .map(([k]) => k);
  console.log(`✅ مفاتيح متاحة: ${available.join(', ')}`);

  if (!keys.anthropic) { console.error('❌ مفتاح Anthropic مطلوب'); process.exit(1); }

  // تحديد الملفات
  const argFiles = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const files = argFiles.length > 0 ? argFiles : DEFAULT_FILES.filter(f => fs.existsSync(f));

  if (!files.length) {
    console.error('❌ لم يُحدَّد ملف. مثال: node benchmark.mjs "مسار/الخطة.xlsx"');
    process.exit(1);
  }

  // استخراج النص من كل الملفات ودمجها
  console.log('\n📄 جاري استخراج النص من الملفات...');
  const texts = [];
  for (const f of files) {
    try {
      const t = await extractText(f);
      texts.push(`\n=== ${path.basename(f)} ===\n${t}`);
      console.log(`   ✅ ${path.basename(f)} — ${t.length.toLocaleString()} حرف`);
    } catch (e) {
      console.warn(`   ⚠️  ${path.basename(f)} — ${e.message}`);
    }
  }

  const combinedText = texts.join('\n\n').slice(0, 35_000);
  const prompt = buildPrompt(combinedText);
  console.log(`\n📝 الـ prompt: ${prompt.length.toLocaleString()} حرف`);

  // تشغيل الثلاثة بالتوازي
  console.log('\n🚀 إرسال للموديلات الثلاثة بالتوازي...\n');
  const tasks = [
    callAnthropic(keys.anthropic, prompt).catch(e => ({ provider:'Anthropic', model:'haiku-4-5', error: e.message, cost:0, ms:0 })),
    keys.openai
      ? callOpenAI(keys.openai, prompt).catch(e => ({ provider:'OpenAI', model:'gpt-4o-mini', error: e.message, cost:0, ms:0 }))
      : Promise.resolve({ provider:'OpenAI', model:'gpt-4o-mini', error:'لا يوجد مفتاح', cost:0, ms:0 }),
    keys.google
      ? callGoogle(keys.google, prompt).catch(e => ({ provider:'Google', model:'gemini-flash', error: e.message, cost:0, ms:0 }))
      : Promise.resolve({ provider:'Google', model:'gemini-flash', error:'لا يوجد مفتاح', cost:0, ms:0 }),
  ];

  const results = await Promise.all(tasks);
  results.forEach(r => {
    const icon = r.error ? '❌' : '✅';
    console.log(`${icon} ${r.provider}: ${r.error || `${r.ms}ms — $${r.cost?.toFixed(5)}`}`);
  });

  // القاضي
  const succeeded = results.filter(r => !r.error && r.text);
  let judgeResult = null;
  if (succeeded.length >= 2) {
    console.log('\n⚖️  القاضي يحكم...');
    judgeResult = await judge(keys.anthropic, succeeded).catch(e => ({ text: `فشل القاضي: ${e.message}`, cost:0, ms:0 }));
    console.log(`✅ حكم القاضي جاهز (${judgeResult.ms}ms)`);
  }

  printResults(results, judgeResult, files);
}

main().catch(e => { console.error('خطأ:', e.message); process.exit(1); });
