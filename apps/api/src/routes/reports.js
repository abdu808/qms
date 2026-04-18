/**
 * تقارير الطباعة — نماذج HTML محسّنة للطباعة (A4 — عربي RTL)
 * ISO 9001:2015 — جمعية البر بصبيا
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';

const router = Router();

// ─── مشترك ─────────────────────────────────────────────────────────────────

const PRINT_BASE = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;color:#111;background:#fff;font-size:13px;line-height:1.6}
  .page{max-width:800px;margin:0 auto;padding:24px 28px}
  .header{border-bottom:3px solid #2e8b57;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
  .org-name{font-size:1.2rem;font-weight:800;color:#2e8b57}
  .org-sub{font-size:.75rem;color:#666;margin-top:2px}
  .report-title{font-size:1.4rem;font-weight:700;margin-bottom:16px;color:#1a1a1a;border-right:4px solid #2e8b57;padding-right:10px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fffe;border:1px solid #d1fae5;border-radius:8px;padding:12px;margin-bottom:20px}
  .meta-item .label{font-size:.7rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .meta-item .value{font-weight:600;color:#111;margin-top:1px}
  .section{margin-bottom:18px}
  .section-title{font-weight:700;font-size:.95rem;color:#2e8b57;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin-bottom:10px}
  .field{margin-bottom:8px}
  .field-label{font-size:.75rem;color:#6b7280;font-weight:600;margin-bottom:2px}
  .field-value{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;min-height:32px;white-space:pre-wrap}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:.85rem}
  th{background:#f0fdf4;color:#166534;font-weight:700;padding:7px 10px;text-align:right;border:1px solid #d1d5db}
  td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:.8rem;font-weight:700}
  .badge-green{background:#dcfce7;color:#166534}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-gray{background:#f3f4f6;color:#374151}
  .sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
  .sig-box{text-align:center}
  .sig-line{border-bottom:1px solid #9ca3af;margin-bottom:6px;height:40px}
  .sig-label{font-size:.75rem;color:#6b7280}
  .footer{text-align:center;font-size:.7rem;color:#9ca3af;margin-top:24px;padding-top:8px;border-top:1px solid #f3f4f6}
  @media print{
    body{font-size:11px}
    .page{padding:10px 14px;max-width:100%}
    .no-print{display:none!important}
    @page{size:A4;margin:1.2cm 1.5cm}
  }
</style>`;

function printBtn(title) {
  return `<div class="no-print" style="text-align:center;margin:20px 0">
    <button onclick="window.print()" style="background:#2e8b57;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:1rem;cursor:pointer;font-family:inherit">🖨️ طباعة / حفظ PDF</button>
    <button onclick="window.close()" style="background:#f3f4f6;border:none;padding:10px 20px;border-radius:8px;font-size:.9rem;cursor:pointer;margin-right:8px;font-family:inherit">✖ إغلاق</button>
  </div>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}
function val(v, fallback = '—') { return v || fallback; }

// ─── 1. تقرير المراجعة الإدارية (ISO 9.3) ──────────────────────────────────
router.get('/management-review/:id', asyncHandler(async (req, res) => {
  const review = await prisma.managementReview.findUnique({ where: { id: req.params.id } });
  if (!review) throw NotFound('المراجعة غير موجودة');

  const STATUS = { PLANNED: 'مخطط', COMPLETED: 'مكتمل', CANCELLED: 'ملغى' };

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>مراجعة الإدارة — ${review.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 9.3</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم المراجعة</div>
          <div style="font-size:1.1rem;font-weight:800;color:#2e8b57">${review.code}</div>
          <div style="font-size:.75rem;color:#9ca3af;margin-top:2px">طُبع: ${formatDate(new Date())}</div>
        </div>
      </div>

      <div class="report-title">محضر مراجعة الإدارة — ${val(review.title)}</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">تاريخ الاجتماع</div><div class="value">${formatDate(review.meetingDate)}</div></div>
        <div class="meta-item"><div class="label">الفترة</div><div class="value">${val(review.period)}</div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value">${STATUS[review.status] || review.status}</div></div>
        <div class="meta-item"><div class="label">حضور الإدارة العليا</div><div class="value">${review.topManagementPresent ? '✅ نعم' : '❌ لم يُؤكد'}</div></div>
        <div class="meta-item" style="grid-column:span 2"><div class="label">الحضور</div><div class="value">${val(review.attendees)}</div></div>
      </div>

      <!-- المدخلات (ISO 9.3.2) -->
      <div class="section">
        <div class="section-title">📥 مدخلات المراجعة (ISO 9.3.2)</div>
        ${[
          ['تغييرات في السياق الداخلي والخارجي', review.contextChanges],
          ['مراجعة تحقق الأهداف والمؤشرات', review.objectivesReview],
          ['أداء العمليات ومطابقة المنتجات/الخدمات', review.processPerformance],
          ['حالة المطابقة وعدم المطابقة (NCR)', review.conformityStatus],
          ['نتائج التدقيق الداخلي', review.auditResults],
          ['تغذية راجعة من المستفيدين والمتبرعين', review.customerFeedback],
          ['حالة المخاطر والفرص', review.risksStatus],
          ['فرص التحسين المُحددة', review.improvementOpps],
        ].map(([label, value]) => `
        <div class="field">
          <div class="field-label">${label}</div>
          <div class="field-value">${val(value)}</div>
        </div>`).join('')}
      </div>

      <!-- المخرجات (ISO 9.3.3) -->
      <div class="section">
        <div class="section-title">📤 مخرجات المراجعة (ISO 9.3.3)</div>
        ${[
          ['القرارات المتخذة', review.decisions],
          ['الاحتياجات من الموارد', review.resourceNeeds],
          ['إجراءات التحسين المقررة', review.improvementActions],
          ['التغييرات المقترحة على نظام الجودة', review.systemChanges],
        ].map(([label, value]) => `
        <div class="field">
          <div class="field-label">${label}</div>
          <div class="field-value">${val(value)}</div>
        </div>`).join('')}
      </div>

      ${review.minutes ? `<div class="section">
        <div class="section-title">📝 محضر الاجتماع</div>
        <div class="field-value" style="min-height:80px">${review.minutes}</div>
      </div>` : ''}

      ${review.nextReview ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:16px">
        📅 <strong>تاريخ المراجعة القادمة:</strong> ${formatDate(review.nextReview)}
      </div>` : ''}

      <!-- التوقيعات -->
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — نظام إدارة الجودة ISO 9001:2015 | ${review.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 2. تقرير عدم المطابقة (ISO 10.2) ─────────────────────────────────────
router.get('/ncr/:id', asyncHandler(async (req, res) => {
  const ncr = await prisma.nCR.findUnique({
    where: { id: req.params.id },
    include: {
      department: true,
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });
  if (!ncr) throw NotFound('عدم المطابقة غير موجود');

  const statusLabel = {
    OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل السبب الجذري',
    ACTION_PLANNED: 'مخطط للإجراء', IN_PROGRESS: 'جارٍ التنفيذ',
    VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق',
  };
  const sevColor = ncr.severity === 'مرتفعة' ? 'badge-red' : ncr.severity === 'متوسطة' ? 'badge-amber' : 'badge-gray';
  const stColor  = ncr.status === 'CLOSED' ? 'badge-green' : ncr.status === 'OPEN' ? 'badge-red' : 'badge-blue';

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>تقرير عدم مطابقة — ${ncr.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 10.2</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم عدم المطابقة</div>
          <div style="font-size:1.1rem;font-weight:800;color:#dc2626">${ncr.code}</div>
        </div>
      </div>

      <div class="report-title">تقرير عدم المطابقة والإجراء التصحيحي</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">تاريخ الرصد</div><div class="value">${formatDate(ncr.detectedAt)}</div></div>
        <div class="meta-item"><div class="label">الإدارة</div><div class="value">${val(ncr.department?.name)}</div></div>
        <div class="meta-item"><div class="label">المُبلِّغ</div><div class="value">${val(ncr.reporter?.name)}</div></div>
        <div class="meta-item"><div class="label">المكلف بالمعالجة</div><div class="value">${val(ncr.assignee?.name)}</div></div>
        <div class="meta-item"><div class="label">الخطورة</div><div class="value"><span class="badge ${sevColor}">${val(ncr.severity)}</span></div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value"><span class="badge ${stColor}">${statusLabel[ncr.status]||ncr.status}</span></div></div>
        <div class="meta-item"><div class="label">تاريخ الاستحقاق</div><div class="value">${formatDate(ncr.dueDate)}</div></div>
        <div class="meta-item"><div class="label">تاريخ التحقق</div><div class="value">${formatDate(ncr.verifiedAt)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">📋 وصف عدم المطابقة</div>
        <div class="field"><div class="field-label">العنوان</div><div class="field-value">${val(ncr.title)}</div></div>
        <div class="field"><div class="field-label">الوصف التفصيلي</div><div class="field-value" style="min-height:60px">${val(ncr.description)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">🔍 تحليل السبب الجذري والإجراءات</div>
        <div class="field"><div class="field-label">السبب الجذري</div><div class="field-value">${val(ncr.rootCause)}</div></div>
        <div class="field"><div class="field-label">التصحيح الفوري</div><div class="field-value">${val(ncr.correction)}</div></div>
        <div class="field"><div class="field-label">الإجراء التصحيحي</div><div class="field-value">${val(ncr.correctiveAction)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">✅ التحقق من الفعالية (ISO 10.2.2)</div>
        <div class="meta-grid">
          <div class="meta-item"><div class="label">الفعالية</div><div class="value">
            ${ncr.effective === true ? '<span class="badge badge-green">✅ فعّال</span>' : ncr.effective === false ? '<span class="badge badge-red">❌ غير فعّال</span>' : '<span class="badge badge-gray">لم يُقيَّم</span>'}
          </div></div>
          <div class="meta-item"><div class="label">تاريخ التحقق</div><div class="value">${formatDate(ncr.verifiedAt)}</div></div>
          <div class="meta-item" style="grid-column:span 2"><div class="label">ملاحظة التحقق</div><div class="value">${val(ncr.verifiedNote)}</div></div>
        </div>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المُبلِّغ / ${val(ncr.reporter?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المكلف / ${val(ncr.assignee?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${ncr.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 3. تقرير تقييم المورد (ISO 8.4) ──────────────────────────────────────
router.get('/supplier-eval/:id', asyncHandler(async (req, res) => {
  const ev = await prisma.supplierEval.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      evaluator: { select: { name: true } },
    },
  });
  if (!ev) throw NotFound('التقييم غير موجود');

  let criteria = [];
  try { criteria = Object.entries(JSON.parse(ev.criteriaJson)?.criteria || {}); } catch {}

  const decColor = ev.decision?.includes('مرفوض') ? 'badge-red' : ev.decision?.includes('مشروط') ? 'badge-amber' : 'badge-green';
  const pct = Math.round(ev.percentage || 0);

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>تقييم المورد — ${ev.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 8.4</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم التقييم</div>
          <div style="font-size:1rem;font-weight:800;color:#2e8b57">${ev.code}</div>
        </div>
      </div>

      <div class="report-title">تقرير تقييم المورد — ${ev.supplier?.name}</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">رمز المورد</div><div class="value">${val(ev.supplier?.code)}</div></div>
        <div class="meta-item"><div class="label">نوع المورد</div><div class="value">${val(ev.supplier?.type)}</div></div>
        <div class="meta-item"><div class="label">المُقيِّم</div><div class="value">${val(ev.evaluator?.name)}</div></div>
        <div class="meta-item"><div class="label">تاريخ التقييم</div><div class="value">${formatDate(ev.evaluatedAt)}</div></div>
        <div class="meta-item"><div class="label">الفترة</div><div class="value">${val(ev.period)}</div></div>
        <div class="meta-item"><div class="label">التقدير</div><div class="value">${val(ev.grade)}</div></div>
      </div>

      <!-- نتيجة إجمالية بارزة -->
      <div style="text-align:center;background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="font-size:.85rem;color:#6b7280">النسبة الإجمالية</div>
        <div style="font-size:3rem;font-weight:900;color:#2e8b57">${pct}%</div>
        <div style="font-size:.9rem;color:#6b7280">من ${ev.maxScore} نقطة — الحصيلة: ${ev.totalScore}</div>
        <div style="margin-top:8px"><span class="badge ${decColor}" style="font-size:1rem;padding:4px 18px">${val(ev.decision)}</span></div>
      </div>

      ${criteria.length ? `
      <div class="section">
        <div class="section-title">📊 تفاصيل معايير التقييم</div>
        <table>
          <thead><tr>
            <th>المعيار</th><th>النوع</th><th>الدرجة</th><th>الأقصى</th><th>النسبة</th><th>المستوى</th><th>ملاحظة</th>
          </tr></thead>
          <tbody>
          ${criteria.map(([key, c]) => {
            const pctC = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
            return `<tr>
              <td style="font-weight:600">${c.label || key}</td>
              <td>${c.critical ? '<span class="badge badge-red" style="font-size:.7rem">⚠️ حرج</span>' : '—'}</td>
              <td style="text-align:center;font-weight:700;color:#2e8b57">${c.score}</td>
              <td style="text-align:center;color:#6b7280">${c.max}</td>
              <td style="text-align:center">${pctC}%</td>
              <td>${c.level || '—'}</td>
              <td style="font-size:.8rem;color:#666">${c.note || '—'}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${ev.notes ? `<div class="section">
        <div class="section-title">📝 ملاحظات المُقيِّم</div>
        <div class="field-value">${ev.notes}</div>
      </div>` : ''}

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المُقيِّم / ${val(ev.evaluator?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مسؤول المشتريات</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${ev.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 3b. تقرير المورد: آخر تقييم له (من صفحة الموردين) ────────────────────
router.get('/supplier/:supplierId/latest-eval', asyncHandler(async (req, res) => {
  const ev = await prisma.supplierEval.findFirst({
    where: { supplierId: req.params.supplierId },
    orderBy: { evaluatedAt: 'desc' },
    include: { supplier: true, evaluator: { select: { name: true } } },
  });
  if (!ev) {
    // إذا لم يوجد تقييم، نعرض ورقة بيانات المورد فقط
    const sup = await prisma.supplier.findUnique({ where: { id: req.params.supplierId } });
    if (!sup) throw NotFound('المورد غير موجود');
    const STATUS = { PENDING: 'معلق', APPROVED: 'معتمد', SUSPENDED: 'موقوف', REJECTED: 'مرفوض' };
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}<title>بيانات المورد — ${sup.code}</title></head>
    <body><div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 8.4</div></div>
        <div style="text-align:left"><div style="font-size:.8rem;color:#666">رمز المورد</div><div style="font-size:1.1rem;font-weight:800;color:#2e8b57">${sup.code}</div></div>
      </div>
      <div class="report-title">بيانات المورد — ${sup.name}</div>
      <div class="meta-grid">
        <div class="meta-item"><div class="label">الاسم</div><div class="value">${val(sup.name)}</div></div>
        <div class="meta-item"><div class="label">النوع</div><div class="value">${val(sup.type)}</div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value">${STATUS[sup.status]||sup.status}</div></div>
        <div class="meta-item"><div class="label">رقم السجل التجاري</div><div class="value">${val(sup.crNumber)}</div></div>
        <div class="meta-item"><div class="label">جهة الاتصال</div><div class="value">${val(sup.contactPerson)}</div></div>
        <div class="meta-item"><div class="label">الهاتف</div><div class="value">${val(sup.phone)}</div></div>
        <div class="meta-item" style="grid-column:span 2"><div class="label">ملاحظات</div><div class="value">${val(sup.notes)}</div></div>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;color:#92400e;font-weight:600">
        ⚠️ لا يوجد تقييم مسجّل لهذا المورد بعد — أرسل رابط التقييم للمورد من نظام QMS
      </div>
      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${sup.code} | ${formatDate(new Date())}</div>
    </div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // إعادة استخدام route التقييم مباشرةً
  return res.redirect(`/api/reports/supplier-eval/${ev.id}`);
}));

// ─── 4. التقرير السنوي لهيئة المنشآت غير الربحية (GAAFZA) ─────────────────
router.get('/gaafza', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = new Date(`${year}-01-01`);
  const to   = new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const [
    beneficiaryTotal, beneficiaryByCategory,
    donationTotal, donationByType, donationAmount,
    programs, activePrograms,
    ncrCount, ncrClosed,
    complaintsCount, resolvedComplaints,
    trainingCount, usersActive,
    surveyData,
  ] = await Promise.all([
    prisma.beneficiary.count({ where: { status: 'ACTIVE' } }),
    prisma.beneficiary.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.donation.count({ where: { receivedAt: range } }),
    prisma.donation.groupBy({ by: ['type'], _count: { _all: true }, where: { receivedAt: range } }),
    prisma.donation.aggregate({ where: { receivedAt: range }, _sum: { amount: true } }),
    prisma.program.count(),
    prisma.program.count({ where: { status: 'ACTIVE' } }),
    prisma.nCR.count({ where: { createdAt: range } }),
    prisma.nCR.count({ where: { createdAt: range, status: 'CLOSED' } }),
    prisma.complaint.count({ where: { receivedAt: range } }),
    prisma.complaint.count({ where: { receivedAt: range, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.training.count({ where: { date: range } }),
    prisma.user.count({ where: { active: true } }),
    prisma.survey.aggregate({ _sum: { responses: true }, _avg: { avgScore: true } }),
  ]);

  const catLabel = {
    ORPHAN: 'أيتام', WIDOW: 'أرامل', POOR_FAMILY: 'أسر محتاجة',
    DISABLED: 'ذوو إعاقة', ELDERLY: 'مسنون', STUDENT: 'طلاب', OTHER: 'أخرى',
  };
  const typeLabel = { CASH: 'نقدي', IN_KIND: 'عيني', SERVICE: 'خدمة' };

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير السنوي — جمعية البر بصبيا ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">التقرير السنوي — هيئة المنشآت غير الربحية (GAAFZA)</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:1.3rem;font-weight:900;color:#2e8b57">${year}</div>
          <div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div>
        </div>
      </div>

      <div class="report-title">التقرير السنوي للأداء المؤسسي ${year}</div>

      <!-- 1. المستفيدون -->
      <div class="section">
        <div class="section-title">👥 أولاً: المستفيدون</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#2e8b57">${beneficiaryTotal}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي المستفيدين النشطين</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#1d4ed8">${activePrograms}/${programs}</div>
            <div style="font-size:.85rem;color:#6b7280">البرامج النشطة / الإجمالي</div>
          </div>
        </div>
        <table>
          <thead><tr><th>فئة المستفيدين</th><th>العدد</th></tr></thead>
          <tbody>
          ${beneficiaryByCategory.map(b => `<tr><td>${catLabel[b.category] || b.category}</td><td style="text-align:center;font-weight:700">${b._count._all}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- 2. التبرعات -->
      <div class="section">
        <div class="section-title">🎁 ثانياً: التبرعات المستلمة (${year})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#92400e">${donationTotal}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي التبرعات المستلمة</div>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:1.6rem;font-weight:900;color:#991b1b">${donationAmount._sum.amount ? Number(donationAmount._sum.amount).toLocaleString('ar-SA') + ' ريال' : '—'}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي التبرعات النقدية</div>
          </div>
        </div>
        <table>
          <thead><tr><th>نوع التبرع</th><th>العدد</th></tr></thead>
          <tbody>
          ${donationByType.map(d => `<tr><td>${typeLabel[d.type] || d.type}</td><td style="text-align:center;font-weight:700">${d._count._all}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- 3. الجودة -->
      <div class="section">
        <div class="section-title">🏅 ثالثاً: مؤشرات الجودة</div>
        <table>
          <thead><tr><th>المؤشر</th><th>القيمة</th><th>الملاحظة</th></tr></thead>
          <tbody>
            <tr><td>حالات عدم المطابقة (NCR)</td><td style="text-align:center;font-weight:700">${ncrCount}</td><td>مغلق: ${ncrClosed} (${ncrCount ? Math.round(ncrClosed/ncrCount*100) : 0}%)</td></tr>
            <tr><td>الشكاوى المستلمة</td><td style="text-align:center;font-weight:700">${complaintsCount}</td><td>محلولة: ${resolvedComplaints} (${complaintsCount ? Math.round(resolvedComplaints/complaintsCount*100) : 0}%)</td></tr>
            <tr><td>جلسات التدريب المنفذة</td><td style="text-align:center;font-weight:700">${trainingCount}</td><td></td></tr>
            <tr><td>الكوادر البشرية (موظفون نشطون)</td><td style="text-align:center;font-weight:700">${usersActive}</td><td></td></tr>
            <tr><td>متوسط رضا المستفيدين</td><td style="text-align:center;font-weight:700">${surveyData._avg.avgScore ? (Math.round(surveyData._avg.avgScore*10)/10) + '/5' : '—'}</td><td>من ${surveyData._sum.responses||0} استجابة</td></tr>
          </tbody>
        </table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.8rem;color:#6b7280">
        <strong>إقرار:</strong> يُقرّ مجلس إدارة جمعية البر بصبيا بصحة المعلومات الواردة في هذا التقرير للعام ${year}، ويُؤكد أن الجمعية تعمل وفق المتطلبات النظامية لهيئة المنشآت غير الربحية.
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة والامتثال</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير السنوي ${year} | هيئة المنشآت غير الربحية</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
