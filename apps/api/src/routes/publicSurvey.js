import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const TARGET_LABELS = {
  BENEFICIARY: 'المستفيدين',
  DONOR: 'المتبرعين',
  VOLUNTEER: 'المتطوعين',
  EMPLOYEE: 'الموظفين',
  PARTNER: 'الشركاء',
};

// GET /survey/:id — render public survey form
router.get('/:id', asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!s.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const questions = JSON.parse(s.questionsJson || '[]');
  res.send(formPage(s, questions));
}));

// POST /survey/:id — submit response
router.post('/:id', asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!s.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const questions = JSON.parse(s.questionsJson || '[]');
  const existing = JSON.parse(s.resultsJson || '[]');

  // Build answers object from body
  const answers = {};
  let ratingSum = 0;
  let ratingCount = 0;
  for (const q of questions) {
    const v = req.body[q.key];
    if (v === undefined || v === '') continue;
    if (q.type === 'rating') {
      const n = Math.max(1, Math.min(5, Number(v) || 0));
      answers[q.key] = n;
      ratingSum += n;
      ratingCount++;
    } else if (q.type === 'yesno') {
      answers[q.key] = v === 'yes' || v === 'نعم' ? 'yes' : 'no';
    } else {
      answers[q.key] = String(v).trim().slice(0, 500);
    }
  }

  const response = {
    at: new Date().toISOString(),
    respondentName: (req.body.respondentName || '').toString().trim().slice(0, 100) || null,
    answers,
  };
  existing.push(response);

  // Recompute avg score across all responses' rating questions
  let totalRatingSum = 0;
  let totalRatingCount = 0;
  for (const r of existing) {
    for (const q of questions) {
      if (q.type === 'rating' && Number.isFinite(Number(r.answers?.[q.key]))) {
        totalRatingSum += Number(r.answers[q.key]);
        totalRatingCount++;
      }
    }
  }
  const avgScore = totalRatingCount > 0 ? Math.round((totalRatingSum / totalRatingCount) * 100) / 100 : null;

  await prisma.survey.update({
    where: { id: s.id },
    data: {
      resultsJson: JSON.stringify(existing),
      responses: existing.length,
      avgScore,
    },
  });

  res.send(successPage(s));
}));

// ─── HTML templates ────────────────────────────────────────────────────────

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#eff8fe;direction:rtl;color:#1a1a1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 10px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:100%;max-width:640px;overflow:hidden}
    .header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:24px 28px}
    .header h1{font-size:1.3rem;margin-bottom:4px}
    .header p{opacity:.9;font-size:.9rem}
    .body{padding:24px 28px}
    .question{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px}
    .qlabel{font-weight:600;margin-bottom:10px;color:#1e293b;font-size:.95rem}
    .rating{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .rating label{cursor:pointer;padding:10px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:600;transition:.15s}
    .rating input{display:none}
    .rating label:has(input:checked){background:#3b82f6;color:#fff;border-color:#3b82f6}
    textarea,input[type=text]{width:100%;border:1.5px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:.95rem;font-family:inherit;direction:rtl}
    textarea:focus,input:focus{outline:none;border-color:#3b82f6}
    .yesno{display:flex;gap:10px}
    .yesno label{flex:1;text-align:center;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;cursor:pointer;font-weight:600}
    .yesno input{display:none}
    .yesno label:has(input:checked){background:#3b82f6;color:#fff;border-color:#3b82f6}
    .submit-btn{width:100%;background:#1e40af;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px}
    .submit-btn:hover{background:#1e3a8a}
    .footer{text-align:center;font-size:.75rem;color:#9ca3af;padding:16px;border-top:1px solid #f3f4f6}
    .field-group{margin-bottom:16px}
    label.field-lbl{display:block;font-weight:600;margin-bottom:6px;font-size:.9rem;color:#374151}
    .icon{font-size:3rem;margin-bottom:12px}
  </style>
`;

function renderQuestion(q) {
  if (q.type === 'rating') {
    const scale = [1, 2, 3, 4, 5];
    return `<div class="question">
      <div class="qlabel">${q.label}</div>
      <div class="rating">
        ${scale.map(n => `<label><input type="radio" name="${q.key}" value="${n}"><span>${'⭐'.repeat(n)} ${n}</span></label>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'yesno') {
    return `<div class="question">
      <div class="qlabel">${q.label}</div>
      <div class="yesno">
        <label><input type="radio" name="${q.key}" value="yes">✅ نعم</label>
        <label><input type="radio" name="${q.key}" value="no">❌ لا</label>
      </div>
    </div>`;
  }
  return `<div class="question">
    <div class="qlabel">${q.label}</div>
    <textarea name="${q.key}" rows="2" placeholder="اكتب إجابتك..."></textarea>
  </div>`;
}

function formPage(s, questions) {
  const target = TARGET_LABELS[s.target] || s.target;
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>${s.title}</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">جمعية البر بصبيا — استبيان</div>
        <h1>📋 ${s.title}</h1>
        <p>الفئة المستهدفة: ${target}${s.period ? ` · ${s.period}` : ''}</p>
      </div>
      <div class="body">
        <form method="POST">
          <div class="field-group">
            <label class="field-lbl">اسمك (اختياري)</label>
            <input type="text" name="respondentName" placeholder="يمكنك ترك الاسم فارغاً">
          </div>
          ${questions.map(renderQuestion).join('')}
          <button type="submit" class="submit-btn">💾 إرسال الاستبيان</button>
        </form>
      </div>
      <div class="footer">شكراً لمشاركتك — رأيك يهمنا لتحسين خدماتنا</div>
    </div>
  </body></html>`;
}

function successPage(s) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال</title></head>
  <body>
    <div class="card">
      <div class="header">
        <h1>✅ شكراً لك!</h1>
        <p>${s.title}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🙏</div>
        <div style="font-size:1.2rem;font-weight:700;color:#166534;margin-bottom:8px">تم استلام مشاركتك بنجاح</div>
        <p style="color:#6b7280">رأيك سيُسهم في تحسين خدمات الجمعية.</p>
        <p style="margin-top:20px;color:#9ca3af;font-size:.85rem">يمكنك إغلاق هذه الصفحة الآن</p>
      </div>
      <div class="footer">جمعية البر بصبيا — نظام إدارة الجودة</div>
    </div>
  </body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>خطأ</title></head>
  <body>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#991b1b,#dc2626)">
        <h1>❌ ${msg}</h1>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">📋</div>
        <p style="color:#6b7280">تواصل مع الجمعية للاستفسار.</p>
      </div>
    </div>
  </body></html>`;
}

export default router;
