/**
 * modules/wizard.js — معالج الإنشاء الموجَّه خطوة بخطوة (UX-2)
 * يُدمج في app() عبر ...window.QmsWizard
 */
(function () {
  'use strict';

  window.QmsWizard = {
    // ─── State ─────────────────────────────────────────────────
    // wizard: null | { flow, step, data, error, busy }
    wizard: null,

    // Setup Wizard steps (دليل إعداد النظام لأول مرة)
    wizardSteps: [
      { icon: '📜', title: 'سياسة الجودة',      iso: 'ISO 5.2',   page: 'qualityPolicy',  desc: 'حدد التزامات الجمعية بالجودة. يجب أن تتضمن الالتزام بمتطلبات ISO 9001 والتحسين المستمر.' },
      { icon: '🎯', title: 'الأهداف الاستراتيجية',  iso: 'ISO 6.2',   page: 'strategicGoals',     desc: 'راجع أهداف الخطة ومؤشراتها المرتبطة قبل متابعة القياس.' },
      { icon: '⚠️', title: 'المخاطر والفرص',     iso: 'ISO 6.1',   page: 'risks',          desc: 'سجّل المخاطر المحيطة بنشاط الجمعية وقيّم احتمالية وأثر كل منها (1-5).' },
      { icon: '🏭', title: 'الموردون',            iso: 'ISO 8.4',   page: 'suppliers',      desc: 'أضف أول مورد وأرسل له رابط التقييم الإلكتروني. الاعتماد يتطلب تقييماً ناجحاً.' },
      { icon: '📄', title: 'الوثائق والسجلات',   iso: 'ISO 7.5',   page: 'documents',      desc: 'أضف دليل الجودة والإجراءات الرئيسية. حدد دورة مراجعة لكل وثيقة.' },
    ],

    // ─── Setup Wizard (onboarding) ──────────────────────────────
    showWizard() {
      this.wizard = { open: true, step: 0 };
    },
    closeWizard() {
      this.wizard = null;
      this._setUserLocalFlag?.('wizard_done', true);
    },
    wizardGoto(pg) {
      this.closeWizard();
      this.goto(pg);
    },

    // ─── Guided Creation Wizard (UX-2) ─────────────────────────
    // إعداد مسارات Wizard: flow → { title, steps[{title, fields[...]}] }
    wizardFlows() {
      const severities = [
        { v: 'منخفضة', l: '🟢 منخفضة' },
        { v: 'متوسطة', l: '🟡 متوسطة' },
        { v: 'مرتفعة', l: '🔴 مرتفعة' },
      ];
      return {
        complaint: {
          title: '➕ فتح شكوى جديدة',
          endpoint: 'complaints',
          icon: '💬',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'subject',          label: 'موضوع الشكوى',        type: 'text',     required: true, placeholder: 'مثال: تأخر في صرف المساعدة' },
                { key: 'severity',         label: 'الخطورة',             type: 'select',   required: true, options: severities },
                { key: 'complainantName',  label: 'اسم الشاكي (اختياري)', type: 'text',     placeholder: 'اتركه فارغاً إن كانت الشكوى مجهولة' },
              ],
            },
            {
              title: 'تفاصيل الشكوى',
              fields: [
                { key: 'description',     label: 'وصف تفصيلي',         type: 'textarea', required: true, rows: 5, placeholder: 'اشرح ما حدث بدقة، والأثر المترتب…' },
                { key: 'contactInfo',     label: 'بيانات التواصل',     type: 'text',     placeholder: 'رقم الجوال أو البريد' },
                { key: 'receivedAt',      label: 'تاريخ الاستلام',     type: 'date',     required: true, hint: 'يُفترض اليوم إن لم تحدد' },
              ],
            },
          ],
        },
        ncr: {
          title: '➕ فتح حالة عدم مطابقة',
          endpoint: 'ncr',
          icon: '🔧',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'title',     label: 'عنوان عدم المطابقة', type: 'text',   required: true },
                { key: 'severity',  label: 'الخطورة',            type: 'select', required: true, options: severities },
                { key: 'source',    label: 'المصدر', type: 'select', options: [
                  { v: 'INTERNAL_AUDIT', l: 'تدقيق داخلي' },
                  { v: 'COMPLAINT',      l: 'شكوى' },
                  { v: 'REVIEW',         l: 'مراجعة إدارية' },
                  { v: 'OBSERVATION',    l: 'ملاحظة ميدانية' },
                  { v: 'OTHER',          l: 'أخرى' },
                ]},
              ],
            },
            {
              title: 'الوصف والأثر',
              fields: [
                { key: 'description', label: 'وصف عدم المطابقة', type: 'textarea', required: true, rows: 5, placeholder: 'ماذا حدث، أين، ومتى…' },
                { key: 'dueDate',     label: 'الموعد النهائي للمعالجة', type: 'date', hint: 'متى يجب إغلاق هذه الحالة؟' },
              ],
            },
          ],
        },
        risk: {
          title: '➕ تسجيل مخاطرة جديدة',
          endpoint: 'risks',
          icon: '⚠️',
          steps: [
            {
              title: 'تعريف المخاطرة',
              fields: [
                { key: 'title',       label: 'عنوان المخاطرة', type: 'text',     required: true },
                { key: 'description', label: 'الوصف',          type: 'textarea', rows: 3 },
                { key: 'source',      label: 'المصدر (اختياري)', type: 'text',  placeholder: 'مثال: تغيّر تنظيمي، تقنية، بشرية…' },
              ],
            },
            {
              title: 'التقييم والمعالجة',
              fields: [
                { key: 'probability', label: 'الاحتمالية (1-5)', type: 'number', required: true, hint: '1 = نادر، 5 = شبه مؤكد' },
                { key: 'impact',      label: 'الأثر (1-5)',      type: 'number', required: true, hint: '1 = طفيف، 5 = كارثي' },
                { key: 'treatmentType', label: 'استراتيجية المعالجة', type: 'select', options: [
                  { v: 'AVOID',    l: 'تجنّب' },
                  { v: 'MITIGATE', l: 'تخفيف' },
                  { v: 'TRANSFER', l: 'نقل' },
                  { v: 'ACCEPT',   l: 'قبول' },
                ]},
                { key: 'treatment', label: 'خطة المعالجة', type: 'textarea', rows: 3, placeholder: 'الإجراءات المُقتَرحة لتخفيض الأثر/الاحتمالية' },
              ],
            },
          ],
        },
        managementReview: {
          title: '➕ جدولة مراجعة إدارية',
          endpoint: 'management-review',
          icon: '🗣️',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'title',       label: 'عنوان المراجعة', type: 'text', required: true, placeholder: 'مثال: المراجعة الإدارية الربع الأول 2026' },
                { key: 'period',      label: 'الفترة المراجَعة', type: 'text', placeholder: 'الربع الأول 2026 / نصف سنوي / سنوي' },
                { key: 'meetingDate', label: 'موعد الاجتماع',   type: 'date', required: true },
              ],
            },
            {
              title: 'الحضور والتنسيق',
              fields: [
                { key: 'attendees',              label: 'الحضور', type: 'textarea', rows: 3, placeholder: 'المدير العام، مدير الجودة، رؤساء الأقسام…' },
                { key: 'topManagementPresent',   label: 'حضور الإدارة العليا؟ (ISO 9.3.1)', type: 'select', required: true, options: [
                  { v: true,  l: '✅ نعم — الإدارة العليا حاضرة' },
                  { v: false, l: '❌ لا' },
                ]},
              ],
            },
          ],
        },
      };
    },

    openWizard(flow) {
      const flows = this.wizardFlows();
      const def = flows[flow];
      if (!def) return;
      // تهيئة القيم الافتراضية
      const defaults = {};
      if (flow === 'complaint') defaults.receivedAt = new Date().toISOString().slice(0, 10);
      this.wizard = { flow, step: 0, data: defaults, error: '', busy: false };
    },

    currentWizardFlow() {
      if (!this.wizard) return null;
      return this.wizardFlows()[this.wizard.flow] || null;
    },
    wizardStepCount() {
      const f = this.currentWizardFlow();
      return (f?.steps?.length || 0) + 1; // +1 لصفحة المراجعة
    },
    wizardCurrentStep() {
      const f = this.currentWizardFlow();
      if (!f) return null;
      return this.wizard.step < f.steps.length ? f.steps[this.wizard.step] : null;
    },
    wizardIsReviewStep() {
      const f = this.currentWizardFlow();
      return this.wizard && f && this.wizard.step === f.steps.length;
    },

    wizardValidateStep() {
      const step = this.wizardCurrentStep();
      if (!step) return true;
      for (const f of step.fields) {
        if (f.required) {
          const v = this.wizard.data[f.key];
          if (v === undefined || v === null || String(v).trim() === '') {
            this.wizard.error = `حقل مطلوب: ${f.label}`;
            return false;
          }
        }
      }
      this.wizard.error = '';
      return true;
    },

    wizardNext() {
      if (!this.wizardValidateStep()) return;
      this.wizard.step++;
    },
    wizardBack() {
      if (this.wizard.step > 0) this.wizard.step--;
      this.wizard.error = '';
    },

    async wizardSubmit() {
      const def = this.currentWizardFlow();
      if (!def) return;
      this.wizard.busy = true;
      // Type coercion: numbers and booleans from Alpine x-model come as strings
      const payload = {};
      for (const step of def.steps) {
        for (const f of step.fields) {
          let v = this.wizard.data[f.key];
          if (v === '' || v === undefined) continue;
          if (f.type === 'number') v = Number(v);
          else if (f.type === 'select' && (v === 'true' || v === 'false')) v = v === 'true';
          payload[f.key] = v;
        }
      }
      try {
        await this.api('POST', `/${def.endpoint}`, payload);
        this.wizard = null;
        if (typeof this.loadList === 'function') await this.loadList();
        alert('✅ تم الحفظ بنجاح');
      } catch (e) {
        this.wizard.error = e.message || 'تعذّر الحفظ';
        this.wizard.busy = false;
      }
    },

    wizardFieldDisplay(field) {
      const v = this.wizard.data[field.key];
      if (v === undefined || v === null || v === '') return '—';
      if (field.type === 'select' && field.options) {
        const opt = field.options.find(o => o.v === v);
        return opt ? opt.l : v;
      }
      return String(v);
    },
  };
})();
