/**
 * modules/document-versions.js — إصدارات الوثائق ورفع الملفات (ISO 7.5.3)
 * يُدمج في app() عبر ...window.QmsDocumentVersions
 */
(function () {
  'use strict';
  window.QmsDocumentVersions = {
    // ─── State ───────────────────────────────────────────────────────────
    docVersions: {
      open: false, document: null, versions: [],
      uploadVersion: '', uploadChangeLog: '', file: null,
      uploading: false, uploadMsg: '', uploadError: false,
    },

    // ─── Methods ─────────────────────────────────────────────────────────
    async viewDocVersions(item) {
      try {
        const res = await this.api('GET', `/documents/${item.id}/versions`);
        this.docVersions = {
          open: true, document: res.document, versions: res.versions,
          uploadVersion: res.document?.currentVersion || '1.0',
          uploadChangeLog: '', file: null,
          uploading: false, uploadMsg: '', uploadError: false,
        };
      } catch (e) { alert(e.message || 'فشل تحميل الإصدارات'); }
    },
    async doUploadDoc() {
      if (!this.docVersions.file || !this.docVersions.document) return;
      this.docVersions.uploading = true;
      this.docVersions.uploadMsg = '';
      this.docVersions.uploadError = false;
      try {
        const form = new FormData();
        form.append('file', this.docVersions.file);
        form.append('version', this.docVersions.uploadVersion || '1.0');
        if (this.docVersions.uploadChangeLog)
          form.append('changeLog', this.docVersions.uploadChangeLog);

        const token = localStorage.getItem('qms_token');
        const resp = await fetch(`/api/documents/${this.docVersions.document.id}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'فشل الرفع');

        // Refresh versions list
        const res = await this.api('GET', `/documents/${this.docVersions.document.id}/versions`);
        this.docVersions.versions  = res.versions;
        this.docVersions.document  = res.document;
        this.docVersions.file      = null;
        this.docVersions.uploadChangeLog = '';
        this.docVersions.uploadMsg = '✅ تم رفع الملف بنجاح';
        this.docVersions.uploadError = false;
        // Also refresh the main list so currentVersion is updated
        await this.loadData();
      } catch (e) {
        this.docVersions.uploadMsg = e.message || 'حدث خطأ أثناء الرفع';
        this.docVersions.uploadError = true;
      } finally {
        this.docVersions.uploading = false;
      }
    },

    // ─── تنزيل ملف وثيقة مع التوكن ──────────────────────────────────
    async downloadDocVersion(docId, ver) {
      try {
        const token = localStorage.getItem('qms_token');
        const resp = await fetch(`/api/documents/${docId}/download/${ver.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) { alert('فشل التنزيل — ' + resp.status); return; }

        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        const ext  = ver.mimeType?.includes('pdf') ? '.pdf'
                   : ver.mimeType?.includes('word') ? '.docx'
                   : ver.mimeType?.includes('sheet') ? '.xlsx' : '';
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${docId}_v${ver.version}${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) { alert('خطأ أثناء التنزيل: ' + e.message); }
    },
  };
})();
