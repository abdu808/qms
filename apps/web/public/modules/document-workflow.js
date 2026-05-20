/**
 * modules/document-workflow.js — سير عمل الوثائق والموافقات العامة
 * يُدمج في app() عبر ...window.QmsDocumentWorkflow
 */
(function () {
  'use strict';
  window.QmsDocumentWorkflow = {
    // ─── State ───────────────────────────────────────────────────────────
    // Resources that have workflow endpoints attached (see apps/api/src/lib/workflow.js).
    workflowResources: ['risks', 'ncr', 'supplier-evals'],
    documentOpsSummary: null,
    documentOpsSummaryLoading: false,

    // ─── Methods ─────────────────────────────────────────────────────────

    // ─── Document workflow ─────────────────────────────────────────────
    async loadDocumentOpsSummary() {
      if (!this.can?.('documents', 'read')) return;
      this.documentOpsSummaryLoading = true;
      try {
        this.documentOpsSummary = await this.api('GET', '/documents/dashboard-summary');
      } catch (e) {
        console.warn('[documents] dashboard summary failed:', e);
        this.documentOpsSummary = null;
      } finally {
        this.documentOpsSummaryLoading = false;
      }
    },
    documentHealthTone(value) {
      const n = Number(value || 0);
      if (n === 0) return 'bg-emerald-50 border-emerald-100 text-emerald-700';
      if (n <= 3) return 'bg-amber-50 border-amber-100 text-amber-700';
      return 'bg-rose-50 border-rose-100 text-rose-700';
    },
    documentAttentionClass(severity) {
      return ({
        danger: 'bg-rose-50 text-rose-700 border-rose-100',
        warning: 'bg-amber-50 text-amber-700 border-amber-100',
        info: 'bg-blue-50 text-blue-700 border-blue-100',
      })[severity] || 'bg-slate-50 text-slate-600 border-slate-100';
    },
    async approveDoc(item, publish) {
      const action = publish ? 'نشر' : 'اعتماد';
      if (!confirm(`تأكيد ${action} الوثيقة "${item.title}"؟`)) return;
      const payload = { publish: !!publish };
      if (item.governing) {
        const ref = prompt('رقم القرار/المرجع:', item.approvalReference || '');
        if (ref === null) return;
        const authority = prompt('جهة الاعتماد:', item.approvalAuthority || '');
        if (authority === null) return;
        payload.approvalReference = ref.trim();
        payload.approvalAuthority = authority.trim();
        payload.publicationUrl = item.publicationUrl || null;
      }
      try {
        await this.api('POST', `/documents/${item.id}/approve`, payload);
        alert(`✅ تم ${action} الوثيقة بنجاح`);
        await this.loadList();
      } catch (e) { alert(e.message || `فشل ${action} الوثيقة`); }
    },
    async obsoleteDoc(item) {
      if (!confirm(`سحب الوثيقة "${item.title}" (سحبها يلغي إقرارات المستخدمين)؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/obsolete`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل السحب'); }
    },

    // ─── Generic Maker/Checker/Approver workflow (risks, ncr, supplier-evals) ──
    hasWorkflow(resource) { return this.workflowResources.includes(resource); },

    workflowStateLabel(state) {
      return ({
        DRAFT:        'مسودة',
        SUBMITTED:    'مُرسَلة',
        UNDER_REVIEW: 'قيد المراجعة',
        APPROVED:     'معتمدة',
        REJECTED:     'مرفوضة',
      })[state] || state || '—';
    },
    workflowStateClass(state) {
      return ({
        DRAFT:        'bg-gray-100 text-gray-700',
        SUBMITTED:    'bg-blue-100 text-blue-700',
        UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
        APPROVED:     'bg-green-100 text-green-700',
        REJECTED:     'bg-red-100 text-red-700',
      })[state] || 'bg-gray-100 text-gray-700';
    },

    // Can the current user fire `event` on this record given its state + role?
    canWorkflow(item, event, resource) {
      if (!this.hasWorkflow(resource)) return false;
      const s = item?.workflowState || 'DRAFT';
      const role = this.user?.role;
      const isSubmitter = item?.submittedById && item.submittedById === this.user?.id;
      switch (event) {
        case 'submit':
          return s === 'DRAFT' && this.can(resource, 'create');
        case 'review':
          return s === 'SUBMITTED' && this.can(resource, 'update') && (!isSubmitter || role === 'SUPER_ADMIN');
        case 'approve':
          return s === 'UNDER_REVIEW' && this.can(resource, 'approve') && (!isSubmitter || role === 'SUPER_ADMIN');
        case 'reject':
          return ['SUBMITTED','UNDER_REVIEW'].includes(s) && this.can(resource, 'update');
        case 'reopen':
          return s === 'REJECTED' && this.can(resource, 'update');
        default: return false;
      }
    },

    async doWorkflow(item, event, resource) {
      const labels = { submit:'إرسال', review:'استلام للمراجعة', approve:'اعتماد', reject:'رفض', reopen:'إعادة فتح' };
      let body = undefined;
      if (event === 'reject') {
        const reason = prompt('أدخل سبب الرفض:');
        if (!reason || !reason.trim()) return;
        body = { reason: reason.trim() };
      } else if (!confirm(`تأكيد ${labels[event]} السجل "${item.code || item.title || item.id}"؟`)) {
        return;
      }
      try {
        await this.api('POST', `/${resource}/${item.id}/${event}`, body);
        this.toast?.(`✅ تم ${labels[event]} السجل`);
        await this.loadList();
      } catch (e) { alert(e.message || `فشل ${labels[event]}`); }
    },
  };
})();
