/**
 * modules/quick-actions.js — Quick Actions حسب الدور + تتبع الاستخدام
 * يُدمج في app() عبر ...window.QmsQuickActions
 */
(function () {
  'use strict';

  window.QmsQuickActions = {
    // ─── تخصيص "الأكثر استخداماً" ─────────────────────────────
    // نُخزّن آخر 20 نقرة على أزرار Quick Actions في localStorage ونستعملها
    // لترفيع ما يستخدمه المستخدم فعلاً إلى الأعلى. قرار صغير وبلا backend.
    _qaUsageKey() { return 'qms_qa_usage_' + (this.user?.id || 'anon'); },
    _qaUsageGet() {
      try {
        const raw = localStorage.getItem(this._qaUsageKey());
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    },
    _qaUsageSet(obj) {
      try { localStorage.setItem(this._qaUsageKey(), JSON.stringify(obj)); } catch {}
    },
    trackQuickAction(id) {
      const m = this._qaUsageGet();
      m[id] = (m[id] || 0) + 1;
      // نبقي 12 مفتاحاً فقط (تنظيف)
      const keys = Object.keys(m);
      if (keys.length > 12) {
        keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - 12).forEach(k => delete m[k]);
      }
      this._qaUsageSet(m);
    },
    mostUsedQaId() {
      const m = this._qaUsageGet();
      const keys = Object.keys(m);
      if (!keys.length) return null;
      return keys.reduce((a, b) => (m[a] >= m[b] ? a : b));
    },

    // ─── Quick Actions حسب الدور (Phase 1 refinement) ─────────────────
    // كل action: { id, icon, label, sublabel, color, onClick }. onClick دالة
    // تُستدعى بسياق this عند النقر.
    quickActions() {
      const role = this.user?.role;
      const all = {
        myKpi: {
          id: 'myKpi', icon: '📊', label: 'أدخل قراءة KPI',
          sublabel: 'مؤشراتك الشهرية', color: 'violet',
          show: () => this.can('kpi', 'create') || this.can('objectives', 'read'),
          onClick: () => this.goToResource('myKpi'),
        },
        complaint: {
          id: 'complaint', icon: '📣', label: 'سجّل شكوى',
          sublabel: 'معالج خطوة بخطوة', color: 'rose',
          show: () => this.can('complaints', 'create'),
          onClick: () => this.openWizard('complaint'),
        },
        ncr: {
          id: 'ncr', icon: '⚠️',
          label: this.isGuided() ? 'أبلِغ عن بلاغ جودة' : 'بلّغ عدم مطابقة',
          sublabel: this.isGuided() ? 'شيء غير مطابق للمعيار' : 'NCR موجَّه',
          color: 'orange',
          show: () => this.can('ncr', 'create'),
          onClick: () => this.openWizard('ncr'),
        },
        risk: {
          id: 'risk', icon: '🛡️', label: 'سجّل مخاطرة',
          sublabel: 'معالج المخاطر', color: 'amber',
          show: () => this.can('risks', 'create'),
          onClick: () => this.openWizard('risk'),
        },
        managementReview: {
          id: 'managementReview', icon: '🗓️',
          label: this.isGuided() ? 'اجتماع متابعة الإدارة' : 'مراجعة إدارية',
          sublabel: 'جدولة اجتماع', color: 'indigo',
          show: () => this.can('management-review', 'create'),
          onClick: () => this.openWizard('managementReview'),
        },
        ncrReview: {
          id: 'ncrReview', icon: '🔍',
          label: this.isGuided() ? 'بلاغات جودة بانتظار قرارك' : 'مراجعة NCR المعلّقة',
          sublabel: 'بانتظار قرارك', color: 'orange',
          show: () => ['QUALITY_MANAGER', 'SUPER_ADMIN', 'COMMITTEE_MEMBER'].includes(role),
          onClick: () => this.goToResource('ncr'),
        },
        slaBoard: {
          id: 'slaBoard', icon: '⏱️',
          label: this.isGuided() ? 'لوحة المهل المتأخّرة' : 'لوحة SLA',
          sublabel: 'شكاوى متأخّرة', color: 'rose',
          show: () => ['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER'].includes(role),
          onClick: () => this.goToResource('slaBoard'),
        },
      };
      // ترتيب حسب الدور — الأعلى قيمة يومية أولاً
      const order = {
        EMPLOYEE:         ['myKpi', 'complaint', 'ncr'],
        DEPT_MANAGER:     ['myKpi', 'ncrReview', 'slaBoard', 'complaint'],
        QUALITY_MANAGER:  ['ncrReview', 'slaBoard', 'managementReview', 'risk'],
        COMMITTEE_MEMBER: ['ncrReview', 'managementReview', 'risk', 'complaint'],
        SUPER_ADMIN:      ['managementReview', 'ncrReview', 'slaBoard', 'risk', 'complaint'],
      };
      const ids = order[role] || order.EMPLOYEE;
      const list = ids.map(id => all[id]).filter(a => a && a.show());
      // ترفيع "الأكثر استخداماً" — إذا كان ضمن القائمة الحالية، ضعه أولاً.
      const topId = this.mostUsedQaId?.();
      if (topId) {
        const idx = list.findIndex(a => a.id === topId);
        if (idx > 0) {
          const item = list.splice(idx, 1)[0];
          // نعلّمه كي يظهر شارة "الأكثر استخداماً"
          item.mostUsed = true;
          list.unshift(item);
        } else if (idx === 0) {
          list[0].mostUsed = true;
        }
      }
      return list;
    },
  };
})();
