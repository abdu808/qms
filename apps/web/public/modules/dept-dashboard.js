/**
 * modules/dept-dashboard.js — لوحة مدير القسم التفصيلية
 * يُدمج في app() عبر ...window.QmsDeptDashboard
 * يستخدم myWork.dept المحمَّل مسبقاً (لا يحتاج طلب API إضافي)
 * يعرض: NCR الفريق حسب الخطورة + شكاوى الفريق حسب SLA + قائمة KPI الناقصة
 */
(function () {
  'use strict';

  const COLORS = {
    red: '#ef4444', orange: '#f97316', yellow: '#f59e0b',
    green: '#22c55e', blue: '#3b82f6', gray: '#9ca3af',
  };

  const SEV_COLORS = {
    'حرج':    COLORS.red,
    'مرتفعة': COLORS.red,
    'متوسطة': COLORS.orange,
    'منخفضة': COLORS.green,
  };

  const SLA_COLORS = {
    BREACHED: COLORS.red,
    AT_RISK:  COLORS.yellow,
    OK:       COLORS.green,
  };

  const SLA_LABELS = {
    BREACHED: 'متجاوز SLA',
    AT_RISK:  'قريب من الانتهاء',
    OK:       'ضمن SLA',
  };

  window.QmsDeptDashboard = {
    deptDash: { open: false, _charts: {} },

    openDeptDashboard() {
      this.deptDash.open = true;
      // البيانات موجودة في myWork.dept — لا حاجة لطلب API
      this.$nextTick(() => this._renderDeptCharts());
    },

    closeDeptDashboard() {
      this.deptDash.open = false;
    },

    _renderDeptCharts() {
      const dept = this.myWork?.dept;
      const Chart = window.Chart;
      if (!dept || !Chart) return;

      // تدمير الـ instances القديمة
      Object.values(this.deptDash._charts).forEach(c => { try { c?.destroy(); } catch {} });
      this.deptDash._charts = {};

      // ── 1. NCR الفريق حسب الخطورة — Bar ────────────────────────────
      const ncrCtx = document.getElementById('chartDeptNcrSeverity');
      if (ncrCtx) {
        const sevMap = {};
        (dept.ncrAssigned || []).forEach(n => {
          sevMap[n.severity || 'غير محدد'] = (sevMap[n.severity || 'غير محدد'] || 0) + 1;
        });
        const labels = Object.keys(sevMap);
        if (labels.length) {
          this.deptDash._charts.ncrSev = new Chart(ncrCtx, {
            type: 'bar',
            data: {
              labels,
              datasets: [{ label: 'عدد NCR', data: labels.map(l => sevMap[l]), backgroundColor: labels.map(l => SEV_COLORS[l] || COLORS.blue) }],
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            },
          });
        }
      }

      // ── 2. شكاوى الفريق حسب SLA — Doughnut ─────────────────────────
      const cmpCtx = document.getElementById('chartDeptComplaintsSla');
      if (cmpCtx) {
        const slaMap = { BREACHED: 0, AT_RISK: 0, OK: 0 };
        (dept.complaintsAssigned || []).forEach(c => {
          const key = c.overall || 'OK';
          slaMap[key] = (slaMap[key] || 0) + 1;
        });
        const keys = Object.keys(slaMap).filter(k => slaMap[k] > 0);
        if (keys.length) {
          this.deptDash._charts.cmpSla = new Chart(cmpCtx, {
            type: 'doughnut',
            data: {
              labels: keys.map(k => SLA_LABELS[k] || k),
              datasets: [{ data: keys.map(k => slaMap[k]), backgroundColor: keys.map(k => SLA_COLORS[k] || COLORS.gray) }],
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
            },
          });
        }
      }
    },
  };
})();
