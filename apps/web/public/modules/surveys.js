/**
 * modules/surveys.js — وحدة الاستبيانات (builder + questions + summary + sharing)
 * يُدمج في app() عبر ...window.QmsSurveys
 */
(function () {
  'use strict';

  window.QmsSurveys = {
    // ─── State ─────────────────────────────────────────────────
    surveysList: [],
    surveyModal: {
      open: false, mode: 'create', id: null,
      title: '', target: 'BENEFICIARY', period: '', active: true,
      executionStatus: 'DRAFT', channel: 'LINK',
      plannedStartAt: '', plannedEndAt: '', targetResponses: '',
      audienceNote: '', ownerId: '', isPublic: true,
      questions: [],
    },
    surveySummary: { open: false, data: null, survey: null },
    surveysQuick: [],
    surveysCounts: {},
    surveyTemplate: '',

    // ─── Loaders ───────────────────────────────────────────────
    async loadSurveys() {
      try {
        const params = new URLSearchParams();
        if (this.surveysQuick.length) params.set('quick', this.surveysQuick.join(','));
        const qs = params.toString();
        const r = await this.api('GET', qs ? `/surveys?${qs}` : '/surveys');
        this.surveysList = r.items || [];
        this.surveysCounts = r.counts || {};
      } catch (e) { alert(e.message || 'فشل تحميل الاستبيانات'); }
    },

    // ─── Quick Filters ──────────────────────────────────────────
    toggleSurveysQuick(key) {
      const i = this.surveysQuick.indexOf(key);
      if (i >= 0) this.surveysQuick.splice(i, 1); else this.surveysQuick.push(key);
      this.loadSurveys();
    },
    clearSurveysQuick() { this.surveysQuick = []; this.loadSurveys(); },
    surveysQuickLabels() {
      return {
        active:           { label: 'نشِط',          icon: '✅' },
        inactive:         { label: 'مُعطَّل',         icon: '⏸️' },
        withResponses:    { label: 'يحوي ردوداً',   icon: '📬' },
        noResponses:      { label: 'بلا ردود',      icon: '📭' },
        highSatisfaction: { label: 'رضا مرتفع ≥4',  icon: '🌟' },
        lowSatisfaction:  { label: 'رضا منخفض <3',  icon: '⚠️' },
        recent:           { label: 'حديث (30ي)',   icon: '🆕' },
        stale:            { label: 'راكد (>60ي بلا ردود)', icon: '🕸️' },
      };
    },

    surveyScorePct(s) {
      const avg = Number(s?.avgScore);
      if (!Number.isFinite(avg)) return null;
      return Math.max(0, Math.min(100, Math.round((avg / 5) * 100)));
    },
    surveyScoreText(s) {
      const pct = this.surveyScorePct(s);
      return pct == null ? '—' : `${pct}%`;
    },
    surveyScoreClass(s) {
      const pct = this.surveyScorePct(s);
      if (pct == null) return 'text-gray-400';
      if (pct >= 80) return 'text-emerald-700';
      if (pct >= 65) return 'text-amber-700';
      return 'text-red-700';
    },
    surveyTargetLabel(target) {
      return ({
        BENEFICIARY: 'المستفيدون',
        DONOR: 'المتبرعون',
        VOLUNTEER: 'المتطوعون',
        EMPLOYEE: 'الموظفون',
        PARTNER: 'الشركاء',
      })[target] || target || '—';
    },
    surveyExecutionStatusLabel(status) {
      return ({
        DRAFT: 'مسودة',
        READY: 'جاهز للإرسال',
        IN_PROGRESS: 'قيد التنفيذ',
        CLOSED: 'مغلق',
      })[status] || status || 'مسودة';
    },
    surveyExecutionStatusClass(status) {
      return ({
        DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
        READY: 'bg-blue-50 text-blue-700 border-blue-200',
        IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
      })[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    },
    surveyChannelLabel(channel) {
      return ({
        WHATSAPP: 'واتساب',
        SMS: 'رسائل SMS',
        EMAIL: 'بريد إلكتروني',
        FIELD: 'ميداني',
        LINK: 'رابط مباشر',
        MIXED: 'مختلط',
      })[channel] || channel || 'رابط مباشر';
    },
    surveyProgressPct(s) {
      const target = Number(s?.targetResponses);
      if (!Number.isFinite(target) || target <= 0) return null;
      const responses = Number(s?.responses) || 0;
      return Math.max(0, Math.min(100, Math.round((responses / target) * 100)));
    },
    surveyProgressText(s) {
      const target = Number(s?.targetResponses);
      const responses = Number(s?.responses) || 0;
      return target > 0 ? `${responses}/${target}` : `${responses}`;
    },
    surveyDueText(s) {
      if (!s?.plannedEndAt) return 'بدون موعد';
      const d = new Date(s.plannedEndAt);
      if (Number.isNaN(d.getTime())) return 'بدون موعد';
      return d.toLocaleDateString('ar-SA');
    },
    surveyIsLate(s) {
      if (!s?.plannedEndAt || s.executionStatus === 'CLOSED') return false;
      const d = new Date(s.plannedEndAt);
      if (Number.isNaN(d.getTime())) return false;
      return d.getTime() < Date.now() && (this.surveyProgressPct(s) ?? 0) < 100;
    },
    surveyNeedsAction(s) {
      return this.surveyIsLate(s)
        || (s.executionStatus === 'IN_PROGRESS' && (Number(s.responses) || 0) === 0)
        || (s.executionStatus === 'DRAFT' && s.active);
    },
    surveyDefaultTargetResponses(target) {
      return ({
        BENEFICIARY: 30,
        EMPLOYEE: 10,
        DONOR: 10,
        PARTNER: 10,
        VOLUNTEER: 10,
      })[target] || 10;
    },

    surveyCenterRows(target = 'BENEFICIARY') {
      return (this.surveysList || [])
        .filter(s => !target || s.target === target)
        .map(s => ({ ...s, scorePct: this.surveyScorePct(s) }))
        .sort((a, b) => (b.responses || 0) - (a.responses || 0));
    },
    surveyCenterStats(target = 'BENEFICIARY') {
      const rows = this.surveyCenterRows(target);
      const totalResponses = rows.reduce((sum, s) => sum + (Number(s.responses) || 0), 0);
      const scored = rows.filter(s => Number.isFinite(Number(s.avgScore)));
      const weightedBase = scored.reduce((sum, s) => sum + ((Number(s.responses) || 0) > 0 ? Number(s.responses) : 1), 0);
      const weightedAvg = weightedBase
        ? scored.reduce((sum, s) => sum + Number(s.avgScore) * ((Number(s.responses) || 0) > 0 ? Number(s.responses) : 1), 0) / weightedBase
        : null;
      const scorePct = weightedAvg == null ? null : Math.round((weightedAvg / 5) * 100);
      return {
        surveys: rows.length,
        active: rows.filter(s => s.active).length,
        totalResponses,
        scored: scored.length,
        scorePct,
        low: rows.filter(s => (Number(s.responses) || 0) > 0 && Number(s.avgScore) < 3).length,
        noResponses: rows.filter(s => (Number(s.responses) || 0) === 0).length,
      };
    },
    surveyCenterScoreClass(target = 'BENEFICIARY') {
      const pct = this.surveyCenterStats(target).scorePct;
      if (pct == null) return 'text-gray-400';
      if (pct >= 80) return 'text-emerald-700';
      if (pct >= 65) return 'text-amber-700';
      return 'text-red-700';
    },
    surveyCenterScoreText(target = 'BENEFICIARY') {
      const pct = this.surveyCenterStats(target).scorePct;
      return pct == null ? '—' : `${pct}%`;
    },

    surveyTemplates() {
      return [
        { v: '', l: '— بدون قالب —' },
        {
          v: 'BENEFICIARY_SERVICE',
          l: 'المستفيد - تجربة الخدمة العامة',
          data: {
            title: 'استبيان رضا المستفيد عن الخدمة',
            target: 'BENEFICIARY',
            period: `ربع سنوي ${new Date().getFullYear()}`,
            questions: [
              { key: 'staff_treatment', label: 'ما مدى رضاك عن تعامل موظفي الجمعية معك؟', type: 'rating', required: true },
              { key: 'easy_service', label: 'هل كانت الخدمة واضحة وسهلة؟', type: 'rating', required: true },
              { key: 'timely_response', label: 'هل تم الرد عليك أو خدمتك في وقت مناسب؟', type: 'rating', required: true },
              { key: 'need_fit', label: 'هل كانت الخدمة مناسبة لاحتياجك؟', type: 'rating', required: true },
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن تجربتك مع الجمعية؟', type: 'rating', required: true },
              { key: 'note', label: 'هل لديك ملاحظة أو اقتراح تحب إضافته؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_AID',
          l: 'المستفيد - مساعدة مالية أو عينية',
          data: {
            title: 'استبيان رضا المستفيد عن المساعدة',
            target: 'BENEFICIARY',
            period: `بعد تقديم المساعدة ${new Date().getFullYear()}`,
            questions: [
              { key: 'staff_treatment', label: 'ما مدى رضاك عن تعامل موظفي الجمعية معك؟', type: 'rating', required: true },
              { key: 'aid_timing', label: 'هل وصلت المساعدة في وقت مناسب؟', type: 'rating', required: true },
              { key: 'aid_fit', label: 'هل كانت المساعدة مناسبة لاحتياجك؟', type: 'rating', required: true },
              { key: 'easy_steps', label: 'هل كانت خطوات الحصول على المساعدة سهلة؟', type: 'rating', required: true },
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن هذه المساعدة؟', type: 'rating', required: true },
              { key: 'note', label: 'هل لديك ملاحظة أو اقتراح تحب إضافته؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_SPONSORSHIP',
          l: 'المستفيد - الكفالة والرعاية',
          data: {
            title: 'استبيان رضا المستفيد عن الكفالة والرعاية',
            target: 'BENEFICIARY',
            period: `نصف سنوي ${new Date().getFullYear()}`,
            questions: [
              { key: 'followup', label: 'هل تشعر أن الجمعية تتابع حالتك بشكل مناسب؟', type: 'rating', required: true },
              { key: 'communication', label: 'هل التواصل مع الجمعية سهل وواضح؟', type: 'rating', required: true },
              { key: 'support_fit', label: 'هل الدعم المقدم مناسب لاحتياج الأسرة؟', type: 'rating', required: true },
              { key: 'respect', label: 'ما مدى رضاك عن طريقة التعامل معك؟', type: 'rating', required: true },
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن الكفالة أو الرعاية؟', type: 'rating', required: true },
              { key: 'note', label: 'هل لديك ملاحظة أو احتياج تريد إيصاله؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_EMPOWERMENT',
          l: 'المستفيد - التمكين أو التدريب',
          data: {
            title: 'استبيان رضا المستفيد عن برنامج التمكين أو التدريب',
            target: 'BENEFICIARY',
            period: `بعد البرنامج ${new Date().getFullYear()}`,
            questions: [
              { key: 'program_clear', label: 'هل كان البرنامج واضحاً وسهل الفهم؟', type: 'rating', required: true },
              { key: 'program_useful', label: 'هل استفدت من البرنامج؟', type: 'rating', required: true },
              { key: 'trainer', label: 'ما مدى رضاك عن المدرب أو مقدم البرنامج؟', type: 'rating', required: true },
              { key: 'future_help', label: 'هل يساعدك البرنامج في تحسين وضعك مستقبلاً؟', type: 'rating', required: true },
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن البرنامج؟', type: 'rating', required: true },
              { key: 'note', label: 'ما الموضوع أو الدعم الذي تحتاجه لاحقاً؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_HOME_DELIVERY',
          l: 'المستفيد - إيصال الدعم منزلياً',
          data: {
            title: 'استبيان رضا المستفيد عن إيصال الدعم منزلياً',
            target: 'BENEFICIARY',
            period: `بعد التوصيل ${new Date().getFullYear()}`,
            questions: [
              { key: 'delivery_timing', label: 'هل وصل الدعم في وقت مناسب؟', type: 'rating', required: true },
              { key: 'delivery_condition', label: 'هل وصل الدعم بحالة جيدة؟', type: 'rating', required: true },
              { key: 'delivery_treatment', label: 'ما مدى رضاك عن تعامل فريق التوصيل؟', type: 'rating', required: true },
              { key: 'delivery_need', label: 'هل خدمة التوصيل ساعدتك فعلاً؟', type: 'rating', required: true },
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن إيصال الدعم منزلياً؟', type: 'rating', required: true },
              { key: 'note', label: 'هل لديك ملاحظة أو اقتراح لتحسين التوصيل؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_QUICK',
          l: 'المستفيد - رأي مختصر جداً',
          data: {
            title: 'استبيان مختصر لرأي المستفيد',
            target: 'BENEFICIARY',
            period: `عند الحاجة ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'بشكل عام، ما مدى رضاك عن الخدمة؟', type: 'rating', required: true },
              { key: 'fit', label: 'هل كانت الخدمة مناسبة لك؟', type: 'yesno', required: false },
              { key: 'note', label: 'اكتب ملاحظتك باختصار', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'DONOR_PARTNER',
          l: 'رضا المتبرع/الشريك',
          data: {
            title: 'استبيان رضا المتبرعين والشركاء',
            target: 'DONOR',
            period: `نصف سنوي ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام لتجربتك مع الجمعية؟', type: 'rating', required: true },
              { key: 'transparency', label: 'ما تقييمك لوضوح المعلومات والتقارير؟', type: 'rating', required: true },
              { key: 'communication', label: 'ما تقييمك للتواصل وسرعة الاستجابة؟', type: 'rating', required: true },
              { key: 'trust', label: 'ما مستوى ثقتك في إدارة التبرعات أو الشراكة؟', type: 'rating', required: true },
              { key: 'repeat', label: 'هل ترغب في استمرار التعاون أو الدعم؟', type: 'yesno', required: true },
              { key: 'suggestion', label: 'ما الذي يمكن تحسينه في تجربة الشراكة/التبرع؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'EMPLOYEE_ENV',
          l: 'رضا الموظف عن بيئة العمل',
          data: {
            title: 'استبيان رضا الموظفين عن بيئة العمل',
            target: 'EMPLOYEE',
            period: `نصف سنوي ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام لبيئة العمل؟', type: 'rating', required: true },
              { key: 'clarity', label: 'ما تقييمك لوضوح المسؤوليات والإجراءات؟', type: 'rating', required: true },
              { key: 'tools', label: 'هل تتوفر الأدوات والموارد اللازمة لأداء العمل؟', type: 'yesno', required: true },
              { key: 'training', label: 'ما تقييمك لفرص التدريب والتطوير؟', type: 'rating', required: true },
              { key: 'communication', label: 'ما تقييمك للتواصل الداخلي وتبادل المعلومات؟', type: 'rating', required: true },
              { key: 'improvement', label: 'ما أهم تحسين تقترحه لبيئة العمل؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'VOLUNTEER_EXPERIENCE',
          l: 'تجربة المتطوع',
          data: {
            title: 'استبيان تجربة المتطوعين',
            target: 'VOLUNTEER',
            period: `بعد المشاركة ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام لتجربتك التطوعية مع الجمعية؟', type: 'rating', required: true },
              { key: 'role_clarity', label: 'هل كانت المهمة المطلوبة منك واضحة؟', type: 'rating', required: true },
              { key: 'support', label: 'ما تقييمك لدعم الفريق لك أثناء المشاركة؟', type: 'rating', required: true },
              { key: 'impact', label: 'هل شعرت أن مشاركتك كان لها أثر واضح؟', type: 'rating', required: true },
              { key: 'repeat', label: 'هل ترغب في تكرار المشاركة مستقبلاً؟', type: 'yesno', required: true },
              { key: 'suggestion', label: 'ما اقتراحك لتحسين تجربة المتطوع؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'TRAINING_EVENT',
          l: 'تقييم تدريب أو فعالية',
          data: {
            title: 'استبيان تقييم تدريب أو فعالية',
            target: 'EMPLOYEE',
            period: `بعد التنفيذ ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام للتدريب أو الفعالية؟', type: 'rating', required: true },
              { key: 'content', label: 'ما تقييمك لمناسبة المحتوى لاحتياجك؟', type: 'rating', required: true },
              { key: 'delivery', label: 'ما تقييمك لطريقة التقديم والتنظيم؟', type: 'rating', required: true },
              { key: 'benefit', label: 'ما مدى استفادتك العملية مما تم تقديمه؟', type: 'rating', required: true },
              { key: 'next_need', label: 'ما الموضوع الذي تقترح التدريب عليه لاحقاً؟', type: 'text', required: false },
            ],
          },
        },
      ];
    },

    applySurveyTemplate() {
      const selected = this.surveyTemplates().find(t => t.v === this.surveyTemplate);
      if (!selected?.data) return;
      Object.assign(this.surveyModal, {
        title: selected.data.title,
        target: selected.data.target,
        period: selected.data.period,
        active: true,
        isPublic: true,
        executionStatus: 'READY',
        channel: 'LINK',
        targetResponses: this.surveyDefaultTargetResponses(selected.data.target),
        audienceNote: selected.l || '',
        questions: selected.data.questions.map(q => ({ ...q })),
      });
    },

    // ─── CRUD ──────────────────────────────────────────────────
    openSurveyCreate() {
      this.surveyModal = {
        open: true, mode: 'create', id: null,
        title: '', target: 'BENEFICIARY', period: '', active: true,
        executionStatus: 'DRAFT', channel: 'LINK',
        plannedStartAt: '', plannedEndAt: '', targetResponses: 30,
        audienceNote: '', ownerId: '', isPublic: true,
        questions: [
          { key: 'overall', label: 'ما تقييمك العام للتجربة؟', type: 'rating', required: true },
          { key: 'improvement', label: 'ما أهم ملاحظة أو اقتراح للتحسين؟', type: 'text', required: false },
        ],
      };
      this.surveyTemplate = '';
    },
    async openSurveyEdit(s) {
      const raw = (() => { try { return JSON.parse(s.questionsJson || '[]'); } catch { return []; } })();
      // تطبيع: يدعم المفاتيح القديمة
      const questions = raw.map((q, i) => {
        const legacyScale = q.scale || q.max || q.ratingScale;
        return {
          key: String(q.key || q.id || `q${i + 1}`),
          label: String(q.label || q.text || q.question || q.q || ''),
          type: String(q.type || (legacyScale ? 'rating' : 'text')).toLowerCase(),
          required: q.required === undefined ? !!legacyScale : !!q.required,
        };
      });
      if (s.responses > 0) {
        if (!confirm(`⚠️ هذا الاستبيان استقبل ${s.responses} ردّاً بالفعل.\nتغيير الأسئلة أو مفاتيحها قد يُفسِد الإحصاءات السابقة.\nهل تريد المتابعة؟`)) return;
      }
      this.surveyModal = {
        open: true, mode: 'edit', id: s.id,
        title: s.title, target: s.target, period: s.period || '', active: s.active,
        isPublic: !!s.isPublic,
        executionStatus: s.executionStatus || 'DRAFT',
        channel: s.channel || 'LINK',
        plannedStartAt: s.plannedStartAt ? String(s.plannedStartAt).slice(0, 10) : '',
        plannedEndAt: s.plannedEndAt ? String(s.plannedEndAt).slice(0, 10) : '',
        targetResponses: s.targetResponses ?? '',
        audienceNote: s.audienceNote || '',
        ownerId: s.ownerId || '',
        responses: s.responses || 0,
        questions,
      };
    },

    // ─── Question Builder ───────────────────────────────────────
    addSurveyQuestion() {
      // توليد مفتاح فريد
      const existingKeys = new Set(this.surveyModal.questions.map(q => q.key));
      let i = this.surveyModal.questions.length + 1;
      let key = `q${i}`;
      while (existingKeys.has(key)) { i++; key = `q${i}`; }
      this.surveyModal.questions.push({ key, label: '', type: 'rating', required: false });
    },
    removeSurveyQuestion(idx) {
      if (!confirm('حذف هذا السؤال؟')) return;
      this.surveyModal.questions.splice(idx, 1);
    },

    async saveSurvey() {
      const m = this.surveyModal;
      if (!m.title?.trim()) return alert('أدخل عنوان الاستبيان');
      if (!m.questions.length) return alert('أضف سؤالاً واحداً على الأقل');
      if (m.questions.length > 50) return alert('الحد الأقصى 50 سؤالاً');
      const keys = new Set();
      for (const [i, q] of m.questions.entries()) {
        if (!q.key?.trim()) return alert(`السؤال رقم ${i + 1}: المعرّف (key) مطلوب`);
        if (!q.label?.trim()) return alert(`السؤال رقم ${i + 1}: نص السؤال مطلوب`);
        if (!['rating','text','yesno'].includes(q.type)) return alert(`السؤال رقم ${i+1}: نوع غير مدعوم`);
        if (keys.has(q.key.trim())) return alert(`السؤال رقم ${i + 1}: المعرّف "${q.key}" مكرَّر`);
        keys.add(q.key.trim());
      }
      const payload = {
        title: m.title, target: m.target, period: m.period || null, active: !!m.active,
        isPublic: !!m.isPublic,
        executionStatus: m.executionStatus || 'DRAFT',
        channel: m.channel || 'LINK',
        plannedStartAt: m.plannedStartAt || null,
        plannedEndAt: m.plannedEndAt || null,
        targetResponses: m.targetResponses === '' || m.targetResponses == null ? null : Number(m.targetResponses),
        audienceNote: m.audienceNote || null,
        ownerId: m.ownerId || null,
        questionsJson: JSON.stringify(m.questions),
      };
      try {
        if (m.mode === 'create') await this.api('POST', '/surveys', payload);
        else await this.api('PUT', `/surveys/${m.id}`, payload);
        this.surveyModal.open = false;
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },

    async deleteSurvey(s) {
      if (!confirm(`حذف الاستبيان "${s.title}"؟`)) return;
      try {
        await this.api('DELETE', `/surveys/${s.id}`);
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    async viewSurveySummary(s) {
      try {
        const r = await this.api('GET', `/surveys/${s.id}/summary`);
        this.surveySummary = { open: true, data: r, survey: s };
      } catch (e) { alert(e.message || 'فشل جلب النتائج'); }
    },

    // ─── Sharing ────────────────────────────────────────────────
    async setSurveyExecutionStatus(s, status) {
      try {
        await this.api('PATCH', `/surveys/${s.id}`, {
          executionStatus: status,
          active: status !== 'CLOSED',
          isPublic: status !== 'CLOSED',
        });
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل تحديث حالة التنفيذ'); }
    },

    copySurveyLink(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`✅ تم نسخ الرابط\n${url}`);
      }).catch(() => {
        prompt('انسخ الرابط:', url);
      });
    },
    shareWhatsappSurvey(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      const msg = encodeURIComponent(`مرحباً، نرجو مشاركتنا رأيك عبر الاستبيان:\n${s.title}\n${url}`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    },
  };
})();
