// apps/api/src/lib/printHelpers.js
/**
 * مشتركات تقارير الطباعة — HTML محسّن للطباعة (A4 — عربي RTL)
 */

export const PRINT_BASE = `
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

export function printBtn() {
  return `<div class="no-print" style="text-align:center;margin:20px 0">
    <button onclick="window.print()" style="background:#2e8b57;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:1rem;cursor:pointer;font-family:inherit">🖨️ طباعة / حفظ PDF</button>
    <button onclick="window.close()" style="background:#f3f4f6;border:none;padding:10px 20px;border-radius:8px;font-size:.9rem;cursor:pointer;margin-right:8px;font-family:inherit">✖ إغلاق</button>
  </div>`;
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function val(v, fallback = '—') { return v || fallback; }
