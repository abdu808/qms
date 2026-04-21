/**
 * portal.js — Alpine.js data للبوابة العامة
 * يتبع نمط القراءة فقط: fetch → عرض، لا كتابة.
 */
function portal() {
  return {
    settings:      {},
    policy:        null,
    announcements: [],
    documents:     [],
    surveys:       [],
    loading:       true,
    error:         null,

    async init() {
      this.loading = true;
      this.error   = null;
      try {
        const res = await fetch('/api/public/portal');
        if (!res.ok) throw new Error('خطأ في الخادم: ' + res.status);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'خطأ غير معروف');
        this.settings      = data.settings      || {};
        this.policy        = data.policy        || null;
        this.announcements = data.announcements || [];
        this.documents     = data.documents     || [];
        this.surveys       = data.surveys       || [];
        // تحديث عنوان الصفحة
        if (this.settings.orgName) {
          document.title = this.settings.orgName + ' — البوابة العامة';
        }
      } catch (e) {
        this.error = 'تعذّر تحميل المحتوى. يرجى المحاولة مجدداً.';
        console.error('[portal]', e);
      } finally {
        this.loading = false;
      }
    },

    /** تنسيق التاريخ بالعربية */
    fmt(dateStr) {
      if (!dateStr) return '';
      try {
        return new Date(dateStr).toLocaleDateString('ar-SA', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
      } catch { return ''; }
    },
  };
}
