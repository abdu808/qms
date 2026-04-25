/**
 * routes/consultant.js — المستشار الاستراتيجي (v2)
 *
 *  GET  /api/consultant/context       — لقطة حالية للـ UI
 *  POST /api/consultant/chat          — محادثة + تنفيذ أدوات
 *                                       body: { messages, mode? }
 *                                       mode: 'auto' (افتراضي) | 'review'
 *  POST /api/consultant/apply-pending — تنفيذ إجراءات وافق عليها المستخدم
 *                                       body: { pendingActions: [{tool, input, id, label}] }
 *  POST /api/consultant/apply         — legacy — يقبل actions بالصيغة القديمة
 */
import { Router }   from 'express';
import multer       from 'multer';
import { tmpdir }   from 'os';
import { extname } from 'path';
import { readFile, unlink } from 'fs/promises';
import { asyncHandler }  from '../utils/asyncHandler.js';
import { authorize }     from '../middleware/auth.js';
import { BadRequest }    from '../utils/errors.js';
import { isAllowedFileKind } from '../lib/fileSignatures.js';
import { buildContext, chat, applyActions, getAiAgentUserIdInternal } from '../services/consultantAgent.js';
import { applyPendingActions } from '../services/aiAgent/loop.js';
import { processOperationalPlan } from '../services/aiAgent/fileProcessor.js';
import { extractText, SUPPORTED_EXTENSIONS } from '../../scripts/ingest/extractors.mjs';
import { analyzeFile }   from '../../scripts/ingest/analyzer.mjs';
import { uploadItem, getAdminUserId } from '../../scripts/ingest/uploader.mjs';
import rateLimit from 'express-rate-limit';

const router = Router();
// DEPT_MANAGER مسموح له بالقراءة والاقتراح فقط (review mode إجباري)
const ROLES      = ['SUPER_ADMIN', 'QUALITY_MANAGER', 'DEPT_MANAGER'];
// الأدوار التي تستطيع تنفيذ الكتابة مباشرةً (auto mode)
const WRITE_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

// ــ Rate limiting على المستخدم (10 طلبات/دقيقة) — يمنع استنزاف الميزانية ─────────────
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // نافذة دقيقة واحدة
  max: 10,               // 10 طلبات لكل مستخدم في الدقيقة
  standardHeaders: true,
  legacyHeaders: false,
  // المفتاح: userId بدل IP (لأن المستخدمين خلف proxy يتشاركون IP)
  keyGenerator: (req) => req.user?.sub || req.user?.id || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      error: { code: 'RATE_LIMIT', message: 'تجاوزت الحد المسموح (10 طلبات/دقيقة) — انتظر قليلاً ثم أعد المحاولة.' },
    });
  },
});

// ── multer: حفظ مؤقت في /tmp ──────────────────────────────────────────────────
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 }, // 20 MB لكل ملف، حتى 10 ملفات
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) return cb(null, true);
    cb(new Error(`نوع الملف غير مدعوم: ${ext} — المدعوم: ${SUPPORTED_EXTENSIONS.join(', ')}`));
  },
});

// ── GET /context ──────────────────────────────────────────────────────────────
router.get('/context', authorize(...ROLES), asyncHandler(async (_req, res) => {
  const ctx = await buildContext({ compact: false });
  res.json({ ok: true, context: ctx });
}));

