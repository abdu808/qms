/**
 * aiAgent/loop.js — حلقة الوكيل الذكي
 *
 * ══════════════════════════════════════════════════════
 * وضعا التشغيل:
 *
 *  AUTO (تلقائي):
 *    AI يستدعي الأدوات → تُنفَّذ فوراً → AI يرى النتيجة → يكمل
 *    المستخدم يرى: رد + ملخص ما فُعل
 *
 *  REVIEW (مراجعة):
 *    AI يستدعي أدوات القراءة (get_system_state) → تُنفَّذ
 *    AI يستدعي أدوات الكتابة → تُجمَّع كـ pendingActions (لا تُنفَّذ)
 *    AI يُخبَر: "الإجراء مُقترَح — ينتظر موافقتك"
 *    المستخدم يرى: رد + قائمة الإجراءات المقترحة + زر تطبيق
 * ══════════════════════════════════════════════════════
 */
import { aiComplete } from '../../lib/ai/index.js';
import { AGENT_TOOLS, READ_ONLY_TOOLS, executeTool } from './tools.js';

const MAX_ITERATIONS        = 8;
const MAX_TOOL_CALLS_PER_ITER = 10;

/**
 * @param {object}  params
 * @param {string}  params.systemPrompt
 * @param {Array}   params.messages          — [{role, content}]
 * @param {string}  params.actingUserId      — للـ audit trail
 * @param {string}  params.callerUserId      — للـ usage logging
 * @param {string}  [params.mode]            — 'auto' | 'review' (افتراضي: auto)
 * @param {string}  [params.feature]
 * @param {number}  [params.maxTokens]
 *
 * @returns {{
 *   reply:          string,
 *   toolsUsed:      Array,   — في وضع auto
 *   pendingActions: Array,   — في وضع review
 *   iterations:     number,
 *   usage:          object,
 * }}
 */
export async function runAgentLoop({
  systemPrompt,
  messages,
  actingUserId,
  callerUserId,
  mode = 'auto',
  feature = 'consultant',
  maxTokens = 4096,
}) {
  const isReview = mode === 'review';
  const history  = buildHistory(messages);

  let finalReply     = '';
  let iterations     = 0;
  let usedProvider   = null;
  let usedModel      = null;
  const toolsUsed    = [];    // auto mode: ما نُفِّذ
  const pendingActions = [];  // review mode: ما اقترحه AI

  const usageTotals = { inputTokens: 0, outputTokens: 0, costUSD: 0 };

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const result = await aiComplete({
      system:   systemPrompt,
      messages: history,
      tools:    AGENT_TOOLS,
      maxTokens,
      feature,
      userId: callerUserId,
    });

    usageTotals.inputTokens  += result.usage?.inputTokens  || 0;
    usageTotals.outputTokens += result.usage?.outputTokens || 0;
    usageTotals.costUSD      += result.usage?.costUSD      || 0;
    // سجِّل المزود والموديل من أول استدعاء
    if (!usedProvider) { usedProvider = result.provider; usedModel = result.model; }

    if (result.content) finalReply = result.content;

    // لا أدوات → انتهت الحلقة
    if (!result.toolCalls?.length || result.stopReason === 'end_turn') break;

    // أضف رد AI لتاريخ المحادثة
    history.push({ role: 'assistant', content: buildAssistantBlocks(result) });

    // نفِّذ / اجمع الأدوات
    const toolResults = [];
    for (const call of result.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ITER)) {
      const isReadOnly = READ_ONLY_TOOLS.has(call.name);

      // ── في وضع المراجعة: نفِّذ القراءة فقط — اجمع الكتابة ──────────────
      if (isReview && !isReadOnly) {
        // أخبر AI أن الإجراء مُقترَح ينتظر الموافقة
        const pendingLabel = toolLabel(call.name);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify({
            ok: true,
            pending: true,
            summary: `⏳ مُقترَح (${pendingLabel}) — ينتظر موافقة المستخدم قبل التنفيذ`,
          }),
        });
        pendingActions.push({
          id:    call.id,
          tool:  call.name,
          input: call.input,
          label: pendingLabel,
        });
        continue;
      }

      // ── تنفيذ الأداة (auto mode أو أدوات القراءة) ─────────────────────────
      const t0 = Date.now();
      let toolResult;
      try {
        toolResult = await executeTool(call.name, call.input, actingUserId);
      } catch (e) {
        toolResult = { ok: false, error: e.message, summary: `خطأ: ${e.message}` };
      }

      const duration = Date.now() - t0;
      toolsUsed.push({
        tool:       call.name,
        input:      call.input,
        result:     toolResult,
        ok:         toolResult.ok,
        summary:    toolResult.summary || (toolResult.ok ? '✅ تم' : `❌ ${toolResult.error}`),
        durationMs: duration,
        readOnly:   isReadOnly,
      });

      toolResults.push({
        type:        'tool_result',
        tool_use_id: call.id,
        content:     JSON.stringify({
          ok:      toolResult.ok,
          data:    toolResult.ok ? toolResult.data : undefined,
          error:   toolResult.ok ? undefined : toolResult.error,
          summary: toolResult.summary,
        }),
        is_error: !toolResult.ok,
      });
    }

    history.push({ role: 'user', content: toolResults });
  }

  return {
    reply:          finalReply,
    toolsUsed:      toolsUsed.filter(t => !t.readOnly), // لا نعرض get_system_state
    pendingActions,
    iterations,
    usage:    usageTotals,
    provider: usedProvider,
    model:    usedModel,
    mode,
  };
}

