/**
 * modules/my-kpi.js — قراءات KPI المطلوبة من المستخدم (Batch 13)
 * يُدمج في app() عبر ...window.QmsMyKpi
 */
(function () {
  'use strict';

  window.QmsMyKpi = {
    // ─── State ─────────────────────────────────────────────────
    myKpi: null,   // { year, month, user, periodLock, summary, pending[], entered[] }
    myKpiForm: null, // { item, actualValue, spent, note, evidenceUrl, busy }

    // ─── Methods ───────────────────────────────────────────────
    async loadMyKpi() {
      try {
        const r = await this.api('GET', '/kpi/my-due');
        this.myKpi = r;
      } catch (e) {
        this.myKpi = null;
        alert(e.message || 'فشل تحميل المؤشرات المطلوبة');
      }
    },

    openMyKpiForm(item) {
      this.myKpiForm = {
        item,
        step: 1,                       // 1=إدخال, 2=مراجعة, 3=تم الحفظ
        actualValue:     item.thisMonth?.actualValue ?? '',
        spent:           item.thisMonth?.spent ?? '',
        note:            item.thisMonth?.note ?? '',
        evidenceUrl:     item.thisMonth?.evidenceUrl ?? '',
        deviationReason: item.thisMonth?.deviationReason ?? '',
        actionNote:      item.thisMonth?.actionNote ?? '',
        busy: false,
        preview: null,                 // نتيجة /kpi/entries/preview
        result: null,                  // نتيجة /kpi/entries (بعد الحفظ)
      };
    },
    closeMyKpiForm() { this.myKpiForm = null; },

    _myKpiPayload() {
      const f = this.myKpiForm;
      const payload = {
        year: this.myKpi.year,
        month: this.myKpi.month,
        actualValue: Number(f.actualValue),
        spent: f.spent === '' ? null : Number(f.spent),
        note: f.note || null,
        evidenceUrl: f.evidenceUrl || null,
        deviationReason: f.deviationReason?.trim() || null,
        actionNote:      f.actionNote?.trim()      || null,
      };
      if (f.item.kind === 'objective')      payload.objectiveId = f.item.id;
      else if (f.item.kind === 'indicator') payload.indicatorId = f.item.id;
      else                                   payload.activityId  = f.item.id;
      return payload;
    },

    // Wizard step 1 → 2: معاينة قبل الحفظ
    async previewMyKpi() {
      if (!this.myKpiForm) return;
      const f = this.myKpiForm;
      if (f.actualValue === '' || f.actualValue == null) {
        alert('القيمة الفعلية مطلوبة');
        return;
      }
      f.busy = true;
      try {
        f.preview = await this.api('POST', '/kpi/entries/preview', this._myKpiPayload());
        f.step = 2;
      } catch (e) {
        alert(e.message || 'فشل حساب المعاينة');
      } finally {
        f.busy = false;
      }
    },

    // Wizard step 2 → 1: رجوع لتعديل القيمة
    backToMyKpiEdit() {
      if (!this.myKpiForm) return;
      this.myKpiForm.step = 1;
      this.myKpiForm.preview = null;
    },

    // Wizard step 2 → 3: تأكيد الحفظ
    async submitMyKpi() {
      if (!this.myKpiForm) return;
      const f = this.myKpiForm;
      if (f.actualValue === '' || f.actualValue == null) {
        alert('القيمة الفعلية مطلوبة');
        return;
      }
      // إذا لم يمر المستخدم بالمعاينة (مثلاً ضغط Enter)، اعرضها أولاً.
      if (f.step === 1) return this.previewMyKpi();

      f.busy = true;
      try {
        const r = await this.api('POST', '/kpi/entries', this._myKpiPayload());
        f.result = r.feedback;
        f.step = 3;
        this.toast?.('✅ تم حفظ القراءة', 'success');
        await this.loadMyKpi();  // refresh counts
      } catch (e) {
        alert(e.message || 'فشل حفظ القراءة');
      } finally {
        f.busy = false;
      }
    },

    ragColor(rag) {
      return { GREEN: 'bg-green-500', YELLOW: 'bg-amber-500', RED: 'bg-red-500', GRAY: 'bg-gray-400' }[rag] || 'bg-gray-400';
    },
    ragBgSoft(rag) {
      return { GREEN: 'bg-green-50 border-green-200', YELLOW: 'bg-amber-50 border-amber-200',
               RED: 'bg-red-50 border-red-200', GRAY: 'bg-gray-50 border-gray-200' }[rag] || 'bg-gray-50 border-gray-200';
    },

    myKpiKindLabel(kind) {
      if (kind === 'indicator') return 'مؤشر أداء';
      if (kind === 'activity') return 'نشاط تشغيلي';
      return 'هدف/مؤشر تشغيلي';
    },

    myKpiPeriodLabel() {
      if (!this.myKpi) return '';
      return `${this.myKpi.year} / ${String(this.myKpi.month).padStart(2, '0')}`;
    },

    myKpiEntryStatus(item) {
      return item?.entered ? 'تم الإدخال' : 'بانتظار إدخالك';
    },
  };
})();
