/**
 * modules/exec-dashboard.js — اللوحة التنفيذية بالرسوم البيانية
 * يُدمج في app() عبر ...window.QmsExecDashboard
 * يستخدم Chart.js المُحمَّل عالمياً في index.html
 */
(function () {
  'use strict';

  // ألوان موحّدة
  const COLORS = {
    blue:   '#3b82f6', green:  '#22c55e', red:    '#ef4444',
    yellow: '#f59e0b', purple: '#a855f7', gray:   '#9ca3af',
    teal:   '#14b8a6', orange: '#f97316', indigo: '#6366f1',
  };

  const STATUS_COLORS = {
    // NCR
    OPEN: COLORS.red, ROOT_CAUSE: COLORS.orange, ACTION_PLANNED: COLORS.yellow,
    IN_PROGRESS: COLORS.blue, VERIFICATION: COLORS.purple, CLOSED: COLORS.green,
    // Complaints
    NEW: COLORS.red, UNDER_REVIEW: COLORS.orange, RESOLVED: COLORS.green,
    // Objectives
    PLANNED: COLORS.gray, ACHIEVED: COLORS.green, DELAYED: COLORS.red, CANCELLED: COLORS.gray,
    // Risks
    'حرج': COLORS.red, 'مرتفع': COLORS.orange, 'متوسط': COLORS.yellow, 'منخفض': COLORS.green,
  };

  window.QmsExecDashboard = {
    execDash: { open: false, loading: false, error: '', data: null, _charts: {} },

    async openExecDashboard() {
      const d = this.execDash;
      d.open = true; d.loading = true; d.error = ''; d.data = null;
      try {
        const data = await this.api('GET', '/charts');
        d.data = data;
        await this.$nextTick();
        this._renderExecCharts(data);
      } catch (e) { d.error = e.message || 'فشل تحميل البيانات'; }
      finally { d.loading = false; }
    },

    closeExecDashboard() { this.execDash.open = false; },

    _renderExecCharts(data) {
      const d = this.execDash;
      // تدمير الـ instances القديمة
      Object.values(d._charts).forEach(c => { try { c?.destroy(); } catch {} });
      d._charts = {};

      const Chart = window.Chart;
      if (!Chart) { d.error = 'Chart.js غير محمَّل'; return; }

      // 1. KPI Trend — Line chart
      const trendCtx = document.getElementById('chartExecKpiTrend');
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

      // 2. NCR by Status — Doughnut
      const ncrCtx = document.getElementById('chartExecNcrStatus');
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

      // 3. Complaints by Status — Doughnut
      const cmpCtx = document.getElementById('chartExecComplaintsStatus');
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

      // 4. Risk Distribution — Bar
      const riskCtx = document.getElementById('chartExecRiskDist');
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

      // 5. Objectives Achievement — Doughnut
      const objCtx = document.getElementById('chartExecObjectives');
      if (objCtx) {
        const oa = data.objectivesAchievement;
        d._charts.objectives = new Chart(objCtx, {
          type: 'doughnut',
          data: {
            labels: ['مُنجَزة', 'قيد التنفيذ', 'متأخرة', 'مُخطَّطة', 'مُلغاة'],
            datasets: [{ data: [oa.achieved, oa.inProgress, oa.delayed, oa.planned, oa.cancelled], backgroundColor: [COLORS.green, COLORS.blue, COLORS.red, COLORS.gray, COLORS.gray + '80'] }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
      }
    },
  };
})();
