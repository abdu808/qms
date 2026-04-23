/**
 * analyzer.mjs — تحليل نص الملف عبر AI layer وإرجاع metadata مُنظَّم
 *
 * يستخدم aiComplete من طبقة AI الموحَّدة → يعمل مع أي مزود مُفعَّل (Claude/GPT/Gemini).
 */
import { aiComplete } from '../../src/lib/ai/index.js';
import { truncateForAi } from './extractors.mjs';

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    title:         { type: 'string',  description: 'عنوان نظيف ومعبِّر بالعربية' },
    category:      { type: 'string',  enum: ['vision', 'mission', 'policy', 'strategic_plan', 'operational_plan', 'procedure', 'form', 'manual', 'announcement', 'report', 'other'] },
    suggestedModule: { type: 'string', enum: ['Document', 'QualityPolicy', 'Announcement', 'StrategicGoal', 'OperationalActivity', 'Other'] },
    summary:       { type: 'string',  description: 'ملخص 2-3 جمل بالعربية' },
    keywords:      { type: 'array', items: { type: 'string' } },
    extractedDate: { type: 'string', description: 'تاريخ من المحتوى إن وُجد (YYYY-MM-DD) أو نص فارغ' },
    version:       { type: 'string', description: 'رقم إصدار الوثيقة إن وُجد أو نص فارغ' },
    approvedBy:    { type: 'string', description: 'اسم المعتمد إن ذُكر أو نص فارغ' },
    confidence:    { type: 'string', enum: ['high', 'medium', 'low'] },
    isoClause:     { type: 'string', description: 'بند ISO 9001:2015 مرتبط إن أمكن (مثل 7.5) أو نص فارغ' },
    notes:         { type: 'string', description: 'ملاحظات أو تحذيرات للمراجع' },
    // ← حقل إضافي للخطط الاستراتيجية فقط
    goals: {
      type: 'array',
      description: 'الأهداف الاستراتيجية المستخرجة — أملأ هذا الحقل فقط عندما category=strategic_plan',
      items: {
        type: 'object',
        properties: {
          title:       { type: 'string',  description: 'عنوان الهدف الاستراتيجي' },
          perspective: { type: 'string',  description: 'المحور: مستفيدون | مالي | داخلي | تعلم ونمو' },
          kpi:         { type: 'string',  description: 'مؤشر القياس الرئيسي' },
          baseline:    { type: 'string',  description: 'الوضع الراهن (نقطة البداية)' },
          target:      { type: 'string',  description: 'المستهدف النهائي' },
          initiatives: { type: 'string',  description: 'المبادرات أو الأنشطة الرئيسية' },
          responsible: { type: 'string',  description: 'الجهة أو الشخص المسؤول' },
        },
        required: ['title'],
      },
    },
  },
  required: ['title', 'category', 'suggestedModule', 'summary', 'confidence'],
};

