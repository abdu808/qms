/**
 * strategicPlan.js — تقرير الخطة الاستراتيجية الكاملة
 * ISO 9001:2015 § 6.2 — Quality objectives and planning
 * جمعية البر بصبيا
 */

import { reportShell, ragColor, ragBadge, calcProgress, v, escHtml } from './shared.js';
import { formatDateBilingual } from '../../utils/hijri.js';

/**
 * generateStrategicPlanReport
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ planId: string, year: number }} options
 * @returns {Promise<string>} HTML string
 */
export async function generateStrategicPlanReport(prisma, { planId, year }) {
  const currentYear = Number(year) || new Date().getFullYear();

  // ── 1. جلب الخطة الاستراتيجية ──────────────────────────────────────────────
  const plan = await prisma.strategicPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return reportShell('الخطة الاستراتيجية — غير موجودة', `
      <div class="no-data" style="margin-top:30px;font-size:1rem">
        ⚠️ لا توجد خطة استراتيجية بهذا المعرّف
      </div>`);
  }

  // ── 2. جلب الأهداف الاستراتيجية مع كل البيانات المرتبطة ───────────────────
  const goals = await prisma.strategicGoal.findMany({
    where: { planId, deletedAt: null },
    include: {
      axis: true,
      ownerUser: { select: { name: true } },
      objectives: {
        where: { deletedAt: null },
        include: {
          owner: { select: { name: true } },
          indicators: {
            where: { deletedAt: null },
            include: {
              annualTargets: { where: { year: currentYear } },
              kpiEntries: {
                where: { year: currentYear },
                orderBy: { month: 'desc' },
                take: 1,
              },
              owner: { select: { name: true } },
            },
          },
        },
        orderBy: { code: 'asc' },
      },
      initiatives: {
        where: { deletedAt: null },
        include: {
          owner: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  });

  // ── 3. جلب سياسة الجودة (اختياري — للسياق) ────────────────────────────────
  const policy = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveDate: 'desc' },
  }).catch(() => null);

  // ── 4. إحصاءات إجمالية ─────────────────────────────────────────────────────
  let totalGoals = goals.length;
  let totalObjectives = 0;
  let totalIndicators = 0;
  let totalInitiatives = 0;
  let greenCount = 0, yellowCount = 0, redCount = 0;

  for (const goal of goals) {
    totalObjectives += goal.objectives?.length || 0;
    totalInitiatives += goal.initiatives?.length || 0;
    for (const obj of goal.objectives || []) {
      for (const ind of obj.indicators || []) {
        totalIndicators++;
        const entry = ind.kpiEntries?.[0];
        const target = ind.annualTargets?.[0]?.targetValue;
        const prog = calcProgress(entry?.actualValue, target);
        if (prog !== null) {
          const rag = ragColor(prog, ind.greenThreshold ?? 95, ind.yellowThreshold ?? 75);
          if (rag.label === 'مُحقَّق') greenCount++;
          else if (rag.label === 'قيد التحقيق') yellowCount++;
          else redCount++;
        }
      }
    }
  }

  // ── 5. بناء HTML ────────────────────────────────────────────────────────────
  const title = `الخطة الاستراتيجية — ${plan.title} — ${currentYear}`;

  const summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:22px">
      <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#1F4E79">${totalGoals}</div>
        <div style="font-size:.72rem;color:#64748b">أهداف استراتيجية</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#475569">${totalObjectives}</div>
        <div style="font-size:.72rem;color:#64748b">أهداف تشغيلية</div>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#92400E">${totalIndicators}</div>
        <div style="font-size:.72rem;color:#64748b">مؤشرات KPI</div>
      </div>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#5b21b6">${totalInitiatives}</div>
        <div style="font-size:.72rem;color:#64748b">مبادرات</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:.9rem;font-weight:800;color:#065F46">🟢${greenCount} 🟡${yellowCount} 🔴${redCount}</div>
        <div style="font-size:.72rem;color:#64748b">RAG المؤشرات</div>
      </div>
    </div>`;

  const planMeta = `
    <div class="meta-grid">
      <div class="meta-item"><div class="label">كود الخطة</div><div class="value">${v(plan.code)}</div></div>
      <div class="meta-item"><div class="label">عنوان الخطة</div><div class="value">${v(plan.title)}</div></div>
      <div class="meta-item"><div class="label">الحالة</div><div class="value">${planStatusAr(plan.status)}</div></div>
      <div class="meta-item"><div class="label">فترة الخطة</div><div class="value">${v(plan.startYear)} — ${v(plan.endYear)}</div></div>
      ${plan.description ? `<div class="meta-item" style="grid-column:span 2"><div class="label">وصف الخطة</div><div class="value">${escHtml(plan.description)}</div></div>` : ''}
      ${plan.notes ? `<div class="meta-item" style="grid-column:span 2"><div class="label">ملاحظات</div><div class="value">${escHtml(plan.notes)}</div></div>` : ''}
    </div>`;

  // سياسة الجودة (إذا وُجدت)
  const policySection = policy ? `
    <div class="section">
      <div class="section-title">📜 سياسة الجودة المعتمدة (ISO 5.2)</div>
      <div style="background:#f0f7ff;border-right:4px solid #1F4E79;border-radius:6px;padding:12px 16px;white-space:pre-wrap;color:#1e293b;font-size:.85rem">
        ${escHtml(policy.content || '')}
      </div>
      <div style="margin-top:8px;font-size:.75rem;color:#64748b">
        الإصدار: ${v(policy.version)} | الاعتماد: ${v(policy.approvedBy)} | تاريخ النفاذ: ${policy.effectiveDate ? new Date(policy.effectiveDate).toLocaleDateString('ar-SA') : '—'}
      </div>
    </div>` : '';

  // ── بناء قسم كل هدف استراتيجي ──────────────────────────────────────────────
  let goalsHtml = '';

  if (goals.length === 0) {
    goalsHtml = `<div class="no-data">لا توجد أهداف استراتيجية مرتبطة بهذه الخطة</div>`;
  } else {
    for (const goal of goals) {
      const axisLabel = goal.axis
        ? `<span class="badge badge-blue" style="font-size:.72rem">${escHtml(goal.axis.nameAr)}</span>`
        : '';

      goalsHtml += `
        <div style="border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;overflow:hidden">
          <!-- رأس الهدف الاستراتيجي -->
          <div style="background:#1F4E79;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:800;font-size:.95rem">${escHtml(goal.code)}</span>
              <span style="margin-right:10px;font-size:.9rem">${escHtml(goal.title)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${axisLabel ? axisLabel.replace('class="badge badge-blue"', 'style="background:rgba(255,255,255,.2);color:#fff;padding:2px 8px;border-radius:12px;font-size:.72rem"') : ''}
              ${goal.ownerUser ? `<span style="font-size:.72rem;opacity:.8">المالك: ${escHtml(goal.ownerUser.name)}</span>` : ''}
              <span style="font-size:.72rem;opacity:.8">${goalStatusAr(goal.status)}</span>
            </div>
          </div>

          <div style="padding:14px 16px">
            <!-- بيانات الهدف -->
            ${(goal.baseline || goal.target || goal.responsible) ? `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;background:#f8fafc;border-radius:8px;padding:10px">
              ${goal.baseline ? `<div><div style="font-size:.7rem;color:#64748b">الوضع الراهن</div><div style="font-weight:600">${escHtml(goal.baseline)}</div></div>` : ''}
              ${goal.target ? `<div><div style="font-size:.7rem;color:#64748b">المستهدف</div><div style="font-weight:600">${escHtml(goal.target)}</div></div>` : ''}
              ${goal.responsible ? `<div><div style="font-size:.7rem;color:#64748b">الجهة المسؤولة</div><div style="font-weight:600">${escHtml(goal.responsible)}</div></div>` : ''}
            </div>` : ''}

            <!-- الأهداف التشغيلية والمؤشرات -->
            ${buildObjectivesTable(goal.objectives || [], currentYear)}

            <!-- المبادرات -->
            ${buildInitiativesTable(goal.initiatives || [])}
          </div>
        </div>`;
    }
  }

  const content = `
    <div class="report-title">🎯 الخطة الاستراتيجية — ${escHtml(plan.title)} — ${currentYear}</div>

    ${planMeta}
    ${summaryCards}
    ${policySection}

    <div class="section">
      <div class="section-title">🏆 الأهداف الاستراتيجية والمؤشرات</div>
      ${goalsHtml}
    </div>

    <div class="sig-row">
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
    </div>`;

  return reportShell(title, content);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildObjectivesTable(objectives, year) {
  if (!objectives || objectives.length === 0) {
    return `<div class="no-data" style="margin:8px 0">لا توجد أهداف تشغيلية مرتبطة</div>`;
  }

  const rows = objectives.map(obj => {
    const indicators = obj.indicators || [];
    if (indicators.length === 0) {
      return `
        <tr>
          <td style="font-weight:700;font-size:.78rem;color:#1F4E79">${escHtml(obj.code)}</td>
          <td style="font-size:.82rem">${escHtml(obj.title)}</td>
          <td style="font-size:.75rem;color:#64748b">${v(obj.owner?.name)}</td>
          <td colspan="5" style="color:#94a3b8;font-style:italic;text-align:center;font-size:.78rem">لا توجد مؤشرات</td>
        </tr>`;
    }

    return indicators.map((ind, i) => {
      const entry = ind.kpiEntries?.[0];
      const target = ind.annualTargets?.[0]?.targetValue;
      const actual = entry?.actualValue ?? null;
      const prog = calcProgress(actual, target);
      const badge = ragBadge(prog, ind.greenThreshold ?? 95, ind.yellowThreshold ?? 75);

      return `
        <tr>
          ${i === 0 ? `<td rowspan="${indicators.length}" style="font-weight:700;font-size:.78rem;color:#1F4E79;vertical-align:top">${escHtml(obj.code)}</td>` : ''}
          ${i === 0 ? `<td rowspan="${indicators.length}" style="font-size:.82rem;vertical-align:top">${escHtml(obj.title)}</td>` : ''}
          ${i === 0 ? `<td rowspan="${indicators.length}" style="font-size:.75rem;color:#64748b;vertical-align:top">${v(obj.owner?.name)}</td>` : ''}
          <td style="font-size:.75rem">${escHtml(ind.code)}<br><span style="color:#475569">${escHtml(ind.nameAr)}</span></td>
          <td style="text-align:center;font-size:.75rem;color:#64748b">${v(ind.unit)}</td>
          <td style="text-align:center;font-weight:700;color:#1F4E79">${target !== null && target !== undefined ? Number(target).toLocaleString('ar-SA') : '—'}</td>
          <td style="text-align:center;font-weight:700">${actual !== null ? Number(actual).toLocaleString('ar-SA') : '—'}</td>
          <td style="text-align:center">${badge}</td>
        </tr>`;
    }).join('');
  }).join('');

  return `
    <table style="margin-bottom:12px;font-size:.82rem">
      <thead>
        <tr>
          <th style="width:90px">الهدف التشغيلي</th>
          <th>العنوان</th>
          <th style="width:90px">المسؤول</th>
          <th style="min-width:100px">المؤشر</th>
          <th style="width:60px">الوحدة</th>
          <th style="width:75px">المستهدف</th>
          <th style="width:75px">الفعلي</th>
          <th style="min-width:110px">الحالة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildInitiativesTable(initiatives) {
  if (!initiatives || initiatives.length === 0) return '';

  const INIT_STATUS = {
    NOT_STARTED: 'لم تبدأ',
    IN_PROGRESS: 'جارية',
    COMPLETED: 'مكتملة',
    ON_HOLD: 'موقوفة',
    CANCELLED: 'ملغاة',
  };

  const rows = initiatives.map(ini => `
    <tr>
      <td style="font-weight:700;font-size:.75rem;color:#5b21b6">${escHtml(ini.code)}</td>
      <td style="font-size:.8rem">${escHtml(ini.name)}</td>
      <td style="font-size:.75rem;color:#64748b">${v(ini.owner?.name)}</td>
      <td style="font-size:.75rem;color:#64748b">${v(ini.department?.name)}</td>
      <td style="text-align:center;font-size:.75rem">
        ${ini.startDate ? new Date(ini.startDate).toLocaleDateString('ar-SA') : '—'}
        ${ini.endDate ? ` → ${new Date(ini.endDate).toLocaleDateString('ar-SA')}` : ''}
      </td>
      <td style="text-align:center">
        <div class="progress-wrap" style="width:70px;margin:0 auto 3px">
          <div class="progress-fill" style="width:${ini.progress || 0}%;background:${ini.progress >= 90 ? '#10b981' : ini.progress >= 60 ? '#f59e0b' : '#ef4444'}"></div>
        </div>
        <div style="font-size:.72rem;text-align:center;color:#64748b">${ini.progress || 0}%</div>
      </td>
      <td style="text-align:center;font-size:.75rem">
        <span class="badge ${initiativeStatusClass(ini.status)}">${INIT_STATUS[ini.status] || v(ini.status)}</span>
      </td>
    </tr>`).join('');

  return `
    <div style="margin-top:8px">
      <div style="font-size:.78rem;font-weight:700;color:#5b21b6;margin-bottom:5px;padding:4px 8px;background:#f5f3ff;border-radius:6px">
        🚀 المبادرات الاستراتيجية (${initiatives.length})
      </div>
      <table style="font-size:.8rem">
        <thead>
          <tr>
            <th style="width:90px">الكود</th>
            <th>اسم المبادرة</th>
            <th style="width:90px">المالك</th>
            <th style="width:90px">الإدارة</th>
            <th style="width:110px">الفترة</th>
            <th style="width:80px">التقدم</th>
            <th style="width:80px">الحالة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function planStatusAr(status) {
  const map = { DRAFT: 'مسودة', ACTIVE: 'نشطة', ARCHIVED: 'مؤرشفة' };
  return map[status] || status || '—';
}

function goalStatusAr(status) {
  const map = { PLANNED: 'مخطط', IN_PROGRESS: 'جارٍ', ACHIEVED: 'مُحقَّق', DELAYED: 'متأخر', CANCELLED: 'ملغى' };
  return map[status] || status || '';
}

function initiativeStatusClass(status) {
  const map = {
    NOT_STARTED: 'badge-gray',
    IN_PROGRESS: 'badge-blue',
    COMPLETED: '',
    ON_HOLD: '',
    CANCELLED: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}
