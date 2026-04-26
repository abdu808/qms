/**
 * shared.js — دوال مشتركة لتقارير HTML القابلة للطباعة
 * جمعية البر بصبيا — نظام إدارة الجودة ISO 9001:2015
 */

import { formatDateBilingual } from '../../utils/hijri.js';

/**
 * ragColor — لون RAG حسب نسبة التقدم
 * @param {number} progress  - 0 to 100 (or higher)
 * @param {number} greenThreshold  - default 95
 * @param {number} yellowThreshold - default 75
 */
export function ragColor(progress, greenThreshold = 95, yellowThreshold = 75) {
  const p = Number(progress) || 0;
  if (p >= greenThreshold) {
    return { bg: '#D1FAE5', text: '#065F46', label: 'مُحقَّق', emoji: '🟢' };
  }
  if (p >= yellowThreshold) {
    return { bg: '#FEF3C7', text: '#92400E', label: 'قيد التحقيق', emoji: '🟡' };
  }
  return { bg: '#FEE2E2', text: '#991B1B', label: 'دون المستهدف', emoji: '🔴' };
}

/**
 * reportShell — يُغلِّف المحتوى في صفحة HTML كاملة احترافية RTL
 * @param {string} title       - عنوان التقرير
 * @param {string} content     - HTML المحتوى الداخلي
 * @param {string} extraStyles - CSS إضافي اختياري
 */
