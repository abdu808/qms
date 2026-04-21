/**
 * modules/supplier-eval.js — تقييم الموردين (wizard متعدد الخطوات + معايير حسب النوع)
 * يُدمج في app() عبر ...window.QmsSupplierEval
 */
(function () {
  'use strict';

  window.QmsSupplierEval = {
    // ─── State ─────────────────────────────────────────────────
    evalModal: {
      open: false,
      step: 1,           // 1=معلومات، 2=درجات، 3=مراجعة
      supplier: null,
      period: '',
      notes: '',
      recommendation: '',
      busy: false,
      criteria: [
        { key: 'quality',       label: 'جودة المنتجات / الخدمات',    max: 30, score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',          max: 25, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',          max: 20, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',   max: 15, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',          max: 10, score: 0 },
      ],
    },
    // Eval link modal
    evalLinkModal: { open: false, url: '', supplier: null, copied: false },

    // ─── Open Eval ──────────────────────────────────────────────
    openEval(supplier) {
      this.evalModal.step = 1;
      this.evalModal.supplier = supplier;
      this.evalModal.period = '';
      this.evalModal.notes = '';
      this.evalModal.recommendation = '';
      this.evalModal.busy = false;
      // Load criteria based on supplier type
      this.evalModal.criteria = this.criteriaForType(supplier.type);
      this.evalModal.criteria.forEach(c => { c.score = 0; c.note = ''; });
      this.evalModal.open = true;
    },

    // ─── Wizard navigation ──────────────────────────────────────
    evalGoNext() {
      const s = this.evalModal.step;
      if (s === 1) {
        if (!this.evalModal.period.trim()) { alert('الفترة التقييمية مطلوبة'); return; }
        this.evalModal.step = 2;
      } else if (s === 2) {
        const anyScored = this.evalModal.criteria.some(c => Number(c.score) > 0);
        if (!anyScored) { alert('يجب تقدير معيار واحد على الأقل'); return; }
        this.evalModal.step = 3;
      }
    },
    evalGoBack() {
      if (this.evalModal.step > 1) this.evalModal.step -= 1;
    },

    // مجموعة المعايير الحرجة الفاشلة (للعرض في مراجعة step 3)
    evalFailedCriticals() {
      return this.evalModal.criteria.filter(
        c => c.critical && (Number(c.score) || 0) < (c.max * 0.5)
      );
    },

    // ─── Criteria by supplier type ──────────────────────────────
    criteriaForType(type) {
      // Common criteria — applied to all supplier types
      const common = [
        { key: 'transparency',   label: 'الشفافية ومكافحة الفساد',        max: 8, critical: true,  score: 0 },
        { key: 'saudization',    label: 'نسبة السعودة وتوطين الوظائف',    max: 5, critical: false, score: 0 },
        { key: 'sustainability', label: 'الاستدامة والمسؤولية الاجتماعية', max: 5, critical: false, score: 0 },
        { key: 'financial_stab', label: 'الاستقرار المالي وموثوقية المورد', max: 5, critical: false, score: 0 },
      ];
      const core = {
        GOODS: [
          { key: 'product_quality', label: 'جودة المنتجات ومطابقة المواصفات', max: 25, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بمواعيد التسليم',         max: 18, critical: false, score: 0 },
          { key: 'packaging',       label: 'التعبئة والتغليف والحفظ',          max: 10, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والشروط التجارية',         max: 12, critical: false, score: 0 },
          { key: 'communication',   label: 'الاستجابة والتواصل',               max: 7,  critical: false, score: 0 },
          { key: 'after_sale',      label: 'خدمات ما بعد البيع والضمان',       max: 5,  critical: false, score: 0 },
        ],
        SERVICES: [
          { key: 'service_quality', label: 'جودة الخدمة المقدمة',             max: 22, critical: true,  score: 0 },
          { key: 'professionalism', label: 'الكفاءة والاحترافية للفريق',       max: 18, critical: false, score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',          max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',               max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',          max: 10, critical: false, score: 0 },
        ],
        CONSTRUCTION: [
          { key: 'spec_compliance', label: 'الالتزام بالمواصفات الفنية والمخططات', max: 14, critical: true,  score: 0 },
          { key: 'work_quality',    label: 'جودة التنفيذ ومطابقة المعايير الهندسية', max: 13, critical: true,  score: 0 },
          { key: 'schedule',        label: 'الالتزام بالجدول الزمني ومراحل التسليم', max: 12, critical: false, score: 0 },
          { key: 'hse_safety',      label: 'السلامة المهنية وتطبيق اشتراطات HSE',  max: 12, critical: true,  score: 0 },
          { key: 'workforce',       label: 'كفاءة العمالة والكوادر الفنية',         max: 8,  critical: false, score: 0 },
          { key: 'materials',       label: 'جودة المواد المستخدمة',                max: 8,  critical: false, score: 0 },
          { key: 'warranty',        label: 'فترة الضمان وخدمات ما بعد التسليم',    max: 5,  critical: false, score: 0 },
          { key: 'permits',         label: 'الالتزام بالأنظمة البلدية والتراخيص',   max: 5,  critical: true,  score: 0 },
        ],
        IT_SERVICES: [
          { key: 'solution_quality',label: 'جودة الحل التقني ومطابقة المتطلبات', max: 18, critical: true,  score: 0 },
          { key: 'sla_response',    label: 'وقت الاستجابة والالتزام بـ SLA',      max: 15, critical: true,  score: 0 },
          { key: 'support',         label: 'الدعم الفني وتوفره عند الحاجة',       max: 12, critical: false, score: 0 },
          { key: 'data_security',   label: 'أمن المعلومات وحماية البيانات',       max: 12, critical: true,  score: 0 },
          { key: 'compatibility',   label: 'التوافقية مع الأنظمة القائمة',        max: 8,  critical: false, score: 0 },
          { key: 'documentation',   label: 'التوثيق والتدريب',                   max: 7,  critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',            max: 5,  critical: false, score: 0 },
        ],
        TRANSPORT: [
          { key: 'safety',           label: 'سلامة النقل وحماية البضاعة',       max: 22, critical: true,  score: 0 },
          { key: 'delivery',         label: 'الالتزام بالمواعيد',               max: 22, critical: false, score: 0 },
          { key: 'vehicle_condition',label: 'حالة المركبات والمعدات',           max: 15, critical: false, score: 0 },
          { key: 'driver_conduct',   label: 'سلوك وكفاءة السائقين',             max: 10, critical: false, score: 0 },
          { key: 'communication',    label: 'التواصل والاستجابة',               max: 5,  critical: false, score: 0 },
          { key: 'pricing',          label: 'الأسعار والتنافسية',               max: 3,  critical: false, score: 0 },
        ],
        CONSULTING: [
          { key: 'output_quality',  label: 'جودة التقارير والمخرجات',           max: 22, critical: true,  score: 0 },
          { key: 'expertise',       label: 'الخبرة والكفاءة التخصصية',          max: 18, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',           max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',                max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقابلة',          max: 10, critical: false, score: 0 },
        ],
        IN_KIND_DONOR: [
          { key: 'spec_conformity', label: 'مطابقة المواصفات المطلوبة',         max: 28, critical: true,  score: 0 },
          { key: 'product_quality', label: 'جودة المواد / البضائع',             max: 22, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالمواعيد',               max: 15, critical: false, score: 0 },
          { key: 'compliance',      label: 'الامتثال والوثائق (صلاحية - شهادات)', max: 12, critical: true,  score: 0 },
        ],
      };
      const fallback = [
        { key: 'quality',       label: 'جودة المنتج / الخدمة',              max: 22, critical: true,  score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',                max: 18, critical: false, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',                max: 15, critical: false, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',          max: 12, critical: false, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',                 max: 10, critical: false, score: 0 },
      ];
      return [ ...(core[type] || fallback), ...common ];
    },

    // ─── Score helpers ──────────────────────────────────────────
    evalTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + Math.min(c.max, Math.max(0, Number(c.score) || 0)), 0);
    },
    evalMaxTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + c.max, 0);
    },
    evalPct() {
      const max = this.evalMaxTotal();
      return max > 0 ? Math.round((this.evalTotal() / max) * 100) : 0;
    },
    evalGrade() {
      const p = this.evalPct();
      if (p >= 90) return 'ممتاز ⭐⭐⭐⭐⭐';
      if (p >= 80) return 'جيد جداً ⭐⭐⭐⭐';
      if (p >= 70) return 'جيد ⭐⭐⭐';
      if (p >= 60) return 'مقبول ⭐⭐';
      return 'ضعيف ⭐';
    },
    evalCriticalFailed() {
      return this.evalModal.criteria.some(c => c.critical && (Number(c.score) || 0) < (c.max * 0.5));
    },
    evalDecision() {
      if (this.evalCriticalFailed()) return 'مرفوض (فشل معيار حرج) ⛔';
      const p = this.evalPct();
      if (p >= 85) return 'معتمد ✅';
      if (p >= 70) return 'معتمد مشروط ⚠️';
      if (p >= 50) return 'قيد المراقبة 🔄';
      return 'مرفوض ❌';
    },

    // ─── Submit ─────────────────────────────────────────────────
    async submitEval() {
      if (this.evalModal.busy) return;
      const answers = {};
      for (const c of this.evalModal.criteria) {
        answers[c.key] = Number(c.score) || 0;
        const note = (c.note || '').trim();
        if (note) answers[`${c.key}_note`] = note.slice(0, 300);
      }
      this.evalModal.busy = true;
      try {
        const res = await this.api('POST', '/supplier-evals', {
          supplierId: this.evalModal.supplier.id,
          answers,
          period: this.evalModal.period,
          notes: this.evalModal.notes,
          recommendation: this.evalModal.recommendation || null,
        });
        const it = res?.item || {};
        this.evalModal.open = false;
        this.evalModal.step = 1;
        alert(`✅ تم حفظ التقييم\nالنتيجة: ${it.totalScore ?? '-'}/${it.maxScore ?? '-'} (${it.percentage ?? '-'}%) — ${it.grade ?? ''}\nالقرار: ${it.decision ?? ''}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل حفظ التقييم'); }
      finally { this.evalModal.busy = false; }
    },

    // ─── External Eval Link ─────────────────────────────────────
    async requestEvalLink(supplier) {
      try {
        const r = await this.api('POST', '/eval-tokens', { supplierId: supplier.id, daysValid: 30 });
        this.evalLinkModal = { open: true, url: r.url, supplier, copied: false };
      } catch (e) { alert(e.message || 'فشل إنشاء الرابط'); }
    },
    copyEvalLink() {
      navigator.clipboard.writeText(this.evalLinkModal.url).then(() => {
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      }).catch(() => {
        const el = document.createElement('textarea');
        el.value = this.evalLinkModal.url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      });
    },
  };
})();
