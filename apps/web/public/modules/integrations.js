/**
 * modules/integrations.js ? extracted from app.js.
 * Merged into app() via ...window.QmsIntegrations.
 */
(function () {
  'use strict';

  window.QmsIntegrations = {
    // INTEGRATIONS & NOTIFICATIONS SETTINGS
    // ════════════════════════════════════════════════════════════════

    integrationsTab: 'providers', // providers | rules | templates | log
    integrationsLoading: false,

    // n8n config (state)
    integrationN8n: null,        // { url, secret(masked), enabled, connectionStatus, lastTest, lastSuccess, lastFailure, stats }
    integrationN8nForm: null,    // { url, secret, enabled, busy, error, testResult }

    // templates state
    notificationTemplates: [],
    notificationTemplateModal: null,  // { tpl, busy, error, preview }

    // notification rules state
    notificationRules: [],
    notificationRuleChannels: ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'],

    // delivery log state
    deliveryLogItems: [],
    deliveryLogStats: null,
    deliveryLogFilter: { status: '', event: '' },

    // مزودات قادمة (للعرض فقط — UI placeholders)
    integrationProvidersFuture: [
      { id: 'sms',    name: 'SMS Gateway',     icon: '📱', desc: 'إرسال رسائل SMS عبر مزود محلي' },
      { id: 'whatsapp', name: 'WhatsApp Business', icon: '💬', desc: 'WhatsApp Business API مباشرة' },
      { id: 'email',  name: 'Email SMTP',       icon: '📧', desc: 'إرسال البريد الإلكتروني عبر SMTP' },
      { id: 'teams',  name: 'Microsoft Teams', icon: '👥', desc: 'إشعارات قنوات Teams' },
      { id: 'slack',  name: 'Slack',           icon: '#️⃣', desc: 'إشعارات قنوات Slack' },
    ],

    async loadIntegrationsSettings() {
      try {
        this.integrationsLoading = true;
        const calls = [
          this.api('GET', '/webhook-settings').catch(() => null),
          this.api('GET', '/notification-rules').catch(() => null),
          this.api('GET', '/notification-templates').catch(() => null),
          this.api('GET', '/integrations/deliveries?limit=50').catch(() => null),
          this.api('GET', '/integrations/deliveries/stats').catch(() => null),
        ];
        const [n8n, rules, tpls, log, stats] = await Promise.all(calls);
        this.integrationN8n          = n8n?.item || null;
        this.notificationRules       = rules?.data || [];
        this.notificationRuleChannels = rules?.allowedChannels || ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'];
        this.notificationTemplates   = tpls?.data || [];
        this.deliveryLogItems        = log?.data || [];
        this.deliveryLogStats        = stats || null;
      } catch (e) {
        alert(e.message || 'فشل تحميل إعدادات التكاملات');
      } finally {
        this.integrationsLoading = false;
      }
    },

    // ─── n8n Provider ─────────────────────────────────────────────
    openN8nProviderForm() {
      this.integrationN8nForm = {
        url: this.integrationN8n?.url || '',
        allowedHosts: this.integrationN8n?.allowedHosts || '',
        secret: '', // فارغ = لا تغيير
        enabled: !!this.integrationN8n?.enabled,
        busy: false, error: '', testResult: null,
      };
    },
    closeN8nProviderForm() { this.integrationN8nForm = null; },

    async saveN8nProvider() {
      const f = this.integrationN8nForm;
      if (!f) return;
      try {
        f.busy = true; f.error = '';
        const payload = { url: f.url, allowedHosts: f.allowedHosts, enabled: f.enabled };
        if (f.secret && !f.secret.startsWith('****')) payload.secret = f.secret;
        await this.api('PUT', '/webhook-settings', payload);
        await this.loadIntegrationsSettings();
        this.toast?.('تم الحفظ', 'success');
        this.closeN8nProviderForm();
      } catch (e) {
        f.error = e.message || 'فشل الحفظ';
      } finally {
        if (this.integrationN8nForm) this.integrationN8nForm.busy = false;
      }
    },

    async testN8nConnection() {
      const f = this.integrationN8nForm;
      if (!f) return;
      try {
        f.busy = true; f.testResult = null;
        const r = await this.api('POST', '/webhook-settings/test', {});
        f.testResult = r;
      } catch (e) {
        f.testResult = { ok: false, message: e.message || 'فشل الاختبار' };
      } finally {
        if (this.integrationN8nForm) this.integrationN8nForm.busy = false;
      }
    },

    integrationStatusLabel(s) {
      return ({
        CONNECTED:    'متصل',
        DISABLED:     'غير مفعّل',
        TEST_FAILED:  'فشل آخر اختبار',
        NOT_TESTED:   'لم يُختبَر بعد',
        NO_URL:       'بلا رابط',
      })[s] || s || '—';
    },
    integrationStatusClass(s) {
      return ({
        CONNECTED:    'bg-green-100 text-green-800 border-green-300',
        DISABLED:     'bg-gray-100 text-gray-700 border-gray-300',
        TEST_FAILED:  'bg-red-100 text-red-800 border-red-300',
        NOT_TESTED:   'bg-amber-100 text-amber-800 border-amber-300',
        NO_URL:       'bg-gray-100 text-gray-700 border-gray-300',
      })[s] || 'bg-gray-100 text-gray-700';
    },

    // ─── Notification Rules ───────────────────────────────────────
    notificationRulesByCategory() {
      const groups = {};
      for (const r of (this.notificationRules || [])) {
        const key = r.category || 'OTHER';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      }
      return groups;
    },
    notificationRuleCategoryLabel(c) {
      return ({
        KPI: 'المؤشرات والمتأخرات',
        NCR: 'عدم المطابقة',
        COMPLAINT: 'الشكاوى',
        DOCUMENT: 'الوثائق',
        TRAINING: 'التدريب',
        OTHER: 'أخرى',
      })[c] || c;
    },
    isRuleChannel(rule, channel) {
      return Array.isArray(rule?.channels) && rule.channels.includes(channel);
    },
    toggleRuleChannel(rule, channel) {
      if (!rule) return;
      if (!Array.isArray(rule.channels)) rule.channels = [];
      const i = rule.channels.indexOf(channel);
      if (i >= 0) rule.channels.splice(i, 1);
      else rule.channels.push(channel);
    },
    async saveNotificationRule(rule) {
      if (!rule?.eventKey) return;
      try {
        rule.busy = true;
        const r = await this.api('PATCH', `/notification-rules/${rule.eventKey}`, {
          enabled: rule.enabled,
          channels: rule.channels || [],
          createsTask: rule.createsTask,
          audience: rule.audience,
          timing: rule.timing,
          repeatPolicy: rule.repeatPolicy,
          escalation: rule.escalation,
          description: rule.description,
        });
        Object.assign(rule, r.item || {});
        this.toast?.('تم حفظ قاعدة التنبيه', 'success');
      } catch (e) {
        alert(e.message || 'فشل حفظ قاعدة التنبيه');
      } finally {
        if (rule) rule.busy = false;
      }
    },

    // ─── Notification Templates ──────────────────────────────────
    async openTemplateEditor(eventKey) {
      try {
        const r = await this.api('GET', `/notification-templates/${eventKey}`);
        this.notificationTemplateModal = {
          tpl: { ...r.item },
          busy: false, error: '', preview: null,
        };
      } catch (e) {
        alert(e.message || 'فشل تحميل القالب');
      }
    },
    closeTemplateEditor() { this.notificationTemplateModal = null; },

    async saveTemplate() {
      const m = this.notificationTemplateModal;
      if (!m) return;
      try {
        m.busy = true; m.error = '';
        const t = m.tpl;
        await this.api('PATCH', `/notification-templates/${t.eventKey}`, {
          name: t.name,
          description: t.description,
          subject: t.subject,
          body: t.body,
          channels: t.channels,
          enabled: t.enabled,
        });
        await this.loadIntegrationsSettings();
        this.toast?.('تم حفظ القالب', 'success');
        this.closeTemplateEditor();
      } catch (e) {
        m.error = e.message || 'فشل الحفظ';
      } finally {
        if (this.notificationTemplateModal) this.notificationTemplateModal.busy = false;
      }
    },

    async previewTemplate() {
      const m = this.notificationTemplateModal;
      if (!m) return;
      try {
        m.busy = true;
        const r = await this.api('POST', `/notification-templates/${m.tpl.eventKey}/preview`, {});
        m.preview = r;
      } catch (e) {
        alert(e.message || 'فشل المعاينة');
      } finally {
        if (this.notificationTemplateModal) this.notificationTemplateModal.busy = false;
      }
    },

    toggleTemplateChannel(channel) {
      const m = this.notificationTemplateModal;
      if (!m) return;
      const list = m.tpl.channels.split(',').map(s => s.trim()).filter(Boolean);
      const i = list.indexOf(channel);
      if (i >= 0) list.splice(i, 1);
      else list.push(channel);
      m.tpl.channels = list.join(',');
    },

    isTemplateChannel(channel) {
      const m = this.notificationTemplateModal;
      if (!m) return false;
      return m.tpl.channels.split(',').map(s => s.trim()).includes(channel);
    },

    // ─── Delivery Log ─────────────────────────────────────────────
    async refreshDeliveryLog() {
      try {
        const params = new URLSearchParams();
        if (this.deliveryLogFilter.status) params.append('status', this.deliveryLogFilter.status);
        if (this.deliveryLogFilter.event) params.append('event', this.deliveryLogFilter.event);
        params.append('limit', '50');
        const r = await this.api('GET', `/integrations/deliveries?${params.toString()}`);
        this.deliveryLogItems = r?.data || [];
      } catch (e) {
        alert(e.message || 'فشل تحميل السجل');
      }
    },

    deliveryStatusLabel(s) {
      return ({
        PENDING:    'قيد الانتظار',
        DISPATCHED: 'أُرسلت',
        DELIVERED:  'وُصلت',
        FAILED:     'فشلت',
        SKIPPED:    'تم تخطيها',
      })[s] || s;
    },
    deliveryStatusClass(s) {
      return ({
        PENDING:    'bg-yellow-100 text-yellow-800',
        DISPATCHED: 'bg-blue-100 text-blue-800',
        DELIVERED:  'bg-green-100 text-green-800',
        FAILED:     'bg-red-100 text-red-800',
        SKIPPED:    'bg-gray-100 text-gray-700',
      })[s] || 'bg-gray-100 text-gray-700';
    },


};
})();
