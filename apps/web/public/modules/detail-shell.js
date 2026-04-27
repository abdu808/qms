/**
 * modules/detail-shell.js — درج تفاصيل السجل + Timeline + الخطوة التالية (UX-4)
 * يُدمج في app() عبر ...window.QmsDetailShell
 */
(function () {
  'use strict';

  window.QmsDetailShell = {
    // ─── State ─────────────────────────────────────────────────
    detailDrawer: null,    // { entityType, item, auditEvents, busy }
    supplierHistory: null, // { supplier, timeline, stats, busy }

    // ─── Detail Drawer ──────────────────────────────────────────
    async openDetail(entityType, id) {
      const endpointMap = {
        complaint: 'complaints', ncr: 'ncr', objective: 'objectives',
        document: 'documents', risk: 'risks', supplier: 'suppliers',
        // v2 strategic planning entities
        indicator: 'indicators', initiative: 'initiatives',
        capa: 'capa', 'follow-up-task': 'follow-up-tasks',
        'audit-finding': 'audit-findings',
      };
      const auditEntityMap = {
        complaint: 'Complaint', ncr: 'NCR', objective: 'Objective',
        document: 'Document', risk: 'Risk', supplier: 'Supplier',
        indicator: 'Indicator', initiative: 'Initiative', capa: 'Capa',
      };
      const endpoint = endpointMap[entityType];
      if (!endpoint) return;
      this.detailDrawer = { entityType, item: null, auditEvents: [], busy: true };
      try {
        const [r, auditR] = await Promise.all([
          this.api('GET', `/${endpoint}/${id}`),
          this.api('GET', `/audit-log/for/${auditEntityMap[entityType]}/${id}`).catch(() => ({ items: [] })),
        ]);
        this.detailDrawer = {
          entityType,
          item: r.item || r,
          auditEvents: auditR.items || [],
          busy: false,
        };
      } catch (e) {
        this.detailDrawer = null;
        alert('تعذّر تحميل التفاصيل: ' + (e.message || e));
      }
    },
    closeDetail() { this.detailDrawer = null; },

    // ── سجل تقييمات المورّد (ISO 8.4.2) ──────────────────────────────
    async openSupplierHistory(id) {
      this.supplierHistory = { busy: true };
      try {
        const r = await this.api('GET', `/suppliers/${id}/history`);
        this.supplierHistory = {
          supplier: r.supplier,
          timeline: r.timeline || [],
          stats:    r.stats    || {},
          busy: false,
        };
      } catch (e) {
        this.supplierHistory = null;
        alert('تعذّر تحميل سجل التقييمات: ' + (e.message || e));
      }
    },
    closeSupplierHistory() { this.supplierHistory = null; },
    trendLabel(t) {
      return { first: 'أول تقييم', improving: '📈 تحسّن', declining: '📉 تراجع', stable: '➖ مستقر' }[t] || t;
    },
    trendColor(t) {
      return { improving: 'text-emerald-700', declining: 'text-rose-700', stable: 'text-slate-600', first: 'text-blue-600' }[t] || '';
    },
    overallTrendLabel(t) {
      return {
        improving: '📈 اتجاه عام: تحسّن',
        declining: '📉 اتجاه عام: تراجع',
        stable:    '➖ اتجاه عام: مستقر',
        insufficient_data: 'بيانات غير كافية (تقييمان على الأقل)',
      }[t] || t;
    },

    // انتقل لصفحة السجل وافتحه في نموذج التعديل (يعمل حتى لو فُتح من myWork)
    async detailOpenFullEdit() {
      const d = this.detailDrawer;
      if (!d?.item) return;
      const pageMap = {
        complaint: 'complaints', ncr: 'ncr', objective: 'objectives',
        document: 'documents', risk: 'risks', supplier: 'suppliers',
        indicator: 'indicators', initiative: 'initiatives', capa: 'capa',
      };
      const targetPage = pageMap[d.entityType];
      const item = d.item;
      this.closeDetail();
      if (this.page !== targetPage) {
        this.page = targetPage;
        await this.$nextTick?.();
        if (typeof this.loadList === 'function') await this.loadList();
      }
      if (typeof this.openEdit === 'function') this.openEdit(item);
    },

    // Timeline من الحقول الزمنية + أحداث AuditLog
    detailTimeline() {
      const d = this.detailDrawer;
      if (!d?.item) return [];
      const it = d.item;
      const events = [];
      const add = (when, label, icon, who) => {
        if (when) events.push({ when, label, icon, who, kind: 'system' });
      };
      add(it.createdAt,   'تم الإنشاء',           '📝', it.createdBy?.name || it.reporter?.name);
      add(it.receivedAt,  'تاريخ الاستلام',        '📥');
      add(it.submittedAt, 'أُرسل للمراجعة',        '📤', it.submittedBy?.name);
      add(it.reviewedAt,  'تمت المراجعة',          '🔍', it.reviewedBy?.name);
      add(it.approvedAt,  'تم الاعتماد',           '✅', it.approvedBy?.name);
      add(it.verifiedAt,  'تم التحقق من الفعالية', '🧪');
      add(it.resolvedAt,  'تم الحل',               '🎯');
      add(it.closedAt,    'تم الإغلاق',            '🔒');
      add(it.assessedAt,  'تم التقييم',            '📋');
      add(it.publishedAt, 'تم النشر',              '📢');

      // إضافة أحداث AuditLog (نُخفي CREATE/UPDATE العاديّة لنُقلّل الضجيج)
      const actionLabels = {
        CREATE: { label: 'تم الإنشاء',      icon: '➕', hide: true },
        UPDATE: { label: 'تحديث البيانات',  icon: '✏️', hideIfWithinMinutes: 2 },
        DELETE: { label: 'تم الحذف',        icon: '🗑️' },
        RESTORE:{ label: 'تمت الاستعادة',   icon: '♻️' },
        SUBMIT: { label: 'أُرسل للمراجعة',   icon: '📤' },
        REVIEW: { label: 'استُلم للمراجعة',  icon: '🔍' },
        APPROVE:{ label: 'تم الاعتماد',     icon: '✅' },
        REJECT: { label: 'تم الرفض',        icon: '❌' },
        REOPEN: { label: 'إعادة فتح',       icon: '🔄' },
        SIGN:   { label: 'توقيع رقمي',      icon: '✍️' },
        VERIFY_NCR_EFFECTIVENESS: { label: 'تحقق من فعالية الإجراء', icon: '🧪' },
      };
      const createdTs = it.createdAt ? new Date(it.createdAt).getTime() : 0;
      for (const a of (d.auditEvents || [])) {
        const def = actionLabels[a.action];
        if (def?.hide) continue;
        if (def?.hideIfWithinMinutes) {
          const diff = Math.abs(new Date(a.at).getTime() - createdTs) / 60000;
          if (diff < def.hideIfWithinMinutes) continue;
        }
        events.push({
          when: a.at,
          label: def?.label || a.action,
          icon: def?.icon || '📌',
          who: a.user?.name,
          kind: 'audit',
        });
      }

      // Final "آخر تحديث" — only if nothing else covered it
      if (it.updatedAt && !events.some(e => Math.abs(new Date(e.when).getTime() - new Date(it.updatedAt).getTime()) < 60000)) {
        add(it.updatedAt, 'آخر تحديث', '🔄');
      }

      // Sort ascending, dedupe same timestamp+label
      const seen = new Set();
      return events
        .map(e => ({ ...e, ts: new Date(e.when).getTime() }))
        .sort((a, b) => a.ts - b.ts)
        .filter(e => {
          const key = Math.floor(e.ts / 60000) + '|' + e.label;
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
    },

    // الخطوة التالية الموصى بها حسب الحالة
    detailNextStep() {
      const d = this.detailDrawer;
      if (!d?.item) return null;
      const it = d.item;
      const t = d.entityType;
      const s = it.status;
      if (t === 'complaint') {
        if (s === 'NEW')          return { text: 'استلام الشكوى وإسنادها لمسؤول',     cta: 'تعديل وإسناد', icon: '📥' };
        if (s === 'UNDER_REVIEW') return { text: 'تسجيل إجراء المعالجة والبدء بالتنفيذ', cta: 'تعديل',       icon: '🔧' };
        if (s === 'IN_PROGRESS')  return { text: 'إغلاق الشكوى بعد الحل + توقيع',       cta: 'تعديل',       icon: '✅' };
        if (s === 'RESOLVED')     return { text: 'التحقق من رضا الشاكي ثم الإغلاق',     cta: 'تعديل',       icon: '🔒' };
        return null;
      }
      if (t === 'ncr') {
        if (s === 'OPEN')            return { text: 'تحليل السبب الجذري',          cta: 'تعديل', icon: '🔬' };
        if (s === 'ROOT_CAUSE')      return { text: 'وضع خطة إجراء تصحيحي',        cta: 'تعديل', icon: '📋' };
        if (s === 'ACTION_PLANNED')  return { text: 'بدء التنفيذ',                 cta: 'تعديل', icon: '🔧' };
        if (s === 'IN_PROGRESS')     return { text: 'الانتقال إلى مرحلة التحقق',    cta: 'تعديل', icon: '🧪' };
        if (s === 'VERIFICATION')    return { text: 'تأكيد الفعالية ثم الإغلاق (بتوقيع)', cta: 'تعديل', icon: '✅' };
        return null;
      }
      if (t === 'document') {
        if (s === 'DRAFT')        return { text: 'إرسال للاعتماد',                 cta: 'اعتماد', icon: '📤' };
        if (s === 'UNDER_REVIEW') return { text: 'مراجعة الوثيقة واعتمادها أو ردّها', cta: 'تعديل', icon: '🔍' };
        if (s === 'PUBLISHED')    return { text: 'المراجعة الدورية + مراقبة الإقرارات', cta: 'تعديل', icon: '🔄' };
        return null;
      }
      return null;
    },

    detailStatusLabel() {
      const it = this.detailDrawer?.item;
      if (!it) return '—';
      const map = {
        NEW: 'جديد', UNDER_REVIEW: 'قيد الدراسة', IN_PROGRESS: 'قيد المعالجة',
        RESOLVED: 'تم الحل', CLOSED: 'مغلق', REJECTED: 'مرفوض',
        OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل السبب', ACTION_PLANNED: 'خطة معدّة', VERIFICATION: 'تحقق',
        DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف',
      };
      return map[it.status] || it.status || '—';
    },
  };
})();
