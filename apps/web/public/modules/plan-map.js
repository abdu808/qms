/**
 * modules/plan-map.js ? extracted from app.js.
 * Merged into app() via ...window.QmsPlanMap.
 */
(function () {
  'use strict';

  window.QmsPlanMap = {
    planMap: null,
    planMapLoading: false,
    planMapError: '',
    planMapFilterAxis: '',
    planMapFilterStatus: '',
    planMapSearch: '',

    async loadPlanMap() {
      this.planMapLoading = true;
      this.planMapError = '';
      try {
        const year = this.filterYear || new Date().getFullYear();
        this.planMap = await this.api('GET', `/strategic-goals/plan-map?year=${encodeURIComponent(year)}`);
      } catch (e) {
        this.planMap = null;
        this.planMapError = e.message || 'تعذر تحميل خريطة ترابط الخطة';
      } finally {
        this.planMapLoading = false;
      }
    },
    async exportPlanMap() {
      try {
        const year = this.filterYear || new Date().getFullYear();
        const res = await fetch(`${API}/strategic-goals/plan-map/export.xlsx?year=${encodeURIComponent(year)}`, {
          headers: { Authorization: `Bearer ${this.token}` },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('فشل تصدير الخطة');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `الخطة-الكاملة-${year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        this.toast?.(e.message || 'فشل تصدير الخطة', 'error');
      }
    },
    planIssueClass(severity) {
      return {
        ERROR: 'bg-red-50 text-red-700 border-red-200',
        WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
        INFO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }[severity] || 'bg-slate-50 text-slate-700 border-slate-200';
    },
    planIssueLabel(severity) {
      return { ERROR: 'مشكلة', WARNING: 'تنبيه', INFO: 'معلومة' }[severity] || severity;
    },

    planMapAxisCards() {
      const axes = this.planMap?.axes || [];
      const goals = this.planMap?.goals || [];
      return axes.map(axis => {
        const axisGoals = goals.filter(goal => goal.axis?.id === axis.id);
        const indicators = axisGoals.reduce((sum, goal) =>
          sum + (goal.indicators?.length || 0) + (goal.supportingAxisIndicators?.length || 0), 0);
        const activities = axisGoals.reduce((sum, goal) => sum + (goal.activities?.length || 0), 0);
        const blockingIssues = axisGoals.reduce((sum, goal) =>
          sum + (goal.issues || []).filter(issue => issue.severity !== 'INFO').length, 0);
        return {
          ...axis,
          goals: axisGoals.length,
          indicators,
          activities,
          blockingIssues,
          status: blockingIssues ? 'NEEDS_ATTENTION' : 'OK',
        };
      });
    },
    planMapTopGaps(limit = 5) {
      const gaps = this.planMap?.summary?.topGaps || [];
      if (gaps.length) return gaps.slice(0, limit);
      return (this.planMap?.issues || []).slice(0, limit).map(item => ({
        severity: item.severity || 'WARNING',
        area: item.area || 'ملاحظة',
        message: item.message || '',
        refs: item.ref ? [item.ref] : [],
      }));
    },
    planMapAxisGoalGroups() {
      const axes = this.planMap?.axes || [];
      const goals = this.planMap?.goals || [];
      const filteredGoals = goals.filter(goal => this.planMapGoalMatchesFilters(goal));
      const groups = axes.map(axis => ({
        ...axis,
        goals: filteredGoals.filter(goal => goal.axis?.id === axis.id),
      }));
      const withoutAxis = filteredGoals.filter(goal => !goal.axis?.id);
      if (withoutAxis.length) {
        groups.push({
          id: '__without_axis',
          code: '',
          nameAr: 'بلا محور',
          goals: withoutAxis,
        });
      }
      return groups.filter(group => group.goals.length || group.id !== '__without_axis');
    },
    planMapGoalMatchesFilters(goal) {
      if (!goal) return false;
      if (this.planMapFilterAxis && goal.axis?.id !== this.planMapFilterAxis) return false;
      if (this.planMapFilterStatus && this.planMapGoalStatus(goal).key !== this.planMapFilterStatus) return false;
      const q = this._normalizeAr(this.planMapSearch || '');
      if (!q) return true;
      const haystack = [
        goal.code,
        goal.title,
        goal.owner?.name,
        goal.responsible,
        ...(goal.indicators || []).map(i => `${i.code} ${i.nameAr}`),
        ...(goal.supportingAxisIndicators || []).map(i => `${i.code} ${i.nameAr}`),
        ...(goal.activities || []).map(a => `${a.code} ${a.title}`),
      ].join(' ');
      return this._normalizeAr(haystack).includes(q);
    },
    planMapGoalStatus(goal) {
      const blocking = (goal?.issues || []).some(i => i.severity === 'ERROR');
      const warnings = (goal?.issues || []).some(i => i.severity === 'WARNING');
      const hasIndicators = (goal?.indicators || []).length || (goal?.supportingAxisIndicators || []).length;
      const hasActivities = (goal?.activities || []).length;
      if (blocking) return { key: 'ERROR', label: 'يحتاج تصحيح', cls: 'bg-red-50 text-red-700 border-red-200' };
      if (!hasIndicators) return { key: 'NO_MEASURE', label: 'بلا قياس', cls: 'bg-red-50 text-red-700 border-red-200' };
      if (!hasActivities) return { key: 'NO_ACTIVITY', label: 'بلا نشاط', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      if (warnings) return { key: 'WARNING', label: 'يحتاج ضبط', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      return { key: 'OK', label: 'مكتمل للمتابعة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    },
    planMapFilteredGoalCount() {
      return this.planMapAxisGoalGroups().reduce((sum, group) => sum + (group.goals?.length || 0), 0);
    },
    resetPlanMapFilters() {
      this.planMapFilterAxis = '';
      this.planMapFilterStatus = '';
      this.planMapSearch = '';
    },
    planMapStatusBreakdown() {
      const goals = this.planMap?.goals || [];
      const seed = {
        OK: { label: 'مكتمل للمتابعة', count: 0, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        WARNING: { label: 'يحتاج ضبط', count: 0, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        NO_ACTIVITY: { label: 'بلا نشاط', count: 0, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        NO_MEASURE: { label: 'بلا قياس', count: 0, cls: 'bg-red-50 text-red-700 border-red-200' },
        ERROR: { label: 'يحتاج تصحيح', count: 0, cls: 'bg-red-50 text-red-700 border-red-200' },
      };
      goals.forEach(goal => {
        const key = this.planMapGoalStatus(goal).key;
        if (seed[key]) seed[key].count += 1;
      });
      return Object.entries(seed).map(([key, item]) => ({ key, ...item }));
    },
    planMapExecutiveSummary() {
      const summary = this.planMap?.summary || {};
      const breakdown = this.planMapStatusBreakdown();
      const urgent = breakdown.filter(item => ['ERROR', 'NO_MEASURE', 'NO_ACTIVITY'].includes(item.key))
        .reduce((sum, item) => sum + item.count, 0);
      const ready = breakdown.find(item => item.key === 'OK')?.count || 0;
      const score = Number(summary.score || 0);
      let verdict = 'تحتاج ضبط قبل الاعتماد التشغيلي';
      let tone = 'amber';
      if (score >= 85 && urgent === 0) {
        verdict = 'جاهزة للمتابعة التشغيلية';
        tone = 'green';
      } else if (score < 65 || urgent > 0) {
        verdict = 'تحتاج معالجة مركزة قبل التعميم';
        tone = 'red';
      }
      return {
        score,
        verdict,
        tone,
        ready,
        urgent,
        warnings: summary.warnings || 0,
        errors: summary.errors || 0,
        next: (this.planMapDecisionItems(1)[0]?.text || this.planMapDecisionItems(1)[0]?.title || 'لا يوجد إجراء حاكم ظاهر الآن.'),
      };
    },
    printPlanMapReport() {
      const map = this.planMap;
      if (!map) return;
      const year = this.filterYear || new Date().getFullYear();
      const executive = this.planMapExecutiveSummary();
      const breakdown = this.planMapStatusBreakdown();
      const actions = this.planMapDecisionItems(8);
      const axes = this.planMapAxisCards();
      const html = `
        <!doctype html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>تقرير خريطة الخطة ${year}</title>
          <style>
            body{font-family:Arial,Tahoma,sans-serif;margin:32px;color:#172033;background:#fff}
            h1{margin:0 0 6px;font-size:24px}
            .muted{color:#667085;font-size:12px}
            .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
            .card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#f8fafc}
            .num{font-size:22px;font-weight:800;margin-top:6px}
            table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:8px;text-align:right;vertical-align:top}
            th{background:#f1f5f9}
            .section{margin-top:24px}
            .pill{display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:4px 8px;margin:3px;font-size:12px}
            @media print{body{margin:18px}.no-print{display:none}}
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="float:left;padding:8px 14px;border:1px solid #ddd;border-radius:10px;background:#fff">طباعة</button>
          <h1>تقرير تنفيذي لخريطة ترابط الخطة</h1>
          <div class="muted">السنة: ${year} · تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</div>
          <div class="grid">
            <div class="card"><div class="muted">درجة الصحة</div><div class="num">${executive.score}%</div></div>
            <div class="card"><div class="muted">قرار القراءة</div><div class="num" style="font-size:16px">${executive.verdict}</div></div>
            <div class="card"><div class="muted">جاهز للمتابعة</div><div class="num">${executive.ready}</div></div>
            <div class="card"><div class="muted">يحتاج معالجة</div><div class="num">${executive.urgent}</div></div>
          </div>
          <div class="section">
            <h2>توزيع الحالات</h2>
            ${breakdown.map(item => `<span class="pill">${item.label}: <b>${item.count}</b></span>`).join('')}
          </div>
          <div class="section">
            <h2>أهم الإجراءات المقترحة</h2>
            <table><thead><tr><th>الأولوية</th><th>المجال</th><th>الإجراء</th></tr></thead><tbody>
              ${actions.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.title || ''}</td><td>${item.text || ''}</td></tr>`).join('') || '<tr><td colspan="3">لا توجد إجراءات حاكمة ظاهرة.</td></tr>'}
            </tbody></table>
          </div>
          <div class="section">
            <h2>قراءة المحاور</h2>
            <table><thead><tr><th>المحور</th><th>الأهداف</th><th>المؤشرات</th><th>الأنشطة</th><th>الملاحظات</th></tr></thead><tbody>
              ${axes.map(axis => `<tr><td>${axis.nameAr || ''}</td><td>${axis.goals}</td><td>${axis.indicators}</td><td>${axis.activities}</td><td>${axis.blockingIssues ? 'يحتاج انتباه' : 'مستقر'}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </body>
        </html>`;
      const win = window.open('', '_blank');
      if (!win) {
        this.toast?.('تعذر فتح نافذة التقرير. تأكد من السماح بالنوافذ المنبثقة.', 'error');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    },
    planMapDecisionItems(limit = 6) {
      const rank = { ERROR: 0, WARNING: 1, INFO: 2 };
      const nextActions = (this.planMap?.nextActions || []).map(item => ({
        severity: item.severity || 'WARNING',
        title: item.label || 'إجراء مطلوب',
        text: item.recommendation || '',
        ref: item.id || '',
      }));
      const issues = (this.planMap?.issues || []).map(item => ({
        severity: item.severity || 'INFO',
        title: item.area || 'ملاحظة',
        text: item.message || '',
        ref: item.ref || '',
      }));
      return [...nextActions, ...issues]
        .filter(item => item.text || item.title)
        .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
        .slice(0, limit);
    },
  };
})();
