/**
 * managementReview.js — تقرير مراجعة الإدارة HTML المحسّن
 * ISO 9001:2015 § 9.3 — Management Review
 * جمعية البر بصبيا
 */

import { reportShell, v, escHtml } from './shared.js';
import { formatDateBilingual } from '../../utils/hijri.js';

/**
 * generateManagementReviewReport
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ id: string }} options
 * @returns {Promise<string>} HTML string
 */
export async function generateManagementReviewReport(prisma, { id }) {
  const review = await prisma.managementReview.findUnique({
    where: { id },
  });

  if (!review) {
    return reportShell('مراجعة الإدارة — غير موجودة', `
      <div class="no-data" style="margin-top:30px;font-size:1rem">
        ⚠️ لا توجد مراجعة إدارة بهذا المعرّف
      </div>`);
  }

  const STATUS = {
    PLANNED: 'مخطط',
    IN_PROGRESS: 'جارٍ',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغى',
  };

  const meetingDateStr = review.meetingDate
    ? formatDateBilingual(new Date(review.meetingDate))
    : '—';

  const nextReviewStr = review.nextReview
    ? formatDateBilingual(new Date(review.nextReview))
    : null;

  // ── دالة مساعدة لبناء حقل نصي ──────────────────────────────────────────────
  const field = (label, value, minHeight = '36px') => `
    <div class="field">
      <div class="field-label">${escHtml(label)}</div>
      <div class="field-value" style="min-height:${minHeight}">${v(value) !== '—' ? escHtml(String(value)) : '<span style="color:#94a3b8">—</span>'}</div>
    </div>`;

  const content = `
    <div class="report-title">📋 محضر مراجعة الإدارة — ${escHtml(review.code)}</div>

    <!-- البيانات الأساسية -->
    <div class="meta-grid cols-3">
      <div class="meta-item">
        <div class="label">رقم المراجعة</div>
        <div class="value" style="color:#1F4E79;font-size:1rem">${escHtml(review.code)}</div>
      </div>
      <div class="meta-item">
        <div class="label">تاريخ الاجتماع</div>
        <div class="value">${meetingDateStr}</div>
      </div>
      <div class="meta-item">
        <div class="label">الفترة</div>
        <div class="value">${v(review.period)}</div>
      </div>
      <div class="meta-item">
        <div class="label">الحالة</div>
        <div class="value">
          <span class="badge ${statusBadgeClass(review.status)}">${STATUS[review.status] || v(review.status)}</span>
        </div>
      </div>
      <div class="meta-item">
        <div class="label">حضور الإدارة العليا</div>
        <div class="value">
          ${review.topManagementPresent === true
            ? '<span class="rag-green">✅ نعم — حضرت الإدارة العليا</span>'
            : review.topManagementPresent === false
            ? '<span class="rag-red">❌ لم تحضر</span>'
            : '<span class="badge badge-gray">غير محدد</span>'}
        </div>
      </div>
      <div class="meta-item">
        <div class="label">المراجعة القادمة</div>
        <div class="value">${nextReviewStr ? `📅 ${nextReviewStr}` : '—'}</div>
      </div>
    </div>

    <!-- العنوان والحضور -->
    <div class="section">
      <div class="section-title">📌 معلومات الاجتماع</div>
      ${field('عنوان المراجعة', review.title, '40px')}
      ${field('الحضور', review.attendees, '50px')}
    </div>

    <!-- المدخلات ISO 9.3.2 -->
    <div class="section">
      <div class="section-title">📥 مدخلات المراجعة — ISO 9.3.2</div>
      <div style="background:#f0f7ff;border-radius:8px;padding:4px 12px 4px;margin-bottom:10px;font-size:.78rem;color:#475569">
        يجب أن تشمل المراجعة جميع المدخلات المنصوص عليها في البند 9.3.2 من ISO 9001:2015
      </div>
      ${field('تغييرات في السياق الداخلي والخارجي (4.1 / 4.2)', review.contextChanges, '60px')}
      ${field('مراجعة تحقق الأهداف والمؤشرات (6.2)', review.objectivesReview, '60px')}
      ${field('أداء العمليات ومطابقة المنتجات والخدمات (8.1)', review.processPerformance, '60px')}
      ${field('حالة المطابقة وعدم المطابقة — NCR (10.2)', review.conformityStatus, '60px')}
      ${field('نتائج التدقيق الداخلي (9.2)', review.auditResults, '60px')}
      ${field('تغذية راجعة من المستفيدين والمتبرعين (9.1.2)', review.customerFeedback, '60px')}
      ${field('حالة المخاطر والفرص (6.1)', review.risksStatus, '60px')}
      ${field('فرص التحسين المُحددة (10.3)', review.improvementOpps, '60px')}
    </div>

    <!-- المخرجات ISO 9.3.3 -->
    <div class="section">
      <div class="section-title">📤 مخرجات المراجعة — ISO 9.3.3</div>
      <div style="background:#f0fdf4;border-radius:8px;padding:4px 12px 4px;margin-bottom:10px;font-size:.78rem;color:#065F46">
        يجب أن تتضمن المخرجات قرارات وإجراءات متعلقة بالتحسين والموارد وتغيير النظام
      </div>
      ${field('القرارات المتخذة', review.decisions, '70px')}
      ${field('الاحتياجات من الموارد', review.resourceNeeds, '60px')}
      ${field('إجراءات التحسين المقررة', review.improvementActions, '70px')}
      ${field('التغييرات المقترحة على نظام الجودة', review.systemChanges, '60px')}
    </div>

    <!-- محضر الاجتماع -->
    ${review.minutes ? `
    <div class="section">
      <div class="section-title">📝 محضر الاجتماع</div>
      <div class="field-value" style="min-height:80px;white-space:pre-wrap">${escHtml(review.minutes)}</div>
    </div>` : ''}

    <!-- تنبيه المراجعة القادمة -->
    ${nextReviewStr ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <span style="font-size:1.3rem">📅</span>
      <div>
        <div style="font-weight:700;color:#065F46">تاريخ المراجعة القادمة</div>
        <div style="color:#166534;font-size:.9rem">${nextReviewStr}</div>
      </div>
    </div>` : ''}

    <!-- التوقيعات -->
    <div class="sig-row">
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
    </div>`;

  return reportShell(`مراجعة الإدارة — ${review.code}`, content);
}

function statusBadgeClass(status) {
  const map = {
    PLANNED: 'badge-blue',
    IN_PROGRESS: 'badge-blue',
    COMPLETED: '',
    CANCELLED: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}