// ــ POST /chat ─────────────────────────────────────────────────────────────────────
router.post('/chat', authorize(...ROLES), chatRateLimiter, asyncHandler(async (req, res) => {
  const { messages, mode: requestedMode = 'auto', model: modelOverride, provider: providerOverride } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    throw BadRequest('messages: مصفوفة غير فارغة مطلوبة');
  }
  if (!['auto', 'review'].includes(requestedMode)) {
    throw BadRequest('mode يجب أن يكون auto أو review');
  }

  for (const m of messages) {
    if (!m || typeof m !== 'object') throw BadRequest('كل رسالة يجب أن تكون كائناً');
    if (!['user', 'assistant'].includes(m.role)) throw BadRequest('role: user أو assistant فقط');
    if (typeof m.content !== 'string' || !m.content.trim()) throw BadRequest('content مطلوب');
    if (m.content.length > 100_000) throw BadRequest('رسالة طويلة جداً (الحد 100,000 حرف)');
  }

  const callerUserId = req.user?.sub || req.user?.id;
  const callerRole   = req.user?.role;
  const mode         = WRITE_ROLES.includes(callerRole) ? requestedMode : 'review';

  // ── SSE Streaming — يمنع Cloudflare من قطع الاتصال عند 100 ثانية ────────
  // نُرسل نبضات keep-alive كل 15 ثانية أثناء معالجة الطلب الطويل.
  res.setHeader('Content-Type',  'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // تعطيل nginx buffering
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders?.();

  const sseWrite = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  // نبضات كل 15 ثانية → Cloudflare يرى حركة بيانات ولا يقطع
  const pingTimer = setInterval(() => sseWrite('ping', { t: Date.now() }), 5_000);
  // إرسال "بدأ التفكير" فوراً
  sseWrite('thinking', { status: 'started' });

  try {
    // onProgress: يُرسل SSE event لكل أداة تُنفَّذ في الوقت الحقيقي
    const onProgress = (event) => {
      if (!res.writableEnded) sseWrite('progress', event);
    };
    const out = await chat({ messages, callerUserId, callerRole, mode, modelOverride, providerOverride, onProgress });
    clearInterval(pingTimer);
    sseWrite('result', { ok: true, ...out });
  } catch (e) {
    clearInterval(pingTimer);
    console.error('[consultant/chat] error:', {
      message: e.message, code: e.code, status: e.status,
      stack:   e.stack?.split('\n').slice(0, 5).join('\n'),
    });
    sseWrite('error', { ok: false, error: { message: e.message, code: e.code } });
  } finally {
    res.end();
  }
}));

// ── POST /apply-pending ───────────────────────────────────────────────────────
router.post('/apply-pending', authorize(...ROLES), asyncHandler(async (req, res) => {
  const { pendingActions } = req.body || {};

  if (!Array.isArray(pendingActions) || pendingActions.length === 0) {
    throw BadRequest('pendingActions: مصفوفة غير فارغة مطلوبة');
  }
  if (pendingActions.length > 30) throw BadRequest('أكثر من 30 إجراء في طلب واحد غير مسموح');

  // تحقق من صحة كل action
  for (const a of pendingActions) {
    if (!a.tool || typeof a.tool !== 'string') throw BadRequest('كل إجراء يحتاج tool (string)');
    if (!a.input || typeof a.input !== 'object') throw BadRequest('كل إجراء يحتاج input (object)');
  }

  const callerUserId = req.user?.sub || req.user?.id;
  const agentUserId  = await getAiAgentUserIdInternal().catch(() => null);
  const actingUserId = agentUserId || callerUserId;

  const results = await applyPendingActions(pendingActions, actingUserId);
  const ok      = results.filter(r => r.ok).length;
  const failed  = results.length - ok;

  res.json({
    ok: true,
    results,
    summary: { total: results.length, ok, failed },
  });
}));

