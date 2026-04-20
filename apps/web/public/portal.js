// portal.js — Alpine.js data للبوابة العامة
function portal() {
  return {
    settings: {
      orgName: '', orgDescription: '',
      showPolicy: true, showDocuments: true,
      showAnnouncements: true, showSurveys: true,
      footerText: '',
    },
    policy: null,
    announcements: [],
    documents: [],
    surveys: [],
    loading: true,
    error: null,
    activeSection: null,   // للـ accordion في الجوال

    async init() {
      try {
        const r = await fetch('/api/public/portal');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        this.settings     = d.settings     || this.settings;
        this.policy       = d.policy       || null;
        this.announcements= d.announcements|| [];
        this.documents    = d.documents    || [];
        this.surveys      = d.surveys      || [];
        document.title    = this.settings.orgName || 'البوابة المؤسسية';
      } catch (e) {
        this.error = 'تعذّر تحميل المحتوى. يرجى المحاولة لاحقاً.';
      } finally {
        this.loading = false;
      }
    },

    toggleSection(id) {
      this.activeSection = this.activeSection === id ? null : id;
    },

    categoryLabel(cat) {
      const MAP = {
        MANUAL: 'دليل', POLICY: 'سياسة', PROCEDURE: 'إجراء',
        WORK_INSTRUCTION: 'تعليمة عمل', FORM: 'نموذج',
        RECORD: 'سجل', EXTERNAL: 'خارجي',
      };
      return MAP[cat] || cat || '';
    },

    targetLabel(t) {
      const MAP = {
        BENEFICIARY: 'المستفيدون', DONOR: 'المانحون',
        VOLUNTEER: 'المتطوعون', EMPLOYEE: 'الموظفون', PARTNER: 'الشركاء',
      };
      return MAP[t] || t || '';
    },

    formatDate(d) {
      if (!d) return '';
      return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    },
  };
}
