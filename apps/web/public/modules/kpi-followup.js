/**
 * modules/kpi-followup.js ? extracted from app.js.
 * Merged into app() via ...window.QmsKpiFollowUp.
 */
(function () {
  'use strict';

  window.QmsKpiFollowUp = {
    // KPI FOLLOW-UP SYSTEM — نظام متابعة الإدخالات المتأخرة الشامل
    // ════════════════════════════════════════════════════════════════

    // ─── State ──────────────────────────────────────────────────────
    kpiFollowUpList: [],
    kpiFollowUpStats: null,
    kpiFollowUpTrends: null,
    kpiFollowUpLoading: false,
    kpiFollowUpDetection: false,

    // الفلاتر
    kpiFollowUpFilters: {
      year: '',
      month: '',
      status: '',
      departmentId: '',
      escalationLevel: '',
      search: '',
    },

    // Modals
    kpiFollowUpEscalateModal: null,   // { followUp, level, notes, busy }
    kpiFollowUpResolveModal:  null,   // { followUp, notes, busy }
    kpiFollowUpAbortModal:    null,   // { followUp, notes, busy }
    kpiFollowUpDetailModal:   null,   // { followUp, timeline, busy }

    // مساعدة: لائحة الأقسام (تُحمَّل مرة واحدة)
    kpiFollowUpDepts: [],

    // ─── Loading ────────────────────────────────────────────────────
    async loadKpiFollowUp() {
      try {
        this.kpiFollowUpLoading = true;

        // فلاتر القائمة الكاملة (تشمل status و sortBy)
        const listParams = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) listParams.append(k, v);
        });
        listParams.append('limit', '500');

        // فلاتر الإحصائيات والاتجاهات (نفس الفلاتر، عدا status — لأن الإحصائيات تعرض توزيع الحالات)
        const statsParams = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (k === 'status') return;
          if (v !== '' && v !== null && v !== undefined) statsParams.append(k, v);
        });

        const [list, stats, trends] = await Promise.all([
          this.api('GET', `/kpi-followups?${listParams.toString()}`),
          this.api('GET', `/kpi-followups/stats/summary?${statsParams.toString()}`),
          this.api('GET', `/kpi-followups/stats/trends?${statsParams.toString()}`).catch(() => null),
        ]);
        this.kpiFollowUpList   = list?.data || [];
        this.kpiFollowUpStats  = stats || null;
        this.kpiFollowUpTrends = trends?.trends || null;

        // تحميل الأقسام إن لم تكن محمّلة
        if (!Array.isArray(this.kpiFollowUpDepts) || !this.kpiFollowUpDepts.length) {
          try {
            const r = await this.api('GET', '/departments');
            this.kpiFollowUpDepts = r?.items || r?.data || (Array.isArray(r) ? r : []);
          } catch {}
        }

        // رسم الـ trends chart بعد تحديث الـ DOM
        this.$nextTick?.(() => this.renderKpiFollowUpChart());
      } catch (e) {
        this.toast?.(e.message || 'فشل تحميل سجل المتابعة', 'error') || alert(e.message);
        this.kpiFollowUpList = [];
        this.kpiFollowUpStats = null;
      } finally {
        this.kpiFollowUpLoading = false;
      }
    },

    // ─── إعادة تحميل عند تغيير الفلتر ───────────────────────────────
    async applyKpiFollowUpFilters() {
      await this.loadKpiFollowUp();
    },

    resetKpiFollowUpFilters() {
      this.kpiFollowUpFilters = {
        year: '', month: '', status: '', departmentId: '', escalationLevel: '', search: '',
      };
      this.loadKpiFollowUp();
    },

    // ─── تشغيل الفحص يدوياً ─────────────────────────────────────────
    async runKpiFollowUpDetection() {
      if (!confirm('سيتم فحص جميع المؤشرات الشهرية وتحديث المتأخرات. هل تريد المتابعة؟')) return;
      try {
        this.kpiFollowUpDetection = true;
        const r = await this.api('POST', '/kpi-followups/run-detection', {});
        const s = r?.stats || {};
        const lines = [
          `✓ تم الفحص:`,
          `• مؤشرات مفحوصة: ${s.indicatorsChecked || 0}`,
          `• فترات مفحوصة: ${s.periodsChecked || 0}`,
          ``,
          `📋 النتائج:`,
          `• جديد: ${s.created || 0}`,
          `• مُحدَّث: ${s.updated || 0}`,
          `• مُحلّ: ${s.resolved || 0}`,
          `• مُغلَق: ${s.aborted || 0}`,
        ];
        if ((s.skippedNoDept || 0) + (s.skippedNoUser || 0) > 0) {
          lines.push('');
          lines.push('⚠️ مؤشرات تم تخطيها:');
          if (s.skippedNoDept > 0) lines.push(`• بلا قسم محدد: ${s.skippedNoDept}`);
          if (s.skippedNoUser > 0) lines.push(`• بلا مدخل بيانات: ${s.skippedNoUser}`);
          lines.push('');
          lines.push('💡 لتظهر هذه المؤشرات: تأكد أن لكل مؤشر مالك أو مدخل بيانات أو ربطه بهدف.');
        }
        alert(lines.join('\n'));
        await this.loadKpiFollowUp();
      } catch (e) {
        alert(e.message || 'فشل تشغيل الفحص');
      } finally {
        this.kpiFollowUpDetection = false;
      }
    },

    // ─── تصدير CSV ──────────────────────────────────────────────────
    async exportKpiFollowUp() {
      try {
        const params = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) params.append(k, v);
        });
        const url = `/api/kpi-followups/export/csv?${params.toString()}`;
        // نفتح الرابط مع التوكن في header — لا يمكن مع <a download>
        // نحمّل الملف عبر fetch ونحفظه
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل التصدير');
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `kpi-followups-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (e) {
        alert(e.message || 'فشل التصدير');
      }
    },

    // ─── Modal: التصعيد ─────────────────────────────────────────────
    openKpiFollowUpEscalate(followUp) {
      const nextLevel = (followUp.escalationLevel || 0) >= 2 ? 2 : (followUp.escalationLevel || 0) + 1;
      this.kpiFollowUpEscalateModal = {
        followUp,
        level: nextLevel,
        notes: '',
        busy: false,
      };
    },
    closeKpiFollowUpEscalate() { this.kpiFollowUpEscalateModal = null; },

    async submitKpiFollowUpEscalate() {
      const m = this.kpiFollowUpEscalateModal;
      if (!m) return;
      if (!m.notes || m.notes.trim().length < 5) {
        alert('يرجى كتابة سبب التصعيد (5 أحرف على الأقل)');
        return;
      }
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/escalate`, {
          escalationLevel: m.level,
          notes: m.notes.trim(),
        });
        this.closeKpiFollowUpEscalate();
        await this.loadKpiFollowUp();
        this.toast?.('تم التصعيد بنجاح', 'success');
      } catch (e) {
        alert(e.message || 'فشل التصعيد');
      } finally {
        if (this.kpiFollowUpEscalateModal) this.kpiFollowUpEscalateModal.busy = false;
      }
    },

    // ─── Modal: الحل ────────────────────────────────────────────────
    openKpiFollowUpResolve(followUp) {
      this.kpiFollowUpResolveModal = { followUp, notes: '', busy: false };
    },
    closeKpiFollowUpResolve() { this.kpiFollowUpResolveModal = null; },

    async submitKpiFollowUpResolve() {
      const m = this.kpiFollowUpResolveModal;
      if (!m) return;
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/resolve`, {
          notes: m.notes?.trim() || '',
        });
        this.closeKpiFollowUpResolve();
        await this.loadKpiFollowUp();
        this.toast?.('تم الحل بنجاح', 'success');
      } catch (e) {
        alert(e.message || 'فشل الحل');
      } finally {
        if (this.kpiFollowUpResolveModal) this.kpiFollowUpResolveModal.busy = false;
      }
    },

    // ─── Modal: الإغلاق النهائي ─────────────────────────────────────
    openKpiFollowUpAbort(followUp) {
      this.kpiFollowUpAbortModal = { followUp, notes: '', busy: false };
    },
    closeKpiFollowUpAbort() { this.kpiFollowUpAbortModal = null; },

    async submitKpiFollowUpAbort() {
      const m = this.kpiFollowUpAbortModal;
      if (!m) return;
      if (!m.notes || m.notes.trim().length < 10) {
        alert('الإغلاق النهائي يتطلب سبب مفصّل (10 أحرف على الأقل)');
        return;
      }
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/abort`, {
          notes: m.notes.trim(),
        });
        this.closeKpiFollowUpAbort();
        await this.loadKpiFollowUp();
        this.toast?.('تم الإغلاق', 'success');
      } catch (e) {
        alert(e.message || 'فشل الإغلاق');
      } finally {
        if (this.kpiFollowUpAbortModal) this.kpiFollowUpAbortModal.busy = false;
      }
    },

    // ─── Modal: التفاصيل + Timeline ─────────────────────────────────
    async openKpiFollowUpDetail(followUp) {
      this.kpiFollowUpDetailModal = { followUp, timeline: null, busy: true };
      try {
        const [full, tl] = await Promise.all([
          this.api('GET', `/kpi-followups/${followUp.id}`),
          this.api('GET', `/kpi-followups/${followUp.id}/timeline`),
        ]);
        this.kpiFollowUpDetailModal = { followUp: full, timeline: tl?.events || [], busy: false };
      } catch (e) {
        alert(e.message || 'فشل تحميل التفاصيل');
        this.kpiFollowUpDetailModal = null;
      }
    },
    closeKpiFollowUpDetail() { this.kpiFollowUpDetailModal = null; },

    // ─── Helpers — UI ────────────────────────────────────────────────
    kpiFollowUpStatusLabel(s) {
      return ({
        PENDING:      'قيد الانتظار',
        FIRST_NOTICE: 'إشعار أول',
        ESCALATED:    'مُصعَّد',
        RESOLVED:     'تم الحل',
        ABORTED:      'مُغلَق',
      })[s] || s;
    },
    kpiFollowUpStatusClass(s) {
      return ({
        PENDING:      'bg-yellow-100 text-yellow-800',
        FIRST_NOTICE: 'bg-amber-100 text-amber-800',
        ESCALATED:    'bg-orange-100 text-orange-800',
        RESOLVED:     'bg-green-100 text-green-800',
        ABORTED:      'bg-gray-200 text-gray-700',
      })[s] || 'bg-gray-100 text-gray-700';
    },
    kpiFollowUpEscalationLabel(level) {
      return ({ 0: 'لا يوجد', 1: 'مدير القسم', 2: 'الإدارة العليا' })[level] || '—';
    },

    // ─── Integration: Create CAPA from follow-up ────────────────────
    async createCapaFromFollowUp(followUp) {
      const rootCause = prompt('السبب الجذري للتأخر (RCA):', '');
      if (rootCause === null) return;
      const plannedAction = prompt('الإجراء المُخطّط:', '');
      if (plannedAction === null) return;
      try {
        const r = await this.api('POST', `/kpi-followups/${followUp.id}/create-capa`, {
          rootCause: rootCause.trim(),
          plannedAction: plannedAction.trim(),
        });
        alert(`✓ تم فتح إجراء تصحيحي: ${r.capa?.code}`);
        await this.loadKpiFollowUp();
        if (this.kpiFollowUpDetailModal) this.closeKpiFollowUpDetail();
      } catch (e) {
        alert(e.message || 'فشل فتح الإجراء التصحيحي');
      }
    },

    // ─── ISO 9001 Compliance Report ─────────────────────────────────
    kpiFollowUpIsoReport: null,
    async loadKpiFollowUpIsoReport() {
      try {
        const year = this.kpiFollowUpFilters.year || new Date().getFullYear();
        const r = await this.api('GET', `/kpi-followups/reports/iso-compliance?year=${year}`);
        this.kpiFollowUpIsoReport = r;
      } catch (e) {
        alert(e.message || 'فشل تحميل تقرير الامتثال');
      }
    },
    closeKpiFollowUpIsoReport() { this.kpiFollowUpIsoReport = null; },

    kpiFollowUpComplianceClass(level) {
      return ({
        EXCELLENT:          'bg-green-100 text-green-800 border-green-300',
        GOOD:               'bg-blue-100 text-blue-800 border-blue-300',
        NEEDS_IMPROVEMENT:  'bg-amber-100 text-amber-800 border-amber-300',
        CRITICAL:           'bg-red-100 text-red-800 border-red-300',
      })[level] || 'bg-gray-100 text-gray-800';
    },
    kpiFollowUpComplianceLabel(level) {
      return ({
        EXCELLENT:         '✨ ممتاز',
        GOOD:              '👍 جيد',
        NEEDS_IMPROVEMENT: '⚠️ يحتاج تحسين',
        CRITICAL:          '🚨 حرج',
      })[level] || level;
    },

    // ════════════════════════════════════════════════════════════════    // ─── Trends Chart ───────────────────────────────────────────────
    _kpiFollowUpChart: null,
    renderKpiFollowUpChart() {
      if (typeof Chart === 'undefined') return;
      const el = document.getElementById('kpiFollowUpTrendsChart');
      if (!el || !this.kpiFollowUpTrends?.length) return;

      if (this._kpiFollowUpChart) {
        try { this._kpiFollowUpChart.destroy(); } catch {}
      }
      const t = this.kpiFollowUpTrends;
      this._kpiFollowUpChart = new Chart(el, {
        type: 'bar',
        data: {
          labels: t.map(x => x.label),
          datasets: [
            { label: 'محلولة', data: t.map(x => x.resolved), backgroundColor: '#10b981', stack: 's1' },
            { label: 'قيد الانتظار', data: t.map(x => x.pending), backgroundColor: '#fbbf24', stack: 's1' },
            { label: 'مُصعَّدة', data: t.map(x => x.escalated), backgroundColor: '#f97316', stack: 's1' },
            { label: 'مُغلقة', data: t.map(x => x.aborted), backgroundColor: '#6b7280', stack: 's1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    },

  };
})();