export function reportShell(title, content, extraStyles = '') {
  const now = new Date();
  const bilingualDate = formatDateBilingual(now);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    /* ── Reset & Base ─────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Noto Kufi Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #1e293b;
      background: #f8fafc;
      font-size: 13px;
      line-height: 1.7;
    }

    /* ── Page Wrapper ─────────────────────────────────── */
    .qms-page {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 28px 40px;
      background: #fff;
      min-height: 100vh;
    }

    /* ── Print Button ─────────────────────────────────── */
    .print-bar {
      text-align: center;
      margin-bottom: 20px;
      padding: 10px;
      background: #f1f5f9;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .btn-print {
      background: #1F4E79;
      color: #fff;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      font-size: .95rem;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      transition: background .15s;
    }
    .btn-print:hover { background: #163b5a; }
    .btn-close {
      background: #e2e8f0;
      color: #334155;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: .9rem;
      cursor: pointer;
      font-family: inherit;
      margin-right: 10px;
    }

    /* ── Header ───────────────────────────────────────── */
    .qms-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1F4E79;
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .org-logo {
      width: 52px;
      height: 52px;
      background: #1F4E79;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      color: #fff;
      flex-shrink: 0;
      margin-left: 12px;
    }
    .org-info { display: flex; align-items: center; }
    .org-name  { font-size: 1.15rem; font-weight: 800; color: #1F4E79; }
    .org-sub   { font-size: .72rem; color: #64748b; margin-top: 2px; }
    .header-date { text-align: left; }
    .header-date .label { font-size: .7rem; color: #94a3b8; }
    .header-date .value { font-size: .82rem; font-weight: 700; color: #1F4E79; }

    /* ── Report Title ─────────────────────────────────── */
    .report-title {
      font-size: 1.3rem;
      font-weight: 800;
      color: #1F4E79;
      border-right: 5px solid #1F4E79;
      padding-right: 12px;
      margin-bottom: 18px;
    }

    /* ── Meta Grid ────────────────────────────────────── */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .meta-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .meta-item .label { font-size: .7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    .meta-item .value { font-weight: 700; color: #1e293b; margin-top: 2px; }

    /* ── Sections ─────────────────────────────────────── */
    .section { margin-bottom: 22px; }
    .section-title {
      font-weight: 800;
      font-size: .97rem;
      color: #1F4E79;
      border-bottom: 2px solid #dbeafe;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }
    .field { margin-bottom: 10px; }
    .field-label { font-size: .75rem; color: #64748b; font-weight: 700; margin-bottom: 3px; }
    .field-value {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 9px 12px;
      min-height: 34px;
      white-space: pre-wrap;
      color: #1e293b;
    }

    /* ── Tables ───────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: .84rem;
    }
    th {
      background: #1F4E79;
      color: #fff;
      font-weight: 700;
      padding: 8px 10px;
      text-align: right;
      border: 1px solid #1a3f61;
      white-space: nowrap;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    tr:hover td { background: #f0f9ff; }

    /* ── RAG Badges ───────────────────────────────────── */
    .rag-green  { background: #D1FAE5; color: #065F46; padding: 3px 10px; border-radius: 20px; font-size: .78rem; font-weight: 700; display: inline-block; white-space: nowrap; }
    .rag-yellow { background: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 20px; font-size: .78rem; font-weight: 700; display: inline-block; white-space: nowrap; }
    .rag-red    { background: #FEE2E2; color: #991B1B; padding: 3px 10px; border-radius: 20px; font-size: .78rem; font-weight: 700; display: inline-block; white-space: nowrap; }
    .badge      { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: .78rem; font-weight: 700; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-gray { background: #f1f5f9; color: #475569; }

    /* ── Progress Bar ─────────────────────────────────── */
    .progress-wrap {
      background: #e2e8f0;
      border-radius: 4px;
      height: 12px;
      overflow: hidden;
    }
    .progress-fill { height: 100%; border-radius: 4px; transition: width .3s; }

    /* ── Axis Header ─────────────────────────────────── */
    .axis-header {
      background: #1F4E79;
      color: #fff;
      font-weight: 800;
      font-size: .95rem;
      padding: 9px 14px;
      border-radius: 8px 8px 0 0;
      margin-top: 18px;
    }

    /* ── Signature Row ────────────────────────────────── */
    .sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 7px; height: 44px; }
    .sig-label { font-size: .73rem; color: #64748b; }

    /* ── Footer ───────────────────────────────────────── */
    .qms-footer {
      text-align: center;
      font-size: .68rem;
      color: #94a3b8;
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
    }

    /* ── No-Data ──────────────────────────────────────── */
    .no-data {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 18px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed #e2e8f0;
    }

    /* ── Print Styles ─────────────────────────────────── */
    @media print {
      @page { margin: 15mm; size: A4; }
      body { font-size: 11px; background: #fff; }
      .qms-page { padding: 0; max-width: 100%; }
      .print-bar, nav, button { display: none !important; }
      .axis-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .rag-green, .rag-yellow, .rag-red { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

    ${extraStyles}
  </style>
</head>
<body>
  <div class="qms-page">
    <!-- زر الطباعة -->
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
      <button class="btn-close" onclick="window.close()">✖ إغلاق</button>
    </div>

    <!-- الرأس -->
    <div class="qms-header">
      <div class="org-info">
        <div class="org-logo">🌿</div>
        <div>
          <div class="org-name">جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015</div>
        </div>
      </div>
      <div class="header-date">
        <div class="label">تاريخ التقرير</div>
        <div class="value">${bilingualDate}</div>
      </div>
    </div>

    ${content}

    <!-- التذييل -->
    <div class="qms-footer">
      نظام إدارة الجودة — جمعية البر بصبيا | تم إنشاؤه في ${bilingualDate}
    </div>
  </div>
</body>
</html>`;
}

/** escHtml — تشفير HTML بسيط */
export function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** v — قيمة آمنة مع fallback */
export function v(val, fallback = '—') {
  return val != null && val !== '' ? val : fallback;
}

/** pct — احسب نسبة التقدم بأمان */
export function calcProgress(actual, target) {
  const a = Number(actual), t = Number(target);
  if (!t || isNaN(a) || isNaN(t)) return null;
  return Math.round((a / t) * 100);
}

/** ragBadge — يُرجع HTML badge حسب نسبة التقدم */
export function ragBadge(progress, greenThreshold = 95, yellowThreshold = 75) {
  if (progress === null || progress === undefined || isNaN(progress)) {
    return '<span class="badge badge-gray">لا بيانات</span>';
  }
  const { bg, text, label, emoji } = ragColor(progress, greenThreshold, yellowThreshold);
  return `<span style="background:${bg};color:${text};padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:700;display:inline-block">${emoji} ${label} (${progress}%)</span>`;
}
