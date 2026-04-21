/**
 * modules/policy-ack.js — إقرار سياسة الجودة (P-02 §3.4 · ISO 5.2.2(b))
 * يُدمج في app() عبر ...window.QmsPolicyAck
 */
(function () {
  'use strict';

  window.QmsPolicyAck = {
    // ─── State ─────────────────────────────────────────────────
    policyAck: null, // { hasActivePolicy, acknowledged, policy }
    policyAckModalOpen: false,
    policyAckScrolledToEnd: false,
    policyAckConfirmRead: false,
    policyAckSubmitting: false,

    // ─── Methods ───────────────────────────────────────────────
    async loadPolicyAck() {
      try {
        this.policyAck = await this.api('GET', '/policy-ack/me');
        // Auto-open modal if acknowledgment is required
        if (this.policyAck?.hasActivePolicy && !this.policyAck?.acknowledged) {
          this.openPolicyAckModal();
        }
      } catch { this.policyAck = null; }
    },
    openPolicyAckModal() {
      this.policyAckScrolledToEnd = false;
      this.policyAckConfirmRead = false;
      this.policyAckModalOpen = true;
      // auto-scroll handler wired in template via @scroll
    },
    onPolicyAckScroll(ev) {
      const el = ev.target;
      // Consider "read" when within 20px of bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        this.policyAckScrolledToEnd = true;
      }
    },
    async acknowledgePolicy() {
      if (!this.policyAckScrolledToEnd || !this.policyAckConfirmRead) return;
      this.policyAckSubmitting = true;
      try {
        await this.api('POST', '/policy-ack', {});
        this.toast?.('✅ تم تسجيل إقرارك بالاطّلاع والالتزام بسياسة الجودة');
        this.policyAckModalOpen = false;
        await this.api('GET', '/policy-ack/me').then(r => this.policyAck = r).catch(() => {});
      } catch (e) {
        alert(e.message || 'فشل تسجيل الإقرار');
      } finally {
        this.policyAckSubmitting = false;
      }
    },
    get needsPolicyAck() {
      return this.policyAck?.hasActivePolicy && !this.policyAck?.acknowledged;
    },
  };
})();
