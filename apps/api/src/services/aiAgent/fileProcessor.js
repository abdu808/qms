/**
 * services/aiAgent/fileProcessor.js — معالج الملفات بنداء AI واحد
 *
 * بدلاً من إرسال نص الملف للمستشار ليُدير حلقة 5-10 دورات،
 * نستدعي AI مرة واحدة بـ JSON structured output
 * ثم نكتب النتائج مباشرةً إلى قاعدة البيانات (بدون loop).
 *
 * التوفير: ~80% من تكلفة معالجة الملفات.
 */
import { aiComplete } from '../../lib/ai/index.js';
import { prisma } from '../../db.js';

/**
 * يستخرج الأنشطة التشغيلية والأهداف من نص خطة تشغيلية
 * ثم يحفظها مباشرةً في DB.
 *
 * @param {string} text       — نص الملف (مقتطع إلى 60K)
 * @param {string} filename   — اسم الملف للـ logging
 * @param {string} userId     — createdById
 * @returns {{ activities: [], objectives: [], summary: string }}
 */
export async function processOperationalPlan({ text, filename, userId }) {
  // ── استدعاء AI واحد بـ JSON schema ──────────────────────────────────────
  const result = await aiComplete({
    system: `أنت محلل خطط تشغيلية متخصص. مهمتك استخراج البيانات المنظمة من وثيقة خطة تشغيلية.
أخرج JSON صحيح بالحقول المطلوبة فقط. لا تُضف تعليقات.`,
    messages: [{
      role: 'user',
      content: `استخرج من الخطة التشغيلية التالية: الأنشطة التشغيلية والأهداف التشغيلية.

اسم الملف: ${filename}

النص:
${text.slice(0, 55000)}

أعِد JSON بالشكل التالي (تجاهل أي حقل غير موجود):
{
  "activities": [
    {
      "title": "عنوان النشاط",
      "department": "اسم القسم",
      "responsible": "اسم المسؤول",
      "targetValue": 90,
      "kpiType": "CUMULATIVE",
      "budget": 50000,
      "startDate": "2026-01-01",
      "endDate": "2026-12-31",
      "description": "وصف مختصر"
    }
  ],
  "objectives": [
    {
      "title": "عنوان الهدف التشغيلي",
      "kpi": "مؤشر القياس",
      "target": 90,
      "unit": "%",
      "baseline": 70,
      "description": "وصف",
      "department": "اسم القسم"
    }
  ],
  "summary": "ملخص في جملة واحدة لما استُخرج"
}`,
    }],
    feature: 'file_processor',
    userId,
    maxTokens: 4096,
    jsonSchema: {
      type: 'object',
      properties: {
        activities: { type: 'array' },
        objectives:  { type: 'array' },
        summary:     { type: 'string' },
      },
    },
  });

  // ── تحليل JSON ────────────────────────────────────────────────────────────
  let extracted = { activities: [], objectives: [], summary: '' };
  try {
    const raw = result.json || JSON.parse(result.content);
    extracted = {
      activities: Array.isArray(raw.activities) ? raw.activities : [],
      objectives:  Array.isArray(raw.objectives)  ? raw.objectives  : [],
      summary:     raw.summary || '',
    };
  } catch {
    console.warn('[fileProcessor] JSON parse failed — no structured data extracted');
    return { activities: [], objectives: [], summary: 'تعذَّر استخراج بيانات منظمة من الملف', aiCost: result.usage?.costUSD || 0 };
  }

  // ── حفظ الأنشطة التشغيلية ────────────────────────────────────────────────
  const createdActivities = [];
  const existingCodes = new Set(
    (await prisma.operationalActivity.findMany({ select: { code: true } })).map(a => a.code)
  );

  for (const act of extracted.activities.slice(0, 50)) {
    if (!act.title) continue;

    // توليد كود فريد
    let code;
    let n = existingCodes.size + createdActivities.length + 1;
    do {
      code = `ACT-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`;
      n++;
    } while (existingCodes.has(code));

    try {
      const created = await prisma.operationalActivity.create({
        data: {
          code,
          title:       act.title,
          description: act.description || null,
          department:  act.department  || null,
          responsible: act.responsible || null,
          targetValue: typeof act.targetValue === 'number' ? act.targetValue : null,
          kpiType:     act.kpiType || 'SNAPSHOT',
          budget:      typeof act.budget === 'number' ? act.budget : null,
          startDate:   act.startDate ? new Date(act.startDate) : null,
          endDate:     act.endDate   ? new Date(act.endDate)   : null,
          status:      'PLANNED',
          createdById: userId || null,
        },
      });
      existingCodes.add(code);
      createdActivities.push({ code, title: created.title });
    } catch (e) {
      console.warn(`[fileProcessor] Failed to create activity "${act.title}": ${e.message}`);
    }
  }

  // ── حفظ الأهداف التشغيلية ────────────────────────────────────────────────
  const createdObjectives = [];
  const existingObjCodes = new Set(
    (await prisma.objective.findMany({ select: { code: true } })).map(o => o.code)
  );

  for (const obj of extracted.objectives.slice(0, 30)) {
    if (!obj.title || !obj.kpi) continue;

    let code;
    let n = existingObjCodes.size + createdObjectives.length + 1;
    do {
      code = `OBJ-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`;
      n++;
    } while (existingObjCodes.has(code));

    // ابحث عن القسم المناسب إن وُجد
    let departmentId = null;
    if (obj.department) {
      const dept = await prisma.department.findFirst({
        where: { name: { contains: obj.department } },
        select: { id: true },
      });
      departmentId = dept?.id || null;
    }

    try {
      const created = await prisma.objective.create({
        data: {
          code,
          title:        obj.title,
          kpi:          obj.kpi,
          target:       typeof obj.target   === 'number' ? obj.target   : 0,
          baseline:     typeof obj.baseline === 'number' ? obj.baseline : null,
          unit:         obj.unit || '%',
          description:  obj.description || null,
          departmentId: departmentId,
          status:       'PLANNED',
        },
      });
      existingObjCodes.add(code);
      createdObjectives.push({ code, title: created.title });
    } catch (e) {
      console.warn(`[fileProcessor] Failed to create objective "${obj.title}": ${e.message}`);
    }
  }

  return {
    activities:  createdActivities,
    objectives:  createdObjectives,
    summary:     extracted.summary,
    aiCost:      result.usage?.costUSD || 0,
    aiTokens:    result.usage?.inputTokens + result.usage?.outputTokens || 0,
  };
}
