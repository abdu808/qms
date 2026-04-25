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
import { getToolsForRole, READ_ONLY_TOOLS, ALWAYS_REVIEW_TOOLS, executeTool } from './tools.js';

const MAX_ITERATIONS          = 14;  // كافٍ لإتمام خطة كاملة (قراءة + اقتراح + إنشاء + ربط + تقرير)
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
 * @param {Function} [params.onProgress]  — callback(event) للـ SSE streaming
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
  onProgress,  // callback للـ SSE streaming (اختياري)
}) {
  const isReview     = mode === 'review';
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const canAutoWrite = WRITE_ROLES.has(callerRole); // هل يستطيع الكتابة المباشرة؟
  // SUPER_ADMIN يرى جميع الأدوات بما فيها الحذف — غيره يرى الأدوات التشغيلية فقط
  const toolsForRole = getToolsForRole(callerRole);
  const history  = buildHistory(messages);

  let finalReply     = '';
  let iterations     = 0;
  let usedProvider   = null;
  let usedModel      = null;
  const toolsUsed    = [];    // auto mode: ما نُفِّذ
  const pendingActions = [];  // review mode: ما اقترحه AI

  const usageTotals = { inputTokens: 0, outputTokens: 0, costUSD: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const loopStart   = Date.now();
  // تتبع آخر logId
  let lastLogId = null;

  // fallback chain عند نفاد الحصة / 429 — يتخطى المزود المُعطَّل للباقي من الحلقة
  // ترتيب: Google (الأرخص) → Anthropic Haiku → OpenAI gpt-4o-mini
  const FALLBACK_CHAIN = [
    { provider: 'anthropic', model: 'claude-haiku-4-5' },
    { provider: 'openai',    model: 'gpt-4o-mini' },
  ];
  let fallbackIndex = -1;
  let currentProvider = provider;
  let currentModel    = model;

  function isQuotaError(err) {
    const msg = String(err?.message || '');
    const status = err?.status || err?.statusCode;
    return status === 429 || /429|Too Many Requests|Resource exhausted|quota|rate limit/i.test(msg);
  }

  /** هل يجب الانتقال للمزود التالي في الـ fallback chain؟ */
  function shouldFallback(err) {
    return isQuotaError(err) || err?.code === 'AI_NO_KEY';
  }

  while (iterations < MAX_ITERATIONS) {
    // ── حارس الوقت: توقف آمن قبل timeout Cloudflare (100s) ──────────────────
    if (Date.now() - loopStart > LOOP_TIMEOUT_MS) {
      finalReply = (finalReply || '⚠️ لم أتمكن من إكمال العملية') +
        '\n\n⏱️ **تنبيه:** انتهى الوقت المتاح — ما تم إنجازه موضح أعلاه. أرسل رسالة أخرى للاستكمال.';
      console.warn(`[loop] timeout after ${Date.now() - loopStart}ms at iteration ${iterations}`);
      break;
    }
    iterations++;

    let result;
    try {
      result = await aiComplete({
        system:   systemPrompt,
        messages: history,
        tools:    toolsForRole,   // SUPER_ADMIN يرى أدوات الحذف
        maxTokens,
        feature,
        userId: callerUserId,
        provider: currentProvider,
        model:    currentModel,
      });
    } catch (err) {
      if (shouldFallback(err) && fallbackIndex < FALLBACK_CHAIN.length - 1) {
        fallbackIndex++;
        const next = FALLBACK_CHAIN[fallbackIndex];
        const reason = err?.code === 'AI_NO_KEY' ? 'no key' : 'quota/429';
        console.warn(`[loop] ${reason} on ${currentProvider}/${currentModel} — fallback to ${next.provider}/${next.model}`);
        currentProvider = next.provider;
        currentModel    = next.model;
        iterations--; // أعد المحاولة بنفس الـ iteration
        continue;
      }
      throw err;
    }

    usageTotals.inputTokens     += result.usage?.inputTokens     || 0;
    usageTotals.outputTokens    += result.usage?.outputTokens    || 0;
    usageTotals.costUSD         += result.usage?.costUSD         || 0;
    usageTotals.cacheReadTokens  += result.cacheReadTokens       || 0;
    usageTotals.cacheWriteTokens += result.cacheWriteTokens      || 0;
    // سجِّل المزود والموديل من أول استدعاء
    if (!usedProvider) { usedProvider = result.provider; usedModel = result.model; }
    // تتبع آخر logId
    if (result.logId) lastLogId = result.logId;

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
      const isReadOnly    = READ_ONLY_TOOLS.has(call.name);
      const isDelete      = DELETE_TOOLS.has(call.name);
      // أدوات الإنشاء/التعديل الهيكلي: تتطلب موافقة ما لم يكن SUPER_ADMIN
      const isAlwaysReview = ALWAYS_REVIEW_TOOLS.has(call.name) && !isSuperAdmin;
      // الحذف: SUPER_ADMIN ينفِّذه فوراً — غيره يحتاج موافقة
      const isDeletePending = isDelete && !isSuperAdmin;

      // ── رفض الكتابة للأدوار غير المخولة (EMPLOYEE وما دون) ─────────────
      if (!isReadOnly && !canAutoWrite && !isReview) {
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

      // ── أدوات تحتاج موافقة: وضع المراجعة، أو تعديل هيكلي، أو حذف لغير المسؤول ──
      if (!isReadOnly && (isReview || isDeletePending || isAlwaysReview)) {
        const pendingLabel    = toolLabel(call.name);
        const deleteNote      = isDeletePending  ? ' ⚠️ إجراء حذف — يتطلب موافقة المسؤول' : '';
        const structuralNote  = isAlwaysReview && !isDeletePending ? ' 🏗️ تعديل هيكلي — يتطلب مراجعتك' : '';
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify({
            ok: true,
            pending: true,
            summary: `⏳ مُقترَح (${pendingLabel})${deleteNote}${structuralNote} — ينتظر موافقتك قبل التنفيذ`,
          }),
        });
        pendingActions.push({
          id:            call.id,
          tool:          call.name,
          input:         call.input,
          label:         pendingLabel,
          isDelete:      isDeletePending,
          isStructural:  isAlwaysReview,
        });
        continue;
      }

      // ── تنفيذ الأداة (auto mode + أدوات القراءة) ─────────────────────────
      const t0 = Date.now();
      let toolResult;
      // إخبار الواجهة ببدء التنفيذ
      onProgress?.({ type: 'tool_start', tool: call.name, label: toolLabel(call.name) });
      try {
        toolResult = await executeTool(call.name, call.input, actingUserId);
      } catch (e) {
        toolResult = { ok: false, error: e.message, summary: `خطأ: ${e.message}` };
      }
      // إخبار الواجهة بنتيجة التنفيذ
      onProgress?.({
        type:   'tool_done',
        tool:   call.name,
        label:  toolLabel(call.name),
        ok:     toolResult.ok,
        summary: toolResult.summary || (toolResult.ok ? '✅ تم' : `❌ ${toolResult.error}`),
      });

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
    lastLogId,
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
 * يُترجم اسم الأداة التقني إلى نص عربي واضح للمدير
 */
function toolLabel(toolName) {
  const LABELS = {
    // قراءة وتحليل
    get_system_state:                    '🔍 قراءة بيانات النظام',
    scan_overdue:                        '⏰ فحص البنود المتأخرة',
    compute_iso_maturity:                '📊 حساب نضج ISO 9001',
    generate_management_report:          '📋 توليد تقرير المراجعة الإدارية',
    compare_departments:                 '🏢 مقارنة أداء الأقسام',
    detect_department_trends:            '📈 تحليل اتجاهات الأداء',
    detect_distressed_departments:       '🚨 اكتشاف الأقسام المتعثرة',
    evaluate_strategic_plan:             '🎯 تقييم الخطة الاستراتيجية',
    evaluate_kpi_quality:                '📐 تقييم جودة المؤشرات',
    suggest_missing_objectives:          '💡 اقتراح الأهداف المفقودة',
    detect_goal_conflicts:               '⚠️ كشف تعارض الأهداف',
    analyze_ncr_patterns:                '🔍 تحليل أنماط عدم المطابقة',
    assess_training_needs:               '🎓 تقييم احتياجات التدريب',
    investigate_cross_contradictions:    '🔍 فحص تناقضات الأقسام',
    generate_progress_report:            '📄 توليد تقرير تقدم',
    // التخطيط الاستراتيجي
    update_strategic_goal:               '✏️ تحديث هدف استراتيجي',
    delete_strategic_goal:               '🗑️ حذف هدف استراتيجي',
    create_operational_activity:         '➕ إنشاء نشاط تشغيلي',
    update_operational_activity:         '✏️ تعديل نشاط تشغيلي',
    delete_operational_activity:         '🗑️ حذف نشاط تشغيلي',
    create_objective:                    '➕ إنشاء هدف تشغيلي',
    update_objective:                    '✏️ تعديل هدف تشغيلي',
    delete_objective:                    '🗑️ حذف هدف تشغيلي',
    link_activity_to_goal:               '🔗 ربط نشاط بهدف',
    assign_responsible:                  '👤 تعيين مسؤول',
    assign_owner:                        '👤 تعيين مالك',
    create_swot_item:                    '➕ إضافة نقطة SWOT',
    update_swot_item:                    '✏️ تحديث SWOT',
    // مراجعة الإدارة
    create_management_review:            '📅 جدولة مراجعة إدارة',
    update_management_review:            '✏️ تحديث مراجعة الإدارة',
    // المخاطر والمطابقة
    create_risk:                         '⚠️ تسجيل مخاطرة',
    update_risk:                         '✏️ تحديث مخاطرة',
    create_ncr:                          '🔴 فتح عدم مطابقة',
    update_ncr:                          '✏️ تحديث عدم مطابقة',
    create_capa:                         '🔧 إنشاء إجراء تصحيحي',
    update_capa:                         '✏️ تحديث إجراء تصحيحي',
    // الشكاوى
    create_complaint:                    '📝 تسجيل شكوى',
    update_complaint:                    '✏️ تحديث شكوى',
    orchestrate_complaint:               '🔄 معالجة شكوى كاملة',
    // التدريب والتدقيق والمؤشرات
    log_kpi_entry:                       '📊 تسجيل قيمة مؤشر',
    plan_audit:                          '📅 جدولة تدقيق',
    schedule_training:                   '🎓 جدولة تدريب',
  };
  return LABELS[toolName] || `🔧 ${toolName}`;
}


/**
 * يضغط نتائج الأدوات الكبيرة في التاريخ لتوفير التوكنات.
 * ⚠️  مهم: نحتفظ دائماً بـ id + title/name/code لكل سجل حتى يستطيع
 *    الـ AI استخدامها في عمليات التحديث اللاحقة.
 */
function compressToolResults(historyEntry) {
  if (!Array.isArray(historyEntry.content)) return historyEntry;
  const compressed = historyEntry.content.map(block => {
    if (block.type !== 'tool_result') return block;
    const raw = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    if (raw.length <= 3000) return block;
    try {
      const parsed = JSON.parse(raw);
      const digest = {};
      const source = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      for (const [k, v] of Object.entries(source)) {
        if (v && typeof v === 'object' && Array.isArray(v.items)) {
          // ✅ نحتفظ بـ id + وصف قصير — حرج للـ AI لتنفيذ updates
          digest[k] = {
            total: v.total ?? v.items.length,
            items: v.items.map(i => _idSummary(i)),
          };
        } else if (Array.isArray(v)) {
          digest[k] = v.map(i => (i && typeof i === 'object' ? _idSummary(i) : i));
        } else if (v && typeof v === 'object') {
          // كائن وحيد — نحتفظ بـ id إن وُجد
          digest[k] = v.id ? _idSummary(v) : '[كائن مضغوط]';
        } else {
          digest[k] = v;
        }
      }
      const compact = {
        ok: parsed.ok !== undefined ? parsed.ok : true,
        summary: parsed.summary || '[تم ضغط البيانات — IDs محفوظة]',
        data: digest,
      };
      if (parsed.error) compact.error = parsed.error;
      return { ...block, content: JSON.stringify(compact) };
    } catch {
      return { ...block, content: raw.slice(0, 2000) + '\n...[مقتطع لتوفير التوكنات]' };
    }
  });
  return { ...historyEntry, content: compressed };
}

/**
 * يُنتج ملخصاً صغيراً لسجل يحتفظ بالـ id + وصف قصير.
 * يُستخدَم في ضغط التاريخ.
 */
function _idSummary(item) {
  if (!item || typeof item !== 'object') return item;
  const label = item.title || item.name || item.code || item.label || '';
  const status = item.status || item.progress || '';
  const summary = [label, status].filter(Boolean).join(' | ');
  return { id: item.id, ...(summary ? { _: summary } : {}) };
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