const SYSTEM_PROMPT = `أنت مساعد خبير في نظام إدارة الجودة ISO 9001:2015 وفي تحليل الوثائق العربية للمنظمات غير الربحية.
مهمتك: قراءة محتوى ملف وإرجاع metadata مُنظَّم بصيغة JSON فقط (بدون أي نص خارج الـ JSON).

تعليمات عامة:
- عنوان نظيف بالعربية، بدون أي ترقيم أو شرطات زائدة.
- category: حدِّد النوع بدقة (vision = رؤية، mission = رسالة، policy = سياسة، strategic_plan = خطة استراتيجية، operational_plan = خطة تشغيلية، procedure = إجراء، form = نموذج، manual = دليل، announcement = إعلان، report = تقرير).
- suggestedModule: أين يُخزَّن في النظام (Document لمعظم الحالات، QualityPolicy لسياسة الجودة فقط، Announcement للإعلانات، StrategicGoal لأهداف الخطة الاستراتيجية).
- summary: 2-3 جمل تُلخِّص المحتوى.
- keywords: 3-7 كلمات مفتاحية دقيقة.
- extractedDate: ابحث عن تاريخ اعتماد/إصدار في النص، أرجع بصيغة YYYY-MM-DD أو "" إن لم يوجد.
- confidence: high لو التحليل واضح، medium لو هناك غموض، low لو المحتوى ضعيف أو غير كافٍ.
- isoClause: بند ISO مناسب (مثل 5.2 للسياسة، 6.2 للأهداف، 7.5 للوثائق).
- notes: أي تحذير للمراجع (مثل: "المحتوى غير كامل" أو "يبدو مسودة").

━━━ تعليمات خاصة بالخطط الاستراتيجية ━━━

عندما تكون category = "strategic_plan":
① لازم تضع suggestedModule = "StrategicGoal"
② لازم تملأ حقل "goals" بمصفوفة تحتوي كل هدف استراتيجي في الوثيقة كسجل مستقل
③ عنوان كل هدف يجب أن يكون الهدف نفسه — ليس المهمة أو الرؤية أو اسم المنظمة
④ لكل هدف: حدِّد المحور (مستفيدون / مالي / داخلي / تعلم ونمو) ومؤشر القياس والمستهدف إن وُجدا
⑤ حقل "title" على مستوى الوثيقة = عنوان الخطة كاملاً (مثل: "الخطة الاستراتيجية 2025-2027")
⑥ لا تضع المهمة أو الرؤية أو القيم كأهداف — الأهداف الاستراتيجية فقط`;

/**
 * يُحلِّل ملف واحد
 * @param {{ filename: string, folder: string, text: string, kind: string }} file
 * @returns { analysis, usage }
 */
export async function analyzeFile(file) {
  const { filename, folder, text, kind } = file;
  if (!text || text.length < 30) {
    return {
      analysis: {
        title: filename.replace(/\.[^.]+$/, ''),
        category: 'other',
        suggestedModule: 'Document',
        summary: 'المحتوى فارغ أو قصير جداً — يحتاج مراجعة يدوية.',
        keywords: [],
        extractedDate: '',
        version: '',
        approvedBy: '',
        confidence: 'low',
        isoClause: '',
        notes: 'المحتوى المستخرج ضعيف',
      },
      usage: null,
      skipped: true,
    };
  }

  const snippet = truncateForAi(text, 25_000);
  const userPrompt = `اسم الملف: ${filename}
المجلد: ${folder}
نوع الملف: ${kind}

محتوى الملف:
"""
${snippet}
"""

استخرج metadata بصيغة JSON تطابق الـ schema المطلوب.`;

  // ── محاولة مع retry واحدة عند فشل JSON ───────────────────────────────────
  async function attempt(isRetry = false) {
    const prompt = isRetry
      ? userPrompt + '\n\nتنبيه: أرجع JSON صالحاً فقط — بدون أي نص خارجه، بدون markdown.'
      : userPrompt;

    return await aiComplete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      feature: 'ingestion',
      jsonSchema: ANALYSIS_SCHEMA,
      temperature: isRetry ? 0.0 : 0.2,
      maxTokens: 2500,
      metadata: { filename, folder, kind, textLength: text.length, retry: isRetry },
    });
  }

  let result = await attempt(false);

  // فشل parsing → retry بدرجة حرارة صفر وتوجيه أوضح
  if (!result.json) {
    console.warn(`[analyzer] JSON parse failed for "${filename}", retrying...`);
    result = await attempt(true);
  }

  if (result.json) {
    return {
      analysis: result.json,
      usage: result.usage,
      provider: result.provider,
      model: result.model,
    };
  }

  // فشل الـ retry أيضاً — fallback آمن
  return {
    analysis: {
      title: filename.replace(/\.[^.]+$/, ''),
      category: 'other',
      suggestedModule: 'Document',
      summary: '⚠️ فشل تحليل AI بعد إعادة المحاولة — سيُحفَظ كوثيقة عامة.',
      keywords: [],
      extractedDate: '',
      version: '',
      approvedBy: '',
      confidence: 'low',
      isoClause: '',
      notes: `JSON parse error: ${result.jsonParseError || 'unknown'}`,
    },
    usage: result.usage,
    provider: result.provider,
    model: result.model,
    parseError: true,
  };
}
