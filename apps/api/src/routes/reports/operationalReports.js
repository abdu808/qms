/**
 * التقارير التشغيلية: الموردون، التبرعات، الشكاوى، GAAFZA، مركز التقارير
 */
import { Router } from 'express';
import { prisma } from '../../db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { NotFound } from '../../utils/errors.js';
import { activeWhere } from '../../lib/dataHelpers.js';
import { PRINT_BASE, printBtn, formatDate, val } from './_helpers.js';

const router = Router();

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

// ─── 5. التقرير التحليلي للشكاوى (ISO 9.1.2) ───────────────────────────────
router.get('/complaints-analytics', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = req.query.from ? new Date(req.query.from) : new Date(`${year}-01-01`);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const all = await prisma.complaint.findMany({
    where: activeWhere({ receivedAt: range }),
    select: { source: true, channel: true, severity: true, status: true, receivedAt: true, resolvedAt: true, subject: true, code: true, satisfaction: true, relatedNcrId: true },
  });

  const SOURCE = { BENEFICIARY: 'مستفيد', DONOR: 'متبرع', VOLUNTEER: 'متطوع', EMPLOYEE: 'موظف', PARTNER: 'شريك', OTHER: 'أخرى' };
  const CHANNEL = { PHONE: 'هاتف', EMAIL: 'بريد', WEBSITE: 'موقع', IN_PERSON: 'حضور', WHATSAPP: 'واتساب', SOCIAL: 'سوشيال', OTHER: 'أخرى' };
  const STATUS = { NEW: 'جديدة', UNDER_REVIEW: 'قيد المراجعة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة', REJECTED: 'مرفوضة' };

  const countBy = (arr, key, labels) => {
    const m = new Map();
    for (const r of arr) m.set(r[key], (m.get(r[key]) || 0) + 1);
    return Array.from(m.entries()).map(([k, v]) => ({ key: k, label: labels[k] || k, count: v, pct: arr.length ? Math.round(v*100/arr.length) : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const bySource = countBy(all, 'source', SOURCE);
  const byChannel = countBy(all, 'channel', CHANNEL);
  const bySeverity = countBy(all, 'severity', {});
  const byStatus = countBy(all, 'status', STATUS);

  // متوسط زمن المعالجة (أيام) — للشكاوى المحلولة/المغلقة فقط
  const resolved = all.filter(r => r.resolvedAt && r.receivedAt);
  const avgDays = resolved.length ? Math.round(resolved.reduce((a, r) => a + (new Date(r.resolvedAt) - new Date(r.receivedAt)) / 86400000, 0) / resolved.length * 10) / 10 : null;

  // توزيع شهري
  const monthly = new Array(12).fill(0).map((_, i) => ({ month: i+1, count: 0, resolved: 0 }));
  for (const r of all) {
    const m = new Date(r.receivedAt).getMonth();
    if (new Date(r.receivedAt).getFullYear() === year) monthly[m].count++;
    if (r.resolvedAt && new Date(r.resolvedAt).getFullYear() === year) monthly[new Date(r.resolvedAt).getMonth()].resolved++;
  }
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const maxMonth = Math.max(1, ...monthly.map(m => m.count));

  const resolvedCount = all.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED').length;
  const openCount = all.length - resolvedCount;
  const linkedNcr = all.filter(r => r.relatedNcrId).length;
  const avgSatisfaction = (() => {
    const s = all.filter(r => Number.isFinite(r.satisfaction)).map(r => r.satisfaction);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10 : null;
  })();

  const bar = (pct, color = '#2e8b57') => `<div style="background:#f3f4f6;border-radius:4px;height:14px;position:relative;overflow:hidden"><div style="background:${color};height:100%;width:${pct}%;border-radius:4px"></div></div>`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير التحليلي للشكاوى — ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 9.1.2</div></div>
        <div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#2e8b57">${year}</div><div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">التقرير التحليلي للشكاوى</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#1e40af">${all.length}</div>
          <div style="font-size:.75rem;color:#6b7280">إجمالي الشكاوى</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#166534">${resolvedCount}</div>
          <div style="font-size:.75rem;color:#6b7280">محلولة/مغلقة (${all.length ? Math.round(resolvedCount*100/all.length) : 0}%)</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#991b1b">${openCount}</div>
          <div style="font-size:.75rem;color:#6b7280">مفتوحة</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#92400e">${avgDays ?? '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">متوسط زمن المعالجة (يوم)</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 التوزيع حسب المصدر</div>
        <table><thead><tr><th>المصدر</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${bySource.map(r => `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📞 التوزيع حسب القناة</div>
        <table><thead><tr><th>القناة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${byChannel.map(r => `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct, '#3b82f6')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">⚠️ التوزيع حسب الخطورة</div>
        <table><thead><tr><th>الخطورة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${bySeverity.map(r => {
          const color = r.key === 'مرتفعة' ? '#dc2626' : r.key === 'متوسطة' ? '#f59e0b' : '#6b7280';
          return `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct, color)}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📅 التوزيع الشهري</div>
        <table><thead><tr><th>الشهر</th><th>الشكاوى الواردة</th><th>الشكاوى المحلولة</th><th>الرسم</th></tr></thead>
        <tbody>${monthly.map(m => `<tr><td>${monthNames[m.month-1]}</td><td style="text-align:center">${m.count}</td><td style="text-align:center">${m.resolved}</td><td>${bar(Math.round(m.count*100/maxMonth), '#8b5cf6')}</td></tr>`).join('')}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📈 مؤشرات إضافية</div>
        <table><tbody>
          <tr><th style="width:40%">الشكاوى المرتبطة بعدم مطابقة (NCR)</th><td>${linkedNcr} (${all.length ? Math.round(linkedNcr*100/all.length) : 0}%)</td></tr>
          <tr><th>متوسط رضا الشاكين</th><td>${avgSatisfaction ? avgSatisfaction + '/5' : '—'}</td></tr>
          <tr><th>نسبة الحل</th><td>${all.length ? Math.round(resolvedCount*100/all.length) : 0}%</td></tr>
          <tr><th>الحالات المتأخرة (لم تُحل خلال 7 أيام)</th><td>${all.filter(r => !r.resolvedAt && (Date.now() - new Date(r.receivedAt).getTime()) > 7*86400000).length}</td></tr>
        </tbody></table>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مسؤول الشكاوى</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير التحليلي للشكاوى ${year} | ISO 9001:2015 §9.1.2</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 8. مركز التقارير — فهرس HTML تفاعلي ──────────────────────────────────
router.get('/hub', asyncHandler(async (req, res) => {
  const year = new Date().getFullYear();
  const [ncrCount, complaintsCount, risksCount, reviewsCount, supplierEvalsCount, surveysCount] = await Promise.all([
    prisma.nCR.count({ where: activeWhere() }).catch(() => 0),
    prisma.complaint.count({ where: activeWhere() }).catch(() => 0),
    prisma.risk.count({ where: activeWhere() }).catch(() => 0),
    prisma.managementReview.count().catch(() => 0),
    prisma.supplierEval.count().catch(() => 0),
    prisma.survey.count().catch(() => 0),
  ]);

  const cards = [
    { icon: '📊', title: 'التقرير التحليلي للشكاوى', desc: `تحليل ${complaintsCount} شكوى حسب المصدر/القناة/الخطورة + متوسط زمن المعالجة`, url: `/api/reports/complaints-analytics?year=${year}`, color: '#3b82f6' },
    { icon: '🔍', title: 'التقرير التحليلي لعدم المطابقات', desc: `تحليل باريتو لأسباب ${ncrCount} NCR + نسبة الفعالية`, url: `/api/reports/ncr-analytics?year=${year}`, color: '#dc2626' },
    { icon: '⚠️', title: 'سجل المخاطر', desc: `${risksCount} خطر/فرصة + خريطة حرارة + المخاطر الحرجة`, url: `/api/reports/risk-register`, color: '#f59e0b' },
    { icon: '🏛️', title: 'التقرير السنوي (GAAFZA)', desc: `تقرير الأداء المؤسسي الشامل لعام ${year}`, url: `/api/reports/gaafza?year=${year}`, color: '#2e8b57' },
    { icon: '📝', title: 'مراجعات الإدارة', desc: `${reviewsCount} محضر مراجعة (يُطبع من صفحة المراجعات)`, url: `/#managementReview`, color: '#8b5cf6' },
    { icon: '🏭', title: 'تقييمات الموردين', desc: `${supplierEvalsCount} تقييم (يُطبع من صفحة الموردين)`, url: `/#suppliers`, color: '#0ea5e9' },
    { icon: '⭐', title: 'الاستبيانات', desc: `${surveysCount} استبيان (التحليل من صفحة الاستبيانات)`, url: `/#surveys`, color: '#f97316' },
  ];

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>مركز التقارير — جمعية البر بصبيا</title>
    <style>
      .hub{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}
      .hub-card{border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff;transition:.15s;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px}
      .hub-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08);transform:translateY(-2px)}
      .hub-card .ic{font-size:2rem}
      .hub-card .t{font-weight:800;font-size:1.05rem}
      .hub-card .d{font-size:.82rem;color:#6b7280;line-height:1.5}
      .hub-card .b{margin-top:8px;font-size:.8rem;color:#2e8b57;font-weight:700}
    </style></head>
  <body>
    <div class="page">
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">مركز التقارير — جميع التقارير في مكان واحد</div></div>
        <div style="text-align:left"><button onclick="window.close()" style="background:#f3f4f6;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">✖ إغلاق</button></div>
      </div>

      <div class="report-title">📚 مركز التقارير</div>
      <p style="color:#6b7280;font-size:.9rem">اختر التقرير الذي تريد عرضه أو طباعته. جميع التقارير تُفتح في نافذة طباعة جاهزة.</p>

      <div class="hub">
        ${cards.map(c => `<a class="hub-card" href="${c.url}" target="_blank">
          <div class="ic">${c.icon}</div>
          <div class="t" style="color:${c.color}">${c.title}</div>
          <div class="d">${c.desc}</div>
          <div class="b">فتح التقرير ←</div>
        </a>`).join('')}
      </div>

      <div class="footer">جمعية البر بصبيا — مركز التقارير | نظام إدارة الجودة ISO 9001:2015</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
