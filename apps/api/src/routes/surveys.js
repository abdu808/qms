import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { nextCode } from '../utils/codeGen.js';
import { config } from '../config.js';

const router = Router();

// Validate questionsJson: must be parseable JSON array with {key,label,type}
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
  for (const [i, q] of arr.entries()) {
    if (!q.key || !q.label || !q.type) {
      throw BadRequest(`السؤال رقم ${i + 1} ينقصه (key/label/type)`);
    }
    if (!['rating', 'text', 'yesno'].includes(q.type)) {
      throw BadRequest(`نوع السؤال ${i + 1} غير مدعوم`);
    }
  }
  return JSON.stringify(arr);
}

// LIST
router.get('/', asyncHandler(async (req, res) => {
  const baseUrl = config.appUrl.replace(/\/$/, '');
  const items = await prisma.survey.findMany({ orderBy: { createdAt: 'desc' } });
  const out = items.map(s => ({ ...s, publicUrl: `${baseUrl}/survey/${s.id}` }));
  res.json({ ok: true, items: out, total: out.length });
}));

// GET
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!item) throw NotFound();
  const baseUrl = config.appUrl.replace(/\/$/, '');
  res.json({ ok: true, item: { ...item, publicUrl: `${baseUrl}/survey/${item.id}` } });
}));

// CREATE
router.post('/', asyncHandler(async (req, res) => {
  const data = { ...req.body };
  data.questionsJson = validateQuestions(data.questionsJson);
  if (!data.code) data.code = await nextCode('survey', 'SRV');
  const item = await prisma.survey.create({ data });
  res.status(201).json({ ok: true, item });
}));

// UPDATE
router.put('/:id', asyncHandler(async (req, res) => {
  const data = { ...req.body };
  delete data.id; delete data.createdAt; delete data.code;
  delete data.responses; delete data.avgScore; delete data.resultsJson;
  if (data.questionsJson) data.questionsJson = validateQuestions(data.questionsJson);
  const item = await prisma.survey.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, item });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const data = { ...req.body };
  delete data.id; delete data.createdAt; delete data.code;
  delete data.responses; delete data.avgScore; delete data.resultsJson;
  if (data.questionsJson) data.questionsJson = validateQuestions(data.questionsJson);
  const item = await prisma.survey.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, item });
}));

// DELETE
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.survey.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// Summary endpoint — parsed results + stats
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) throw NotFound();
  const questions = JSON.parse(s.questionsJson || '[]');
  const responses = JSON.parse(s.resultsJson || '[]');

  // Compute per-question stats
  const stats = questions.map(q => {
    if (q.type === 'rating') {
      const scores = responses.map(r => Number(r.answers?.[q.key])).filter(Number.isFinite);
      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { ...q, responsesCount: scores.length, avgScore: avg ? Math.round(avg * 100) / 100 : null };
    }
    if (q.type === 'yesno') {
      const ys = responses.filter(r => r.answers?.[q.key] === 'yes').length;
      const ns = responses.filter(r => r.answers?.[q.key] === 'no').length;
      return { ...q, yes: ys, no: ns };
    }
    return { ...q, textAnswers: responses.map(r => r.answers?.[q.key]).filter(Boolean).slice(0, 50) };
  });

  res.json({ ok: true, survey: s, stats, totalResponses: responses.length });
}));

export default router;
