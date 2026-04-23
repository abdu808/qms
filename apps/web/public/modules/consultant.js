/**
 * modules/consultant.js — المستشار الاستراتيجي الذكي (v2.1)
 *
 * وضعا التشغيل:
 *   ⚡ تلقائي  (auto)   — AI ينفِّذ مباشرةً، ترى ما فعل
 *   🔍 مراجعة (review) — AI يقترح، أنت توافق بنقرة واحدة
 */
(function () {
  'use strict';

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
      mode:        'auto',     // 'auto' | 'review'
      showTools:   true,
      attachments: [],         // [{ name, size, _file }] — قائمة الملفات المُختارة
      modelLock:    null,    // null=تلقائي, string=موديل محدد يُرسَل للـ API
      lastModel:    '',      // آخر موديل استُخدم (من الـ response)
      lastProvider: '',      // آخر مزود
      modelOptions: [],      // قائمة الموديلات المتاحة
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
    _consultSaveHistory() {
      try {
        // نحفظ رسائل الملفات كملخص خفيف (chatMessage فقط) حتى لا نضيع السياق
        // بعد إعادة تحميل الصفحة.
        const toSave = this.consult.messages
          .map(m => {
            if (m.role !== 'file') return m;
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
        localStorage.setItem('qms_consult_history', JSON.stringify(toSave));
      } catch {}
    },

    _consultRestoreHistory() {
      try {
        const raw = localStorage.getItem('qms_consult_history');
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
            try { localStorage.setItem('qms_consult_history', JSON.stringify(filtered)); } catch {}
          }
        }
      } catch {
        localStorage.removeItem('qms_consult_history');
      }
    },

    // ─── تحميل السياق ─────────────────────────────────────────────────────
    async loadConsultContext() {
      if (!this.token) return;
      // استعادة المحادثة السابقة من localStorage (مرة واحدة فقط عند الفتح)
      if (this.consult.messages.length === 0) this._consultRestoreHistory();
      try {
        this.consult.loading = true;
        // جلب قائمة الموديلات مرة واحدة
        if (!this.consult.modelOptions.length) {
          try {
            const mj = await this.api('GET', '/ai-settings/models');
            if (mj.ok) this.consult.modelOptions = mj.items || [];
          } catch {}
        }
        const j = await this.api('GET', '/consultant/context');
        if (!j.ok) throw new Error(j.error?.message || j.error || 'فشل تحميل السياق');
        this.consult.context = { summary: j.context.summary, gaps: j.context.gaps.counts };
      } catch (e) {
        this.consult.error = e.message;
      } finally {
        this.consult.loading = false;
      }
    },

    consultUseTemplate(tpl) { this.consult.input = tpl.prompt; },

    // ─── إرسال رسالة ──────────────────────────────────────────────────────
    async consultSend() {
      const text = (this.consult.input || '').trim();
      if (!text || this.consult.thinking) return;

      this.consult.messages.push({ role: 'user', content: text });
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
          return { role: m.role, content: m.content };
        });

      try {
        const body = { messages: history, mode: this.consult.mode };
        if (this.consult.modelLock) {
          // استخراج provider/model من "provider/model" format
          const [p, ...m] = this.consult.modelLock.split('/');
          body.provider = p;
          body.model = m.join('/');
        }
        const j = await this.api('POST', '/consultant/chat', body);
        if (!j.ok) throw new Error(j.error?.message || j.error || 'خطأ في الاستدعاء');

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
        });

        if (j.model) { this.consult.lastModel = j.model; this.consult.lastProvider = j.provider || ''; }
        if (j.context) this.consult.context = j.context;
        this._consultSaveHistory();

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

    async consultUpload() {
      if (!this.consult.attachments.length || this.consult.uploading) return;

      this.consult.uploading = true;
      this.consult.error     = '';

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

        // رسالة موحَّدة تُظهر نتيجة كل الملفات
        this.consult.messages.push({
          role:        'file',
          count:       j.total,
          succeeded:   j.succeeded,
          failed:      j.failed,
          totalCreated: j.totalCreated,
          files:       j.files,
          chatMessage: j.chatMessage,
        });

        this.consult.attachments = [];
        if (j.totalCreated > 0) await this.loadConsultContext();

        // لا نُرسل أي برومت تلقائي — المستخدم يكتب ما يريد بنفسه.
        // الملفات المرفوعة ليست بالضرورة مؤشرات/أهداف، والبرومت الثابت كان يُضلِّل المودل.

      } catch (e) {
        this.consult.error = e.message;
      } finally {
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
      try { localStorage.removeItem('qms_consult_history'); } catch {}
    },

    async consultResetStrategicData() {
      if (!confirm('⚠️ سيتم حذف جميع الأهداف الاستراتيجية والتشغيلية والمؤشرات.\n\nهذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد؟')) return;
      if (!confirm('تأكيد نهائي — اضغط موافق لبدء الحذف.')) return;

      try {
        const r = await fetch('/api/strategic-goals/reset', {
          method:  'DELETE',
          headers: { Authorization: 'Bearer ' + this.token },
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
