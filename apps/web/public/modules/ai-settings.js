/**
 * modules/ai-settings.js — إعدادات الذكاء الاصطناعي
 * يُدمج في app() عبر ...window.QmsAiSettings
 *
 * الميزات:
 *   - إدارة 3 مزودين (Anthropic, OpenAI, Google)
 *   - حفظ مفاتيح مُشفَّرة على السيرفر
 *   - اختبار اتصال لكل مزود
 *   - تفعيل/تعطيل الطبقة
 *   - ضبط الميزانية الشهرية
 *   - PII redaction (اختياري/دائم/مُعطَّل)
 *   - عرض ملخص الاستخدام والتكلفة
 *   - Playground تجريبي للسؤال السريع
 */
(function () {
  'use strict';
  window.QmsAiSettings = {
    aiCfg: {
      open: false,
      tab: 'general', // general | keys | usage | playground

      // General settings
      enabled: false,
      defaultProvider: 'anthropic',
      defaultModel: '',
      monthlyBudgetUsd: 50,
      piiRedaction: 'optional',
      logRequests: true,

      // Keys (عرض مُخفَّى فقط)
      keys: { anthropic: '', openai: '', google: '' },
      hasKeys: { anthropic: false, openai: false, google: false },
      // القيم الجديدة التي يُدخلها المستخدم (تُرسل للسيرفر)
      newKeys: { anthropic: '', openai: '', google: '' },

      // Models catalog (ثابت)
      models: [],
      defaults: { anthropic: '', openai: '', google: '' },

      // Live models من API المزود
      liveModels: { anthropic: [], openai: [], google: [] },
      liveModelsLoading: { anthropic: false, openai: false, google: false },
      liveModelsError: { anthropic: '', openai: '', google: '' },

      // Usage summary
      usage: null,

      // UI state
      saving: false,
      testing: { anthropic: false, openai: false, google: false },
      testResult: { anthropic: null, openai: null, google: null },
      error: '',

      // Playground
      playground: {
        prompt: '',
        system: '',
        provider: '',
        model: '',
        piiRedact: false,
        loading: false,
        response: null,
        error: '',
      },
    },

    async openAiSettings() {
      const c = this.aiCfg;
      c.open = true;
      c.error = '';
      c.testResult = { anthropic: null, openai: null, google: null };
      c.newKeys = { anthropic: '', openai: '', google: '' };
      c.tab = 'general';
      await Promise.all([this.loadAiSettings(), this.loadAiModels(), this.loadAiUsage()]);
      // جلب الموديلات الحية بعد تحميل الإعدادات (لمعرفة من لديه مفاتيح)
      this.fetchAllLiveModels();
    },

    async loadAiSettings() {
      const c = this.aiCfg;
      try {
        const r = await this.api('GET', '/ai-settings');
        const it = r.item || {};
        c.enabled          = !!it.enabled;
        c.defaultProvider  = it.defaultProvider || 'anthropic';
        c.defaultModel     = it.defaultModel || '';
        c.monthlyBudgetUsd = Number(it.monthlyBudgetUsd ?? 50);
        c.piiRedaction     = it.piiRedaction || 'optional';
        c.logRequests      = it.logRequests !== false;
        c.keys             = it.keys || { anthropic: '', openai: '', google: '' };
        c.hasKeys          = it.hasKeys || { anthropic: false, openai: false, google: false };
      } catch (e) {
        c.error = e.message;
      }
    },

    async loadAiModels() {
      try {
        const r = await this.api('GET', '/ai-settings/models');
        this.aiCfg.models = r.items || [];
        this.aiCfg.defaults = r.defaults || {};
      } catch (e) { /* silent */ }
    },

    /**
     * جلب الموديلات الحية من API المزود باستخدام المفتاح المحفوظ
     */
    async fetchLiveModels(provider) {
      const c = this.aiCfg;
      if (!c.hasKeys[provider]) {
        c.liveModelsError[provider] = 'أضف مفتاح API أولاً ثم احفظه';
        return;
      }
      c.liveModelsLoading[provider] = true;
      c.liveModelsError[provider] = '';
      c.liveModels[provider] = [];
      try {
        const r = await this.api('GET', `/ai-settings/models/live?provider=${provider}`);
        c.liveModels[provider] = r.models || [];
        // إذا لم يكن الموديل الحالي ضمن القائمة، اضبطه على أول موديل
        if (c.defaultProvider === provider && c.liveModels[provider].length > 0) {
          const exists = c.liveModels[provider].some(m => m.id === c.defaultModel);
          if (!exists) c.defaultModel = c.liveModels[provider][0].id;
        }
      } catch (e) {
        c.liveModelsError[provider] = e.message || 'فشل جلب الموديلات';
      } finally {
        c.liveModelsLoading[provider] = false;
      }
    },

    /**
     * جلب الموديلات لكل المزودين الذين لديهم مفاتيح
     */
    async fetchAllLiveModels() {
      const c = this.aiCfg;
      const providers = ['anthropic', 'openai', 'google'].filter(p => c.hasKeys[p]);
      await Promise.allSettled(providers.map(p => this.fetchLiveModels(p)));
    },

    /** الموديلات المتاحة للمزود المحدد (live إذا وُجدت، وإلا الكتالوج الثابت) */
    modelsForProviderLive(provider) {
      const live = this.aiCfg.liveModels[provider] || [];
      if (live.length > 0) return live;
      // fallback للكتالوج الثابت
      return (this.aiCfg.models || []).filter(m => m.provider === provider);
    },

    async loadAiUsage() {
      try {
        const r = await this.api('GET', '/ai-settings/usage');
        this.aiCfg.usage = r.item;
      } catch (e) { /* silent */ }
    },

    modelsForProvider(provider) {
      return (this.aiCfg.models || []).filter((m) => m.provider === provider);
    },

    async saveAiSettings() {
      const c = this.aiCfg;
      c.saving = true; c.error = '';
      try {
        await this.api('PUT', '/ai-settings', {
          enabled: c.enabled,
          defaultProvider: c.defaultProvider,
          defaultModel: c.defaultModel,
          monthlyBudgetUsd: Number(c.monthlyBudgetUsd) || 0,
          piiRedaction: c.piiRedaction,
          logRequests: c.logRequests,
        });
        this.toast?.('تم حفظ إعدادات AI ✓');
      } catch (e) {
        c.error = e.message;
        this.toast?.(e.message, 'error');
      } finally {
        c.saving = false;
      }
    },

    async saveAiKeys() {
      const c = this.aiCfg;
      c.saving = true; c.error = '';
      try {
        const body = {};
        // نُرسل فقط المفاتيح التي أدخل المستخدم قيمة جديدة لها
        for (const p of ['anthropic', 'openai', 'google']) {
          const v = (c.newKeys[p] || '').trim();
          if (v) body[p] = v;
        }
        if (Object.keys(body).length === 0) {
          this.toast?.('لم تُدخل أي مفتاح جديد', 'warning');
          return;
        }
        const r = await this.api('PUT', '/ai-settings/keys', body);
        this.toast?.(r.message || 'تم حفظ المفاتيح ✓');
        c.newKeys = { anthropic: '', openai: '', google: '' };
        await this.loadAiSettings();
      } catch (e) {
        c.error = e.message;
        this.toast?.(e.message, 'error');
      } finally {
        c.saving = false;
      }
    },

    async deleteAiKey(provider) {
      if (!confirm(`هل تريد حذف مفتاح ${provider}؟`)) return;
      const c = this.aiCfg;
      c.saving = true; c.error = '';
      try {
        await this.api('PUT', '/ai-settings/keys', { [provider]: '' });
        this.toast?.('تم حذف المفتاح ✓');
        await this.loadAiSettings();
      } catch (e) {
        c.error = e.message;
        this.toast?.(e.message, 'error');
      } finally {
        c.saving = false;
      }
    },

    async testAiProvider(provider) {
      const c = this.aiCfg;
      c.testing[provider] = true;
      c.testResult[provider] = null;
      try {
        const body = { provider };
        // لو أدخل مفتاحاً جديداً في UI، استخدمه مباشرة في الاختبار
        const newKey = (c.newKeys[provider] || '').trim();
        if (newKey) body.apiKey = newKey;
        const r = await this.api('POST', '/ai-settings/test', body);
        c.testResult[provider] = r;
      } catch (e) {
        c.testResult[provider] = { ok: false, message: e.message };
      } finally {
        c.testing[provider] = false;
      }
    },

    async runAiPlayground() {
      const p = this.aiCfg.playground;
      if (!p.prompt || p.prompt.trim().length < 2) {
        this.toast?.('أدخل سؤالاً', 'error');
        return;
      }
      p.loading = true;
      p.response = null;
      p.error = '';
      try {
        const body = { prompt: p.prompt };
        if (p.system)    body.system    = p.system;
        if (p.provider)  body.provider  = p.provider;
        if (p.model)     body.model     = p.model;
        if (p.piiRedact) body.piiRedact = true;
        const r = await this.api('POST', '/ai-settings/complete', body);
        if (r.ok) {
          p.response = r;
          // تحديث ملخص الاستخدام
          this.loadAiUsage();
        } else {
          p.error = r.error || 'فشل الاستدعاء';
        }
      } catch (e) {
        p.error = e.message;
      } finally {
        p.loading = false;
      }
    },

    // helpers
    aiFormatUsd(v) {
      const n = Number(v) || 0;
      return '$' + n.toFixed(n < 1 ? 4 : 2);
    },

    aiBudgetBarColor(pct) {
      if (pct >= 90) return 'bg-red-500';
      if (pct >= 70) return 'bg-amber-500';
      if (pct >= 40) return 'bg-blue-500';
      return 'bg-emerald-500';
    },

    aiProviderLabel(p) {
      return { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (GPT)', google: 'Google (Gemini)' }[p] || p;
    },

    aiFormatDate(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleString('ar-SA-u-nu-latn');
      } catch { return iso; }
    },
  };
})();
