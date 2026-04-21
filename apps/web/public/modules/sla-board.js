/**
 * modules/sla-board.js — لوحة SLA (الشكاوى / عدم المطابقة)
 * يُدمج في app() عبر ...window.QmsSlaBoard
 */
(function () {
  'use strict';
  window.QmsSlaBoard = {
    // ─── State ───────────────────────────────────────────────────────────
    slaBoard: null,        // { complaints[], ncrs[], summary }
    slaPolicy: null,       // SLA_POLICY from server (transparency)

    // ─── Methods ─────────────────────────────────────────────────────────
    async loadSlaBoard() {
      try {
        const [b, p] = await Promise.all([
          this.api('GET', '/sla/board'),
          this.api('GET', '/sla/policy'),
        ]);
        this.slaBoard  = b;
        this.slaPolicy = p.policy;
      } catch (e) {
        this.slaBoard = null;
        alert(e.message || 'فشل تحميل لوحة SLA');
      }
    },
    slaBadgeClass(status) {
      return {
        OK:            'bg-green-100 text-green-800 border border-green-300',
        MET:           'bg-green-100 text-green-800 border border-green-300',
        DUE_SOON:      'bg-amber-100 text-amber-800 border border-amber-300',
        BREACHED:      'bg-red-100 text-red-800 border border-red-400',
        BREACHED_MET:  'bg-orange-100 text-orange-800 border border-orange-300',
      }[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
    },
    slaBadgeLabel(status) {
      return {
        OK:           '✓ ضمن المهلة',
        MET:          '✅ مُنجَز في الوقت',
        DUE_SOON:     '⏳ اقترب الاستحقاق',
        BREACHED:     '⛔ تجاوز SLA',
        BREACHED_MET: '⚠ مُنجَز متأخراً',
      }[status] || status;
    },
    slaSevLabel(sev) {
      return { high: 'مرتفعة', med: 'متوسطة', low: 'منخفضة' }[sev] || sev;
    },
  };
})();
