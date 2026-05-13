/**
 * modules/consultant.js — المستشار الاستراتيجي الذكي (v2.1)
 *
 * وضعا التشغيل:
 *   ⚡ تلقائي  (auto)   — AI ينفِّذ مباشرةً، ترى ما فعل
 *   🔍 مراجعة (review) — AI يقترح، أنت توافق بنقرة واحدة
 */
(function () {
  'use strict';

  const LEGACY_CONSULT_HISTORY_KEY = 'qms_consult_history';
  const CONSULT_HISTORY_PREFIX = 'qms_consult_history:user:';

  const TOOL_LABELS = {
    // قراءة وتحليل
    get_system_state:              '🔍 قراءة النظام',
    scan_overdue:                  '⏰ مسح التأخيرات',
    compute_iso_maturity:          '📊 قياس نضج ISO',
    generate_management_report:    '📋 تقرير مراجعة الإدارة',
    // التخطيط الاستراتيجي
    update_strategic_goal:         '✏️ تحديث هدف استراتيجي',
    delete_strategic_goal:         '🗑 حذف هدف استراتيجي',
    update_operational_activity:   '✏️ تحديث نشاط تشغيلي',
    delete_operational_activity:   '🗑 حذف نشاط تشغيلي',
    create_operational_activity:   '➕ إنشاء نشاط تشغيلي',
    link_activity_to_goal:         '🔗 ربط نشاط بهدف',
    create_objective:              '➕ إنشاء هدف تشغيلي',
    update_objective:              '✏️ تحديث هدف تشغيلي',
    delete_objective:              '🗑 حذف هدف تشغيلي',
    assign_responsible:            '👤 تعيين مسؤول',
    assign_owner:                  '👤 تعيين مالك',
    log_kpi_entry:                 '📊 تسجيل KPI',
    // المخاطر والمطابقة
    create_risk:                   '⚠️ إنشاء خطر/فرصة',
    update_risk:                   '✏️ تحديث خطر',
    create_ncr:                    '🚨 إنشاء NCR',
    update_ncr:                    '✏️ تحديث NCR',
    create_capa:                   '🔧 إنشاء CAPA',
    update_capa:                   '✏️ تحديث CAPA',
    // الشكاوى
    create_complaint:              '😤 إنشاء شكوى',
    update_complaint:              '✏️ تحديث شكوى',
    orchestrate_complaint:         '🔗 سير عمل شكوى متكامل',
    // سياق المنظمة
    create_swot_item:              '➕ إضافة عنصر SWOT',
    update_swot_item:              '✏️ تحديث SWOT',
    // مراجعة الإدارة
    create_management_review:      '🏛 جدولة مراجعة إدارة',
    update_management_review:      '✏️ تحديث مراجعة الإدارة',
    // التدريب والتدقيق
    schedule_training:             '🎓 جدولة تدريب',
    plan_audit:                    '📋 جدولة تدقيق',
  };

  window.QmsConsultant = {
    consult: {
      loading:   false,
      thinking:  false,
      applying:  false,    // جاري تطبيق الإجراءات المعلقة
      uploading:   false,      // جاري رفع الملفات
      error:       '',
      context:     null,
      messages:    [],
      input:       '',
      // Audit improvement #3: الافتراضي مراجعة، لا تنفيذ مباشر — أمان first.
      mode:        'review',   // 'auto' (تنفيذ مباشر) | 'review' (يقترح ثم تعتمد)
      showTools:   true,
      attachments: [],         // [{ name, size, _file }] — قائمة الملفات المُختارة
      modelLock:    null,    // null=تلقائي, string=موديل محدد يُرسَل للـ API
      lastModel:    '',      // آخر موديل استُخدم (من الـ response)
      lastProvider: '',      // آخر مزود
      modelOptions: [],      // قائمة الموديلات المتاحة
      // الجلسات
      sessionId:       null,    // ID الجلسة الحالية في DB (null = غير محفوظة بعد)
      sessions:        [],      // قائمة الجلسات السابقة [{id, title, messageCount, costUSD, updatedAt}]
      sessionsOpen:    false,   // هل قائمة الجلسات مفتوحة
      sessionsLoading: false,   // جارٍ التحميل
      historyOwnerKey: null,
      templates: [
        { id: 'analyze',       label: '🔍 تحليل شامل للنظام',          prompt: 'حلِّل حالة نظام الجودة كاملاً: استخدم scan_overdue لمعرفة التأخيرات، ثم اقرأ الأهداف والمخاطر وNCRs وCAPAs. قدِّم تقريراً بالأولويات والإجراءات العاجلة.' },
        { id: 'fill_gaps',     label: '🔧 أصلح فجوات الخطة',           prompt: 'افحص الفجوات الحالية في الخطة الاستراتيجية وأصلح ما تستطيع: اربط الأنشطة، أضف مسؤولين، واملأ الحقول الناقصة.' },
        { id: 'overdue_scan',  label: '⏰ مسح التأخيرات والمتعثرات',   prompt: 'شغِّل scan_overdue واعطني تقريراً مفصلاً عن كل المتأخرات: NCRs، CAPAs، أهداف، أنشطة، مخاطر لم تُراجَع، شكاوى قديمة. رتِّبها بالأولوية.' },
        { id: 'iso_maturity',  label: '📊 قياس نضج ISO 9001',          prompt: 'استخدم compute_iso_maturity وأعطني تقييماً تفصيلياً لكل بند ISO 9001:2015 مع الدرجة ونقاط الضعف والتوصيات لكل بند.' },
        { id: 'mgmt_report',   label: '🏛 أعدَّ تقرير مراجعة الإدارة', prompt: 'استخدم generate_management_report لإعداد تقرير مدخلات مراجعة الإدارة الكاملة وفق ISO 9.3.2. ثم اقترح أهم القرارات المطلوبة من الإدارة.' },
        { id: 'risk_scan',     label: '⚠️ مسح شامل للمخاطر',           prompt: 'افحص المخاطر الحالية: ما المرتفعة والحرجة بلا خطة معالجة؟ هل هناك فرص لم نستثمرها؟ حدِّث حالات المخاطر المُعالَجة وأنشئ CAPAs للحرجة.' },
        { id: 'ncr_review',    label: '🚨 راجع NCRs وأغلق المكتملة',   prompt: 'افحص تقارير عدم المطابقة المفتوحة. ما المتأخر منها؟ هل يحتاج أي منها إجراءً تصحيحياً؟ حدِّث الحالات وأغلق ما اكتمل تصحيحه.' },
        { id: 'audit_plan',    label: '📋 اقترح خطة تدقيق وجدولها',    prompt: 'بناءً على نتائج compute_iso_maturity وحالة النظام، اقترح وجدوِل التدقيقات الداخلية للأشهر الستة القادمة مع النطاق والمعايير.' },
        { id: 'kpis',          label: '🎯 أنشئ Objectives/KPIs',        prompt: 'افحص الأهداف الاستراتيجية وأنشئ أهدافاً تشغيلية بمؤشرات KPIs محددة وقابلة للقياس لأي هدف لا يوجد له objective.' },
        { id: 'swot_update',   label: '🔄 حدِّث تحليل SWOT',           prompt: 'اقرأ SWOT الحالي وحالة المنظمة، ثم أضف أي نقاط قوة/ضعف/فرص/تهديدات جديدة مستنبطة من بيانات الأهداف والمخاطر والشكاوى.' },
        { id: 'training_gaps', label: '🎓 حلِّل فجوات التدريب',        prompt: 'افحص سجلات التدريب وحالة CAPAs وNCRs. هل هناك مجالات تحتاج تدريباً؟ اقترح وجدوِل برامج تدريبية مناسبة.' },
      ],
    },

    // ─── localStorage: حفظ واستعادة المحادثة ────────────────────────────────
    _consultUserStorageId() {
      const u = this.user || {};
      return String(u.id || u.sub || u.email || '').trim();
    },

    _consultHistoryKey() {
      const id = this._consultUserStorageId();
      if (!id) return null;
      return CONSULT_HISTORY_PREFIX + encodeURIComponent(id);
    },

    _consultClearLegacyHistory() {
      try { localStorage.removeItem(LEGACY_CONSULT_HISTORY_KEY); } catch {}
    },

    _consultRemoveCurrentHistory() {
      try {
        const key = this._consultHistoryKey();
        if (key) localStorage.removeItem(key);
        this._consultClearLegacyHistory();
      } catch {}
    },

    _consultResetRuntimeState(options = {}) {
      if (options.clearStorage) this._consultRemoveCurrentHistory();
      this.consult.messages        = [];
      this.consult.input           = '';
      this.consult.error           = '';
      this.consult.attachments     = [];
      this.consult.sessionId       = null;
      this.consult.sessions        = [];
      this.consult.sessionsOpen    = false;
      this.consult.sessionsLoading = false;
      this.consult.thinking        = false;
      this.consult.applying        = false;
      this.consult.uploading       = false;
      this.consult.context         = null;
      this.consult.historyOwnerKey = null;
    },

    _consultEnsureUserScope() {
      const key = this._consultHistoryKey();
      if (this.consult.historyOwnerKey && this.consult.historyOwnerKey !== key) {
        this._consultResetRuntimeState();
      }
      this.consult.historyOwnerKey = key;
      this._consultClearLegacyHistory();
      return key;
    },

    _consultSaveHistory() {
      try {
        const key = this._consultEnsureUserScope();
        if (!key) return;
        // نحفظ رسائل الملفات كملخص خفيف (chatMessage فقط) حتى لا نضيع السياق
        // بعد إعادة تحميل الصفحة.
        const toSave = this.consult.messages
          .map(m => {
            if (m.role !== 'file') {
              const { _sendContent, ...safeMessage } = m;
              return safeMessage;
            }
            return {
              role: 'file',
              count: m.count,
              succeeded: m.succeeded,
              failed: m.failed,
              totalCreated: m.totalCreated,
              chatMessage: m.chatMessage, // نص الملخص فقط — files array يُحذف (ثقيل)
            };
          })
          .slice(-40);
        localStorage.setItem(key, JSON.stringify(toSave));
      } catch {}
    },

    _consultRestoreHistory() {
      try {
        const key = this._consultEnsureUserScope();
        if (!key) return;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const msgs = JSON.parse(raw);
        if (Array.isArray(msgs) && msgs.length > 0) {
          // نظّف رسائل البرومت التلقائي القديمة (كانت تُحقن تلقائياً بعد رفع الملفات)
          const filtered = msgs.filter(m =>
            !(m.role === 'user' && typeof m.content === 'string' &&
              m.content.includes('المطلوب منك:') &&
              m.content.includes('get_system_state'))
          );
          this.consult.messages = filtered;
          if (filtered.length !== msgs.length) {
            // احفظ النسخة المنظفة
            try { localStorage.setItem(key, JSON.stringify(filtered)); } catch {}
          }
        }
      } catch {
        this._consultRemoveCurrentHistory();
      }
    },

    // ─── تحميل السياق ─────────────────────────────────────────────────────
    /**
     * يُطبِّع موديل من Live API إلى الصيغة المتوقعة من الـ picker
     * { provider, model, label, good, tier }
     */
    _normalizeModel(m, provider = 'anthropic') {
      const id   = m.id || m.model || '';
      const name = m.name || m.label || m.display_name || id;
      const low  = id.toLowerCase();
      const tier = low.includes('opus')   ? 'premium'
                 : low.includes('haiku')  ? 'quick'
                 : low.includes('sonnet') ? 'standard'
                 : 'standard';
      const good = low.includes('opus')   ? 'أعلى جودة — مثالي للتحليل المعمق'
                 : low.includes('haiku')  ? 'سريع واقتصادي — للأسئلة البسيطة'
                 : low.includes('sonnet') ? 'توازن ممتاز — الاستخدام اليومي'
                 : '';
      return { provider, model: id, label: name, good, tier };
    },

    /** يجلب الموديلات الحية ثم يُحدِّث consult.modelOptions */
    async refreshConsultModels() {
      try {
        const live = await this.api('GET', '/ai-settings/models/live?provider=anthropic');
        if (live?.ok && live.models?.length) {
          this.consult.modelOptions = live.models.map(m => this._normalizeModel(m, 'anthropic'));
          return;
        }
      } catch {}
      // احتياط: الكتالوج الثابت
      try {
        const mj = await this.api('GET', '/ai-settings/models');
        if (mj?.ok) this.consult.modelOptions = (mj.items || []).filter(m => m.provider === 'anthropic');
      } catch {}
    },

    async loadConsultContext() {
      if (!this.token) return;
      this._consultEnsureUserScope();
      // استعادة المحادثة السابقة من localStorage (مرة واحدة فقط عند الفتح)
      if (this.consult.messages.length === 0) this._consultRestoreHistory();
      try {
        this.consult.loading = true;
        // جلب قائمة الموديلات — الحية من API أولاً، والكتالوج احتياط
        if (!this.consult.modelOptions.length) await this.refreshConsultModels();
        // تحميل قائمة الجلسات
        this.loadSessions();
        const j = await this.api('GET', '/consultant/context');
        if (!j) throw new Error('فشل تحميل السياق — لم يصل رد من الخادم');
        if (!j.ok) throw new Error(j.error?.message || j.error || 'فشل تحميل السياق');
        this.consult.context = { summary: j.context?.summary, gaps: j.context?.gaps?.counts };
      } catch (e) {
        this.consult.error = e.message;
      } finally {
        this.consult.loading = false;
      }
    },

    consultUseTemplate(tpl) { this.consult.input = tpl.prompt; },

    /** تقييم رد المستشار — 1=إيجابي، -1=سلبي */
    async rateConsultResponse(msg, rating) {
      if (!msg.logId || msg.rating !== null) return;
      msg.rating = rating; // تحديث فوري (optimistic)
      try {
        await this.api('POST', `/ai-settings/usage/${msg.logId}/rate`, { rating });
      } catch {
        msg.rating = null; // تراجع عند الفشل
      }
    },

    /** يجلب قائمة الجلسات من API */
    async loadSessions() {
      this.consult.sessionsLoading = true;
      try {
        const r = await this.api('GET', '/consult-sessions');
        if (r?.ok) this.consult.sessions = r.items || [];
      } catch { /* silent */ }
      finally { this.consult.sessionsLoading = false; }
    },

    /** يحفظ الجلسة الحالية في DB */
    async saveSession() {
      const c = this.consult;
      if (!c.messages.length) return;
      const msgs = c.messages.filter(m => m.role === 'user' || m.role === 'assistant');
      if (!msgs.length) return;
      try {
        // احسب إجمالي الاستخدام من رسائل المستشار
        const usage = c.messages
          .filter(m => m.role === 'assistant' && m.usage)
          .reduce((a, m) => ({
            inputTokens: a.inputTokens + (m.usage.inputTokens || 0),
            outputTokens: a.outputTokens + (m.usage.outputTokens || 0),
            costUSD: a.costUSD + (m.usage.costUSD || 0),
          }), { inputTokens: 0, outputTokens: 0, costUSD: 0 });

        const r = await this.api('POST', '/consult-sessions', {
          id: c.sessionId || undefined,
          messages: this._consultPersistableMessages(),
          ...usage,
          lastModel: c.lastModel || '',
        });
        if (r?.ok && r.item?.id) {
          c.sessionId = r.item.id;
        }
      } catch { /* silent — لا نكسر المحادثة */ }
    },

    _consultPersistableMessages() {
      return (this.consult.messages || []).map(m => {
        const { _sendContent, ...safeMessage } = m;
        if (safeMessage.role === 'file') {
          return {
            role: 'file',
            count: safeMessage.count,
            succeeded: safeMessage.succeeded,
            failed: safeMessage.failed,
            totalCreated: safeMessage.totalCreated,
            chatMessage: safeMessage.chatMessage,
          };
        }
        return safeMessage;
      });
    },

    /** يفتح جلسة قديمة */
    async loadSession(session) {
      const c = this.consult;
      try {
        const r = await this.api('GET', `/consult-sessions/${session.id}`);
        if (!r?.ok) return;
        c.messages   = r.item.messages || [];
        c.sessionId  = r.item.id;
        c.lastModel  = r.item.lastModel || '';
        c.sessionsOpen = false;
        c.error = '';
        // تحديث localStorage
        this._consultSaveHistory();
        // scroll للأسفل
        this.$nextTick && this.$nextTick(() => {
          const el = document.getElementById('consult-messages');
          if (el) el.scrollTop = el.scrollHeight;
        });
      } catch (e) {
        c.error = 'فشل تحميل الجلسة: ' + e.message;
      }
    },

    /** يحذف جلسة */
    async deleteSession(session, event) {
      event?.stopPropagation();
      if (!confirm('حذف هذه الجلسة؟')) return;
      try {
        await this.api('DELETE', `/consult-sessions/${session.id}`);
        this.consult.sessions = this.consult.sessions.filter(s => s.id !== session.id);
        if (this.consult.sessionId === session.id) {
          this.consultReset();
        }
      } catch { /* silent */ }
    },

    /** جلسة جديدة (يمسح الحالية ويبدأ من صفر) */
    consultNewSession() {
      this.consult.sessionId = null;
      this.consultReset();
    },

    // ─── إرسال رسالة ──────────────────────────────────────────────────────
    async consultSend() {
      const text      = (this.consult.input || '').trim();
      const hasFiles  = this.consult.attachments.length > 0;

      // لا إرسال أثناء معالجة سابقة أو إذا لا يوجد محتوى
      if ((!text && !hasFiles) || this.consult.thinking || this.consult.uploading) return;

      let uploadedContext = '';
      let uploadedMessage = null;

      // إذا كان هناك ملفات — ارفعها أولاً ثم اربطها بنفس رسالة المستخدم
      if (hasFiles) {
        const uploadResult = await this.consultUpload({ silent: !!text });
        // إذا فشل الرفع نوقف هنا (الخطأ ظهر مسبقاً)
        if (this.consult.error) return;
        uploadedContext = uploadResult?.attachmentContext || uploadResult?.chatMessage || '';
        uploadedMessage = uploadResult ? {
          role:        'file',
          count:       uploadResult.total,
          succeeded:   uploadResult.succeeded,
          failed:      uploadResult.failed,
          totalCreated: uploadResult.totalCreated,
          files:       uploadResult.files,
          chatMessage: uploadResult.chatMessage,
          attachmentContext: uploadResult.attachmentContext,
        } : null;
        // إذا لا يوجد نص للإرسال نكتفي بنتيجة الرفع
        if (!text) return;
      }

      if (!text) return;

      const outgoingText = uploadedContext
        ? `${uploadedContext}\n\n[توجيه المستخدم على المرفقات]\n${text}`
        : text;

      this.consult.messages.push({
        role: 'user',
        content: text,
        attachments: uploadedMessage ? {
          count: uploadedMessage.count,
          succeeded: uploadedMessage.succeeded,
          failed: uploadedMessage.failed,
          totalCreated: uploadedMessage.totalCreated,
          chatMessage: uploadedMessage.chatMessage,
        } : null,
        _sendContent: outgoingText,
      });
      this.consult.input    = '';
      this.consult.thinking = true;
      this.consult.error    = '';

      // بناء التاريخ: نحتفظ برسائل الملفات ونحولها إلى user message
      // حتى يرى النموذج سياق ما رُفع ومعالجته في الدورات اللاحقة.
      const history = this.consult.messages
        .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'file')
        .map(m => {
          if (m.role === 'file') {
            const txt = m.chatMessage ||
              `رفعتُ ${m.count || ''} ملف${m.succeeded ? ` (${m.succeeded} نجح، ${m.failed || 0} فشل)` : ''}` +
              (m.totalCreated ? ` — تم إنشاء ${m.totalCreated} عنصر.` : '');
            return { role: 'user', content: `[سياق الملفات المرفوعة]\n${txt}` };
          }
          return { role: m.role, content: m._sendContent || m.content };
        });

      try {
        const body = { messages: history, mode: this.consult.mode };
        if (this.consult.modelLock) {
          const [p, ...m] = this.consult.modelLock.split('/');
          body.provider = p;
          body.model = m.join('/');
        }

        // ── SSE Streaming — يقرأ النبضات ويتحمل الطلبات الطويلة ────────────
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
        const csrf = this._getCsrfToken?.();
        if (csrf) headers['X-CSRF-Token'] = csrf;

        let response;
        try {
          response = await fetch((window.QMS_API || '/api') + '/consultant/chat', {
            method: 'POST', headers, credentials: 'include',
            body: JSON.stringify(body),
          });
        } catch (netErr) {
          // fetch() نفسه فشل (انقطاع شبكة، DNS، Cloudflare timeout...)
          const isTimeout = netErr.name === 'AbortError';
          throw new Error(
            isTimeout
              ? 'انتهى وقت الطلب — العملية طالت أكثر من المتوقع. أرسل «أكمل» للمتابعة.'
              : 'انقطع الاتصال — تحقّق من الشبكة وأعد المحاولة.'
          );
        }

        if (!response.ok && response.status !== 200) {
          const err = await response.json().catch(() => ({ error: { message: 'خطأ في الخادم' } }));
          throw new Error(err.error?.message || 'خطأ في الاستدعاء');
        }

        // قراءة SSE stream
        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';
        let   j       = null;
        let   lastEventType = '';

        while (true) {
          let chunk;
          try {
            chunk = await reader.read();
          } catch (readErr) {
            // انقطع الـ stream في المنتصف (timeout Cloudflare)
            throw new Error('انقطع الاتصال أثناء الاستجابة — أرسل «أكمل» إن كانت العملية قد بدأت.');
          }
          const { done, value } = chunk;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // معالجة أسطر SSE المكتملة
          const lines = buffer.split('\n');
          buffer = lines.pop(); // الجزء غير المكتمل

          for (const line of lines) {
            // تتبع نوع الحدث (event: error / event: result)
            if (line.startsWith('event: ')) {
              lastEventType = line.slice(7).trim();
              continue;
            }
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (!parsed || typeof parsed !== 'object') { lastEventType = ''; continue; }

                // progress event — خطوات التفكير الحية
                if (lastEventType === 'progress') {
                  if (parsed.type === 'tool_start') {
                    this.consultSteps.push({ label: parsed.label || parsed.tool, status: 'running' });
                  } else if (parsed.type === 'tool_done') {
                    const step = [...this.consultSteps].reverse().find(s => s.label === (parsed.label || parsed.tool) && s.status === 'running');
                    if (step) step.status = parsed.ok ? 'done' : 'error';
                  }
                  lastEventType = '';
                  continue;
                }

                // الخادم أرسل event: error صريح
                if (lastEventType === 'error' || parsed.ok === false) {
                  throw new Error(
                    (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message)
                    || 'خطأ من الخادم'
                  );
                }

                if (parsed.ok !== undefined) {
                  j = parsed; // النتيجة النهائية
                }
                // ping / thinking events تُتجاهَل
              } catch (parseOrSseErr) {
                if (
                  parseOrSseErr.message === 'خطأ من الخادم' ||
                  parseOrSseErr.message.startsWith('خطأ')
                ) throw parseOrSseErr;
                continue; // تجاهل أخطاء JSON البسيطة
              } finally {
                lastEventType = ''; // reset بعد معالجة كل data:
              }
            }
          }
        }

        if (!j) throw new Error('لم يصل رد من الخادم — قد يكون الطلب استغرق وقتاً طويلاً، أرسل «أكمل».');
        if (!j.ok) throw new Error(j.error?.message || 'خطأ في الاستدعاء');

        this.consult.messages.push({
          role:              'assistant',
          content:           j.reply,
          toolsUsed:         j.toolsUsed         || [],
          pendingActions:    j.pendingActions     || [],
          iterations:        j.iterations         || 0,
          hitIterationLimit: j.hitIterationLimit  || false,
          usage:             j.usage,
          cacheRead:         j.cacheRead          || 0,
          cacheWrite:        j.cacheWrite         || 0,
          mode:              j.mode,
          applied:           false,
          applyResults:      null,
          logId:             j.logId              || null,
          rating:            null,
        });

        if (j.model) { this.consult.lastModel = j.model; this.consult.lastProvider = j.provider || ''; }
        if (j.context) this.consult.context = j.context;
        this._consultSaveHistory();
        await this.saveSession();

      } catch (e) {
        this.consult.error = e.message;
        this.consult.messages.push({
          role: 'assistant', content: `❌ خطأ: ${e.message}`,
          toolsUsed: [], pendingActions: [],
        });
      } finally {
        this.consult.thinking = false;
        this.$nextTick && this.$nextTick(() => {
          const el = document.getElementById('consult-messages');
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    },

    // ─── تطبيق الإجراءات المعلقة ─────────────────────────────────────────
    async consultApplyPending(msg) {
      if (!msg.pendingActions?.length || msg.applied || this.consult.applying) return;
      if (!confirm(`تطبيق ${msg.pendingActions.length} إجراء على قاعدة البيانات؟`)) return;

      this.consult.applying = true;
      try {
        const j = await this.api('POST', '/consultant/apply-pending', { pendingActions: msg.pendingActions });
        if (!j.ok) throw new Error(j.error?.message || j.error || 'فشل التطبيق');

        msg.applied      = true;
        msg.applyResults = j.results;

        // رسالة تأكيد
        const ok     = j.summary.ok;
        const failed = j.summary.failed;
        this.consult.messages.push({
          role:    'system',
          content: `✅ طُبِّق ${ok} من ${j.summary.total}${failed ? ` (فشل ${failed})` : ''}`,
          isSuccess: failed === 0,
        });

        await this.loadConsultContext();
      } catch (e) {
        this.consult.error = e.message;
      } finally {
        this.consult.applying = false;
      }
    },

    // ─── مساعدات العرض ───────────────────────────────────────────────────
    toolLabel(name) { return TOOL_LABELS[name] || `🔧 ${name}`; },

    modelShortName(model) {
      if (!model) return '';
      const found = this.consult.modelOptions.find(m => m.model === model);
      if (found) return found.label;
      // fallback: strip date suffix and shorten
      return model.replace(/-\d{8}$/, '').replace('claude-', 'C-').replace('gemini-', 'G-').replace('gpt-', 'GPT-');
    },

    toolsSummary(toolsUsed) {
      if (!toolsUsed?.length) return '';
      const ok = toolsUsed.filter(t => t.ok).length;
      const failed = toolsUsed.length - ok;
      return `${toolsUsed.length} عملية${ok ? ` · ${ok}✅` : ''}${failed ? ` · ${failed}❌` : ''}`;
    },

    usageSummary(usage, cacheRead, cacheWrite) {
      if (!usage) return '';
      const parts = [];
      if (usage.inputTokens)  parts.push(`↑${usage.inputTokens.toLocaleString()}`);
      if (usage.outputTokens) parts.push(`↓${usage.outputTokens.toLocaleString()}`);
      if (cacheRead)  parts.push(`📦كاش ${cacheRead.toLocaleString()}`);
      if (usage.costUSD > 0) parts.push(`$${usage.costUSD.toFixed(4)}`);
      return parts.join(' · ');
    },

    formatConsultMessage(content) {
      if (!content) return '';
      return content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>');
    },

    // ─── رفع المرفقات (متعددة) ───────────────────────────────────────────────
    consultPickFile() {
      const input = document.getElementById('consult-file-input');
      if (input) input.click();
    },

    consultFileSelected(event) {
      const files = Array.from(event.target.files || []);
      for (const file of files) {
        // تجنب الإضافة المكررة
        if (!this.consult.attachments.find(a => a.name === file.name && a.size === file.size)) {
          this.consult.attachments.push({ name: file.name, size: file.size, _file: file });
        }
      }
      event.target.value = '';  // إعادة تعيين لإتاحة رفع نفس الملف مرة أخرى
    },

    consultRemoveAttachment(index) {
      this.consult.attachments.splice(index, 1);
    },

    async consultUpload(options = {}) {
      const silent = !!options.silent;
      if (!this.consult.attachments.length || this.consult.uploading || this.consult.thinking) return;

      // ← الإصلاح: ضبط uploading=true فوراً لمنع الإرسال المكرر
      this.consult.uploading = true;
      this.consult.loading   = true;
      this.consult.error     = '';
      this.consult.steps     = [];
      this.consultSteps      = [];

      const form = new FormData();
      for (const att of this.consult.attachments) {
        form.append('files', att._file, att.name);
      }

      try {
        const uploadHeaders = { Authorization: 'Bearer ' + this.token };
        const csrf = this._getCsrfToken?.();
        if (csrf) uploadHeaders['X-CSRF-Token'] = csrf;
        const r = await fetch('/api/consultant/upload', {
          method: 'POST', headers: uploadHeaders, credentials: 'include', body: form,
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error?.message || j.error || 'فشل رفع الملفات');

        // رسالة موحَّدة تُظهر نتيجة كل الملفات عند الرفع دون نص.
        // عند وجود نص، تُدمج المرفقات داخل رسالة المستخدم نفسها حتى لا ينفصل السياق.
        if (!silent) {
          this.consult.messages.push({
            role:        'file',
            count:       j.total,
            succeeded:   j.succeeded,
            failed:      j.failed,
            totalCreated: j.totalCreated,
            files:       j.files,
            chatMessage: j.chatMessage,
            attachmentContext: j.attachmentContext,
          });
        }

        this.consult.attachments = [];
        if (j.totalCreated > 0) await this.loadConsultContext();
        return j;

        // لا نُرسل أي برومت تلقائي — المستخدم يكتب ما يريد بنفسه.
        // الملفات المرفوعة ليست بالضرورة مؤشرات/أهداف، والبرومت الثابت كان يُضلِّل المودل.

      } catch (e) {
        this.consult.error = e.message;
      } finally {
        this.consult.loading   = false;
        this.consult.uploading = false;
        this.$nextTick && this.$nextTick(() => {
          const el = document.getElementById('consult-messages');
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    },

    formatFileSize(bytes) {
      if (!bytes) return '';
      if (bytes < 1024)        return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    },

    consultReset() {
      if (!confirm('بدء محادثة جديدة؟ ستُفقد الرسائل الحالية.')) return;
      this.consult.messages     = [];
      this.consult.input        = '';
      this.consult.error        = '';
      this.consult.attachments  = [];
      this.consult.sessionId    = null;
      this._consultRemoveCurrentHistory();
    },

    async consultResetStrategicData() {
      if (!confirm('⚠️ سيتم حذف جميع الأهداف الاستراتيجية والتشغيلية والمؤشرات.\n\nهذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد؟')) return;
      if (!confirm('تأكيد نهائي — اضغط موافق لبدء الحذف.')) return;

      try {
        const resetHeaders = { Authorization: 'Bearer ' + this.token };
        const csrf = this._getCsrfToken?.();
        if (csrf) resetHeaders['X-CSRF-Token'] = csrf;
        const r = await fetch('/api/strategic-goals/reset', {
          method:  'DELETE',
          headers: resetHeaders,
          credentials: 'include',
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error?.message || j.error || 'فشل الحذف');

        const d = j.deleted;
        this.consult.messages.push({
          role:      'system',
          content:   `🗑 تم حذف بيانات الخطة:\n• ${d.strategicGoals} هدف استراتيجي\n• ${d.operationalActivities} نشاط تشغيلي\n• ${d.objectives} هدف تشغيلي\n• ${d.kpiEntries} قيمة KPI\n• ${d.risksUnlinked} خطر (فُك ربطه فقط)\n\nارفع ملفات الخطة الآن 📎`,
          isSuccess: true,
        });
        await this.loadConsultContext();
      } catch (e) {
        this.consult.error = e.message;
      }
    },
  };
})();
