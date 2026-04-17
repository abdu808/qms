import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nextCode } from '../utils/codeGen.js';

const router = Router();

const CRITERIA = [
  { key: 'quality',       label: 'جودة المنتجات / الخدمات',   max: 30 },
  { key: 'delivery',      label: 'الالتزام بالمواعيد',          max: 25 },
  { key: 'communication', label: 'التواصل والاستجابة',          max: 20 },
  { key: 'pricing',       label: 'الأسعار والشروط التجارية',   max: 15 },
  { key: 'compliance',    label: 'الامتثال والوثائق',          max: 10 },
];

function grade(p) {
  if (p >= 90) return 'ممتاز';
  if (p >= 80) return 'جيد جداً';
  if (p >= 70) return 'جيد';
  if (p >= 60) return 'مقبول';
  return 'ضعيف';
}

function decision(p) {
  if (p >= 80) return 'معتمد';
  if (p >= 60) return 'مشروط';
  return 'مرفوض';
}

// GET /eval/:token  — render the public evaluation form
router.get('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح أو منتهي الصلاحية'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  res.send(formPage(record));
}));

// POST /eval/:token  — submit evaluation
router.post('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  const { evaluatorName, evaluatorOrg, notes } = req.body;

  // Build criteria JSON & compute scores
  let totalScore = 0;
  const criteriaObj = {};
  for (const c of CRITERIA) {
    const score = Math.min(c.max, Math.max(0, Number(req.body[c.key]) || 0));
    totalScore += score;
    criteriaObj[c.key] = { label: c.label, max: c.max, score };
  }

  const pct   = totalScore; // out of 100
  const code  = await nextCode('supplierEval', 'SEVAL');

  // Find a system user to use as evaluatorId (use token creator)
  await prisma.$transaction([
    prisma.supplierEval.create({
      data: {
        code,
        supplierId:   record.supplierId,
        evaluatorId:  record.createdById,
        period:       `تقييم خارجي — ${evaluatorOrg || evaluatorName || 'مقيّم خارجي'}`,
        criteriaJson: JSON.stringify(criteriaObj),
        totalScore,
        maxScore: 100,
        percentage: pct,
        grade:    grade(pct),
        decision: decision(pct),
        notes:    notes || null,
      },
    }),
    prisma.evalToken.update({
      where: { id: record.id },
      data: {
        usedAt: new Date(),
        evaluatorName: evaluatorName || null,
        evaluatorOrg:  evaluatorOrg  || null,
        notes:         notes         || null,
      },
    }),
    // Update supplier overall rating
    prisma.supplier.update({
      where: { id: record.supplierId },
      data: { overallRating: pct },
    }),
  ]);

  res.send(successPage(record.supplier, totalScore, grade(pct), decision(pct)));
}));

