/**
 * modules/webhook-settings.js — إعدادات n8n Webhook
 * يُدمج في app() عبر ...window.QmsWebhookSettings
 */
(function () {
  'use strict';
  window.QmsWebhookSettings = {
    webhookCfg: {
      open: false,
      url: '', secret: '', enabled: false,
      saving: false, testing: false,
      testResult: null, // { ok, status, message }
      error: '',
    },

    async openWebhookSettings() {
      const w = this.webhookCfg;
      w.open = true; w.testResult = null; w.error = '';
      try {
        const r = await this.api('GET', '/webhook-settings');
        w.url     = r.item.url;
        w.secret  = r.item.secret;
        w.enabled = r.item.enabled;
      } catch (e) { w.error = e.message; }
    },

    async saveWebhookSettings() {
      const w = this.webhookCfg;
      w.saving = true; w.error = '';
      try {
        await this.api('PUT', '/webhook-settings', { url: w.url, secret: w.secret, enabled: w.enabled });
        this.toast?.('تم حفظ إعدادات الـ webhook ✓');
      } catch (e) { w.error = e.message; this.toast?.(e.message, 'error'); }
      finally { w.saving = false; }
    },

    async testWebhookConnection() {
      const w = this.webhookCfg;
      w.testing = true; w.testResult = null;
      try {
        const r = await this.api('POST', '/webhook-settings/test');
        w.testResult = r;
      } catch (e) { w.testResult = { ok: false, message: e.message }; }
      finally { w.testing = false; }
    },
  };
})();
