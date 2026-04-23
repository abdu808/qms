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

const MAX_ITERATIONS          = 10;  // خُفِّض من 15 — كل دورة ~6-10 ثوانٍ، الحد الأقصى ~85 ثانية
const MAX_TOOL_CALLS_PER_ITER = 25;  // AI يحتاج سعة لمعالجة ملفات بها إدارات/مؤشرات متعددة دفعةً واحدة
const LOOP_TIMEOUT_MS         = 82_000; // 82 ثانية — هامش آمن تحت 100 ثانية لـ Cloudflare

// أدوات الحذف — تتطلب موافقة المسؤول دائماً بغض النظر عن الوضع أو الدور
const DELETE_TOOLS = new Set([
  'delete_strategic_goal',
  'delete_operational_activity',
  'delete_objective',
]);

// الأدوار التي تستطيع تنفيذ الكتابة مباشرةً دون مراجعة
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'QUALITY_MANAGER']);

/**
 * @param {object}  params
 * @param {string}  params.systemPrompt
 * @param {Array}   params.messages          — [{role, content}]
 * @param {string}  params.actingUserId      — للـ audit trail
 * @param {string}  params.callerUserId      — للـ usage logging
 * @param {string}  [params.mode]            — 'auto' | 'review' (افتراضي: auto)
 * @param {string}  [params.callerRole]      — دور المستخدم الأصلي (SUPER_ADMIN | QUALITY_MANAGER | DEPT_MANAGER | ...)
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
  callerRole,  // دور المستخدم الأصلي
  feature = 'consultant',
  maxTokens = 4096,
  provider,    // override المزود (من الموجِّه الذكي)
  model,       // override الموديل (من الموجِّه الذكي)
  routingTier, // للـ logging
}) {
  const isReview    = mode === 'review';
  const canAutoWrite = WRITE_ROLES.has(callerRole); // هل يستطيع الكتابة المباشرة؟
  const history  = buildHistory(messages);

  let finalReply     = '';
  let iterations     = 0;
  let usedProvider   = null;
  let usedModel      = null;
  const toolsUsed    = [];    // auto mode: ما نُفِّذ
  const pendingActions = [];  // review mode: ما اقترحه AI

  const usageTotals = { inputTokens: 0, outputTokens: 0, costUSD: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const loopStart   = Date.now();

  while (iterations < MAX_ITERATIONS) {
    // ── حارس الوقت: توقف آمن قبل timeout Cloudflare (100s) ──────────────────
    if (Date.now() - loopStart > LOOP_TIMEOUT_MS) {
      finalReply = (finalReply || '⚠️ لم أتمكن من إكمال العملية') +
        '\n\n⏱️ **تنبيه:** انتهى الوقت المتاح — ما تم إنجازه موضح أعلاه. أرسل رسالة أخرى للاستكمال.';
      console.warn(`[loop] timeout after ${Date.now() - loopStart}ms at iteration ${iterations}`);
      break;
    }
    iterations++;

    const result = await aiComplete({
      system:   systemPrompt,
      messages: history,
      tools:    AGENT_TOOLS,
      maxTokens,
      feature,
      userId: callerUserId,
      provider,   // override المزود (undefined → يستخدم الإعداد الافتراضي)
      model,      // override الموديل
    });

    usageTotals.inputTokens     += result.usage?.inputTokens     || 0;
    usageTotals.outputTokens    += result.usage?.outputTokens    || 0;
    usageTotals.costUSD         += result.usage?.costUSD         || 0;
    usageTotals.cacheReadTokens  += result.cacheReadTokens       || 0;
    usageTotals.cacheWriteTokens += result.cacheWriteTokens      || 0;
    // سجِّل المزود والموديل من أول استدعاء
    if (!usedProvider) { usedProvider = result.provider; usedModel = result.model; }

    if (result.content) finalReply = result.content;

    // لا أدوات → انتهت الحلقة
    if (!result.toolCalls?.length || result.stopReason === 'end_turn') break;

    // قص الأدوات إلى الحد الأعلى — يجب أن نحافظ على ثابت Anthropic:
    // كل tool_use في رسالة المساعد يحتاج tool_result مقابل في الرسالة التالية.
    // لو تجاوز Claude الحد، نأخذ أول N فقط ونتجاهل الباقي تماماً (من الرسالة ومن النتائج).
    const processedCalls = result.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ITER);
    if (result.toolCalls.length > MAX_TOOL_CALLS_PER_ITER) {
      console.warn(`[loop] AI طلب ${result.toolCalls.length} أداة، حُدّت إلى ${MAX_TOOL_CALLS_PER_ITER}`);
    }

    // أضف رد AI لتاريخ المحادثة — فقط الأدوات التي سنُعالجها (للحفاظ على الثابت)
    history.push({ role: 'assistant', content: buildAssistantBlocks(result, processedCalls) });

    // نفِّذ / اجمع الأدوات
    const toolResults = [];
    for (const call of processedCalls) {
      const isReadOnly  = READ_ONLY_TOOLS.has(call.name);
      const isDelete    = DELETE_TOOLS.has(call.name);

      // ── رفض الكتابة للأدوار غير المخولة (EMPLOYEE وما دون) ─────────────
      if (!isReadOnly && !canAutoWrite && !isReview) {
        // هذا لا يحدث عملياً لأن consultant.js يُجبر review للأدوار غير المخولة
        // لكن كطبقة دفاع ثانية
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify({
            ok: false,
            error: '🚫 ليس لديك صلاحية تنفيذ هذا الإجراء مباشرةً. تواصل مع مسؤول النظام.',
          }),
          is_error: true,
        });
        continue;
      }

      // ── أدوات الحذف: دائماً في وضع المراجعة حتى لـ QUALITY_MANAGER ──────
      // ── وضع المراجعة العادي: اجمع أدوات الكتابة ─────────────────────────
      if (!isReadOnly && (isReview || isDelete)) {
        const pendingLabel = toolLabel(call.name);
        const deleteNote   = isDelete ? ' ⚠️ إجراء حذف — يتطلب موافقة المسؤول' : '';
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify({
            ok: true,
            pending: true,
            summary: `⏳ مُقترَح (${pendingLabel})${deleteNote} — ينتظر موافقة المستخدم قبل التنفيذ`,
          }),
        });
        pendingActions.push({
          id:       call.id,
          tool:     call.name,
          input:    call.input,
          label:    pendingLabel,
          isDelete, // علامة للـ UI للتمييز
        });
        continue;
      }

      // ── تنفيذ الأداة (auto mode + أدوات القراءة) ─────────────────────────
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

    // ضغط نتائج الأدوات الكبيرة قبل إضافتها للتاريخ (يوفر توكنات في iterations التالية)
    history.push(compressToolResults({ role: 'user', content: toolResults }));
  }

  // تحذير إن وصلنا للحد الأقصى للتكرارات دون إنهاء طبيعي
  const hitLimit = iterations >= MAX_ITERATIONS;
  if (hitLimit) {
    console.warn(`[loop] reached MAX_ITERATIONS (${MAX_ITERATIONS}) — task may be incomplete`);
    if (finalReply) {
      finalReply += '\n\n⚠️ **تنبيه:** وصل المستشار للحد الأقصى من الخطوات. قد تكون بعض المهام لم تكتمل — يمكنك إرسال "أكمل" ليتابع.';
    } else {
      finalReply = '⚠️ وصل المستشار للحد الأقصى من الخطوات دون رد نهائي. أرسل "أكمل" ليتابع العمل.';
    }
  }

  return {
    reply:          finalReply,
    toolsUsed:      toolsUsed.filter(t => !t.readOnly),
    pendingActions,
    iterations,
    hitIterationLimit: hitLimit,
    usage: {
      inputTokens:      usageTotals.inputTokens,
      outputTokens:     usageTotals.outputTokens,
      costUSD:          usageTotals.costUSD,
      cacheReadTokens:  usageTotals.cacheReadTokens,
      cacheWriteTokens: usageTotals.cacheWriteTokens,
    },
    provider: usedProvider,
    model:    usedModel,
    routingTier,
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

/**
 * يضغط نتائج الأدوات الكبيرة في التاريخ لتوفير التوكنات.
 * نتائج get_system_state > 3000 حرف تُختصر بإحصائيات فقط.
 * يُطبَّق على التاريخ المتراكم داخل الحلقة.
 */