/**
 * ينفِّذ pendingActions التي وافق عليها المستخدم
 */
export async function applyPendingActions(pendingActions, actingUserId) {
  const results = [];
  for (const action of pendingActions) {
    const t0 = Date.now();
    try {
      const r = await executeTool(action.tool, action.input, actingUserId);
      results.push({
        id:         action.id,
        tool:       action.tool,
        input:      action.input,
        label:      action.label,
        ok:         r.ok,
        summary:    r.summary,
        error:      r.error,
        durationMs: Date.now() - t0,
      });
    } catch (e) {
      results.push({
        id:      action.id,
        tool:    action.tool,
        label:   action.label,
        ok:      false,
        error:   e.message,
        summary: `❌ ${e.message}`,
        durationMs: Date.now() - t0,
      });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
//  دوال مساعدة
// ─────────────────────────────────────────────────────────────────────────────

function buildHistory(messages) {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));
}

function buildAssistantBlocks(result) {
  const blocks = [];
  if (result.content) blocks.push({ type: 'text', text: result.content });
  for (const tc of (result.toolCalls || [])) {
    blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
  }
  return blocks;
}

function toolLabel(name) {
  const labels = {
    update_strategic_goal:        'تحديث هدف استراتيجي',
    delete_strategic_goal:        'حذف هدف استراتيجي',
    update_operational_activity:  'تحديث نشاط تشغيلي',
    delete_operational_activity:  'حذف نشاط تشغيلي',
    create_operational_activity:  'إنشاء نشاط تشغيلي',
    link_activity_to_goal:        'ربط نشاط بهدف',
    create_objective:             'إنشاء هدف تشغيلي',
    update_objective:             'تحديث هدف تشغيلي',
    delete_objective:             'حذف هدف تشغيلي',
    assign_responsible:           'تعيين مسؤول',
    assign_owner:                 'تعيين مالك',
    log_kpi_entry:                'تسجيل KPI',
    create_risk:                  'إنشاء خطر/فرصة',
    update_risk:                  'تحديث خطر',
    create_ncr:                   'إنشاء NCR',
    update_ncr:                   'تحديث NCR',
    create_capa:                  'إنشاء CAPA',
    update_capa:                  'تحديث CAPA',
    plan_audit:                   'جدولة تدقيق',
    create_complaint:             'إنشاء شكوى',
    update_complaint:             'تحديث شكوى',
    create_swot_item:             'إضافة عنصر SWOT',
    update_swot_item:             'تحديث SWOT',
    create_management_review:     'جدولة مراجعة إدارة',
    update_management_review:     'تحديث مراجعة الإدارة',
    schedule_training:            'جدولة تدريب',
    orchestrate_complaint:        'سير عمل شكوى متكامل',
    generate_progress_report:     'توليد تقرير قسم شهري',
    investigate_cross_contradictions: 'فحص تناقضات الأقسام',
  };
  return labels[name] || name;
}
