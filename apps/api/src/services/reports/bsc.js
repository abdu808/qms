/**
 * bsc.js — تقرير بطاقة الأداء المتوازن (BSC)
 * ISO 9001:2015 § 6.2 — الأهداف والمؤشرات
 * جمعية البر بصبيا
 */

import { reportShell, ragColor, ragBadge, calcProgress, v, escHtml } from './shared.js';
import { formatDateBilingual } from '../../utils/hijri.js';

/**
 * generateBscReport
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ planId: string, year: number }} options
 * @returns {Promise<string>} HTML string
 */
export async function generateBscReport(prisma, { planId, year }) {
  const currentYear = Number(year) || new Date().getFullYear();

  // ── 1. جلب الخطة الاستراتيجية ──────────────────────────────────────────────
  const plan = await prisma.strategicPlan.findUnique({
    where: { id: planId },
  });

  // ── 2. جلب المحاور (Axes) ──────────────────────────────────────────────────
  const axes = await prisma.axis.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
  });

  // ── 3. جلب الأهداف الاستراتيجية مع كل التسلسل الهرمي ─────────────────────
  const goals = await prisma.strategicGoal.findMany({
    where: { planId, deletedAt: null },
    include: {
      axis: true,
      objectives: {
        where: { deletedAt: null },
        include: {
          indicators: {
            where: { deletedAt: null },
            include: {
              annualTargets: { where: { year: currentYear } },
              kpiEntries: {
                where: { year: currentYear },
                orderBy: { month: 'desc' },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      },
      initiatives: {
        where: { deletedAt: null },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  });

  // ── 4. حساب إجماليات للملخص ────────────────────────────────────────────────
  let totalIndicators = 0;
  let greenCount = 0, yellowCount = 0, redCount = 0, noDataCount = 0;

  for (const goal of goals) {
    for (const obj of goal.objectives || []) {
      for (const ind of obj.indicators || []) {
        totalIndicators++;
        const { actual, progress } = getLatestActual(ind, currentYear);
        if (progress === null) {
          noDataCount++;
        } else {
          const rag = ragColor(progress, ind.greenThreshold ?? 95, ind.yellowThreshold ?? 75);
          if (rag.label === 'مُحقَّق') greenCount++;
          else if (rag.label === 'قيد التحقيق') yellowCount++;
          else redCount++;
        }
      }
    }
  }

  // ── 5. بناء HTML ────────────────────────────────────────────────────────────
  const title = `تقرير بطاقة الأداء المتوازن (BSC) — ${plan?.title || planId} — ${currentYear}`;

  const summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">
      <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#1F4E79">${totalIndicators}</div>
        <div style="font-size:.75rem;color:#64748b">إجمالي المؤشرات</div>
      </div>
      <div style="background:#D1FAE5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#065F46">${greenCount}</div>
        <div style="font-size:.75rem;color:#065F46">🟢 مُحقَّق</div>
      </div>
      <div style="background:#FEF3C7;border:1px solid #fcd34d;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#92400E">${yellowCount}</div>
        <div style="font-size:.75rem;color:#92400E">🟡 قيد التحقيق</div>
      </div>
      <div style="background:#FEE2E2;border:1px solid #fca5a5;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#991B1B">${redCount + noDataCount}</div>
        <div style="font-size:.75rem;color:#991B1B">🔴 دون المستهدف / لا بيانات</div>
      </div>
    </div>`;

  const planMeta = plan ? `
    <div class="meta-grid cols-3">
      <div class="meta-item"><div class="label">كود الخطة</div><div class="value">${v(plan.code)}</div></div>
      <div class="meta-item"><div class="label">عنوان الخطة</div><div class="value">${v(plan.title)}</div></div>
      <div class="meta-item"><div class="label">الحالة</div><div class="value">${planStatusAr(plan.status)}</div></div>
      <div class="meta-item"><div class="label">سنة البداية</div><div class="value">${v(plan.startYear)}</div></div>
      <div class="meta-item"><div class="label">سنة النهاية</div><div class="value">${v(plan.endYear)}</div></div>
      <div class="meta-item"><div class="label">السنة المعروضة</div><div class="value">${currentYear}</div></div>
    </div>` : '';

  // ── بناء جدول BSC لكل محور ──────────────────────────────────────────────────
  const axisMap = new Map(axes.map(a => [a.id, a]));

  // تجميع الأهداف حسب المحور
  const goalsByAxis = new Map();
  const noAxisGoals = [];
  for (const goal of goals) {
    if (goal.axisId) {
      if (!goalsByAxis.has(goal.axisId)) goalsByAxis.set(goal.axisId, []);
      goalsByAxis.get(goal.axisId).push(goal);
    } else {
      noAxisGoals.push(goal);
    }
  }

  let axisTablesHtml = '';

  // دالة لبناء الجدول لمجموعة أهداف
  const buildAxisTable = (axisGoals) => {
    const rows = [];
    for (const goal of axisGoals) {
      const hasObjectives = goal.objectives && goal.objectives.length > 0;
      if (!hasObjectives) {
        rows.push(`
          <tr>
            <td style="font-weight:700;color:#1F4E79">${escHtml(goal.code)}</td>
            <td colspan="7" style="color:#94a3b8;font-style:italic">لا توجد أهداف تشغيلية مرتبطة</td>
          </tr>`);
        continue;
      }
      for (const obj of goal.objectives) {
        const hasIndicators = obj.indicators && obj.indicators.length > 0;
        if (!hasIndicators) {
          rows.push(`
            <tr>
              <td style="font-weight:700;color:#1F4E79;font-size:.8rem">${escHtml(goal.code)}<br><span style="color:#64748b;font-weight:400">${escHtml(goal.title)}</span></td>
              <td style="font-size:.8rem">${escHtml(obj.code)}<br><span style="color:#64748b">${escHtml(obj.title)}</span></td>
              <td colspan="6" style="color:#94a3b8;font-style:italic;text-align:center">لا توجد مؤشرات مرتبطة</td>
            </tr>`);
          continue;
        }
        for (let i = 0; i < obj.indicators.length; i++) {
          const ind = obj.indicators[i];
          const target = ind.annualTargets?.[0];
          const targetVal = target ? target.targetValue : null;
          const { actual, progress } = getLatestActual(ind, currentYear);
          const badge = ragBadge(progress, ind.greenThreshold ?? 95, ind.yellowThreshold ?? 75);
          const progressBar = progress !== null ? `
            <div class="progress-wrap" style="margin-top:4px;width:80px">
              <div class="progress-fill" style="width:${Math.min(100, progress)}%;background:${progressBarColor(progress, ind.greenThreshold ?? 95, ind.yellowThreshold ?? 75)}"></div>
            </div>` : '';

          rows.push(`
            <tr>
              ${i === 0 ? `<td rowspan="${obj.indicators.length}" style="font-weight:700;color:#1F4E79;font-size:.78rem;vertical-align:top;background:#f8fafc">${escHtml(goal.code)}<br><span style="font-size:.72rem;color:#64748b;font-weight:400">${escHtml(goal.title)}</span></td>` : ''}
              ${i === 0 ? `<td rowspan="${obj.indicators.length}" style="font-size:.78rem;vertical-align:top;background:#f8fafc">${escHtml(obj.code)}<br><span style="color:#475569">${escHtml(obj.title)}</span></td>` : ''}
              <td style="font-size:.75rem">${escHtml(ind.code)}<br><span style="color:#475569">${escHtml(ind.nameAr)}</span></td>
              <td style="text-align:center;font-size:.78rem;color:#64748b">${v(ind.unit)}</td>
              <td style="text-align:center;font-weight:700;color:#1F4E79">${targetVal !== null && targetVal !== undefined ? Number(targetVal).toLocaleString('ar-SA') : '—'}</td>
              <td style="text-align:center;font-weight:700;color:#1e293b">${actual !== null ? Number(actual).toLocaleString('ar-SA') : '—'}</td>
              <td style="text-align:center">
                ${progress !== null ? `<strong>${progress}%</strong>` : '—'}
                ${progressBar}
              </td>
              <td style="text-align:center">${badge}</td>
            </tr>`);
        }
      }
    }

    if (rows.length === 0) {
      return `<tr><td colspan="8" class="no-data">لا توجد بيانات لهذا المحور</td></tr>`;
    }
    return rows.join('');
  };

  // إنشاء جداول المحاور
  const orderedAxes = axes.length > 0 ? axes : [];
  for (const axis of orderedAxes) {
    const axisGoals = goalsByAxis.get(axis.id) || [];
    const axisColor = axis.color || '#1F4E79';
    axisTablesHtml += `
      <div class="section">
        <div class="axis-header" style="background:${axisColor}">
          ${escHtml(axis.nameAr)} ${axis.nameEn ? `(${escHtml(axis.nameEn)})` : ''}
          ${axis.weight ? `<span style="font-size:.75rem;opacity:.8;margin-right:8px">الوزن: ${axis.weight}%</span>` : ''}
        </div>
        <table style="margin-top:0;border-radius:0 0 8px 8px;overflow:hidden">
          <thead>
            <tr>
              <th style="min-width:100px">الهدف الاستراتيجي</th>
              <th style="min-width:110px">الهدف التشغيلي</th>
              <th style="min-width:110px">المؤشر</th>
              <th style="width:70px">الوحدة</th>
              <th style="width:80px">المستهدف</th>
              <th style="width:80px">الفعلي</th>
              <th style="width:90px">% التقدم</th>
              <th style="min-width:110px">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${axisGoals.length > 0 ? buildAxisTable(axisGoals) : `<tr><td colspan="8" class="no-data">لا توجد أهداف مرتبطة بهذا المحور</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  // الأهداف غير المرتبطة بمحور
  if (noAxisGoals.length > 0) {
    axisTablesHtml += `
      <div class="section">
        <div class="axis-header" style="background:#475569">
          أهداف غير مصنفة (بدون محور BSC)
        </div>
        <table style="margin-top:0">
          <thead>
            <tr>
              <th>الهدف الاستراتيجي</th>
              <th>الهدف التشغيلي</th>
              <th>المؤشر</th>
              <th style="width:70px">الوحدة</th>
              <th style="width:80px">المستهدف</th>
              <th style="width:80px">الفعلي</th>
              <th style="width:90px">% التقدم</th>
              <th style="min-width:110px">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${buildAxisTable(noAxisGoals)}
          </tbody>
        </table>
      </div>`;
  }

  if (axes.length === 0 && goals.length === 0) {
    axisTablesHtml = `<div class="no-data" style="margin-top:20px">لا توجد بيانات للخطة المحددة أو لم يتم إعداد المحاور بعد</div>`;
  }

  const content = `
    <div class="report-title">📊 تقرير بطاقة الأداء المتوازن (BSC) — ${escHtml(plan?.title || planId)} — ${currentYear}</div>

    ${planMeta}
    ${summaryCards}

    <div class="section">
      <div class="section-title">📋 تفاصيل المؤشرات حسب المحاور الاستراتيجية</div>
      ${axisTablesHtml}
    </div>

    <div class="sig-row">
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
    </div>`;

  return reportShell(title, content);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLatestActual(indicator, year) {
  if (!indicator.kpiEntries || indicator.kpiEntries.length === 0) {
    return { actual: null, progress: null };
  }
  // أحدث إدخال في السنة المطلوبة
  const sorted = [...indicator.kpiEntries].sort((a, b) => b.month - a.month);
  const latest = sorted[0];
  if (!latest) return { actual: null, progress: null };

  const actual = latest.actualValue;
  const target = indicator.annualTargets?.[0]?.targetValue;
  const progress = calcProgress(actual, target);
  return { actual, progress };
}

function progressBarColor(progress, green = 95, yellow = 75) {
  if (progress >= green) return '#10b981';
  if (progress >= yellow) return '#f59e0b';
  return '#ef4444';
}

function planStatusAr(status) {
  const map = { DRAFT: 'مسودة', ACTIVE: 'نشطة', ARCHIVED: 'مؤرشفة' };
  return map[status] || status || '—';
}
