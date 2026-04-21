/**
 * modules/kpi-common.js — دوال مشتركة بين modules الـ KPI
 * يُدمج في app() عبر ...window.QmsKpiCommon
 *
 * يُحمَّل أولاً قبل باقي kpi modules في index.html.
 *
 * تحليل الـ State المشترك (Phase 2.2):
 * لا يوجد state مكرر حقيقي بين الـ KPI modules — كل module له state مستقل:
 *   - kpi-quickentry.js: myDue, _kpiDraft, _undoTimers
 *   - kpi-bulk.js:       bulk  (يقرأ this.myDue من quickentry لكن لا يعرّفه)
 *   - kpi-tracking.js:   kpi   (object مستقل لمتابعة الأداء الكامل)
 *   - my-kpi.js:         myKpi, myKpiForm  (wizard إدخال القراءة الشخصي)
 * هذا الملف يحتوي فقط على helper functions (formatters, color helpers).
 */
(function () {
  'use strict';
  window.QmsKpiCommon = {
    kpiSeverityColor(s) {
      return s === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300'
           : s === 'HIGH'     ? 'bg-orange-100 text-orange-700 border-orange-300'
           : s === 'WARNING'  ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300';
    },
    kpiSeverityLabel(s) {
      return { CRITICAL: 'حرج', HIGH: 'مرتفع', WARNING: 'تنبيه', INFO: 'معلومة' }[s] || s;
    },
    kpiRagColor(r) {
      return r === 'GREEN'  ? 'bg-emerald-500'
           : r === 'YELLOW' ? 'bg-amber-500'
           : r === 'RED'    ? 'bg-red-500'
                            : 'bg-slate-300';
    },
    kpiRowBorder(r) {
      return r === 'GREEN'  ? 'border-r-4 border-r-emerald-500'
           : r === 'YELLOW' ? 'border-r-4 border-r-amber-500'
           : r === 'RED'    ? 'border-r-4 border-r-red-500'
                            : 'border-r-4 border-r-slate-300';
    },
    kpiRowBg(r) {
      return r === 'RED' ? 'bg-red-50/40' : '';
    },
    kpiRagLabel(r) {
      return { GREEN: 'متحقق', YELLOW: 'قيد التحقق', RED: 'متأخر', GRAY: 'لا بيانات' }[r] || r;
    },
    kpiMonthName(m) {
      return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m-1] || '';
    },
    kpiFmt(v) {
      if (v == null || isNaN(v)) return '—';
      const n = Number(v);
      if (n >= 1000000) return (n/1000000).toFixed(1) + 'م';
      if (n >= 1000)    return (n/1000).toFixed(1) + 'ك';
      return Math.abs(n) < 1 ? n.toFixed(2) : Math.round(n).toLocaleString('ar-SA');
    },
  };
})();
