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
import { unlink }   from 'fs/promises';
import { asyncHandler }  from '../utils/asyncHandler.js';
import { authorize }     from '../middleware/auth.js';
import { BadRequest }    from '../utils/errors.js';
import { buildContext, chat, applyActions, getAiAgentUserIdInternal } from '../services/consultantAgent.js';
import { applyPendingActions } from '../services/aiAgent/loop.js';
import { extractText, SUPPORTED_EXTENSIONS } from '../../scripts/ingest/extractors.mjs';
import { analyzeFile }   from '../../scripts/ingest/analyzer.mjs';
import { uploadItem, getAdminUserId } from '../../scripts/ingest/uploader.mjs';

const router = Router();
const ROLES  = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

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

// ── POST /chat ────────────────────────────────────────────────────────────────
router.post('/chat', authorize(...ROLES), asyncHandler(async (req, res) => {
  const { messages, mode = 'auto' } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    throw BadRequest('messages: مصفوفة غير فارغة مطلوبة');
  }
  if (!['auto', 'review'].includes(mode)) {
    throw BadRequest('mode يجب أن يكون auto أو review');
  }

  for (const m of messages) {
    if (!m || typeof m !== 'object') throw BadRequest('كل رسالة يجب أن تكون كائناً');
    if (!['user', 'assistant'].includes(m.role)) throw BadRequest('role: user أو assistant فقط');
    if (typeof m.content !== 'string' || !m.content.trim()) throw BadRequest('content مطلوب');
    if (m.content.length > 100_000) throw BadRequest('رسالة طويلة جداً (الحد 100,000 حرف)');
  }

  const callerUserId = req.user?.sub || req.user?.id;

  try {
    const out = await chat({ messages, callerUserId, mode });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message, code: e.code });
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

      // 1️⃣ استخراج النص
      const extracted = await extractText(namedPath);

      // كشف PDF ممسوح ضوئياً — لا فائدة من التحليل
      if (extracted.scanned) {
        return {
          ok: false,
          filename,
          error: extracted.warning,
          scanned: true,
        };
      }

      // 2️⃣ تحليل AI
      const analyzed = await analyzeFile({
        filename,
        folder: 'consultant-upload',
        text:   extracted.text,
        kind:   extracted.kind || ext.replace('.', ''),
      });
      const a = analyzed.analysis;

      // 3️⃣ إنشاء السجلات
      const shouldStore = ['StrategicGoal', 'QualityPolicy', 'Announcement', 'Document'].includes(a.suggestedModule);
      let stored = null;
      if (shouldStore) {
        stored = await uploadItem(
          { filename, folder: 'consultant-upload', filePath: null, analysis: a, textPreview: extracted.text?.slice(0, 3000) },
          createdById,
        );
      }

      return {
        ok: true, filename,
        analysis: a,
        stored,
        textLength: extracted.text?.length || 0,
        // لا نُرجع النص الكامل للفرونت-إند — السجلات أُنشئت في DB
        // والمستشار يقرأها مباشرةً عبر get_system_state (أكفأ وأخف على الشبكة)
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
    if (r.stored?.success && r.stored.count > 0) {
      lines.push(`   ✅ أُنشئ ${r.stored.count} هدف استراتيجي:`);
      (r.stored.goals || []).filter(g => !g.skipped).forEach(g => lines.push(`      • ${g.code} — ${g.title}`));
      if (r.stored.skipped > 0) lines.push(`      ℹ️ ${r.stored.skipped} موجود مسبقاً`);
    } else if (r.stored?.success) {
      lines.push(`   ✅ ${r.stored.code} — ${r.stored.title}`);
    }
    if (a.notes) lines.push(`   ⚠️ ${a.notes}`);
    lines.push('');
  }
  for (const r of failed) {
    lines.push(`❌ **${r.filename}** — ${r.error}`);
  }

  // عدد ما أُنشئ إجمالاً
  const totalCreated = succeeded.reduce((s, r) => s + (r.stored?.count || (r.stored?.success ? 1 : 0)), 0);

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
