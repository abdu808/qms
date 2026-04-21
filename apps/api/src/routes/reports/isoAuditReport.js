/**
 * reports/isoAuditReport.js — تقرير التدقيق الداخلي ISO 9001:2015
 * GET /api/reports/iso-audit?year=YYYY
 */
import { Router } from 'express';
import { prisma } from '../../db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAction } from '../../lib/permissions.js';
import { activeWhere } from '../../lib/dataHelpers.js';
import { PRINT_BASE, formatDate, val } from './_helpers.js';

const router = Router();

router.get('/iso-audit', requireAction('reports', 'read'), asyncHandler(async (req, res) => {
  const year  = parseInt(req.query.year || new Date().getFullYear());
  const yStart = new Date(year, 0, 1);
  const yEnd   = new Date(year + 1, 0, 1);

  const [
    policy, objectives, risks, documents, ncrs, complaints,
    suppliers, trainings, managementReviews, swotItems,
  ] = await Promise.all([
    prisma.qualityPolicy.findFirst({ where: { active: true }, orderBy: { effectiveDate: 'desc' } }),
    prisma.objective.findMany({ where: activeWhere(), include: { kpiEntries: { where: { year }, select: { value: true, month: true } }, owner: { select: { name: true } } }, orderBy: { code: 'asc' } }),
    prisma.risk.findMany({ where: activeWhere({ status: { not: 'CLOSED' } }), include: { owner: { select: { name: true } } }, orderBy: [{ level: 'asc' }, { code: 'asc' }] }),
    prisma.document.findMany({ where: activeWhere({ status: 'PUBLISHED' }), orderBy: { code: 'asc' } }),
    prisma.nCR.findMany({ where: activeWhere(), orderBy: { createdAt: 'desc' }, take: 50, include: { assignee: { select: { name: true } } } }),
    prisma.complaint.findMany({ where: activeWhere(), orderBy: { receivedAt: 'desc' }, take: 50 }),
    prisma.supplier.findMany({ where: activeWhere({ status: 'APPROVED' }), orderBy: { code: 'asc' } }),
    prisma.training.findMany({ where: activeWhere({ createdAt: { gte: yStart, lt: yEnd } }), orderBy: { startDate: 'asc' } }).catch(() => []),
    prisma.managementReview.findMany({ where: { status: 'COMPLETED' }, orderBy: { meetingDate: 'desc' }, take: 3 }).catch(() => []),
    prisma.swotItem.findMany({ where: activeWhere?.({ isActive: true }) ?? { deletedAt: null } }).catch(() => []),
  ]);

  const org = 'نظام إدارة الجودة';
  const generatedAt = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  const statusAr = { OPEN: 'مفتوح', ROOT_CAUSE: 'تحديد السبب', ACTION_PLANNED: 'الإجراء مُخطَّط', IN_PROGRESS: 'قيد التنفيذ', VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق', RESOLVED: 'مُحلول', NEW: 'جديد', UNDER_REVIEW: 'قيد المراجعة', PLANNED: 'مُخطَّط', ACHIEVED: 'مُنجَز', DELAYED: 'متأخر', CANCELLED: 'مُلغى', APPROVED: 'معتمد' };
  const ar = (s) => statusAr[s] || s || '—';

  const table = (headers, rows) => `
    <table class="iso-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const section = (num, iso, title, content) => `
    <div class="section page-break">
      <div class="section-header">
        <span class="iso-ref">ISO ${iso}</span>
        <h2>القسم ${num}: ${title}</h2>
      </div>
      ${content}
    </div>`;

  const css = `
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; font-size: 13px; color: #1a1a2e; margin: 0; }
    .cover { text-align: center; padding: 80px 40px; border-bottom: 3px solid #1e3a5f; }
    .cover h1 { color: #1e3a5f; font-size: 28px; margin-bottom: 10px; }
    .cover h2 { color: #2d6a4f; font-size: 20px; }
    .cover .meta { margin-top: 30px; color: #555; font-size: 14px; }
    .section { padding: 30px 40px; }
    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; }
    .section-header h2 { color: #1e3a5f; font-size: 16px; margin: 0; }
    .iso-ref { background: #1e3a5f; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
    .iso-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    .iso-table th { background: #1e3a5f; color: white; padding: 7px 10px; text-align: right; }
    .iso-table td { border: 1px solid #ddd; padding: 5px 8px; vertical-align: top; }
    .iso-table tr:nth-child(even) { background: #f8fafc; }
    .policy-box { background: #f0f4f8; border-right: 4px solid #1e3a5f; padding: 16px 20px; border-radius: 6px; white-space: pre-wrap; line-height: 1.8; }
    .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .swot-card { border-radius: 8px; padding: 12px; }
    .swot-S { background: #d1fae5; border: 1px solid #6ee7b7; } .swot-W { background: #fee2e2; border: 1px solid #fca5a5; }
    .swot-O { background: #dbeafe; border: 1px solid #93c5fd; } .swot-T { background: #fef3c7; border: 1px solid #fcd34d; }
    .swot-card h3 { margin: 0 0 8px; font-size: 13px; }
    .sig-table { width: 100%; margin-top: 40px; }
    .sig-table td { width: 33%; text-align: center; padding: 20px; border-top: 1px solid #333; }
    .summary-row { display: flex; gap: 20px; margin-bottom: 16px; }
    .summary-box { background: #f0f4f8; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; }
    .summary-box .num { font-size: 24px; font-weight: bold; color: #1e3a5f; }
    .page-break { page-break-before: always; break-before: page; }
    .page-break:first-child { page-break-before: avoid; }
    @media print { .page-break { page-break-before: always; } body { font-size: 11px; } }
  `;

  // احسب KPI progress لكل هدف
  const objProgress = (obj) => {
    if (!obj.kpiEntries?.length) return '—';
    const vals = obj.kpiEntries.map(e => e.value).filter(v => v != null);
    if (!vals.length) return '—';
    const avg = vals.reduce((a, b) => a + Number(b), 0) / vals.length;
    return Math.round(avg) + (obj.unit || '');
  };

  const swotByType = (type) => swotItems.filter(s => s.type === type).map(s => `<li>${s.title || s.content || ''}</li>`).join('') || '<li>لا يوجد</li>';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير التدقيق الداخلي ISO 9001:2015 — ${year}</title>
  <style>${css}</style>
</head>
<body>

<!-- الغلاف -->
<div class="cover">
  <h1>تقرير التدقيق الداخلي</h1>
  <h2>ISO 9001:2015</h2>
  <div class="meta">
    <p><strong>السنة:</strong> ${year}</p>
    <p><strong>تاريخ الإصدار:</strong> ${generatedAt}</p>
    <p style="margin-top:20px;color:#888;font-size:12px">هذا التقرير مُولَّد تلقائياً من نظام إدارة الجودة</p>
  </div>
</div>

${section(1, '5.2', 'سياسة الجودة', policy ? `
  <p><strong>العنوان:</strong> ${val(policy.title)} &nbsp;|&nbsp; <strong>الإصدار:</strong> ${val(policy.version)} &nbsp;|&nbsp; <strong>تاريخ النفاذ:</strong> ${formatDate(policy.effectiveDate)}</p>
  <div class="policy-box">${val(policy.content)}</div>
  ${policy.commitments ? `<div class="policy-box" style="margin-top:12px"><strong>التعهدات:</strong><br>${val(policy.commitments)}</div>` : ''}
` : '<p style="color:#999">لا توجد سياسة جودة مفعَّلة.</p>')}

${section(2, '6.2', 'الأهداف ومؤشرات الأداء', `
  <p><strong>إجمالي الأهداف:</strong> ${objectives.length}</p>
  ${table(['الرمز','العنوان','الحالة','المسؤول','آخر قراءة KPI','الاستحقاق'],
    objectives.map(o => [o.code, o.title, ar(o.status), o.owner?.name || '—', objProgress(o), formatDate(o.targetDate)])
  )}
`)}

${section(3, '6.1', 'سجل المخاطر والفرص', `
  <p><strong>مخاطر نشطة:</strong> ${risks.length}</p>
  ${table(['الرمز','العنوان','المستوى','الحالة','المسؤول','خطة المعالجة'],
    risks.map(r => [r.code, r.title, r.level || '—', ar(r.status), r.owner?.name || '—', (r.treatment || '').substring(0, 60) + (r.treatment?.length > 60 ? '…' : '') ])
  )}
`)}

${section(4, '7.5', 'الوثائق والسجلات المنشورة', `
  <p><strong>وثائق منشورة:</strong> ${documents.length}</p>
  ${table(['الرمز','العنوان','التصنيف','الإصدار','تاريخ النفاذ','تاريخ المراجعة'],
    documents.map(d => [d.code, d.title, d.category || '—', d.currentVersion || '—', formatDate(d.effectiveDate), formatDate(d.reviewDate)])
  )}
`)}

${section(5, '10.2', 'عدم المطابقة والإجراءات التصحيحية', `
  <div class="summary-row">
    <div class="summary-box"><div class="num">${ncrs.length}</div><div>إجمالي NCR</div></div>
    <div class="summary-box"><div class="num">${ncrs.filter(n=>n.status==='CLOSED').length}</div><div>مُغلقة</div></div>
    <div class="summary-box"><div class="num">${ncrs.filter(n=>n.status!=='CLOSED').length}</div><div>مفتوحة</div></div>
  </div>
  ${table(['الرمز','العنوان','الحالة','المُكلَّف','الاستحقاق','الإجراء التصحيحي (مُختصر)'],
    ncrs.map(n => [n.code, n.title, ar(n.status), n.assignee?.name || '—', formatDate(n.dueDate), (n.correctiveAction||'').substring(0,50)+'…'])
  )}
`)}

${section(6, '9.1.2', 'الشكاوى ورضا العملاء', `
  <div class="summary-row">
    <div class="summary-box"><div class="num">${complaints.length}</div><div>إجمالي الشكاوى</div></div>
    <div class="summary-box"><div class="num">${complaints.filter(c=>['RESOLVED','CLOSED'].includes(c.status)).length}</div><div>مُحلولة/مُغلقة</div></div>
    <div class="summary-box"><div class="num">${complaints.filter(c=>!['RESOLVED','CLOSED'].includes(c.status)).length}</div><div>مفتوحة</div></div>
  </div>
  ${table(['الرمز','الموضوع','الحالة','الشدّة','تاريخ الاستلام'],
    complaints.map(c => [c.code, c.subject, ar(c.status), c.severity || '—', formatDate(c.receivedAt)])
  )}
`)}

${section(7, '8.4', 'الموردون المعتمدون', `
  <p><strong>موردون معتمدون:</strong> ${suppliers.length}</p>
  ${table(['الرمز','الاسم','التصنيف','الحالة','المدينة'],
    suppliers.map(s => [s.code, s.name, s.category || '—', ar(s.status), s.city || '—'])
  )}
`)}

${section(8, '7.2', `التدريب والكفاءة — ${year}`, `
  <p><strong>دورات التدريب للسنة:</strong> ${trainings.length}</p>
  ${trainings.length ? table(['العنوان','المدرِّب','تاريخ البداية','الحالة'],
    trainings.map(t => [t.title, t.trainer || '—', formatDate(t.startDate), ar(t.status)])
  ) : '<p style="color:#999">لا توجد بيانات تدريب لهذه السنة.</p>'}
`)}

${section(9, '9.3', 'مراجعة الإدارة', `
  ${managementReviews.length ? table(['العنوان','تاريخ الاجتماع','الحالة'],
    managementReviews.map(m => [m.title, formatDate(m.meetingDate), ar(m.status)])
  ) : '<p style="color:#999">لا توجد مراجعات إدارية مكتملة.</p>'}
`)}

${section(10, '4.1', 'تحليل SWOT — السياق التنظيمي', `
  <div class="swot-grid">
    <div class="swot-card swot-S"><h3>نقاط القوة (Strengths)</h3><ul>${swotByType('STRENGTH')}</ul></div>
    <div class="swot-card swot-W"><h3>نقاط الضعف (Weaknesses)</h3><ul>${swotByType('WEAKNESS')}</ul></div>
    <div class="swot-card swot-O"><h3>الفرص (Opportunities)</h3><ul>${swotByType('OPPORTUNITY')}</ul></div>
    <div class="swot-card swot-T"><h3>التهديدات (Threats)</h3><ul>${swotByType('THREAT')}</ul></div>
  </div>
`)}

<!-- صفحة التوقيعات -->
<div class="section page-break">
  <h2 style="color:#1e3a5f;text-align:center;margin-bottom:60px">صفحة الاعتماد والتوقيعات</h2>
  <table class="sig-table">
    <tr>
      <td><strong>المدقق الداخلي</strong><br><br><br>الاسم: _______________<br>التاريخ: _______________</td>
      <td><strong>مدير الجودة</strong><br><br><br>الاسم: _______________<br>التاريخ: _______________</td>
      <td><strong>المدير العام</strong><br><br><br>الاسم: _______________<br>التاريخ: _______________</td>
    </tr>
  </table>
</div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
