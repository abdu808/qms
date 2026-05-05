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

    surveyTemplates() {
      return [
        { v: '', l: '— بدون قالب —' },
        {
          v: 'BENEFICIARY_SERVICE',
          l: 'رضا المستفيد بعد الخدمة',
          data: {
            title: 'استبيان رضا المستفيدين عن الخدمة',
            target: 'BENEFICIARY',
            period: `شهر ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام للخدمة المقدمة؟', type: 'rating', required: true },
              { key: 'speed', label: 'ما تقييمك لسرعة إنجاز الخدمة؟', type: 'rating', required: true },
              { key: 'clarity', label: 'هل كانت المتطلبات والإجراءات واضحة؟', type: 'yesno', required: true },
              { key: 'respect', label: 'ما تقييمك للتعامل والاحترام أثناء تقديم الخدمة؟', type: 'rating', required: true },
              { key: 'suggestion', label: 'ما اقتراحك لتحسين الخدمة؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'BENEFICIARY_AID',
          l: 'رضا المستفيد عن المساعدة/الكفالة',
          data: {
            title: 'استبيان رضا المستفيدين عن المساعدة أو الكفالة',
            target: 'BENEFICIARY',
            period: `شهر ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام للمساعدة أو الكفالة؟', type: 'rating', required: true },
              { key: 'suitability', label: 'هل كانت المساعدة مناسبة لاحتياجك؟', type: 'yesno', required: true },
              { key: 'timing', label: 'ما تقييمك لتوقيت وصول المساعدة؟', type: 'rating', required: true },
              { key: 'communication', label: 'ما تقييمك للتواصل والمتابعة؟', type: 'rating', required: true },
              { key: 'needs', label: 'هل لديك احتياج أو ملاحظة إضافية؟', type: 'text', required: false },
            ],
          },
        },
        {
          v: 'DONOR_PARTNER',
          l: 'رضا المتبرع/الشريك',
          data: {
            title: 'استبيان رضا المتبرعين والشركاء',
            target: 'DONOR',
            period: `شهر ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام لتجربتك مع الجمعية؟', type: 'rating', required: true },
              { key: 'transparency', label: 'ما تقييمك لوضوح المعلومات والتقارير؟', type: 'rating', required: true },
              { key: 'communication', label: 'ما تقييمك للتواصل وسرعة الاستجابة؟', type: 'rating', required: true },
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
            period: `شهر ${new Date().getFullYear()}`,
            questions: [
              { key: 'overall', label: 'ما تقييمك العام لبيئة العمل؟', type: 'rating', required: true },
              { key: 'clarity', label: 'ما تقييمك لوضوح المسؤوليات والإجراءات؟', type: 'rating', required: true },
              { key: 'tools', label: 'هل تتوفر الأدوات والموارد اللازمة لأداء العمل؟', type: 'yesno', required: true },
              { key: 'training', label: 'ما تقييمك لفرص التدريب والتطوير؟', type: 'rating', required: true },
              { key: 'improvement', label: 'ما أهم تحسين تقترحه لبيئة العمل؟', type: 'text', required: false },
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
        questions: selected.data.questions.map(q => ({ ...q })),
      });
    },

    // ─── CRUD ──────────────────────────────────────────────────
    openSurveyCreate() {
      this.surveyModal = {
        open: true, mode: 'create', id: null,
        title: '', target: 'BENEFICIARY', period: '', active: true,
        questions: [
          { key: 'overall', label: 'تقييمك العام للخدمة', type: 'rating' },
        ],
      };
      this.surveyTemplate = '';
    },
    async openSurveyEdit(s) {
      const raw = (() => { try { return JSON.parse(s.questionsJson || '[]'); } catch { return []; } })();
      // تطبيع: يدعم المفاتيح القديمة
      const questions = raw.map((q, i) => ({
        key: String(q.key || q.id || `q${i + 1}`),
        label: String(q.label || q.text || q.question || ''),
        type: String(q.type || 'text').toLowerCase(),
        required: !!q.required,
      }));
      if (s.responses > 0) {
        if (!confirm(`⚠️ هذا الاستبيان استقبل ${s.responses} ردّاً بالفعل.\nتغيير الأسئلة أو مفاتيحها قد يُفسِد الإحصاءات السابقة.\nهل تريد المتابعة؟`)) return;
      }
      this.surveyModal = {
        open: true, mode: 'edit', id: s.id,
        title: s.title, target: s.target, period: s.period || '', active: s.active,
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
