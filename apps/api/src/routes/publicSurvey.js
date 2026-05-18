import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeHtml } from '../utils/html.js';

const router = Router();

const TARGET_LABELS = {
  BENEFICIARY: 'المستفيدين',
  DONOR: 'المتبرعين',
  VOLUNTEER: 'المتطوعين',
  EMPLOYEE: 'الموظفين',
  PARTNER: 'الشركاء',
};

// GET /survey/:id - render public survey form
router.get('/:id', asyncHandler(async (req, res) => {
  const survey = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!survey) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!survey.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const questions = parseQuestions(survey.questionsJson);
  res.send(formPage(survey, questions));
}));

// POST /survey/:id - submit response
router.post('/:id', asyncHandler(async (req, res) => {
  const survey = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!survey) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!survey.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const questions = parseQuestions(survey.questionsJson);

  // Prevent noisy duplicate submissions from the same browser within one hour.
  const ipKey = (req.ip || '') + '|' + (req.headers['user-agent'] || '');
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
  const duplicate = await prisma.surveyResponse.findFirst({
    where: { surveyId: survey.id, idHash: ipKey, submittedAt: { gte: ONE_HOUR_AGO } },
    select: { id: true },
  });
  if (duplicate) {
    return res.status(429).send(errorPage('تم استلام مشاركة قريبة من نفس الجهاز. يمكن إعادة المحاولة لاحقاً عند الحاجة.'));
  }

  const answers = {};
  const missing = [];
  for (const q of questions) {
    const rawValue = req.body[q.key];
    const isEmpty = rawValue === undefined || rawValue === '' || rawValue === null;
    if (isEmpty) {
      if (q.required) missing.push(q.label);
      continue;
    }

    if (q.type === 'rating') {
      const n = Math.max(1, Math.min(5, Number(rawValue) || 0));
      answers[q.key] = n;
    } else if (q.type === 'yesno') {
      answers[q.key] = rawValue === 'yes' || rawValue === 'نعم' ? 'yes' : 'no';
    } else {
      answers[q.key] = String(rawValue).trim().slice(0, 5000);
    }
  }

  if (missing.length) {
    return res.status(400).send(errorPage('يرجى الإجابة عن: ' + missing.join('، ')));
  }

  const respondentName = (req.body.respondentName || '').toString().trim().slice(0, 100) || null;

  await prisma.$transaction(async (tx) => {
    await tx.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentName,
        answersJson: JSON.stringify(answers),
        idHash: ipKey,
      },
    });

    const rows = await tx.surveyResponse.findMany({
      where: { surveyId: survey.id },
      select: { answersJson: true },
    });

    let ratingSum = 0;
    let ratingCount = 0;
    for (const row of rows) {
      const rowAnswers = JSON.parse(row.answersJson || '{}');
      for (const q of scoreQuestions(questions)) {
        const value = Number(rowAnswers[q.key]);
        if (Number.isFinite(value)) {
          const weight = q.weight || 1;
          ratingSum += value * weight;
          ratingCount += weight;
        }
      }
    }

    await tx.survey.update({
      where: { id: survey.id },
      data: {
        responses: rows.length,
        avgScore: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : null,
      },
    });
  });

  res.send(successPage(survey));
}));

function parseQuestions(rawJson) {
  let raw = [];
  try {
    raw = JSON.parse(rawJson || '[]');
  } catch {
    raw = [];
  }
  return raw.map(normalizeQuestion).filter(q => q.label);
}

