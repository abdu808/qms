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

    // ─── Methods ─────────────────────────────────────────────────────────

    // ─── Document workflow ─────────────────────────────────────────────
    async approveDoc(item, publish) {
      const action = publish ? 'نشر' : 'اعتماد';
      if (!confirm(`تأكيد ${action} الوثيقة "${item.title}"؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/approve`, { publish: !!publish });
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
