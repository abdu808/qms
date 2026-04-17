import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nextCode } from '../utils/codeGen.js';

const router = Router();

// ─── معايير مشتركة لجميع الأنواع (متوائمة مع متطلبات الجمعيات في المملكة) ──
// (هيئة المنشآت غير الربحية — Vision 2030 — ISO 26000)
const COMMON_CRITERIA = [
  { key: 'transparency',     label: 'الشفافية ومكافحة الفساد (عدم تقديم إكراميات)', max: 8,  critical: true  },
  { key: 'saudization',      label: 'نسبة السعودة وتوطين الوظائف',                max: 5,  critical: false },
  { key: 'sustainability',   label: 'الاستدامة والمسؤولية الاجتماعية',            max: 5,  critical: false },
  { key: 'financial_stab',   label: 'الاستقرار المالي وموثوقية المورد',           max: 5,  critical: false },
];

// معايير خاصة بكل نوع (المجموع = 77 نقطة ليكتمل 100 مع المعايير المشتركة = 23)
const CORE_CRITERIA_BY_TYPE = {
  GOODS: [
    { key: 'product_quality',  label: 'جودة المنتجات ومطابقة المواصفات',     max: 25, critical: true  },
    { key: 'delivery',         label: 'الالتزام بمواعيد التسليم',             max: 18, critical: false },
    { key: 'packaging',        label: 'التعبئة والتغليف والحفظ',              max: 10, critical: false },
    { key: 'pricing',          label: 'الأسعار والشروط التجارية',             max: 12, critical: false },
    { key: 'communication',    label: 'الاستجابة والتواصل',                   max: 7,  critical: false },
    { key: 'after_sale',       label: 'خدمات ما بعد البيع والضمان',           max: 5,  critical: false },
  ],
  SERVICES: [
    { key: 'service_quality',  label: 'جودة الخدمة المقدمة',                  max: 22, critical: true  },
    { key: 'professionalism',  label: 'الكفاءة والاحترافية للفريق',            max: 18, critical: false },
    { key: 'delivery',         label: 'الالتزام بالجدول الزمني',              max: 15, critical: false },
    { key: 'communication',    label: 'التواصل والاستجابة',                   max: 12, critical: false },
    { key: 'pricing',          label: 'الأسعار والقيمة المقدمة',              max: 10, critical: false },
  ],
  CONSTRUCTION: [
    { key: 'spec_compliance',  label: 'الالتزام بالمواصفات الفنية والمخططات', max: 14, critical: true  },
    { key: 'work_quality',     label: 'جودة التنفيذ ومطابقة المعايير الهندسية', max: 13, critical: true  },
    { key: 'schedule',         label: 'الالتزام بالجدول الزمني ومراحل التسليم', max: 12, critical: false },
    { key: 'hse_safety',       label: 'السلامة المهنية وتطبيق اشتراطات HSE',  max: 12, critical: true  },
    { key: 'workforce',        label: 'كفاءة العمالة والكوادر الفنية',         max: 8,  critical: false },
    { key: 'materials',        label: 'جودة المواد المستخدمة',                max: 8,  critical: false },
    { key: 'warranty',         label: 'فترة الضمان وخدمات ما بعد التسليم',    max: 5,  critical: false },
    { key: 'permits',          label: 'الالتزام بالأنظمة البلدية والتراخيص',   max: 5,  critical: true  },
  ],
  IT_SERVICES: [
    { key: 'solution_quality', label: 'جودة الحل التقني ومطابقة المتطلبات',   max: 18, critical: true  },
    { key: 'sla_response',     label: 'وقت الاستجابة والالتزام بـ SLA',        max: 15, critical: true  },
    { key: 'support',          label: 'الدعم الفني وتوفره عند الحاجة',         max: 12, critical: false },
    { key: 'data_security',    label: 'أمن المعلومات وحماية البيانات',        max: 12, critical: true  },
    { key: 'compatibility',    label: 'التوافقية مع الأنظمة القائمة',          max: 8,  critical: false },
    { key: 'documentation',    label: 'التوثيق والتدريب',                     max: 7,  critical: false },
    { key: 'pricing',          label: 'الأسعار والقيمة المقدمة',              max: 5,  critical: false },
  ],
  TRANSPORT: [
    { key: 'safety',           label: 'سلامة النقل وحماية البضاعة',           max: 22, critical: true  },
    { key: 'delivery',         label: 'الالتزام بالمواعيد',                   max: 22, critical: false },
    { key: 'vehicle_condition',label: 'حالة المركبات والمعدات',               max: 15, critical: false },
    { key: 'driver_conduct',   label: 'سلوك وكفاءة السائقين',                 max: 10, critical: false },
    { key: 'communication',    label: 'التواصل والاستجابة',                   max: 5,  critical: false },
    { key: 'pricing',          label: 'الأسعار والتنافسية',                   max: 3,  critical: false },
  ],
  CONSULTING: [
    { key: 'output_quality',   label: 'جودة التقارير والمخرجات',              max: 22, critical: true  },
    { key: 'expertise',        label: 'الخبرة والكفاءة التخصصية',             max: 18, critical: true  },
    { key: 'delivery',         label: 'الالتزام بالجدول الزمني',              max: 15, critical: false },
    { key: 'communication',    label: 'التواصل والاستجابة',                   max: 12, critical: false },
    { key: 'pricing',          label: 'الأسعار والقيمة المقابلة',             max: 10, critical: false },
  ],
  IN_KIND_DONOR: [
    { key: 'spec_conformity',  label: 'مطابقة المواصفات المطلوبة',            max: 28, critical: true  },
    { key: 'product_quality',  label: 'جودة المواد / البضائع',                max: 22, critical: true  },
    { key: 'delivery',         label: 'الالتزام بالمواعيد',                   max: 15, critical: false },
    { key: 'compliance',       label: 'الامتثال والوثائق (صلاحية - شهادات)',  max: 12, critical: true  },
  ],
  OTHER: [
    { key: 'quality',          label: 'جودة المنتج / الخدمة',                 max: 22, critical: true  },
    { key: 'delivery',         label: 'الالتزام بالمواعيد',                   max: 18, critical: false },
    { key: 'communication',    label: 'التواصل والاستجابة',                   max: 15, critical: false },
    { key: 'pricing',          label: 'الأسعار والشروط التجارية',             max: 12, critical: false },
    { key: 'compliance',       label: 'الامتثال والوثائق',                    max: 10, critical: false },
  ],
};

