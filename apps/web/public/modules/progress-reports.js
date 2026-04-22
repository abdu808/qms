/**
 * modules/progress-reports.js — المحقق الشهري (Digital Quality Employee)
 *
 * يُغطي دورين:
 *   • رئيس القسم — يفتح تقرير قسمه، يُدخِل الأرقام، يُجيب على أسئلة التحقيق، يُرسل
 *   • مدير الجودة — لوحة المقارنة، الاتجاهات، التناقضات، الاعتماد
 */
(function () {
  'use strict';

  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  window.QmsProgressReports = {
    prog: {
      // state مشترك
      loading: false,
      error: '',
      // رئيس القسم
      myReports: [],
      currentReport: null,       // التقرير المفتوح للتحرير
      saving: false,
      submitting: false,
      // لوحة مدير الجودة
      qmYear:  new Date().getFullYear(),
      qmMonth: new Date().getMonth() + 1,
      qmCompare: [],
      qmTrends:  [],
      qmFlags:   [],
      qmLoading: false,
      qmDetecting: false,
      // تقرير موسَّع
      viewMode: 'list', // 'list' | 'edit' | 'dashboard' | 'detail'
    },

    // ─── Helpers ────────────────────────────────────────────────────────────
    progMonthLabel(m) { return AR_MONTHS[(m || 1) - 1] || String(m); },

    progClassBadge(c) {
      return {
        EXCELLENT:  { label: '🟢 متميِّز',  cls: 'bg-green-100 text-green-700' },
        STABLE:     { label: '⚪ مستقر',     cls: 'bg-gray-100 text-gray-700' },
        WARNING:    { label: '🟠 منذر',      cls: 'bg-amber-100 text-amber-700' },
        DISTRESSED: { label: '🔴 متعثِّر',  cls: 'bg-red-100 text-red-700' },
        MISSING:    { label: '⚪ ناقص',      cls: 'bg-gray-100 text-gray-500' },
      }[c] || { label: c, cls: 'bg-gray-100 text-gray-600' };
    },

    progStatusBadge(s) {
      return {
        DRAFT:     { label: 'مسودة',   cls: 'bg-gray-100 text-gray-700' },
        SUBMITTED: { label: 'مُرسل',   cls: 'bg-blue-100 text-blue-700' },
        APPROVED:  { label: 'معتمد',   cls: 'bg-green-100 text-green-700' },
        RETURNED:  { label: 'مُعاد',   cls: 'bg-amber-100 text-amber-700' },
      }[s] || { label: s, cls: 'bg-gray-100' };
    },

    async progFetch(url, opts = {}) {
      const r = await fetch(url, {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token },
        ...opts,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.error?.message || j.error || 'فشل الطلب');
      return j;
    },

    // ─── رئيس القسم: افتح تقرير شهره ───────────────────────────────────────
    async progOpenMyReport({ year, month } = {}) {
      const y = year  || new Date().getFullYear();
      const m = month || (new Date().getMonth() + 1);
      if (!this.user?.departmentId && !['QUALITY_MANAGER','SUPER_ADMIN'].includes(this.user?.role)) {
        this.prog.error = 'حسابك غير مربوط بقسم';
        return;
      }

      this.prog.loading = true; this.prog.error = '';
      try {
        const deptId = this.user.departmentId || this.prog.currentReport?.departmentId;
        if (!deptId) throw new Error('حدد قسماً أولاً');

        const j = await this.progFetch('/api/progress-reports/generate', {
          method: 'POST',
          body: JSON.stringify({ departmentId: deptId, year: y, month: m }),
        });
        this.prog.currentReport = this.progPrepareForEdit(j.report);
        this.prog.viewMode = 'edit';
      } catch (e) {
        this.prog.error = e.message;
      } finally {
        this.prog.loading = false;
      }
    },

    progPrepareForEdit(r) {
      // تأكد من وجود deptFilled
      const dept = r.deptFilled || { kpiValues: [], aiAnswers: [], freeText: '' };
      if (!dept.kpiValues) dept.kpiValues = [];
      if (!dept.aiAnswers) dept.aiAnswers = [];
      if (dept.freeText == null) dept.freeText = '';

      // تأكد من أن kpiValues تحتوي إدخالاً لكل KPI ناقص
      const needed = r.autoFilled?.kpisNeedingValue || [];
      for (const k of needed) {
        if (!dept.kpiValues.find(v => v.objectiveId === k.id)) {
          dept.kpiValues.push({ objectiveId: k.id, title: k.title, value: null, note: '' });
        }
      }
      // تأكد من إجابات الأسئلة
      for (const q of (r.aiQuestions || [])) {
        if (!dept.aiAnswers.find(a => a.questionId === q.id)) {
          dept.aiAnswers.push({ questionId: q.id, answer: '' });
        }
      }
      r.deptFilled = dept;
      return r;
    },

    // ─── حفظ تلقائي (عند الكتابة) ──────────────────────────────────────────
    async progAutoSave() {
      if (!this.prog.currentReport || this.prog.saving) return;
      if (!['DRAFT','RETURNED'].includes(this.prog.currentReport.status)) return;
      this.prog.saving = true;
      try {
        await this.progFetch(`/api/progress-reports/${this.prog.currentReport.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ deptFilled: this.prog.currentReport.deptFilled }),
        });
      } catch (e) {
        console.error('save failed', e);
      } finally {
        this.prog.saving = false;
      }
    },

    // ─── إرسال للاعتماد ─────────────────────────────────────────────────────
    async progSubmit() {
      if (!this.prog.currentReport) return;
      if (!confirm('إرسال التقرير للاعتماد؟ لن تستطيع التعديل بعد ذلك إلا إذا أُعيد إليك.')) return;

      // احفظ قبل الإرسال
      await this.progAutoSave();

      this.prog.submitting = true;
      try {
        const j = await this.progFetch(`/api/progress-reports/${this.prog.currentReport.id}/submit`, {
          method: 'POST',
        });
        this.prog.currentReport = { ...this.prog.currentReport, ...j.report };
        alert(`✅ أُرسل التقرير — الدرجة المحسوبة: ${j.score?.total}/100`);
        this.progLoadMine();
      } catch (e) {
        alert('فشل الإرسال: ' + e.message);
      } finally {
        this.prog.submitting = false;
      }
    },

    async progLoadMine() {
      try {
        const j = await this.progFetch('/api/progress-reports/mine');
        this.prog.myReports = j.items || [];
      } catch (e) { this.prog.error = e.message; }
    },

    // ─── لوحة مدير الجودة ─────────────────────────────────────────────────
    async progLoadDashboard() {
      this.prog.qmLoading = true;
      try {
        const [cmp, trd, flg] = await Promise.all([
          this.progFetch(`/api/progress-reports/dashboard/compare?year=${this.prog.qmYear}&month=${this.prog.qmMonth}`),
          this.progFetch(`/api/progress-reports/dashboard/trends?months=6`),
          this.progFetch(`/api/progress-reports/flags?status=OPEN`),
        ]);
        this.prog.qmCompare = cmp.rows || [];
        this.prog.qmTrends  = trd.trends || [];
        this.prog.qmFlags   = flg.items  || [];
        this.prog.viewMode = 'dashboard';
      } catch (e) {
        this.prog.error = e.message;
      } finally {
        this.prog.qmLoading = false;
      }
    },

    async progRunContradictionCheck() {
      this.prog.qmDetecting = true;
      try {
        const j = await this.progFetch('/api/progress-reports/dashboard/detect-contradictions', {
          method: 'POST',
          body: JSON.stringify({ year: this.prog.qmYear, month: this.prog.qmMonth }),
        });
        alert(`🔍 فُحصت التقارير — وُجد ${j.found} تناقض${j.found === 1 ? '' : 'اً'}`);
        await this.progLoadDashboard();
      } catch (e) {
        alert('فشل الفحص: ' + e.message);
      } finally {
        this.prog.qmDetecting = false;
      }
    },

    async progApproveReport(id) {
      if (!confirm('اعتماد هذا التقرير؟')) return;
      try {
        await this.progFetch(`/api/progress-reports/${id}/approve`, { method: 'POST' });
        await this.progLoadDashboard();
      } catch (e) { alert(e.message); }
    },

    async progReturnReport(id) {
      const reason = prompt('سبب الإعادة للتعديل:');
      if (!reason?.trim()) return;
      try {
        await this.progFetch(`/api/progress-reports/${id}/return`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        });
        await this.progLoadDashboard();
      } catch (e) { alert(e.message); }
    },

    async progOpenReportDetail(reportOrId) {
      const id = typeof reportOrId === 'string' ? reportOrId : reportOrId.id;
      try {
        const j = await this.progFetch(`/api/progress-reports/${id}`);
        this.prog.currentReport = j.report;
        this.prog.viewMode = 'detail';
      } catch (e) { alert(e.message); }
    },

    async progResolveFlag(flagId) {
      const note = prompt('ملاحظة عن الحل (اختياري):') || '';
      try {
        await this.progFetch(`/api/progress-reports/flags/${flagId}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ note }),
        });
        await this.progLoadDashboard();
      } catch (e) { alert(e.message); }
    },

    // ─── Navigation shortcuts ─────────────────────────────────────────────
    progGoToList() {
      this.prog.viewMode = 'list';
      this.prog.currentReport = null;
      this.progLoadMine();
    },

    // ─── للإيجنت AI في صفحة المستشار ──────────────────────────────────────
    progCanUseDashboard() {
      return ['SUPER_ADMIN','QUALITY_MANAGER'].includes(this.user?.role);
    },
    progCanFillReport() {
      return ['SUPER_ADMIN','QUALITY_MANAGER','DEPT_MANAGER'].includes(this.user?.role);
    },
  };
})();
