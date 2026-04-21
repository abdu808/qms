/**
 * modules/operational-reports.js — التقارير التشغيلية
 * يُدمج في app() عبر ...window.QmsOperationalReports
 */
(function () {
  'use strict';
  window.QmsOperationalReports = {
    // ─── State ───────────────────────────────────────────────────────────
    opReportsCatalog: [],      // [{ slug, title, description, severity }]
    opReportsSummary: null,    // { asOf, totalIssues, reports: [{slug,count,...}] }
    opReportActive: null,      // currently opened report { slug, title, severity, asOf, count, items }
    opReportBusy: false,

    // ─── Methods ─────────────────────────────────────────────────────────
    async loadOperationalReports() {
      try {
        this.opReportActive = null;
        const [cat, sum] = await Promise.all([
          this.api('GET', '/operational-reports/catalog'),
          this.api('GET', '/operational-reports/all/summary'),
        ]);
        this.opReportsCatalog = cat.catalog || [];
        this.opReportsSummary = sum;
      } catch (e) {
        this.opReportsCatalog = [];
        this.opReportsSummary = null;
        alert(e.message || 'فشل تحميل التقارير التشغيلية');
      }
    },

    async openOpReport(slug) {
      this.opReportBusy = true;
      try {
        const r = await this.api('GET', `/operational-reports/${slug}`);
        this.opReportActive = r;
      } catch (e) {
        alert(e.message || 'فشل تحميل التقرير');
      } finally {
        this.opReportBusy = false;
      }
    },

    closeOpReport() { this.opReportActive = null; },

    opReportSeverityClass(sev) {
      return { critical: 'bg-red-600', warning: 'bg-amber-500', info: 'bg-sky-500' }[sev] || 'bg-gray-400';
    },
    opReportSeverityLabel(sev) {
      return { critical: 'حرج', warning: 'تحذير', info: 'معلومة' }[sev] || sev;
    },

    // Helper: يستخرج count لـ slug من opReportsSummary
    opReportCount(slug) {
      if (!this.opReportsSummary?.reports) return null;
      const r = this.opReportsSummary.reports.find(x => x.slug === slug);
      return r ? r.count : null;
    },
  };
})();
