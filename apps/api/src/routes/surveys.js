import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { nextCode } from '../utils/codeGen.js';
import { config } from '../config.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

// Validate questionsJson: must be parseable JSON array with {key,label,type}
// تطبيع يتسامح مع المفاتيح القديمة (id/text/RATING) — انظر publicSurvey.js
function validateQuestions(raw) {
  if (!raw) throw BadRequest('مطلوب إضافة الأسئلة للاستبيان');
  let arr;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw BadRequest('صياغة الأسئلة غير صحيحة (يجب أن تكون JSON)');
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw BadRequest('يجب أن يحتوي الاستبيان على سؤال واحد على الأقل');
  }
  if (arr.length > 50) {
    throw BadRequest('الحد الأقصى 50 سؤالاً لكل استبيان');
  }
  const keys = new Set();
  const normalized = arr.map((q, i) => {
    const key = String(q.key || q.id || `q${i + 1}`).trim();
    const label = String(q.label || q.text || q.question || q.q || q.title || '').trim();
    const legacyScale = q.scale || q.max || q.ratingScale;
    const type = String(q.type || (legacyScale ? 'rating' : 'text')).toLowerCase();
    if (!label) throw BadRequest(`السؤال رقم ${i + 1} بدون نص`);
    if (!['rating', 'text', 'yesno'].includes(type)) {
      throw BadRequest(`نوع السؤال ${i + 1} غير مدعوم (المسموح: rating, text, yesno)`);
    }
    if (keys.has(key)) {
      throw BadRequest(`معرّف السؤال "${key}" مكرَّر — يجب أن يكون المعرّف فريداً`);
    }
    keys.add(key);
    return { key, label, type, required: !!q.required };
  });
  return JSON.stringify(normalized);
}

// ── Smart filter chips للاستبيانات ─────────────────────────────
// Pure predicates — تُختبَر في tests/surveysSmartFilters.test.js
const DAY_MS = 86400000;
export const SURVEY_SMART_FILTERS = {
  active:           (s) => s.active === true,
  inactive:         (s) => s.active === false,
  withResponses:    (s) => (s.responses || 0) > 0,
  noResponses:      (s) => (s.responses || 0) === 0,
  highSatisfaction: (s) => s.avgScore != null && s.avgScore >= 4 && (s.responses || 0) > 0,
  lowSatisfaction:  (s) => s.avgScore != null && s.avgScore < 3 && (s.responses || 0) > 0,
  recent:           (s) => s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) < 30 * DAY_MS,
  stale:            (s) =>
    s.active === true
    && s.createdAt
    && (Date.now() - new Date(s.createdAt).getTime()) > 60 * DAY_MS
    && (s.responses || 0) === 0,
};

function applySurveyQuick(items, quickCsv) {
  const keys = String(quickCsv || '').split(',').map(x => x.trim()).filter(Boolean);
  let out = items;
  for (const key of keys) {
    const fn = SURVEY_SMART_FILTERS[key];
    if (fn) out = out.filter(fn);
  }
  return out;
}

function computeSurveyCounts(items) {
  const counts = {};
  for (const [key, fn] of Object.entries(SURVEY_SMART_FILTERS)) {
    try { counts[key] = items.filter(fn).length; } catch { counts[key] = 0; }
  }
  return counts;
}

const SURVEY_EXECUTION_STATUSES = new Set(['DRAFT', 'READY', 'IN_PROGRESS', 'CLOSED']);
const SURVEY_CHANNELS = new Set(['WHATSAPP', 'SMS', 'EMAIL', 'FIELD', 'LINK', 'MIXED']);

function asNullableDate(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw BadRequest(`${fieldName} غير صالح`);
  return date;
}

function asNullableInt(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw BadRequest(`${fieldName} يجب أن يكون رقماً صحيحاً موجباً`);
  return n;
}

function rejectCorruptedArabicText(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('���') || /\?{5,}/.test(text)) {
    throw BadRequest(`${fieldName} يبدو غير مقروء بسبب مشكلة ترميز، أعد إدخاله من الواجهة أو أرسله بترميز UTF-8`);
  }
  return text;
}

