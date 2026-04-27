/**
 * modules/quality-dashboard.js — لوحة مدير الجودة الشاملة
 * يُدمج في app() عبر ...window.QmsQualityDashboard
 * يستدعي GET /charts (نفس endpoint اللوحة التنفيذية) ويعرض:
 *   1. اتجاه مؤشرات الأداء (Line) — 6 أشهر
 *   2. NCR حسب الحالة (Doughnut)
 *   3. الشكاوى حسب الحالة (Doughnut)
 *   4. توزيع المخاطر (Bar)
 */
(function () {
  'use strict';

  const COLORS = {
    blue: '#3b82f6', green: '#22c55e', red: '#ef4444',
    yellow: '#f59e0b', purple: '#a855f7', gray: '#9ca3af',
    teal: '#14b8a6', orange: '#f97316',
  };

  const STATUS_COLORS = {
    OPEN: COLORS.red, ROOT_CAUSE: COLORS.orange, ACTION_PLANNED: COLORS.yellow,
    IN_PROGRESS: COLORS.blue, VERIFICATION: COLORS.purple, CLOSED: COLORS.green,
    NEW: COLORS.red, UNDER_REVIEW: COLORS.orange, RESOLVED: COLORS.green,
    'حرج': COLORS.red, 'مرتفع': COLORS.orange, 'متوسط': COLORS.yellow, 'منخفض': COLORS.green,
  };

  window.QmsQualityDashboard = {
    qualityDash: { open: false, loading: false, error: '', _charts: {} },

    async openQualityDashboard() {
      const d = this.qualityDash;
      d.open = true; d.loading = true; d.error = '';
      try {
        const data = await this.api('GET', '/charts');
        await this.$nextTick();
        this._renderQualityCharts(data);
      } catch (e) { d.error = e.message || 'فشل تحميل البيانات'; }
      finally { d.loading = false; }
    },

    closeQualityDashboard() { this.qualityDash.open = false; },

    _renderQualityCharts(data) {
      const d = this.qualityDash;
      Object.values(d._charts).forEach(c => { try { c?.destroy(); } catch {} });
      d._charts = {};

      const Chart = window.Chart;
      if (!Chart) { d.error = 'Chart.js غير محمَّل'; return; }

      // 1. اتجاه مؤشرات الأداء — Line (آخر 6 أشهر)
      const trendCtx = document.getElementById('chartQualityKpiTrend');
      if (trendCtx) {
        d._charts.kpiTrend = new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: data.kpiTrend.map(m => m.label),
            datasets: [
              { label: 'إنجاز الأهداف %', data: data.kpiTrend.map(m => m.objectivesRate), borderColor: COLORS.green,  backgroundColor: COLORS.green  + '20', tension: 0.3, fill: true },
              { label: 'إغلاق NCR %',      data: data.kpiTrend.map(m => m.ncrClosureRate), borderColor: COLORS.blue,   backgroundColor: COLORS.blue   + '20', tension: 0.3, fill: true },
              { label: 'حل الشكاوى %',    data: data.kpiTrend.map(m => m.complaintsRate), borderColor: COLORS.orange, backgroundColor: COLORS.orange + '20', tension: 0.3, fill: true },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
        });
      }

      // 2. NCR حسب الحالة — Doughnut
      const ncrCtx = document.getElementById('chartQualityNcrStatus');
      if (ncrCtx && data.ncrByStatus.length) {
        d._charts.ncrStatus = new Chart(ncrCtx, {
          type: 'doughnut',
          data: {
            labels: data.ncrByStatus.map(r => r.status),
            datasets: [{ data: data.ncrByStatus.map(r => r.count), backgroundColor: data.ncrByStatus.map(r => STATUS_COLORS[r.status] || COLORS.gray) }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
      }

      // 3. الشكاوى حسب الحالة — Doughnut
      const cmpCtx = document.getElementById('chartQualityComplaintsStatus');
      if (cmpCtx && data.complaintsByStatus.length) {
        d._charts.cmpStatus = new Chart(cmpCtx, {
          type: 'doughnut',
          data: {
            labels: data.complaintsByStatus.map(r => r.status),
            datasets: [{ data: data.complaintsByStatus.map(r => r.count), backgroundColor: data.complaintsByStatus.map(r => STATUS_COLORS[r.status] || COLORS.gray) }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
      }

      // 4. توزيع المخاطر — Bar
      const riskCtx = document.getElementById('chartQualityRiskDist');
      if (riskCtx && data.riskDistribution.length) {
        d._charts.riskDist = new Chart(riskCtx, {
          type: 'bar',
          data: {
            labels: data.riskDistribution.map(r => r.level),
            datasets: [{ label: 'عدد المخاطر', data: data.riskDistribution.map(r => r.count), backgroundColor: data.riskDistribution.map(r => STATUS_COLORS[r.level] || COLORS.blue) }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
        });
      }
    },
  };
})();
