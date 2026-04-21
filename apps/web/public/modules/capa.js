(function () {
  'use strict';
  window.QmsCapa = {
    capaAdvDlg: { open: false, item: null, busy: false, implementedAction: '', verificationNote: '', effective: null, lessonsLearned: '' },

    capaAdvLabel(s) { return { OPEN: '▶ بدء التنفيذ', IN_PROGRESS: '✅ إرسال للتحقق', VERIFICATION: '🔒 إغلاق' }[s] || ''; },
    capaStatusLabel(s) { return { OPEN: 'مفتوح', IN_PROGRESS: 'قيد التنفيذ', VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق' }[s] || s; },
    capaStatusClass(s) {
      const m = { OPEN: 'bg-red-100 text-red-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-700', VERIFICATION: 'bg-blue-100 text-blue-700', CLOSED: 'bg-green-100 text-green-700' };
      return m[s] || 'bg-gray-100 text-gray-600';
    },
    capaTypeLabel(t) { return t === 'CORRECTIVE' ? 'تصحيحي' : t === 'PREVENTIVE' ? 'وقائي' : t; },

    openCapaAdvance(item) {
      this.capaAdvDlg = { open: true, item, busy: false, implementedAction: '', verificationNote: '', effective: null, lessonsLearned: '' };
    },

    async doCapaAdvance() {
      const d = this.capaAdvDlg;
      d.busy = true;
      try {
        const body = {};
        if (d.implementedAction) body.implementedAction = d.implementedAction;
        if (d.verificationNote)  body.verificationNote  = d.verificationNote;
        if (d.effective !== null) body.effective = d.effective;
        if (d.lessonsLearned)    body.lessonsLearned    = d.lessonsLearned;
        await this.api('POST', `/capa/${d.item.id}/advance`, body);
        this.toast?.('تم تقديم الحالة ✓');
        d.open = false;
        if (typeof this.loadList === 'function') await this.loadList();
      } catch (e) { this.toast?.(e.message || 'فشل', 'error'); }
      finally { d.busy = false; }
    },
  };
})();