function cleanSurveyPayload(body, { create = false } = {}) {
  const data = {};
  if (create || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw BadRequest('عنوان الاستبيان مطلوب');
    data.title = title;
  }
  if (create || body.target !== undefined) data.target = body.target;
  if (body.period !== undefined) data.period = body.period ? String(body.period).trim() : null;
  if (body.active !== undefined) data.active = !!body.active;
  if (body.isPublic !== undefined) data.isPublic = !!body.isPublic;
  if (body.questionsJson !== undefined || create) data.questionsJson = validateQuestions(body.questionsJson);

  if (body.ownerId !== undefined) data.ownerId = body.ownerId || null;
  if (body.audienceNote !== undefined) data.audienceNote = rejectCorruptedArabicText(body.audienceNote, 'وصف الجمهور أو طريقة الإرسال');
  if (body.channel !== undefined) {
    const channel = body.channel ? String(body.channel).toUpperCase() : null;
    if (channel && !SURVEY_CHANNELS.has(channel)) throw BadRequest('قناة تنفيذ الاستبيان غير مدعومة');
    data.channel = channel;
  }
  if (body.executionStatus !== undefined) {
    const status = body.executionStatus ? String(body.executionStatus).toUpperCase() : 'DRAFT';
    if (!SURVEY_EXECUTION_STATUSES.has(status)) throw BadRequest('حالة تنفيذ الاستبيان غير مدعومة');
    data.executionStatus = status;
  }
  const plannedStartAt = asNullableDate(body.plannedStartAt, 'تاريخ بداية التنفيذ');
  if (plannedStartAt !== undefined) data.plannedStartAt = plannedStartAt;
  const plannedEndAt = asNullableDate(body.plannedEndAt, 'تاريخ نهاية التنفيذ');
  if (plannedEndAt !== undefined) data.plannedEndAt = plannedEndAt;
  const targetResponses = asNullableInt(body.targetResponses, 'عدد الردود المستهدف');
  if (targetResponses !== undefined) data.targetResponses = targetResponses;

  return data;
}

// LIST — مع دعم Smart Filters (?quick=active,highSatisfaction) + counts
router.get('/', requireAction('surveys', 'read'), asyncHandler(async (req, res) => {
  const baseUrl = config.appUrl.replace(/\/$/, '');
  const items = await prisma.survey.findMany({
    where: { deletedAt: null },
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // counts قبل التمرير (للـ UI chips)
  const counts = { total: items.length, ...computeSurveyCounts(items) };
  const filtered = applySurveyQuick(items, req.query.quick);

  const out = filtered.map(s => ({ ...s, publicUrl: `${baseUrl}/survey/${s.id}` }));
  res.json({
    ok: true, items: out, total: out.length,
    counts, activeQuick: String(req.query.quick || '').split(',').filter(Boolean),
  });
}));

// GET
router.get('/:id', requireAction('surveys', 'read'), asyncHandler(async (req, res) => {
  const item = await prisma.survey.findUnique({
    where: { id: req.params.id, deletedAt: null },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!item) throw NotFound();
  const baseUrl = config.appUrl.replace(/\/$/, '');
  res.json({ ok: true, item: { ...item, publicUrl: `${baseUrl}/survey/${item.id}` } });
}));

// CREATE
router.post('/', requireAction('surveys', 'create'), asyncHandler(async (req, res) => {
  const data = cleanSurveyPayload(req.body, { create: true });
  if (!data.code) data.code = await nextCode('survey', 'SRV');
  const item = await prisma.survey.create({ data });
  res.status(201).json({ ok: true, item });
}));

// UPDATE
router.put('/:id', requireAction('surveys', 'update'), asyncHandler(async (req, res) => {
  const data = cleanSurveyPayload(req.body);
  const item = await prisma.survey.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, item });
}));

router.patch('/:id', requireAction('surveys', 'update'), asyncHandler(async (req, res) => {
  const data = cleanSurveyPayload(req.body);
  const item = await prisma.survey.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, item });
}));

// DELETE — يُمنع حذف استبيان بعد وجود ردود (أثر رقابي ISO §7.5)
router.delete('/:id', requireAction('surveys', 'delete'), asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id }, select: { responses: true } });
  if (!s) throw NotFound();
  if ((s.responses || 0) > 0) {
    throw BadRequest('لا يمكن حذف استبيان يحتوي على ردود — عطّله بدل ذلك (active=false)');
  }
  await prisma.survey.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ─── Helpers ───────────────────────────────────────────────

/**
 * يُحمِّل ردود الاستبيان من جدول SurveyResponse.
 * يُرجع مصفوفة بنفس شكل العناصر القديمة (at, respondentName, answers)
 * حتى لا يحتاج كود الإحصاء أدناه إلى أي تغيير.
 * idHash مستبعد عمداً — لا يُكشَف في API.
 */
