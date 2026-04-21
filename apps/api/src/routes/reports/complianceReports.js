/**
 * تقارير الامتثال: ISO (مراجعة الإدارة، NCR، سجل المخاطر)
 */
import { Router } from 'express';
import { prisma } from '../../db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { NotFound } from '../../utils/errors.js';
import { activeWhere } from '../../lib/dataHelpers.js';
import { PRINT_BASE, printBtn, formatDate, val } from './_helpers.js';

const router = Router();

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

// ─── 6. التقرير التحليلي لعدم المطابقات (باريتو — ISO 10.2) ───────────────
router.get('/ncr-analytics', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = req.query.from ? new Date(req.query.from) : new Date(`${year}-01-01`);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const all = await prisma.nCR.findMany({
    where: activeWhere({ createdAt: range }),
    include: { department: { select: { name: true } } },
  });

  const total = all.length;
  const byStatus = {};
  const bySeverity = {};
  const byDept = {};
  const byRoot = {};
  let closedCount = 0, effectiveCount = 0, evaluatedCount = 0;
  let totalCloseDays = 0, closedWithTime = 0;

  for (const n of all) {
    byStatus[n.status] = (byStatus[n.status] || 0) + 1;
    bySeverity[n.severity || 'غير محدد'] = (bySeverity[n.severity || 'غير محدد'] || 0) + 1;
    const dept = n.department?.name || 'غير محدد';
    byDept[dept] = (byDept[dept] || 0) + 1;
    const root = (n.rootCause || '').trim() || 'لم يُحدَّد';
    const rootKey = root.length > 60 ? root.slice(0, 60) + '…' : root;
    byRoot[rootKey] = (byRoot[rootKey] || 0) + 1;
    if (n.status === 'CLOSED') {
      closedCount++;
      if (n.verifiedAt) { totalCloseDays += (new Date(n.verifiedAt) - new Date(n.detectedAt)) / 86400000; closedWithTime++; }
    }
    if (n.effective !== null && n.effective !== undefined) {
      evaluatedCount++;
      if (n.effective) effectiveCount++;
    }
  }

  const avgCloseDays = closedWithTime ? Math.round(totalCloseDays / closedWithTime * 10) / 10 : null;
  const effectiveRate = evaluatedCount ? Math.round(effectiveCount * 100 / evaluatedCount) : null;

  // تحليل باريتو للأسباب الجذرية (80/20)
  const rootSorted = Object.entries(byRoot).sort((a, b) => b[1] - a[1]);
  let cumulative = 0;
  const paretoData = rootSorted.map(([cause, count]) => {
    cumulative += count;
    return { cause, count, pct: Math.round(count*100/total), cumPct: Math.round(cumulative*100/total) };
  });

  const STATUS_LABEL = { OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل الجذر', ACTION_PLANNED: 'مخطط', IN_PROGRESS: 'جارٍ', VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق' };
  const bar = (pct, color = '#2e8b57') => `<div style="background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden"><div style="background:${color};height:100%;width:${pct}%"></div></div>`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير التحليلي لعدم المطابقات — ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 10.2</div></div>
        <div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#dc2626">${year}</div><div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">التقرير التحليلي لعدم المطابقات — تحليل باريتو</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#991b1b">${total}</div>
          <div style="font-size:.75rem;color:#6b7280">إجمالي NCR</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#166534">${closedCount}</div>
          <div style="font-size:.75rem;color:#6b7280">مغلقة (${total ? Math.round(closedCount*100/total) : 0}%)</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#1e40af">${avgCloseDays ?? '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">متوسط زمن الإغلاق (يوم)</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#92400e">${effectiveRate !== null ? effectiveRate + '%' : '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">نسبة فعالية الإجراءات</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 تحليل باريتو للأسباب الجذرية (80/20)</div>
        <p style="font-size:.8rem;color:#6b7280;margin-bottom:8px">القاعدة: 80% من عدم المطابقات تنجم عن 20% من الأسباب — التركيز عليها يضاعف أثر التحسين.</p>
        <table><thead><tr><th>السبب الجذري</th><th style="width:70px">العدد</th><th style="width:60px">%</th><th style="width:80px">التراكمي</th><th>الرسم</th></tr></thead>
        <tbody>${paretoData.slice(0, 15).map(p => {
          const color = p.cumPct <= 80 ? '#dc2626' : '#9ca3af';
          return `<tr><td style="font-size:.82rem">${p.cause}</td><td style="text-align:center;font-weight:700">${p.count}</td><td style="text-align:center">${p.pct}%</td><td style="text-align:center;font-weight:600;color:${p.cumPct <= 80 ? '#dc2626' : '#166534'}">${p.cumPct}%</td><td>${bar(p.pct, color)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">🏢 التوزيع حسب الإدارة</div>
        <table><thead><tr><th>الإدارة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${Object.entries(byDept).sort((a,b) => b[1]-a[1]).map(([d, c]) => `<tr><td>${d}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td><td>${bar(total ? Math.round(c*100/total) : 0, '#8b5cf6')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">⚠️ التوزيع حسب الخطورة</div>
        <table><thead><tr><th>الخطورة</th><th style="width:80px">العدد</th><th style="width:60px">%</th></tr></thead>
        <tbody>${Object.entries(bySeverity).sort((a,b) => b[1]-a[1]).map(([s, c]) => `<tr><td>${s}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📋 التوزيع حسب الحالة</div>
        <table><thead><tr><th>الحالة</th><th style="width:80px">العدد</th><th style="width:60px">%</th></tr></thead>
        <tbody>${Object.entries(byStatus).map(([s, c]) => `<tr><td>${STATUS_LABEL[s] || s}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.82rem;color:#374151">
        <strong>🎯 التوصية:</strong> التركيز على أعلى ${Math.min(3, paretoData.length)} أسباب جذرية — معالجتها تغطي نحو ${paretoData.slice(0,3).reduce((a,p) => a+p.pct, 0)}% من الحالات.
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">ممثل الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير التحليلي لـ NCR ${year} | ISO 9001:2015 §10.2</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 7. سجل المخاطر (ISO 6.1) ──────────────────────────────────────────────
router.get('/risk-register', asyncHandler(async (req, res) => {
  const risks = await prisma.risk.findMany({
    where: activeWhere(),
    include: { department: { select: { name: true } }, owner: { select: { name: true } } },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
  });

  const LEVEL_COLOR = { 'حرج': '#991b1b', 'مرتفع': '#dc2626', 'متوسط': '#f59e0b', 'منخفض': '#16a34a' };
  const STATUS = { IDENTIFIED: 'محدّد', ASSESSED: 'مُقيَّم', TREATED: 'قيد المعالجة', MONITORED: 'مُراقب', ACCEPTED: 'مقبول', CLOSED: 'مغلق' };

  const byLevel = {};
  for (const r of risks) byLevel[r.level] = (byLevel[r.level] || 0) + 1;

  // خريطة حرارة 5×5
  const heat = {};
  for (let p = 1; p <= 5; p++) { heat[p] = {}; for (let i = 1; i <= 5; i++) heat[p][i] = 0; }
  for (const r of risks) if (r.probability >= 1 && r.probability <= 5 && r.impact >= 1 && r.impact <= 5) heat[r.probability][r.impact]++;

  const heatColor = (p, i) => {
    const s = p * i;
    if (s >= 15) return '#991b1b';
    if (s >= 10) return '#dc2626';
    if (s >= 6) return '#f59e0b';
    if (s >= 3) return '#facc15';
    return '#22c55e';
  };

  const critical = risks.filter(r => r.level === 'حرج' || r.level === 'مرتفع');

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>سجل المخاطر — جمعية البر بصبيا</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 6.1</div></div>
        <div style="text-align:left"><div style="font-size:.8rem;color:#666">تاريخ الإصدار</div><div style="font-size:1rem;font-weight:800;color:#2e8b57">${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">سجل المخاطر والفرص</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        ${['حرج', 'مرتفع', 'متوسط', 'منخفض'].map(lvl => `
        <div style="background:#fff;border:2px solid ${LEVEL_COLOR[lvl]};border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.6rem;font-weight:900;color:${LEVEL_COLOR[lvl]}">${byLevel[lvl]||0}</div>
          <div style="font-size:.75rem;color:#6b7280">${lvl}</div>
        </div>`).join('')}
      </div>

      <div class="section">
        <div class="section-title">🌡️ خريطة الحرارة (الاحتمالية × الأثر)</div>
        <table style="max-width:450px;margin:0 auto">
          <thead><tr><th style="background:#f3f4f6">الاحتمالية \\ الأثر</th>${[1,2,3,4,5].map(i => `<th style="text-align:center">${i}</th>`).join('')}</tr></thead>
          <tbody>${[5,4,3,2,1].map(p => `
            <tr><th>${p}</th>${[1,2,3,4,5].map(i => {
              const c = heat[p][i];
              return `<td style="background:${heatColor(p,i)};color:#fff;text-align:center;font-weight:800;font-size:1rem;width:50px;height:42px">${c||''}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div style="text-align:center;font-size:.75rem;color:#6b7280;margin-top:6px">الأرقام تمثّل عدد المخاطر في كل خلية</div>
      </div>

      ${critical.length ? `
      <div class="section">
        <div class="section-title">🚨 المخاطر الحرجة/المرتفعة (${critical.length})</div>
        <table>
          <thead><tr><th>الرمز</th><th>العنوان</th><th>الإدارة</th><th>المسؤول</th><th>P</th><th>I</th><th>الدرجة</th><th>المستوى</th><th>المعالجة</th></tr></thead>
          <tbody>${critical.map(r => `<tr>
            <td style="font-weight:700;color:#2e8b57">${r.code}</td>
            <td style="font-size:.82rem">${val(r.title)}</td>
            <td style="font-size:.8rem">${val(r.department?.name)}</td>
            <td style="font-size:.8rem">${val(r.owner?.name)}</td>
            <td style="text-align:center">${r.probability}</td>
            <td style="text-align:center">${r.impact}</td>
            <td style="text-align:center;font-weight:800">${r.score}</td>
            <td style="text-align:center"><span class="badge" style="background:${LEVEL_COLOR[r.level]||'#6b7280'};color:#fff">${r.level}</span></td>
            <td style="font-size:.78rem">${val(r.treatmentType)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      <div class="section">
        <div class="section-title">📋 السجل الكامل (${risks.length})</div>
        <table>
          <thead><tr><th>الرمز</th><th>النوع</th><th>العنوان</th><th>الإدارة</th><th>P×I</th><th>الدرجة</th><th>المستوى</th><th>الحالة</th></tr></thead>
          <tbody>${risks.map(r => `<tr>
            <td style="font-weight:700;font-size:.78rem">${r.code}</td>
            <td style="font-size:.75rem">${r.type === 'OPPORTUNITY' ? 'فرصة' : 'خطر'}</td>
            <td style="font-size:.8rem">${val(r.title)}</td>
            <td style="font-size:.78rem">${val(r.department?.name)}</td>
            <td style="text-align:center;font-size:.78rem">${r.probability}×${r.impact}</td>
            <td style="text-align:center;font-weight:700">${r.score}</td>
            <td style="text-align:center;font-size:.75rem"><span class="badge" style="background:${LEVEL_COLOR[r.level]||'#6b7280'};color:#fff">${r.level}</span></td>
            <td style="text-align:center;font-size:.75rem">${STATUS[r.status]||r.status}</td>
          </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">لا توجد مخاطر مسجّلة</td></tr>'}</tbody>
        </table>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — سجل المخاطر | ISO 9001:2015 §6.1 | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