function normalizeQuestion(raw, idx) {
  const legacyScale = raw.scale || raw.max || raw.ratingScale;
  const type = String(raw.type || (legacyScale ? 'rating' : 'text')).toLowerCase();
  const normalizedType = ['rating', 'yesno', 'text'].includes(type) ? type : 'text';
  const contributesToScore = normalizedType === 'rating'
    && (raw.contributesToScore === undefined && raw.scoreQuestion === undefined && raw.includeInScore === undefined
      ? true
      : raw.contributesToScore === true || raw.scoreQuestion === true || raw.includeInScore === true);
  return {
    key: String(raw.key || raw.id || `q${idx + 1}`).trim(),
    label: String(raw.label || raw.text || raw.question || raw.q || raw.title || '').trim(),
    type: normalizedType,
    required: raw.required === undefined ? type === 'rating' : !!raw.required,
    contributesToScore,
    metricType: String(raw.metricType || raw.dimension || raw.category || (normalizedType === 'rating' ? 'SATISFACTION' : 'INFO')).toUpperCase(),
    weight: Number.isFinite(Number(raw.weight)) && Number(raw.weight) > 0 ? Number(raw.weight) : 1,
  };
}

function scoreQuestions(questions) {
  return questions.filter(q => q.type === 'rating' && q.contributesToScore !== false);
}

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f7f4;direction:rtl;color:#15251d;min-height:100vh;padding:24px 12px}
    .wrap{width:100%;max-width:720px;margin:auto}
    .card{background:#fff;border:1px solid #dfe9e3;border-radius:18px;box-shadow:0 16px 40px rgba(21,37,29,.08);overflow:hidden}
    .header{background:linear-gradient(135deg,#176b3a,#2e8b57);color:#fff;padding:26px 30px}
    .brand{font-size:.82rem;opacity:.9;margin-bottom:10px}
    h1{font-size:1.45rem;line-height:1.45;margin:0 0 8px}
    .subtitle{font-size:.92rem;opacity:.92;line-height:1.7}
    .intro{background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;border-radius:14px;padding:12px 14px;margin-bottom:18px;font-size:.9rem;line-height:1.8}
    .body{padding:24px 30px}
    .field-group{margin-bottom:18px}
    .field-lbl,.qlabel{display:block;font-weight:700;margin-bottom:8px;color:#22352b;font-size:.95rem}
    .hint{color:#64748b;font-size:.78rem;margin-top:4px}
    input[type=text],textarea{width:100%;border:1.5px solid #cfded5;border-radius:12px;padding:12px 14px;font-size:.95rem;font-family:inherit;direction:rtl;background:#fff}
    input[type=text]:focus,textarea:focus{outline:none;border-color:#2e8b57;box-shadow:0 0 0 3px rgba(46,139,87,.12)}
    .question{background:#fbfdfb;border:1px solid #e3ece7;border-radius:14px;padding:15px;margin-bottom:13px}
    .required{color:#dc2626}
    .rating{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .choice{position:relative}
    .choice input{position:absolute;opacity:0}
    .choice span{display:block;text-align:center;padding:10px 8px;border:1.5px solid #cfded5;border-radius:12px;background:#fff;cursor:pointer;font-weight:800;color:#31513d;transition:.15s}
    .choice input:checked + span{background:#2e8b57;color:#fff;border-color:#2e8b57}
    .yesno{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .submit-btn{width:100%;background:#176b3a;color:#fff;border:none;padding:15px;border-radius:13px;font-size:1rem;font-weight:800;cursor:pointer;margin-top:8px}
    .submit-btn:hover{background:#145c32}
    .footer{text-align:center;font-size:.78rem;color:#64748b;padding:16px;border-top:1px solid #edf2ef;background:#fbfdfb}
    .status{padding:42px 30px;text-align:center}
    .status h1{color:#166534}
    @media(max-width:560px){.body,.header{padding:20px 16px}.rating{grid-template-columns:1fr}.yesno{grid-template-columns:1fr}}
  </style>
`;

function renderQuestion(raw, idx) {
  const q = normalizeQuestion(raw, idx);
  const label = escapeHtml(q.label) || `سؤال ${idx + 1}`;
  const key = escapeHtml(q.key);
  const req = q.required ? '<span class="required">*</span>' : '';
  const reqAttr = q.required ? 'required' : '';

  if (q.type === 'rating') {
    const labels = ['ضعيف', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];
    return `<div class="question">
      <div class="qlabel">${label} ${req}</div>
      <div class="rating">
        ${[1, 2, 3, 4, 5].map((n, i) => `
          <label class="choice">
            <input type="radio" name="${key}" value="${n}" ${reqAttr && n === 1 ? 'required' : ''}>
            <span>${n}<br><small>${labels[i]}</small></span>
          </label>
        `).join('')}
      </div>
    </div>`;
  }

  if (q.type === 'yesno') {
    return `<div class="question">
      <div class="qlabel">${label} ${req}</div>
      <div class="yesno">
        <label class="choice"><input type="radio" name="${key}" value="yes" ${reqAttr}><span>نعم</span></label>
        <label class="choice"><input type="radio" name="${key}" value="no"><span>لا</span></label>
      </div>
    </div>`;
  }

  return `<div class="question">
    <div class="qlabel">${label} ${req}</div>
    <textarea name="${key}" rows="3" maxlength="5000" placeholder="اكتب إجابتك باختصار..." ${reqAttr}
      oninput="this.nextElementSibling.textContent = this.value.length + ' / 5000 حرف'"></textarea>
    <div class="hint" style="text-align:left">0 / 5000 حرف</div>
  </div>`;
}

function formPage(survey, questions) {
  const target = escapeHtml(TARGET_LABELS[survey.target] || survey.target);
  const title = escapeHtml(survey.title);
  const period = escapeHtml(survey.period || '');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}<title>${title}</title></head>
  <body>
    <main class="wrap">
      <section class="card">
        <header class="header">
          <div class="brand">جمعية البر بصبيا - قياس رضا وتحسين خدمة</div>
          <h1>${title}</h1>
          <div class="subtitle">الفئة المستهدفة: ${target}${period ? ` - ${period}` : ''}</div>
        </header>
        <div class="body">
          <div class="intro">مشاركتك تساعدنا على تحسين الخدمة. الإجابات تستخدم لأغراض الجودة والتحسين، ويمكن ترك الاسم فارغاً.</div>
          <form method="POST">
            <div class="field-group">
              <label class="field-lbl">الاسم (اختياري)</label>
              <input type="text" name="respondentName" placeholder="يمكن ترك الاسم فارغاً">
              <div class="hint">لا نطلب أي بيانات حساسة داخل هذا النموذج.</div>
            </div>
            ${questions.map((q, i) => renderQuestion(q, i)).join('')}
            <button type="submit" class="submit-btn">إرسال المشاركة</button>
          </form>
        </div>
        <footer class="footer">شكراً لمساهمتك في تحسين خدمات جمعية البر بصبيا</footer>
      </section>
    </main>
  </body></html>`;
}

function successPage(survey) {
  const title = escapeHtml(survey.title);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}<title>تم الإرسال</title></head>
  <body>
    <main class="wrap">
      <section class="card">
        <header class="header"><div class="brand">جمعية البر بصبيا</div><h1>تم استلام مشاركتك</h1></header>
        <div class="status">
          <h1>شكراً لك</h1>
          <p>تم حفظ إجابتك على: <strong>${title}</strong></p>
          <p class="hint">رأيك يساعدنا على تحسين الخدمة واتخاذ قرارات أفضل.</p>
        </div>
        <footer class="footer">يمكنك إغلاق هذه الصفحة الآن</footer>
      </section>
    </main>
  </body></html>`;
}

function errorPage(message) {
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}<title>تعذر الإرسال</title></head>
  <body>
    <main class="wrap">
      <section class="card">
        <header class="header" style="background:linear-gradient(135deg,#991b1b,#dc2626)"><h1>تعذر إكمال الطلب</h1></header>
        <div class="status">
          <h1 style="color:#991b1b">${safeMessage}</h1>
          <p class="hint">يمكنك المحاولة لاحقاً أو التواصل مع الجمعية عند الحاجة.</p>
        </div>
      </section>
    </main>
  </body></html>`;
}

export default router;