async function loadResponses(surveyId) {
  const rows = await prisma.surveyResponse.findMany({
    where:   { surveyId },
    orderBy: { submittedAt: 'asc' },
    select:  { submittedAt: true, respondentName: true, answersJson: true },
  });
  return rows.map(r => ({
    at:             r.submittedAt.toISOString(),
    respondentName: r.respondentName,
    answers:        JSON.parse(r.answersJson || '{}'),
  }));
}

export function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Net Promoter Score من سؤال rating 1-5:
 *  Promoters = 5، Passives = 4، Detractors ≤ 3 → NPS = %P - %D (مقياس 1-5 تقريبي) */
export function computeNps(scores) {
  if (!scores.length) return null;
  const promoters  = scores.filter(s => s === 5).length;
  const detractors = scores.filter(s => s <= 3).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

// Summary endpoint — parsed results + stats (Batch 15: نضج الاستبيانات)
router.get('/:id/summary', requireAction('surveys', 'read'), asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) throw NotFound();
  const questions = JSON.parse(s.questionsJson || '[]');
  const responses = await loadResponses(s.id);

  // Compute per-question stats (مع توزيع + نسب + وسيط)
  const stats = questions.map(q => {
    if (q.type === 'rating') {
      const scores = responses.map(r => Number(r.answers?.[q.key])).filter(Number.isFinite);
      if (!scores.length) return { ...q, responsesCount: 0, avgScore: null };
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const s of scores) if (distribution[s] != null) distribution[s]++;
      return {
        ...q,
        responsesCount: scores.length,
        avgScore:       Math.round(avg * 100) / 100,
        median:         median(scores),
        min:            Math.min(...scores),
        max:            Math.max(...scores),
        distribution,
        nps:            computeNps(scores),
        satisfactionPct: Math.round(scores.filter(s => s >= 4).length / scores.length * 100),
      };
    }
    if (q.type === 'yesno') {
      const ys = responses.filter(r => r.answers?.[q.key] === 'yes').length;
      const ns = responses.filter(r => r.answers?.[q.key] === 'no').length;
      const total = ys + ns;
      return { ...q, yes: ys, no: ns, yesPct: total ? Math.round(ys / total * 100) : null };
    }
    return { ...q, textAnswers: responses.map(r => r.answers?.[q.key]).filter(Boolean).slice(0, 50) };
  });

  // اتجاه زمني (شهري) للـ avgScore الإجمالي (يُفيد مراجعة الإدارة — ISO 9.3)
  const byMonth = new Map();
  for (const r of responses) {
    const month = (r.at || '').slice(0, 7); // YYYY-MM
    if (!month) continue;
    let sum = 0, cnt = 0;
    for (const q of questions) {
      if (q.type !== 'rating') continue;
      const v = Number(r.answers?.[q.key]);
      if (Number.isFinite(v)) { sum += v; cnt++; }
    }
    if (!cnt) continue;
    const cur = byMonth.get(month) || { sum: 0, cnt: 0 };
    cur.sum += sum; cur.cnt += cnt;
    byMonth.set(month, cur);
  }
  const trend = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, avgScore: +(v.sum / v.cnt).toFixed(2), samples: v.cnt }));

  // مقياس NPS الإجمالي (كل أسئلة rating مجتمعة)
  const allRatings = [];
  for (const r of responses) {
    for (const q of questions) {
      if (q.type !== 'rating') continue;
      const v = Number(r.answers?.[q.key]);
      if (Number.isFinite(v)) allRatings.push(v);
    }
  }

  res.json({
    ok: true,
    survey: s,
    stats,
    totalResponses: responses.length,
    trend,
    overallNps: computeNps(allRatings),
    overallAvg: allRatings.length ? +(allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2) : null,
    satisfactionPct: allRatings.length
      ? Math.round(allRatings.filter(s => s >= 4).length / allRatings.length * 100)
      : null,
  });
}));

// ─── CSV export — للتحليل الخارجي (ISO 9.1.3) ─────────────────
function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/:id/export.csv', requireAction('surveys', 'read'), asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) throw NotFound();
  const questions = JSON.parse(s.questionsJson || '[]');
  const responses = await loadResponses(s.id);

  const header = ['at', 'respondentName', ...questions.map(q => q.key)];
  const rows = [header.join(',')];
  for (const r of responses) {
    const row = [
      r.at || '',
      r.respondentName || '',
      ...questions.map(q => escapeCsv(r.answers?.[q.key] ?? '')),
    ];
    rows.push(row.map(escapeCsv).join(','));
  }
  const csv = '\uFEFF' + rows.join('\r\n'); // BOM لدعم Excel العربي
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${s.code || s.id}-responses.csv"`);
  res.send(csv);
}));

export default router;