// ── POST /upload ──────────────────────────────────────────────────────────────
// يستقبل حتى 10 ملفات، يعالجها بالتوازي، ويُنشئ السجلات المناسبة
router.post('/upload', authorize(...ROLES), upload.array('files', 10), asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw BadRequest('لم تُرفق ملفات — أرسل الملفات كـ multipart/form-data في حقل "files"');

  const { rename } = await import('fs/promises');
  const callerUserId = req.user?.sub || req.user?.id;
  let createdById;
  try { createdById = await getAdminUserId(); } catch { createdById = callerUserId; }

  // ── معالجة كل ملف (بالتوازي) ──────────────────────────────────────────────
  const fileResults = await Promise.all(files.map(async (f) => {
    const tmpPath  = f.path;
    const filename = f.originalname;
    const ext      = extname(filename).toLowerCase();
    const namedPath = tmpPath + ext;

    try {
      await rename(tmpPath, namedPath);
      const uploadedBuffer = await readFile(namedPath);
      if (!isAllowedFileKind(uploadedBuffer, ['pdf', 'ole-office', 'zip-office', 'jpg', 'png'])) {
        throw BadRequest('محتوى الملف لا يطابق الأنواع المسموحة');
      }

      // 1️⃣ استخراج المحتوى (نص أو buffer للـ vision)
      const extracted = await extractText(namedPath);

      // 2️⃣ تحليل AI — PDF/صور تُرسَل كـ vision، بقية الأنواع كنص
      const analyzed = await analyzeFile({
        filename,
        folder:    'consultant-upload',
        text:      extracted.text,
        kind:      extracted.kind || ext.replace('.', ''),
        buffer:    extracted.buffer,
        mediaType: extracted.mediaType,
        vision:    extracted.vision,
      });
      const a = analyzed.analysis;

      // 3️⃣ إنشاء السجلات
      const AUTO_STORE_MODULES = ['StrategicGoal', 'QualityPolicy', 'Announcement', 'Document'];
      const shouldStore = AUTO_STORE_MODULES.includes(a.suggestedModule);
      let stored = null;
      if (shouldStore) {
        stored = await uploadItem(
          { filename, folder: 'consultant-upload', filePath: null, analysis: a, textPreview: extracted.text?.slice(0, 3000) },
          createdById,
        );
      }

      // 4️⃣ الخطط التشغيلية — معالجة مباشرة بنداء AI واحد (بدون حلقة وكيل)
      let operationalResult = null;
      if (['operational_plan'].includes(a.category) && extracted.text?.length > 100) {
        operationalResult = await processOperationalPlan({
          text:     extracted.text,
          filename,
          userId:   createdById,
        });
      }

      return {
        ok: true, filename,
        analysis: a,
        stored,
        operationalResult,
        textLength: extracted.text?.length || 0,
      };
    } catch (e) {
      return { ok: false, filename, error: e.message };
    } finally {
      await unlink(namedPath).catch(() => unlink(tmpPath).catch(() => {}));
    }
  }));

  // ── بناء رسالة موحَّدة ────────────────────────────────────────────────────
  const succeeded = fileResults.filter(r => r.ok);
  const failed    = fileResults.filter(r => !r.ok);

  const lines = [`📦 **معالجة ${files.length} ملف${files.length > 1 ? 'ات' : ''}**\n`];

  for (const r of succeeded) {
    const a = r.analysis;
    lines.push(`📎 **${r.filename}** — ${a.category || '—'}`);
    lines.push(`   ${a.summary || ''}`);

    // الأهداف الاستراتيجية
    if (r.stored?.success && r.stored.count > 0) {
      lines.push(`   ✅ أُنشئ ${r.stored.count} هدف استراتيجي:`);
      (r.stored.goals || []).filter(g => !g.skipped).forEach(g => lines.push(`      • ${g.code} — ${g.title}`));
      if (r.stored.skipped > 0) lines.push(`      ℹ️ ${r.stored.skipped} موجود مسبقاً`);
    } else if (r.stored?.success) {
      lines.push(`   ✅ ${r.stored.code} — ${r.stored.title}`);
    }

    // الأنشطة والأهداف التشغيلية (معالجة مباشرة)
    const op = r.operationalResult;
    if (op) {
      if (op.activities?.length) {
        lines.push(`   ✅ أُنشئ ${op.activities.length} نشاط تشغيلي:`);
        op.activities.forEach(a => lines.push(`      • ${a.code} — ${a.title}`));
      }
      if (op.objectives?.length) {
        lines.push(`   ✅ أُنشئ ${op.objectives.length} هدف تشغيلي:`);
        op.objectives.forEach(o => lines.push(`      • ${o.code} — ${o.title}`));
      }
      if (op.summary) lines.push(`   📋 ${op.summary}`);
    }

    if (a.notes) lines.push(`   ⚠️ ${a.notes}`);
    lines.push('');
  }
  for (const r of failed) {
    lines.push(`❌ **${r.filename}** — ${r.error}`);
  }

  // عدد ما أُنشئ إجمالاً
  const totalCreated = succeeded.reduce((s, r) => {
    let n = r.stored?.count || (r.stored?.success ? 1 : 0);
    if (r.operationalResult) {
      n += (r.operationalResult.activities?.length || 0);
      n += (r.operationalResult.objectives?.length || 0);
    }
    return s + n;
  }, 0);

  res.json({
    ok:          true,
    total:       files.length,
    succeeded:   succeeded.length,
    failed:      failed.length,
    totalCreated,
    files:       fileResults,
    chatMessage: lines.join('\n').trim(),
  });
}));

// ── POST /apply (legacy) ──────────────────────────────────────────────────────
router.post('/apply', authorize(...ROLES), asyncHandler(async (req, res) => {
  const { actions } = req.body || {};
  if (!Array.isArray(actions) || actions.length === 0) {
    throw BadRequest('actions: مصفوفة غير فارغة مطلوبة');
  }
  if (actions.length > 50) throw BadRequest('أكثر من 50 إجراء غير مسموح');

  const callerUserId = req.user?.sub || req.user?.id;
  const results = await applyActions(actions, callerUserId);
  const ok      = results.filter(r => r.ok).length;
  const failed  = results.length - ok;

  res.json({ ok: true, results, summary: { total: results.length, ok, failed } });
}));

export default router;