const TYPE_LABELS = {
  GOODS: 'بضائع ومنتجات',
  SERVICES: 'خدمات',
  CONSTRUCTION: 'مقاولات وبناء',
  IT_SERVICES: 'خدمات تقنية المعلومات',
  TRANSPORT: 'نقل وشحن',
  CONSULTING: 'استشارات',
  IN_KIND_DONOR: 'مورد تبرعات عينية',
  OTHER: 'أخرى',
};

// الأوصاف النوعية للدرجات حسب نسبة التحقق (مع المعيار)
function scoreLabel(score, max) {
  if (max === 0) return '';
  const pct = (score / max) * 100;
  if (pct >= 90) return 'ممتاز ويتجاوز التوقعات';
  if (pct >= 75) return 'جيد جداً ومطابق';
  if (pct >= 60) return 'مقبول مع ملاحظات';
  if (pct >= 40) return 'ضعيف يحتاج تحسين';
  if (pct > 0)   return 'غير مقبول';
  return 'لم يُقيَّم';
}

function getCriteria(supplierType) {
  const core = CORE_CRITERIA_BY_TYPE[supplierType] || CORE_CRITERIA_BY_TYPE.OTHER;
  return [...core, ...COMMON_CRITERIA];
}

function grade(p) {
  if (p >= 90) return 'ممتاز';
  if (p >= 80) return 'جيد جداً';
  if (p >= 70) return 'جيد';
  if (p >= 60) return 'مقبول';
  return 'ضعيف';
}