function compressToolResults(historyEntry) {
  if (!Array.isArray(historyEntry.content)) return historyEntry;
  const compressed = historyEntry.content.map(block => {
    if (block.type !== 'tool_result') return block;
    const raw = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    if (raw.length <= 3000) return block;
    // استخرج إحصائية بسيطة بدلاً من البيانات الكاملة
    try {
      const parsed = JSON.parse(raw);
      const summary = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object' && 'items' in v) {
          summary[k] = `${v.items?.length || 0}/${v.total || '?'} سجل`;
        } else if (Array.isArray(v)) {
          summary[k] = `${v.length} سجل`;
        } else {
          summary[k] = v;
        }
      }
      return { ...block, content: `[مضغوط] ${JSON.stringify(summary)}` };
    } catch {
      return { ...block, content: raw.slice(0, 2000) + '\n...[مقتطع لتوفير التوكنات]' };
    }
  });
  return { ...historyEntry, content: compressed };
}

function buildAssistantBlocks(result, toolCalls = null) {
  // toolCalls اختياري — لو مُرِّر، نستخدمه بدل result.toolCalls (للحالة التي قصصنا فيها الأدوات)
  const calls = toolCalls || result.toolCalls || [];
  const blocks = [];
  if (result.content) blocks.push({ type: 'text', text: result.content });
  for (const tc of calls) {
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
