/**
 * modules/kpi-tracking.js — نظام متابعة الأداء (KPI Tracking)
 * يُدمج في app() عبر ...window.QmsKpiTracking
 */
(function () {
  'use strict';

  window.QmsKpiTracking = {
    // ─── State ─────────────────────────────────────────────────
    kpi: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      view: 'dashboard', // dashboard | matrix | entry | detail | alerts
      dashboard: null,
      matrix: null,
      alerts: [],
      detail: null,
      entryForm: { kind: 'objective', id: '', actualValue: '', spent: '', note: '', evidenceUrl: '', deviationReason: '', actionNote: '' },
      objectivesList: [],
      activitiesList: [],
      indicatorsList: [],
      loading: false,
      // Smart filter chips للمصفوفة
      quick: [],           // مثل ['mine', 'red']
      perspective: '',     // محور BSC فعّال
      // ─── السنوات المتاحة (تُحسب من الخطة الفعّالة) ───
      // كانت مهارد-كود [2025,2026,2027] — الآن تُحسب ديناميكياً من active plan
      availableYears: [],
    },

    // يُحسب نطاق السنوات من الخطة الاستراتيجية الفعّالة
    async kpiLoadAvailableYears() {
      try {
        const r = await this.api('GET', '/strategic-plans?limit=10');
        const plans = (r?.items || []).filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
        if (!plans.length) {
          // fallback: السنة الحالية ± 1
          const cy = new Date().getFullYear();
          this.kpi.availableYears = [cy - 1, cy, cy + 1];
          return;
        }
        // اجمع كل السنوات من كل الخطط الفعّالة
        const yearSet = new Set();
        for (const p of plans) {
          const s = Number(p.startYear) || 0;
          const e = Number(p.endYear)   || 0;
          if (s && e && s <= e) {
            for (let y = s; y <= e; y++) yearSet.add(y);
          }
        }
        const years = [...yearSet].sort();
        this.kpi.availableYears = years;
        // اضبط السنة الافتراضية لو خارج النطاق
        if (years.length && !years.includes(this.kpi.year)) {
          const cy = new Date().getFullYear();
          this.kpi.year = years.includes(cy) ? cy : years[0];
        }
      } catch (e) {
        const cy = new Date().getFullYear();
        this.kpi.availableYears = [cy - 1, cy, cy + 1];
      }
    },

    // ─── Methods ───────────────────────────────────────────────
    async kpiLoadDashboard() {
      this.kpi.loading = true;
      try {
        const r = await this.api('GET', `/kpi/dashboard?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.dashboard = r;
      } catch (e) { this.toast('فشل تحميل لوحة المتابعة', 'error'); }
      finally { this.kpi.loading = false; }
    },

    async kpiLoadMatrix() {
      this.kpi.loading = true;
      try {
        const params = new URLSearchParams({ year: this.kpi.year, month: this.kpi.month });
        if (this.kpi.quick?.length) params.set('quick', this.kpi.quick.join(','));
        if (this.kpi.perspective)    params.set('perspective', this.kpi.perspective);
        const r = await this.api('GET', `/kpi/matrix?${params.toString()}`);
        this.kpi.matrix = r;
      } catch (e) { this.toast('فشل تحميل المصفوفة', 'error'); }
      finally { this.kpi.loading = false; }
    },

    // تفعيل/إلغاء مرشّح ذكي (toggle chip)
    kpiToggleQuick(key) {
      const i = this.kpi.quick.indexOf(key);
      if (i >= 0) this.kpi.quick.splice(i, 1);
      else this.kpi.quick.push(key);
      this.kpiLoadMatrix();
    },
    kpiSetPerspective(p) {
      this.kpi.perspective = (this.kpi.perspective === p) ? '' : p;
      this.kpiLoadMatrix();
    },
    kpiClearFilters() {
      this.kpi.quick = [];
      this.kpi.perspective = '';
      this.kpiLoadMatrix();
    },

    // قاموس labels للـ chips
    kpiQuickLabels() {
      return {
        mine:           { label: 'ملكيّتي',      icon: '👤' },
        myDept:         { label: 'إدارتي',        icon: '🏢' },
        red:            { label: 'أحمر',          icon: '🔴' },
        yellow:         { label: 'أصفر',          icon: '🟡' },
        green:          { label: 'أخضر',          icon: '🟢' },
        gray:           { label: 'بلا بيانات',    icon: '⚪' },
        behind:         { label: 'تحت المستهدف',  icon: '📉' },
        ahead:          { label: 'متجاوز',        icon: '🚀' },
        missing:        { label: 'لم يُقرأ',      icon: '❓' },
        entered:        { label: 'مُقرَأ',         icon: '✅' },
        criticalAlerts: { label: 'تنبيه حرج',    icon: '🚨' },
      };
    },

    async kpiLoadAlerts() {
      this.kpi.loading = true;
      try {
        const r = await this.api('GET', `/kpi/alerts?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.alerts = r.alerts || [];
      } catch (e) { this.toast('فشل تحميل التنبيهات', 'error'); }
      finally { this.kpi.loading = false; }
    },

    async kpiLoadEntryOptions() {
      try {
        const [objs, acts, inds] = await Promise.all([
          this.api('GET', '/objectives?limit=500'),
          this.api('GET', '/operational-activities?limit=500'),
          this.api('GET', '/indicators?limit=500'),
        ]);
        this.kpi.objectivesList = (objs.items || [])
          .map(o => ({ id: o.id, title: o.title, kpiType: o.kpiType, targetValue: o.target, unit: o.unit }));
        this.kpi.activitiesList = (acts.items || [])
          .filter(a => !a.year || a.year === this.kpi.year)
          .map(a => ({ id: a.id, code: a.code, title: a.title, kpiType: a.kpiType, targetValue: a.targetValue, unit: a.targetUnit }));
        this.kpi.indicatorsList = (inds.items || [])
          .map(i => ({ id: i.id, code: i.code, nameAr: i.nameAr, unit: i.unit, kpiType: i.kpiType }));
      } catch (e) { console.error('kpiLoadEntryOptions error:', e); }
    },

    async kpiSaveEntry() {
      const f = this.kpi.entryForm;
      if (!f.id || f.actualValue === '') { this.toast('اختر المؤشر وأدخل القيمة', 'error'); return; }
      const fkField = f.kind === 'objective' ? 'objectiveId'
                    : f.kind === 'indicator' ? 'indicatorId'
                    : 'activityId';
      const body = {
        [fkField]: f.id,
        year: this.kpi.year, month: this.kpi.month,
        actualValue: Number(f.actualValue),
        spent: f.spent !== '' ? Number(f.spent) : null,
        note: f.note || null, evidenceUrl: f.evidenceUrl || null,
        deviationReason: f.deviationReason?.trim() || null,
        actionNote:      f.actionNote?.trim()      || null,
      };
      try {
        await this.api('POST', '/kpi/entries', body);
        this.toast('تم حفظ القيمة الفعلية', 'success');
        this.kpi.entryForm = { ...this.kpi.entryForm, actualValue: '', spent: '', note: '', evidenceUrl: '', deviationReason: '', actionNote: '' };
      } catch (e) { this.toast('فشل الحفظ: ' + (e.message || 'خطأ'), 'error'); }
    },

    // Inline quick-entry من خلية المصفوفة — يفتح نموذج الإدخال مع تعبئة مسبقة
    async kpiQuickEntryFromCell(row, month) {
      if (!row || !month) return;
      // التأكد من تحميل قوائم الاختيار
      if (!this.kpi.objectivesList?.length || !this.kpi.activitiesList?.length) {
        try { await this.kpiLoadEntryOptions?.(); } catch { /* ignore */ }
      }
      this.kpi.month = month;
      this.kpi.entryForm = {
        kind: row.kind,
        id:   row.id,
        actualValue:     '',
        spent:           '',
        note:            '',
        evidenceUrl:     '',
        deviationReason: '',
        actionNote:      '',
      };
      this.kpi.view = 'entry';
    },

    async kpiLoadDetail(kind, id) {
      this.kpi.loading = true; this.kpi.view = 'detail';
      try {
        const r = await this.api('GET', `/kpi/${kind}/${id}?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.detail = r;
        setTimeout(() => this.kpiRenderChart(), 100);
      } catch (e) { this.toast('فشل تحميل التفاصيل', 'error'); }
      finally { this.kpi.loading = false; }
    },

    kpiRenderChart() {
      const el = document.getElementById('kpiDetailChart');
      if (!el || !this.kpi.detail) return;
      if (this._kpiChart) { this._kpiChart.destroy(); }
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const series = this.kpi.detail.series;
      this._kpiChart = new Chart(el.getContext('2d'), {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'المستهدف/المتوقع', data: series.map(s=>s.expected), borderColor: '#6366f1', borderDash: [6,4], fill: false, tension: 0.2 },
            { label: 'الفعلي التراكمي',   data: series.map(s=>s.cumulativeActual), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.2 },
            { label: 'القيمة الشهرية',     data: series.map(s=>s.actual), borderColor: '#f59e0b', borderDash: [2,2], fill: false, tension: 0.2, pointRadius: 4 },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    },

    // هل قراءة الشهر الحالي مفقودة؟ (GRAY في الشهر ≤ الحالي من السنة الحالية)
    kpiIsLate(row) {
      if (!row || !Array.isArray(row.months)) return false;
      const now = new Date();
      const curYear  = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const selYear  = Number(this.kpi?.year) || curYear;
      if (selYear !== curYear) return false;
      // متأخر إذا الشهر السابق الحالي لا يحوي قيمة
      const m = curMonth - 1;
      if (m < 1) return false;
      const cell = row.months.find(c => c.month === m);
      return !!cell && cell.actualValue == null;
    },
    async kpiInit() {
      // أولاً: احسب السنوات المتاحة من الخطة الاستراتيجية
      await this.kpiLoadAvailableYears();
      await Promise.all([this.kpiLoadDashboard(), this.kpiLoadEntryOptions()]);
    },
  };
})();