function decision(p, criticalFailed) {
  // فشل أي معيار حرج = رفض تلقائي (حتى لو النسبة عالية)
  if (criticalFailed) return 'مرفوض (فشل معيار حرج)';
  if (p >= 85) return 'معتمد';
  if (p >= 70) return 'معتمد مشروط';
  if (p >= 50) return 'قيد المراقبة';
  return 'مرفوض';
}

// GET /eval/:token
router.get('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح أو منتهي الصلاحية'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  const criteria = getCriteria(record.supplier.type);
  res.send(formPage(record, criteria));
}));

// POST /eval/:token
router.post('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  const { evaluatorName, evaluatorOrg, notes, recommendation } = req.body;
  const criteria = getCriteria(record.supplier.type);

  let totalScore = 0;
  let maxTotal = 0;
  let criticalFailed = false;
  const criteriaObj = {};

  for (const c of criteria) {
    const score = Math.min(c.max, Math.max(0, Number(req.body[c.key]) || 0));
    const note = (req.body[`${c.key}_note`] || '').trim().slice(0, 300);
    totalScore += score;
    maxTotal += c.max;
    // معيار حرج يعتبر فاشلاً إذا حصل على أقل من 50% من حده الأقصى
    if (c.critical && score < (c.max * 0.5)) criticalFailed = true;
    criteriaObj[c.key] = {
      label: c.label,
      max: c.max,
      score,
      critical: !!c.critical,
      level: scoreLabel(score, c.max),
      note: note || null,
    };
  }

  const pctNorm = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
  const finalDecision = decision(pctNorm, criticalFailed);

  // توصية المقيّم النهائية (اختيارية — إن لم تُرسل تُستخدم الحسابية)
  const userRec = (recommendation || '').trim();
  const allowedRec = ['approved','conditional','rejected','watch'];
  const recommendationFinal = allowedRec.includes(userRec) ? userRec : null;

  const code = await nextCode('supplierEval', 'SEVAL');

  const payload = {
    criteria:    criteriaObj,
    criticalFailed,
    recommendation: recommendationFinal,
  };

  await prisma.$transaction([
    prisma.supplierEval.create({
      data: {
        code,
        supplierId:   record.supplierId,
        evaluatorId:  record.createdById,
        period:       `تقييم خارجي — ${evaluatorOrg || evaluatorName || 'مقيّم خارجي'}`,
        criteriaJson: JSON.stringify(payload),
        totalScore,
        maxScore:   maxTotal,
        percentage: pctNorm,
        grade:      grade(pctNorm),
        decision:   finalDecision,
        notes:      notes || null,
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
    prisma.supplier.update({
      where: { id: record.supplierId },
      data: { overallRating: pctNorm },
    }),
  ]);

  res.send(successPage(record.supplier, totalScore, maxTotal, pctNorm, grade(pctNorm), finalDecision, criticalFailed));
}));

// ─── HTML Templates ────────────────────────────────────────────────────────────

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f0f9f4;direction:rtl;color:#1a1a1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:20px 10px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:100%;max-width:680px;overflow:hidden}
    .header{background:linear-gradient(135deg,#2e8b57,#3aab6f);color:#fff;padding:24px 28px}
    .header h1{font-size:1.3rem;margin-bottom:4px}
    .header p{opacity:.9;font-size:.9rem}
    .body{padding:24px 28px}
    label{display:block;font-weight:600;margin-bottom:6px;font-size:.9rem;color:#374151}
    input[type=text],textarea{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:.95rem;font-family:inherit;direction:rtl}
    input:focus,textarea:focus{outline:none;border-color:#2e8b57}
    .criterion{background:#f8fffe;border:1.5px solid #d1fae5;border-radius:10px;padding:14px;margin-bottom:10px;transition:border-color .2s}
    .criterion.critical{border-color:#fca5a5;background:#fef7f7}
    .criterion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap}
    .criterion-label{font-weight:600;font-size:.9rem;flex:1;min-width:0}
    .chip{font-size:.7rem;padding:2px 8px;border-radius:20px;white-space:nowrap}
    .chip-max{color:#6b7280;background:#e5f7ed}
    .chip-crit{color:#991b1b;background:#fee2e2;font-weight:700}
    .score-display{font-size:1.3rem;font-weight:700;color:#2e8b57;min-width:36px;text-align:center}
    .score-level{font-size:.75rem;color:#6b7280;min-height:14px;margin-top:4px;text-align:center}
    input[type=range]{width:100%;accent-color:#2e8b57;height:6px;cursor:pointer}
    .note-input{width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;font-size:.8rem;font-family:inherit;direction:rtl;margin-top:8px;background:#fff}
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
    .section-title{font-weight:700;margin:20px 0 10px;color:#374151;font-size:.95rem;border-bottom:1.5px solid #e5e7eb;padding-bottom:8px}
    .rec-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rec-options label{display:flex;align-items:center;gap:8px;background:#f9fafb;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:.85rem;margin:0}
    .rec-options input[type=radio]{accent-color:#2e8b57}
    .rec-options label:has(input:checked){background:#dcfce7;border-color:#2e8b57}
    .legend{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:.78rem;color:#78350f;margin-bottom:14px;line-height:1.6}
    @media (max-width:500px){.rec-options{grid-template-columns:1fr}}
  </style>
`;

function formPage(record, criteria) {
  const sup = record.supplier;
  const expDate = record.expiresAt.toLocaleDateString('ar-SA');
  const typeLabel = TYPE_LABELS[sup.type] || sup.type;
  const maxTotal = criteria.reduce((s, c) => s + c.max, 0);

  const renderCrit = (c) => `
    <div class="criterion ${c.critical ? 'critical' : ''}">
      <div class="criterion-header">
        <span class="criterion-label">${c.label}</span>
        <div style="display:flex;gap:4px">
          ${c.critical ? '<span class="chip chip-crit">⚠️ معيار حرج</span>' : ''}
          <span class="chip chip-max">من ${c.max}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" name="${c.key}" min="0" max="${c.max}" value="0"
          data-max="${c.max}"
          oninput="updateCriterion(this)">
        <span class="score-display">0</span>
      </div>
      <div class="score-level"></div>
      <input type="text" class="note-input" name="${c.key}_note" maxlength="300"
        placeholder="ملاحظة (اختياري) — سبب الدرجة أو اقتراح تحسين...">
    </div>
  `;

  // افصل المعايير الأساسية عن المشتركة
  const coreCount = criteria.length - COMMON_CRITERIA.length;
  const coreHtml = criteria.slice(0, coreCount).map(renderCrit).join('');
  const commonHtml = criteria.slice(coreCount).map(renderCrit).join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تقييم المورد — ${sup.name}</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>📋 نموذج تقييم المورد</h1>
        <p>${sup.code} — ${sup.name}</p>
        <p style="margin-top:4px;font-size:.8rem;opacity:.85">📦 نوع المورد: ${typeLabel}</p>
        <p style="margin-top:2px;font-size:.8rem;opacity:.75">⏳ الرابط صالح حتى ${expDate}</p>
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

          <div class="legend">
            💡 <strong>دليل التقييم:</strong>
            <div>• ممتاز (90%+) — يتجاوز التوقعات &nbsp; • جيد جداً (75%+) — مطابق</div>
            <div>• مقبول (60%+) — مع ملاحظات &nbsp; • ضعيف — يحتاج تحسين</div>
            <div style="margin-top:4px;color:#991b1b">⚠️ المعايير الحرجة: فشلها (أقل من 50%) يؤدي لرفض المورد تلقائياً</div>
          </div>

          <div class="section-title">⭐ المعايير الأساسية</div>
          ${coreHtml}

          <div class="section-title">🤝 معايير الامتثال والاستدامة (مشتركة)</div>
          ${commonHtml}

          <div class="total-bar">
            <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">المجموع الكلي</div>
            <div class="total-score" id="totalDisplay">0</div>
            <div style="font-size:.8rem;color:#6b7280">من ${maxTotal} نقطة (نسبة: <span id="pctDisplay">0</span>%)</div>
          </div>

          <div class="section-title">🎯 توصيتك النهائية</div>
          <div class="rec-options">
            <label><input type="radio" name="recommendation" value="approved"> ✅ معتمد</label>
            <label><input type="radio" name="recommendation" value="conditional"> ⚠️ معتمد مشروط</label>
            <label><input type="radio" name="recommendation" value="watch"> 🔄 قيد المراقبة</label>
            <label><input type="radio" name="recommendation" value="rejected"> ❌ غير معتمد</label>
          </div>

          <div class="field-group" style="margin-top:16px">
            <label>ملاحظات عامة وتوصيات للتحسين</label>
            <textarea name="notes" rows="3" placeholder="أي ملاحظات تتعلق بالمورد أو اقتراحات للتحسين..."></textarea>
          </div>

          <button type="submit" class="submit-btn">💾 إرسال التقييم</button>
        </form>
      </div>
      <div class="footer">هذا الرابط للاستخدام مرة واحدة فقط — وفقاً لمتطلبات ISO 9001:2015 بند 8.4</div>
    </div>

    <script>
      const maxTotal = ${maxTotal};
      function levelText(score, max){
        if(max===0) return '';
        const p=(score/max)*100;
        if(p>=90) return 'ممتاز ويتجاوز التوقعات';
        if(p>=75) return 'جيد جداً ومطابق';
        if(p>=60) return 'مقبول مع ملاحظات';
        if(p>=40) return 'ضعيف يحتاج تحسين';
        if(p>0)   return 'غير مقبول';
        return '';
      }
      function updateCriterion(r){
        const disp=r.nextElementSibling;
        const lvl=r.parentElement.nextElementSibling;
        disp.textContent=r.value;
        lvl.textContent=levelText(Number(r.value), Number(r.dataset.max));
        updateTotal();
      }
      function updateTotal(){
        let t=0;
        document.querySelectorAll('input[type=range]').forEach(r=>t+=Number(r.value));
        document.getElementById('totalDisplay').textContent=t;
        document.getElementById('pctDisplay').textContent=maxTotal?Math.round((t/maxTotal)*100):0;
      }
    </script>
  </body></html>`;
}

function successPage(sup, score, maxScore, pct, gradeStr, decisionStr, criticalFailed) {
  const color = criticalFailed ? 'badge-red' : (pct >= 80 ? 'badge-green' : pct >= 60 ? 'badge-amber' : 'badge-red');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال بنجاح</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>✅ تم استلام تقييمك</h1>
        <p>${sup.code} — ${sup.name}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🎉</div>
        <div class="success-title">شكراً لك!</div>
        <p style="color:#6b7280;margin-bottom:24px">تم حفظ تقييمك بنجاح وإرساله لفريق الجودة</p>
        <div class="total-bar">
          <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">نتيجتك</div>
          <div class="total-score">${score}/${maxScore}</div>
          <div style="font-size:.8rem;color:#6b7280;margin-top:4px">النسبة المئوية: ${pct}%</div>
        </div>
        ${criticalFailed ? '<div style="background:#fee2e2;color:#991b1b;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.85rem">⚠️ تم رصد فشل في معيار حرج</div>' : ''}
        <div style="margin-top:8px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
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
