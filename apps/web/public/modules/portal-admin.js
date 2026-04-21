/**
 * modules/portal-admin.js — إدارة البوابة العامة
 * يُدمج في app() عبر ...window.QmsPortalAdmin
 */
(function () {
  'use strict';
  window.QmsPortalAdmin = {
    // ─── State ───────────────────────────────────────────────────────────
    portalAdmin: {
      tab: 'announcements',   // 'announcements' | 'settings' | 'documents' | 'surveys'
      settings: {},
      announcements: [],
      documents: [],
      surveys: [],
      loading: false,
      saving: false,
      form: { open: false, mode: 'create', id: null, title: '', summary: '', body: '', category: '', isActive: true, publishedAt: '', expiresAt: '' },
      error: '',
    },

    // ─── Methods ─────────────────────────────────────────────────────────
    async loadPortalAdmin() {
      const p = this.portalAdmin;
      p.loading = true; p.error = '';
      try {
        const [s, a, d, sv] = await Promise.all([
          this.api('GET', '/portal/settings'),
          this.api('GET', '/portal/announcements'),
          this.api('GET', '/portal/documents'),
          this.api('GET', '/portal/surveys'),
        ]);
        p.settings      = s.item  || {};
        p.announcements = a.items || [];
        p.documents     = d.items || [];
        p.surveys       = sv.items || [];
      } catch (e) { p.error = e.message; }
      finally { p.loading = false; }
    },

    async savePortalSettings() {
      const p = this.portalAdmin;
      p.saving = true; p.error = '';
      try {
        const r = await this.api('PATCH', '/portal/settings', p.settings);
        p.settings = r.item;
        this.toast?.('تم حفظ الإعدادات ✓');
      } catch (e) { p.error = e.message; }
      finally { p.saving = false; }
    },

    portalAnnouncementNew() {
      const f = this.portalAdmin.form;
      Object.assign(f, { open: true, mode: 'create', id: null, title: '', summary: '', body: '', category: '', isActive: true, publishedAt: '', expiresAt: '' });
    },

    portalAnnouncementEdit(a) {
      const f = this.portalAdmin.form;
      const toLocal = (d) => d ? new Date(d).toISOString().slice(0, 16) : '';
      Object.assign(f, { open: true, mode: 'edit', id: a.id, title: a.title, summary: a.summary || '', body: a.body, category: a.category || '', isActive: a.isActive, publishedAt: toLocal(a.publishedAt), expiresAt: toLocal(a.expiresAt) });
    },

    async portalAnnouncementSave() {
      const p = this.portalAdmin; const f = p.form;
      p.saving = true; p.error = '';
      try {
        const payload = { title: f.title, summary: f.summary, body: f.body, category: f.category, isActive: f.isActive, publishedAt: f.publishedAt || null, expiresAt: f.expiresAt || null };
        if (f.mode === 'create') {
          const r = await this.api('POST', '/portal/announcements', payload);
          p.announcements.unshift(r.item);
        } else {
          const r = await this.api('PATCH', `/portal/announcements/${f.id}`, payload);
          const idx = p.announcements.findIndex(a => a.id === f.id);
          if (idx !== -1) p.announcements[idx] = r.item;
        }
        f.open = false;
        this.toast?.('تم الحفظ ✓');
      } catch (e) { p.error = e.message; }
      finally { p.saving = false; }
    },

    async portalAnnouncementDelete(id) {
      if (!confirm('حذف هذا الإعلان؟')) return;
      const p = this.portalAdmin;
      try {
        await this.api('DELETE', `/portal/announcements/${id}`);
        p.announcements = p.announcements.filter(a => a.id !== id);
        this.toast?.('تم الحذف');
      } catch (e) { p.error = e.message; }
    },

    async portalToggleDocVisibility(doc) {
      const p = this.portalAdmin;
      try {
        const r = await this.api('PATCH', `/portal/documents/${doc.id}/visibility`, { isPublic: !doc.isPublic });
        const idx = p.documents.findIndex(d => d.id === doc.id);
        if (idx !== -1) p.documents[idx].isPublic = r.item.isPublic;
      } catch (e) { p.error = e.message; }
    },

    async portalToggleSurveyVisibility(survey) {
      const p = this.portalAdmin;
      try {
        const r = await this.api('PATCH', `/portal/surveys/${survey.id}/visibility`, { isPublic: !survey.isPublic });
        const idx = p.surveys.findIndex(s => s.id === survey.id);
        if (idx !== -1) p.surveys[idx].isPublic = r.item.isPublic;
      } catch (e) { p.error = e.message; }
    },
  };
})();
