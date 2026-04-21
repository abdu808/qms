/**
 * modules/live-alerts.js — تنبيهات الصحة الحيّة (ISO 9.1.3 · org-wide snapshot)
 * يُدمج في app() عبر ...window.QmsLiveAlerts
 */
(function () {
  'use strict';

  window.QmsLiveAlerts = {
    // ─── State ─────────────────────────────────────────────────
    liveAlerts: [],
    liveAlertsSummary: { danger: 0, warn: 0, info: 0, total: 0 },
    liveAlertsOpen: false,
    _alertsTimer: null,

    // ─── Methods ───────────────────────────────────────────────
    async loadLiveAlerts() {
      if (!this.canSeeAlerts()) return;
      try {
        const r = await this.api('GET', '/alerts');
        this.liveAlerts = r.alerts || [];
        this.liveAlertsSummary = r.summary || { danger: 0, warn: 0, info: 0, total: 0 };
        this.liveAlertsSummary.total = r.total || 0;
      } catch { /* silent — القراءة مقصورة على QM+ */ }
    },
    canSeeAlerts() {
      // نفس قاعدة permissions-matrix: alerts.read = MANAGER_UP
      return ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'].includes(this.user?.role);
    },
    toggleLiveAlerts() {
      this.liveAlertsOpen = !this.liveAlertsOpen;
      if (this.liveAlertsOpen) this.loadLiveAlerts();
    },
    goToAlert(a) {
      this.liveAlertsOpen = false;
      if (!a?.actionUrl) return;
      const m = a.actionUrl.match(/^\/#\/([\w-]+)/);
      if (m) this.goto(m[1]);
    },
    alertSeverityClass(sev) {
      if (sev === 'danger') return 'bg-red-50 border-red-300 text-red-800';
      if (sev === 'warn')   return 'bg-amber-50 border-amber-300 text-amber-800';
      return 'bg-blue-50 border-blue-300 text-blue-800';
    },
    alertSeverityIcon(sev) {
      if (sev === 'danger') return '🔴';
      if (sev === 'warn')   return '🟡';
      return '🔵';
    },
    startAlertsPolling() {
      if (!this.canSeeAlerts()) return;
      if (this._alertsTimer) clearInterval(this._alertsTimer);
      this.loadLiveAlerts();
      // كل 3 دقائق — أسرع من notifications لأن الـ endpoint محسوب حيّاً
      this._alertsTimer = setInterval(() => this.loadLiveAlerts(), 3 * 60 * 1000);
    },
  };
})();
