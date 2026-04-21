/**
 * modules/report-builder.js — منشئ التقارير المخصص (dataset + filters + aggregations + export)
 * يُدمج في app() عبر ...window.QmsReportBuilder
 */
(function () {
  'use strict';

  window.QmsReportBuilder = {
    // ─── State ─────────────────────────────────────────────────
    rb: {
      datasets: [],           // catalog from /report-builder/datasets
      dataset:  '',           // selected dataset key
      columns:  [],           // selected column keys
      filters:  [],           // [{ field, op, value }]
      groupBy:  '',
      aggregations: [],       // [{ field, fn }]
      sort:     [],           // [{ field, dir }]
      limit:    1000,
      running:  false,
      result:   null,         // { mode, rows, columns?, groupBy?, total }
      error:    '',
    },
    rbOps: [
      { v: 'eq',       l: 'يساوي' },
      { v: 'ne',       l: 'لا يساوي' },
      { v: 'in',       l: 'ضمن قائمة' },
      { v: 'contains', l: 'يحتوي' },
      { v: 'gt',       l: 'أكبر من' },
      { v: 'gte',      l: 'أكبر أو يساوي' },
      { v: 'lt',       l: 'أصغر من' },
      { v: 'lte',      l: 'أصغر أو يساوي' },
      { v: 'between',  l: 'بين' },
      { v: 'isNull',   l: 'فارغ' },
      { v: 'isNotNull',l: 'غير فارغ' },
    ],
    rbAggFns: [
      { v: 'sum', l: 'المجموع' },
      { v: 'avg', l: 'المتوسط' },
      { v: 'min', l: 'الأدنى' },
      { v: 'max', l: 'الأعلى' },
    ],

    // ─── Catalog ────────────────────────────────────────────────
    async rbLoadCatalog() {
      try {
        const r = await this.api('GET', '/report-builder/datasets');
        this.rb.datasets = r.datasets || [];
      } catch (e) { this.toast('فشل تحميل كتالوج التقارير', 'error'); }
    },

    // ─── Computed helpers ───────────────────────────────────────
    get rbCurrentDataset() {
      return this.rb.datasets.find(d => d.key === this.rb.dataset) || null;
    },
    get rbFilterableFields()   { return (this.rbCurrentDataset?.fields || []).filter(f => f.filter); },
    get rbGroupableFields()    { return (this.rbCurrentDataset?.fields || []).filter(f => f.groupable); },
    get rbAggregatableFields() { return (this.rbCurrentDataset?.fields || []).filter(f => f.aggregatable); },

    // ─── Mutations ──────────────────────────────────────────────
    rbOnDatasetChange() {
      this.rb.columns = [];
      this.rb.filters = [];
      this.rb.groupBy = '';
      this.rb.aggregations = [];
      this.rb.sort = [];
      this.rb.result = null;
      this.rb.error = '';
    },
    rbToggleColumn(key) {
      const i = this.rb.columns.indexOf(key);
      if (i >= 0) this.rb.columns.splice(i, 1);
      else this.rb.columns.push(key);
    },
    rbAddFilter() { this.rb.filters.push({ field: '', op: 'eq', value: '' }); },
    rbRemoveFilter(i) { this.rb.filters.splice(i, 1); },
    rbAddAgg() { this.rb.aggregations.push({ field: '', fn: 'sum' }); },
    rbRemoveAgg(i) { this.rb.aggregations.splice(i, 1); },

    rbBuildDefinition() {
      return {
        dataset: this.rb.dataset,
        columns: this.rb.columns,
        filters: this.rb.filters.filter(f => f.field && f.op),
        groupBy: this.rb.groupBy || undefined,
        aggregations: this.rb.aggregations.filter(a => a.field && a.fn),
        sort: this.rb.sort,
        limit: Number(this.rb.limit) || 1000,
      };
    },

    // ─── Run & Export ───────────────────────────────────────────
    async rbRun() {
      if (!this.rb.dataset) { this.toast('اختر مجموعة بيانات أولاً', 'error'); return; }
      this.rb.running = true; this.rb.error = '';
      try {
        const r = await this.api('POST', '/report-builder/run', this.rbBuildDefinition());
        this.rb.result = r;
      } catch (e) {
        this.rb.error = e.message || 'فشل تنفيذ التقرير';
        this.rb.result = null;
      } finally { this.rb.running = false; }
    },

    async rbExport() {
      if (!this.rb.dataset) { this.toast('اختر مجموعة بيانات أولاً', 'error'); return; }
      try {
        const res = await fetch('/api/report-builder/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(this.rbBuildDefinition()),
        });
        if (!res.ok) throw new Error('فشل التصدير');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.rb.dataset}-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
        const count = res.headers.get('X-Row-Count') || '?';
        this.toast(`تم تصدير ${count} سجل`, 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    rbCellDisplay(row, col) {
      const v = row[col];
      if (v == null) return '—';
      if (v instanceof Date) return this.fmtDate(v);
      if (typeof v === 'object') {
        return v.name || v.title || v.code || JSON.stringify(v).slice(0, 40);
      }
      // ISO date heuristic
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return this.fmtDate(v);
      return String(v);
    },
  };
})();
