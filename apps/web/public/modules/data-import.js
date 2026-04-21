/**
 * modules/data-import.js — استيراد البيانات من ملفات Excel
 * يُدمج في app() عبر ...window.QmsDataImport
 */
(function () {
  'use strict';
  window.QmsDataImport = {
    // ─── State ───────────────────────────────────────────────────────────
    dataImport: {
      entities: [], selected: '', file: null, fileName: '',
      preview: null, previewLoading: false,
      importing: false, result: null, error: '',
    },

    // ─── Methods ─────────────────────────────────────────────────────────
    async loadDataImportEntities() {
      try {
        const r = await this.api('GET', '/import/entities');
        this.dataImport.entities = r.entities || [];
      } catch(e) { this.toast('تعذر تحميل قائمة الكيانات', 'error'); }
    },
    async downloadTemplate(entityKey) {
      const a = document.createElement('a');
      a.href = `/api/import/template/${entityKey}`;
      a.setAttribute('Authorization', `Bearer ${this.token}`);
      // Use fetch to download with auth header
      try {
        const res = await fetch(`/api/import/template/${entityKey}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل التحميل');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template-${entityKey}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch(e) { this.toast('تعذر تحميل النموذج', 'error'); }
    },
    async previewImport() {
      const d = this.dataImport;
      if (!d.selected || !d.file) { this.toast('اختر نوع البيانات والملف أولاً', 'warn'); return; }
      d.previewLoading = true; d.preview = null; d.result = null; d.error = '';
      try {
        const form = new FormData(); form.append('file', d.file);
        const res = await fetch(`/api/import/preview/${d.selected}`, {
          method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'خطأ في التحليل');
        d.preview = data;
      } catch(e) { d.error = e.message; } finally { d.previewLoading = false; }
    },
    async confirmImport() {
      const d = this.dataImport;
      if (!d.selected || !d.file) return;
      d.importing = true; d.error = '';
      try {
        const form = new FormData(); form.append('file', d.file);
        const res = await fetch(`/api/import/confirm/${d.selected}`, {
          method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'خطأ في الاستيراد');
        d.result = data; d.preview = null; d.file = null; d.fileName = '';
        this.toast(`تم الاستيراد: ${data.created} جديد، ${data.updated} محدَّث ✅`, 'success');
      } catch(e) { d.error = e.message; } finally { d.importing = false; }
    },
  };
})();