// ─── HTML Templates ────────────────────────────────────────────────────────────

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f0f9f4;direction:rtl;color:#1a1a1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:20px 10px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:100%;max-width:640px;overflow:hidden}
    .header{background:linear-gradient(135deg,#2e8b57,#3aab6f);color:#fff;padding:24px 28px}
    .header h1{font-size:1.3rem;margin-bottom:4px}
    .header p{opacity:.85;font-size:.9rem}
    .body{padding:24px 28px}
    label{display:block;font-weight:600;margin-bottom:6px;font-size:.9rem;color:#374151}
    input[type=text],textarea{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:.95rem;font-family:inherit;direction:rtl}
    input:focus,textarea:focus{outline:none;border-color:#2e8b57}
    .criterion{background:#f8fffe;border:1.5px solid #d1fae5;border-radius:10px;padding:16px;margin-bottom:12px}
    .criterion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .criterion-label{font-weight:600;font-size:.9rem}
    .criterion-max{font-size:.8rem;color:#6b7280;background:#e5f7ed;padding:2px 8px;border-radius:20px}
    .score-display{font-size:1.4rem;font-weight:700;color:#2e8b57;min-width:40px;text-align:center}
    input[type=range]{width:100%;accent-color:#2e8b57;height:6px;cursor:pointer}
    .submit-btn{width:100%;background:#2e8b57;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px;transition:background .2s}
    .submit-btn:hover{background:#236b43}
    .total-bar{background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;text-align:center;margin:16px 0}
    .total-score{font-size:2.5rem;font-weight:800;color:#2e8b57}
    .footer{text-align:center;font-size:.75rem;color:#9ca3af;padding:16px;border-top:1px solid #f3f4f6}
    .icon{font-size:2rem;margin-bottom:8px}
    .success-title{font-size:1.4rem;font-weight:700;color:#166534;margin-bottom:8px}
    .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:700;font-size:.95rem}
    .badge-green{background:#dcfce7;color:#166534}
    .badge-amber{background:#fef3c7;color:#92400e}
    .badge-red{background:#fee2e2;color:#991b1b}
    .field-group{margin-bottom:16px}
  </style>
`;

function formPage(record) {
  const sup = record.supplier;
  const expDate = record.expiresAt.toLocaleDateString('ar-SA');
  const criteriaHtml = CRITERIA.map(c => `
    <div class="criterion">
      <div class="criterion-header">
        <span class="criterion-label">${c.label}</span>
        <span class="criterion-max">من ${c.max} نقطة</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" name="${c.key}" min="0" max="${c.max}" value="0"
          oninput="this.nextElementSibling.textContent=this.value">
        <span class="score-display">0</span>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تقييم المورد — ${sup.name}</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.8;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>📋 نموذج تقييم المورد</h1>
        <p>${sup.code} — ${sup.name}</p>
        <p style="margin-top:6px;font-size:.8rem;opacity:.7">⏳ الرابط صالح حتى ${expDate}</p>
      </div>
      <div class="body">
        <form method="POST">
          <div class="field-group">
            <label>اسمك الكامل *</label>
            <input type="text" name="evaluatorName" required placeholder="أدخل اسمك">
          </div>
          <div class="field-group">
            <label>جهتك / شركتك</label>
            <input type="text" name="evaluatorOrg" placeholder="اسم الجهة أو الشركة (اختياري)">
          </div>

          <div style="border-top:1.5px solid #e5e7eb;margin:20px 0;padding-top:20px">
            <div style="font-weight:700;margin-bottom:14px;color:#374151">⭐ معايير التقييم</div>
            ${criteriaHtml}
          </div>

          <div class="total-bar">
            <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">المجموع الكلي</div>
            <div class="total-score" id="totalDisplay">0</div>
            <div style="font-size:.8rem;color:#6b7280">من 100 نقطة</div>
          </div>

          <div class="field-group">
            <label>ملاحظات إضافية</label>
            <textarea name="notes" rows="3" placeholder="أي ملاحظات تتعلق بالمورد..."></textarea>
          </div>

          <button type="submit" class="submit-btn">💾 إرسال التقييم</button>
        </form>
      </div>
      <div class="footer">هذا الرابط للاستخدام مرة واحدة فقط</div>
    </div>

    <script>
      const ranges = document.querySelectorAll('input[type=range]');
      function updateTotal() {
        let t = 0;
        ranges.forEach(r => t += Number(r.value));
        document.getElementById('totalDisplay').textContent = t;
      }
      ranges.forEach(r => { r.addEventListener('input', updateTotal); });
    </script>
  </body></html>`;
}

function successPage(sup, score, gradeStr, decisionStr) {
  const color = score >= 80 ? 'badge-green' : score >= 60 ? 'badge-amber' : 'badge-red';
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال بنجاح</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.8;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>✅ تم استلام تقييمك</h1>
        <p>${sup.code} — ${sup.name}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🎉</div>
        <div class="success-title">شكراً لك!</div>
        <p style="color:#6b7280;margin-bottom:24px">تم حفظ تقييمك بنجاح وإرساله لفريق الجودة</p>
        <div class="total-bar">
          <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">نتيجتك</div>
          <div class="total-score">${score}</div>
          <div style="font-size:.8rem;color:#6b7280;margin-top:4px">من 100 نقطة</div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <span class="badge ${color}">${gradeStr}</span>
          <span class="badge ${color}">${decisionStr}</span>
        </div>
        <p style="margin-top:24px;color:#9ca3af;font-size:.85rem">يمكنك إغلاق هذه الصفحة الآن</p>
      </div>
      <div class="footer">نظام إدارة الجودة — جمعية البر بصبيا</div>
    </div>
  </body></html>`;
}

function usedPage(sup) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال مسبقاً</title></head>
  <body>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#92400e,#b45309)">
        <h1>⚠️ تم استخدام هذا الرابط</h1>
        <p>${sup.name}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🔒</div>
        <div style="font-size:1.1rem;font-weight:600;color:#92400e;margin-bottom:12px">تم تقديم التقييم مسبقاً</div>
        <p style="color:#6b7280">كل رابط يُستخدم مرة واحدة فقط.<br>تواصل مع الجهة المُرسِلة لرابط جديد إن لزم.</p>
      </div>
    </div>
  </body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>خطأ</title></head>
  <body>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#991b1b,#dc2626)">
        <h1>❌ رابط غير صالح</h1>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🔗</div>
        <div style="font-size:1.1rem;font-weight:600;color:#991b1b;margin-bottom:12px">${msg}</div>
        <p style="color:#6b7280">تواصل مع الجهة المُرسِلة للحصول على رابط صحيح.</p>
      </div>
    </div>
  </body></html>`;
}

export default router;
