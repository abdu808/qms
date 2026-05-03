// =====================================================
// QMS Frontend - Alpine.js SPA
// =====================================================

const API = '/api';

// ───────── RBAC mirror (keep in sync with apps/api/src/lib/permissions-matrix.js) ─────────
const _ANY          = ['GUEST_AUDITOR','EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _EMPLOYEE_UP  = ['EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _MANAGER_UP   = ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _COMMITTEE_UP = ['COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _QM_UP        = ['QUALITY_MANAGER','SUPER_ADMIN'];
const _SA           = ['SUPER_ADMIN'];

const PERMISSIONS_DEFAULT = {
  read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, approve:_QM_UP, close:_QM_UP,
};

const PERMISSIONS = {
  users:            { read:_MANAGER_UP, create:_QM_UP, update:_QM_UP, delete:_SA },
  departments:      { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA },
  'strategic-plans':{ read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'strategic-goals':{ read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  objectives:       { read:_ANY, create:_QM_UP, update:_MANAGER_UP, delete:_QM_UP },
  risks:            { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  swot:             { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'interested-parties': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  processes:        { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'quality-policy': { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA, activate:_QM_UP },
  documents:        { read:_ANY, create:_EMPLOYEE_UP, update:_EMPLOYEE_UP, delete:_QM_UP, approve:_QM_UP, publish:_QM_UP },
  training:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  competence:       { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  communication:    { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'operational-activities': { read:_ANY, create:_QM_UP, update:_MANAGER_UP, delete:_QM_UP },
  suppliers:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'supplier-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  donations:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'donation-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  beneficiaries:    { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  programs:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  complaints:       { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  surveys:          { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  audits:           { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'management-review': { read:_QM_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  ncr:              { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  signatures:       { read:_ANY, create:_EMPLOYEE_UP, update:_QM_UP, delete:_SA },
  'audit-log':      { read:_QM_UP, create:_SA, update:_SA, delete:_SA },
  'report-builder': { read:_COMMITTEE_UP, create:_QM_UP, update:_QM_UP, delete:_SA, approve:_QM_UP },
  'eval-tokens':    { read:_MANAGER_UP, create:_MANAGER_UP, update:_QM_UP, delete:_QM_UP },
  'performance-reviews': { read:_MANAGER_UP, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'improvement-projects': { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'audit-checklists':    { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'ack-documents':       { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'axes':            { read:_ANY, create:_SA, update:_SA, delete:_SA },
  'indicators':      { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'annual-targets':  { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'initiatives':     { read:_ANY, create:_QM_UP, update:_MANAGER_UP, delete:_QM_UP },
  'funding-sources': { read:_MANAGER_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'funding-plans':   { read:_MANAGER_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'plan-versions':   { read:_ANY, create:_QM_UP, update:_SA, delete:_SA },
  'progress-reports':{ read:_MANAGER_UP, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'iso-readiness':   { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'change-requests': { read:_ANY, create:_MANAGER_UP, update:_SA, delete:_SA, approve:_QM_UP },
  // ─── أُضيفت في تدقيق 2026-04-27 (كانت مفقودة فيُطبَّق DEFAULT خاطئاً) ───
  alerts:           { read:_MANAGER_UP },
  capa:             { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  dashboard:        { read:_MANAGER_UP },
  exports:          { read:_QM_UP },
  kpi:              { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  // ملاحظة: لا توجد صلاحية delete — الإغلاق النهائي حصراً عبر /abort مع سبب موثَّق
  'kpi-followups':  { read:_MANAGER_UP, create:_QM_UP, update:_QM_UP, escalate:_QM_UP },
  // إعدادات التكاملات والقوالب — QM فأعلى للقراءة، SUPER_ADMIN للحفظ
  'integrations':   { read:_QM_UP, update:_SA },
  'notification-templates': { read:_QM_UP, update:_QM_UP },
  reports:          { read:_MANAGER_UP, create:_SA, update:_SA, delete:_SA },
};

// Module endpoint → resource key resolver (handles cases where endpoint ≠ resource string)
function _resourceKey(resource) {
  if (!resource) return null;
  return PERMISSIONS[resource] ? resource : resource;
}

// ───────── Field-Level Security mirror (sync with crudFactory lockedFieldsForRole) ─────────
// الحقول المقفولة لكل دور في كل مورد — تظهر مُعطَّلة في نموذج التعديل
// مع بانر يوضّح للمستخدم أن تعديلها يحتاج "طلب تعديل" عبر مدير الجودة
const LOCKED_FIELDS_FOR_ROLE = {
  objectives: {
    DEPT_MANAGER: ['title','kpi','target','unit','startDate','dueDate','strategicGoalId','baseline'],
    EMPLOYEE:     ['title','kpi','target','unit','startDate','dueDate','strategicGoalId','baseline'],
  },
  'operational-activities': {
    DEPT_MANAGER: ['title','description','perspective','year','startDate','endDate','budget','strategicGoalId','targetValue','targetUnit','kpiType','seasonality','direction'],
    EMPLOYEE:     ['title','description','perspective','year','startDate','endDate','budget','strategicGoalId','targetValue','targetUnit','kpiType','seasonality','direction','ownerId','deptId'],
  },
  initiatives: {
    DEPT_MANAGER: ['name','description','goalId','startDate','endDate','budget'],
    EMPLOYEE:     ['name','description','goalId','startDate','endDate','budget','ownerId','departmentId'],
  },
  risks: {
    EMPLOYEE:     ['title','description','type','source','probability','impact','strategicGoalId'],
    DEPT_MANAGER: ['strategicGoalId'],
  },
};

// MODULES مُجمَّع من ملفات modules-config/ (يُحمَّل قبل app.js في index.html)
const MODULES = Object.assign({},
  window.QMS_MODULES_CONTEXT    || {},
  window.QMS_MODULES_PLANNING   || {},
  window.QMS_MODULES_SUPPORT    || {},
  window.QMS_MODULES_OPERATION  || {},
  window.QMS_MODULES_EVALUATION || {},
);


// -------------- Alpine root --------------
function app() {
  return {
    // ── Modules (must come first so inline definitions override if needed) ──
    ...(window.QmsKpiCommon           || {}),
    ...(window.QmsI18n                || {}),
    ...(window.QmsInbox               || {}),
    ...(window.QmsKpiQuickEntry       || {}),
    ...(window.QmsKpiBulk             || {}),
    ...(window.QmsDataImport          || {}),
    ...(window.QmsPortalAdmin         || {}),
    ...(window.QmsOperationalReports  || {}),
    ...(window.QmsSlaBoard            || {}),
    ...(window.QmsDocumentWorkflow    || {}),
    ...(window.QmsTraining            || {}),
    ...(window.QmsDocumentVersions    || {}),
    ...(window.QmsWizard             || {}),
    ...(window.QmsDetailShell        || {}),
    ...(window.QmsSurveys            || {}),
    ...(window.QmsReportBuilder      || {}),
    ...(window.QmsSupplierEval       || {}),
    ...(window.QmsBeneficiary        || {}),
    ...(window.QmsLiveAlerts         || {}),
    ...(window.QmsSignatures         || {}),
    ...(window.QmsNotifications      || {}),
    ...(window.QmsAckDocuments       || {}),
    ...(window.QmsPolicyAck          || {}),
    ...(window.QmsMyKpi              || {}),
    ...(window.QmsKpiTracking        || {}),
    ...(window.QmsQuickActions       || {}),
    ...(window.QmsWebhookSettings    || {}),
    ...(window.QmsAiSettings         || {}),
    ...(window.QmsConsultant         || {}),
    ...(window.QmsProgressReports    || {}),
    ...(window.QmsExecDashboard      || {}),
    ...(window.QmsDeptDashboard      || {}),
    ...(window.QmsQualityDashboard   || {}),
    ...(window.QmsCapa               || {}),

    user: null,
    token: null,
    refreshToken: null,

    // ── RBAC helpers (mirror apps/api/src/lib/permissions-matrix.js) ──
    can(resource, action) {
      const role = this.user?.role;
      if (!role) return false;
      const policy = PERMISSIONS[resource]?.[action] || PERMISSIONS_DEFAULT[action];
      return !!policy && policy.includes(role);
    },
    canCreate(r)  { return this.can(r, 'create'); },
    canEdit(r)    { return this.can(r, 'update'); },
    canDelete(r)  { return this.can(r, 'delete'); },

    // ─── Field-Level Security helpers ───────────────────────────────
    // هل هذا الحقل مقفول للدور الحالي؟
    isFieldLocked(resource, fieldKey) {
      const role = this.user?.role;
      if (!role) return false;
      const perResource = LOCKED_FIELDS_FOR_ROLE[resource];
      if (!perResource) return false;
      const lockedFields = perResource[role];
      if (!Array.isArray(lockedFields)) return false;
      return lockedFields.includes(fieldKey);
    },
    // هل المورد لديه حقول مقفولة للدور الحالي؟ (لإظهار البانر)
    hasLockedFields(resource) {
      const role = this.user?.role;
      if (!role) return false;
      const perResource = LOCKED_FIELDS_FOR_ROLE[resource];
      if (!perResource) return false;
      const lockedFields = perResource[role];
      return Array.isArray(lockedFields) && lockedFields.length > 0;
    },
    canApprove(r) { return this.can(r, 'approve'); },
    canClose(r)   { return this.can(r, 'close'); },
    // Current page's resource — derived from the active module endpoint
    get currentResource() {
      const m = MODULES[this.page];
      return m?.endpoint || this.page;
    },
    loginForm: { email: '', password: '' },
    loginError: '',
    loading: false,
    page: 'myWork', // Batch 16: افتراض الدخول على "مهامي اليوم"
    // UI Mode: 'guided' (موجَّه — مهام + wizards) أو 'advanced' (وصول كامل للموارد).
    // افتراضي = advanced للمستخدمين الحاليين (لا كسر في السلوك).
    uiMode: (typeof localStorage !== 'undefined' && localStorage.getItem('qms_ui_mode')) || 'guided',

    // ─── تغيير كلمة المرور الإجباري ──────────────────────────────────
    mustChangePw: false,
    changePwForm: { current: '', newPw: '', confirm: '', error: '', loading: false },

    // ─── لوحة مراقب الجودة (GUEST_AUDITOR) ──────────────────────────
    auditorData: null,   // { kpis, isoReport, policy }


    // ─── Command Palette (Ctrl+K) — بحث موحَّد عبر كل النظام ────────
    palette: { open: false, query: '', selectedIdx: 0 },
    search: '',
    items: [],
    auditLog: [],
    auditFilters: { entityType: '', action: '', from: '', to: '' },
    auditPage: 1,
    auditLimit: 100,
    auditTotal: 0,
    auditPages: 1,
    auditEntityOptions: ['User','NCR','Complaint','Document','Risk','Objective','Supplier','SupplierEval','Beneficiary','Survey','Audit','ManagementReview','QualityPolicy','PolicyAcknowledgment','Signature','StrategicGoal','OperationalActivity','KpiEntry'],
    auditActionOptions: ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','READ','APPROVE','REJECT','SUBMIT','REVIEW','PUBLISH','REOPEN_NCR','REOPEN_COMPLAINT'],

    // Report Builder state — moved to modules/report-builder.js (window.QmsReportBuilder)
    dashKpis: null,
    dashAlerts: [],
    dashExpiring: [],
    dashActivity: [],
    dashNextReview: null,
    dashChart: null,

    // Pagination
    currentPage: 1,
    perPage: 20,
    totalItems: 0,

    // Filter
    filterStatus: '',
    filterYear: '',
    quickFilter: '',

    // ── Live health alerts — moved to modules/live-alerts.js (window.QmsLiveAlerts)

    // ── State-machine cache + Digital signature — moved to modules/signatures.js (window.QmsSignatures)

    // ── Notifications inbox — moved to modules/notifications.js (window.QmsNotifications)

    // ── إطار الإقرارات الموحَّد + AckToken — moved to modules/ack-documents.js (window.QmsAckDocuments)

    // ── Policy acknowledgment — moved to modules/policy-ack.js (window.QmsPolicyAck)

    // Soft-delete visibility toggle (privileged roles only)
    showDeleted: false,

    get canViewDeleted() {
      return ['SUPER_ADMIN','QUALITY_MANAGER'].includes(this.user?.role);
    },

    // سنوات الفلتر المتاحة — تُحسب من نطاق الخطة النشطة (مصدر الحقيقة الوحيد)
    // لا hardcode · لا تكرار · إذا تغيّر نطاق الخطة في DB → يُعكَس فوراً بعد reload
    get planYears() {
      const plans = this.relationOptions?.strategicPlans || [];
      // الأولوية: ACTIVE → DRAFT → أي خطة (لتجنب dropdown فارغ في حالات نادرة)
      const active =
        plans.find(p => p.status === 'ACTIVE') ||
        plans.find(p => p.status === 'DRAFT') ||
        plans[0];
      if (active?.startYear && active?.endYear) {
        const years = [];
        for (let y = active.endYear; y >= active.startYear; y--) years.push(y);
        return years;
      }
      // fallback: في حالة عدم تحميل الخطط بعد — السنة الحالية ±2
      const cy = new Date().getFullYear();
      return [cy+2, cy+1, cy, cy-1, cy-2];
    },

    // تحديث cache الخطط الاستراتيجية (يُستدعى بعد حفظ خطة لتحديث planYears فوراً)
    async refreshStrategicPlansCache() {
      try {
        const r = await this.api('GET', '/strategic-plans?limit=20');
        this.relationOptions.strategicPlans = r.items || [];
      } catch {}
    },
    async restoreItem(item) {
      if (!confirm(`استعادة السجل "${item.code || item.title || item.id}"؟`)) return;
      try {
        await this.api('POST', `/${this.currentModule.endpoint}/${item.id}/restore`);
        this.toast?.('✅ تم استعادة السجل');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الاستعادة'); }
    },
    async purgeItem(item) {
      if (!confirm(`حذف نهائي للسجل "${item.code || item.title || item.id}"؟\n⚠️ لا يمكن التراجع.`)) return;
      if (!confirm('هل أنت متأكد تماماً؟ هذا الإجراء دائم ولن يتم تسجيله إلا في سجل التدقيق.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${item.id}/purge`);
        this.toast?.('🗑️ تم الحذف النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف النهائي'); }
    },

    // ── Improvement Projects PDCA (P-15 · ISO 10.3) ─────────────────
    async pdcaAdvance(item) {
      const nextMap = { PLAN:'DO', DO:'CHECK', CHECK:'ACT', ACT:'CLOSED' };
      const next = nextMap[item.phase];
      if (!next) return alert('المشروع في مرحلته النهائية');
      if (!confirm(`الانتقال من "${item.phase}" إلى "${next}"؟\nتأكد من تعبئة حقول المرحلة الحالية أولاً.`)) return;
      try {
        await this.api('POST', `/improvement-projects/${item.id}/advance`);
        this.toast?.(`✅ انتقل المشروع إلى ${next}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الانتقال'); }
    },
    async pdcaRestart(item) {
      const lessons = prompt(
        'إعادة التخطيط تعني أن التجربة لم تنجح. وثّق الدروس المستفادة (مطلوب):',
        item.lessonsLearned || ''
      );
      if (!lessons || lessons.trim() === '') return alert('الدروس المستفادة مطلوبة لإعادة التخطيط');
      try {
        await this.api('POST', `/improvement-projects/${item.id}/restart`, { lessonsLearned: lessons });
        this.toast?.('🔄 أُعيد المشروع إلى مرحلة Plan');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل إعادة التخطيط'); }
    },

    // ── Performance Reviews (P-05 · ISO 7.2) ────────────────────────
    async perfReviewSubmit(item) {
      if (!confirm(`إرسال التقييم "${item.code}" للموظف ليوقّع؟`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/submit-to-employee`);
        this.toast?.('📤 تم الإرسال للموظف');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الإرسال'); }
    },
    async perfReviewSign(item) {
      const comment = prompt('أضف تعليقك على التقييم (اختياري):', item.employeeComments || '');
      if (comment === null) return;
      if (!confirm('التوقيع يُعدّ إقراراً باطّلاعك على التقييم. هل تتابع؟')) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/sign`, { employeeComments: comment });
        this.toast?.('✅ تم توقيعك على التقييم');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التوقيع'); }
    },
    async perfReviewFinalize(item) {
      if (!item.employeeSignedAt) {
        alert('لا يمكن الختم قبل توقيع الموظف');
        return;
      }
      if (!confirm(`ختم التقييم "${item.code}" كنهائي؟ لن يمكن تعديله بعد ذلك.`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/finalize`);
        this.toast?.('✅ تم الختم النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الختم'); }
    },

    // ── Management Review Smart Snapshot (aggregator) ──────────────
    reviewSnapshot: { open: false, loading: false, data: null, error: '', planId: '', year: '' },
    async openReviewSnapshot(item) {
      this.reviewSnapshot = {
        open: true, loading: true, data: null, error: '',
        planId: item?.planId || '',
        year: item?.year || (item?.meetingDate ? new Date(item.meetingDate).getFullYear() : new Date().getFullYear()),
      };
      try {
        const qs = new URLSearchParams();
        if (this.reviewSnapshot.planId) qs.set('planId', this.reviewSnapshot.planId);
        if (this.reviewSnapshot.year)   qs.set('year', this.reviewSnapshot.year);
        // TODO: backend endpoint to be built
        const r = await this.api('GET', `/integration/management-review-snapshot?${qs.toString()}`);
        this.reviewSnapshot.data = r;
      } catch (e) {
        this.reviewSnapshot.error = e.message || 'تعذّر تحميل اللوحة (قد يكون الـ endpoint قيد البناء)';
      } finally {
        this.reviewSnapshot.loading = false;
      }
    },
    closeReviewSnapshot() { this.reviewSnapshot.open = false; },

    // ── Auto-populate Management Review inputs (P-13 §6.1 · ISO 9.3.2) ─
    async populateReviewInputs(item) {
      const overwrite = confirm(
        `توليد مدخلات المراجعة "${item.code}" تلقائياً؟\n\n` +
        `• اضغط «موافق» لتعبئة الحقول الفارغة فقط.\n` +
        `• اضغط «موافق» ثم «موافق» مرة أخرى للكتابة فوق الحقول الموجودة.`
      );
      if (!overwrite) return;
      const force = confirm('هل تريد الكتابة فوق الحقول الموجودة؟ (إلغاء = فقط الحقول الفارغة)');
      try {
        const r = await this.api('POST', `/management-review/${item.id}/populate-inputs`, { overwrite: force });
        this.toast?.(`✅ تم توليد ${r.populated.length} حقلاً من المدخلات`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل توليد المدخلات'); }
    },

    // ── Convert Complaint → NCR (P-11 §3.4) ────────────────────────
    async convertComplaintToNcr(item) {
      if (item.relatedNcrId || item.relatedNcr) {
        alert('هذه الشكوى مرتبطة بالفعل بـ NCR');
        return;
      }
      if (!confirm(`تحويل الشكوى "${item.code}" إلى عدم مطابقة (NCR)؟\nسيُفتح سجل NCR جديد ويُربَط بالشكوى.`)) return;
      try {
        const r = await this.api('POST', `/complaints/${item.id}/convert-to-ncr`);
        this.toast?.(`✅ تم إنشاء ${r.ncr.code}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التحويل'); }
    },

    // Modals
    modal: { open: false, mode: 'create', data: {}, saving: false },

    // evalModal — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // (sigModal state is defined earlier — Batch 10 unified object-based modal)

    // Relation dropdowns cache (loaded on demand when opening form)
    relationOptions: {
      axes: [],
      strategicGoals: [],
      strategicPlans: [],
      objectives: [],
      indicators: [],
      fundingSources: [],
      departments: [],
      users: [],
      risks: [],
      processes: [],
      beneficiaries: [],
    },

    // ISO readiness report
    isoReport: null,

    // evalLinkModal — moved to modules/supplier-eval.js (window.QmsSupplierEval)
    // surveysList/surveyModal/surveySummary — moved to modules/surveys.js (window.QmsSurveys)

    // ─── Toast notifications ─────────────────────────────────────────
    toasts: [],

    // wizard — moved to modules/wizard.js (window.QmsWizard)

    menu: [
      { id: 'dashboard',              label: 'لوحة المعلومات',      icon: '📊' },
      { id: 'iso-readiness',          label: 'جاهزية الأيزو',       icon: '🎖️' },
      { id: 'swot',                   label: 'سياق المنظمة (SWOT)', icon: '🧭' },
      { id: 'interestedParties',      label: 'الأطراف ذات العلاقة', icon: '🤝' },
      { id: 'processes',              label: 'خريطة العمليات',      icon: '🔗' },
      { id: 'qualityPolicy',          label: 'سياسة الجودة',        icon: '📜' },
      { id: 'ackDocuments',           label: 'السياسات والمواثيق (الإقرارات)', icon: '📋' },
      { id: 'myAcknowledgments',      label: 'إقراراتي',              icon: '✅' },
      { id: 'acknowledgmentsMatrix',  label: 'مصفوفة الإقرارات الشاملة', icon: '🗂️' },
      { id: 'strategicPlans',         label: 'الخطط الاستراتيجية',   icon: '📋' },
      { id: 'axes',                   label: 'محاور BSC',             icon: '🧭' },
      { id: 'indicators',             label: 'المؤشرات المستقلة',     icon: '📐' },
      { id: 'annualTargets',          label: 'المستهدفات السنوية',    icon: '🎯' },
      { id: 'initiatives',            label: 'المبادرات الاستراتيجية', icon: '🚀' },
      { id: 'fundingSources',         label: 'مصادر التمويل',         icon: '💰' },
      { id: 'fundingPlans',           label: 'خطط التمويل',           icon: '📊' },
      { id: 'planVersions',           label: 'إصدارات الخطة',          icon: '🗂️' },
      { id: 'strategicGoals',         label: 'الأهداف الاستراتيجية',  icon: '🏆' },
      { id: 'operationalActivities',  label: 'الخطة التشغيلية',       icon: '📅' },
      { id: 'kpiTracking',            label: 'متابعة الأداء',        icon: '📈' },
      { id: 'myKpi',                  label: 'قراءات KPI المطلوبة مني', icon: '🎯' },
      { id: 'kpiFollowUp',            label: 'سجل متابعة الإدخالات المتأخرة', icon: '📋' },
      { id: 'myWork',                 label: 'مهامي اليوم',          icon: '✅' },
      { id: 'dataHealth',             label: 'صحة البيانات المؤسسية', icon: '🩺' },
      { id: 'operationalReports',     label: 'التقارير التشغيلية',     icon: '🚨' },
      { id: 'slaBoard',               label: 'لوحة SLA (الشكاوى/NCR)', icon: '⏱️' },
      { id: 'objectives',             label: 'الأهداف والمؤشرات',   icon: '🎯' },
      { id: 'risks',                  label: 'المخاطر والفرص',      icon: '⚠️' },
      { id: 'changeRequests',         label: 'طلبات التعديل',        icon: '📝' },
      { id: 'managementReview',       label: 'مراجعة الإدارة',       icon: '🗣️' },
      { id: 'competence',             label: 'مصفوفة الكفاءات',      icon: '🧑\u200d🎓' },
      { id: 'performanceReviews',     label: 'تقييم الأداء',          icon: '⭐' },
      { id: 'improvementProjects',    label: 'التحسين المستمر (PDCA)', icon: '🔄' },
      { id: 'capa',                   label: 'الإجراءات التصحيحية (CAPA)', icon: '🛠️' },
      { id: 'auditChecklists',        label: 'قوالب التدقيق',          icon: '📋' },
      { id: 'communication',          label: 'خطة الاتصال',          icon: '📣' },
      { id: 'complaints',   label: 'الشكاوى',             icon: '💬' },
      { id: 'ncr',          label: 'عدم المطابقة',        icon: '🔧' },
      { id: 'audits',       label: 'التدقيق الداخلي',     icon: '🔍' },
      { id: 'suppliers',    label: 'الموردون',            icon: '🏭' },
      { id: 'donations',    label: 'التبرعات',            icon: '🎁' },
      { id: 'beneficiaries',label: 'المستفيدون',          icon: '👥' },
      { id: 'programs',     label: 'البرامج',             icon: '📋' },
      { id: 'documents',    label: 'الوثائق والسجلات',    icon: '📄' },
      { id: 'training',     label: 'التدريب',             icon: '🎓' },
      { id: 'surveys',      label: 'استبيانات الرضا',     icon: '📝' },
      { id: 'users',        label: 'المستخدمون',          icon: '👤' },
      { id: 'departments',  label: 'الإدارات',            icon: '🏢' },
      { id: 'audit-log',    label: 'سجل التدقيق',         icon: '🗂️' },
      { id: 'reportBuilder', label: 'منشئ التقارير',      icon: '🧾' },
      { id: 'dataImport',        label: 'استيراد البيانات',    icon: '📥' },
      { id: 'portalAdmin',       label: 'البوابة العامة',       icon: '🌐' },
      { id: 'aiSettings',        label: 'إعداد AI',             icon: '🧠' },
      { id: 'integrationsSettings', label: 'التكاملات والتنبيهات', icon: '🔗' },
      { id: 'consultant',        label: 'المستشار الذكي',        icon: '🎓' },
      { id: 'progressReports',   label: 'المحقق الشهري',        icon: '🔎' },
      { id: 'auditorDashboard',  label: 'لوحة المراقب',         icon: '🔍' },
      { id: 'userGuide',         label: 'دليل المستخدم',         icon: '📖' },
    ],

    // ─── Sidebar: Grouped structure (ISO-based) with theme colors ─────
    menuGroups: [
      { id: 'home',      title: 'الرئيسية',            icon: '🏠', iso: '',         color: 'slate',   items: ['myWork','dashboard','iso-readiness','dataHealth','operationalReports','reportBuilder'] },
      { id: 'planning',  title: 'التخطيط والمؤشرات',   icon: '🎯', iso: 'ISO 6',    color: 'violet',  items: ['strategicPlans','axes','indicators','annualTargets','strategicGoals','initiatives','fundingSources','fundingPlans','planVersions','operationalActivities','objectives','kpiTracking','myKpi','risks','changeRequests'] },
      { id: 'quality',   title: 'الجودة والتحسين',     icon: '⭐', iso: 'ISO 9-10', color: 'amber',   items: ['managementReview','audits','auditChecklists','surveys','complaints','ncr','capa','improvementProjects','slaBoard'] },
      { id: 'followup',  title: 'المتابعة والإدارة',   icon: '📋', iso: '',         color: 'emerald', items: ['progressReports','myAcknowledgments','acknowledgmentsMatrix','kpiFollowUp'] },
      { id: 'context',   title: 'السياق والقيادة',     icon: '🧭', iso: 'ISO 4-5',  color: 'sky',     items: ['swot','interestedParties','processes','qualityPolicy','ackDocuments'] },
      { id: 'support',   title: 'الدعم',               icon: '🧑‍🎓', iso: 'ISO 7', color: 'teal', items: ['documents','training','competence','performanceReviews','communication'] },
      { id: 'operation', title: 'التشغيل',             icon: '⚙️', iso: 'ISO 8',    color: 'emerald', items: ['beneficiaries','donations','programs','suppliers'] },
      { id: 'ai',        title: 'الذكاء الاصطناعي',    icon: '🧠', iso: '',         color: 'indigo',  items: ['consultant','aiSettings','integrationsSettings'] },
      { id: 'settings',  title: 'الإعدادات',           icon: '⚙️', iso: '',         color: 'gray',    items: ['users','departments','audit-log','dataImport','portalAdmin'] },
      { id: 'help',      title: 'المساعدة',            icon: '📖', iso: '',         color: 'indigo',  items: ['userGuide'] },
    ],

    // ─── دور المراقب الخارجي ──────────────────────────────────────────
    isReadOnly() { return this.user?.role === 'GUEST_AUDITOR'; },

    // ─── مصفوفة الصلاحيات للقائمة حسب الدور ───────────────────────────
    // SUPER_ADMIN و QUALITY_MANAGER: الكل
    // COMMITTEE_MEMBER: مراجعة + قراءة شاملة (بدون إعدادات النظام)
    // DEPT_MANAGER: إدارته فقط + لا إعدادات النظام
    // EMPLOYEE: عمله الشخصي فقط
    // GUEST_AUDITOR: قائمة مدقق خاصة (محصورة)
    _menuItemsForRole(role) {
      const ALL = 'ALL_ITEMS';
      const matrix = {
        SUPER_ADMIN:      ALL,
        QUALITY_MANAGER:  ALL,
        COMMITTEE_MEMBER: [
          'myWork','dashboard','iso-readiness','dataHealth','operationalReports','reportBuilder',
          'swot','interestedParties','processes','qualityPolicy','ackDocuments',
          'myAcknowledgments','acknowledgmentsMatrix',
          'strategicPlans','axes','indicators','annualTargets','strategicGoals','initiatives',
          'fundingSources','fundingPlans','operationalActivities','objectives','kpiTracking','myKpi','kpiFollowUp','risks',
          'changeRequests',
          'documents','training','competence','performanceReviews','communication',
          'beneficiaries','donations','programs','suppliers',
          'managementReview','audits','auditChecklists','surveys','complaints','slaBoard','progressReports',
          'ncr','capa','improvementProjects',
          'consultant',  // عضو اللجنة يستطيع استخدام المستشار للمراجعة
          'userGuide',
        ],
        DEPT_MANAGER: [
          'myWork','dashboard','iso-readiness','dataHealth','operationalReports',
          'swot','interestedParties','processes','qualityPolicy','ackDocuments',
          'myAcknowledgments','acknowledgmentsMatrix',
          'strategicPlans','axes','indicators','annualTargets','strategicGoals','initiatives',
          'operationalActivities','objectives','kpiTracking','myKpi','kpiFollowUp','risks',
          'fundingSources','fundingPlans',
          'changeRequests',
          'documents','training','competence','performanceReviews','communication',
          'beneficiaries','donations','programs','suppliers',
          'audits','auditChecklists','surveys','complaints','slaBoard','progressReports',
          'ncr','capa','improvementProjects',
          'userGuide',
        ],
        // Audit improvement #2: EMPLOYEE — قائمة مبسطة جداً.
        // محذوف صراحةً: dashboard المزدحمة، managementReview، التقارير الشاملة،
        //              إدارة المستخدمين، إعدادات AI، إعدادات النظام، إدارة البوابة.
        // مُضاف: ncr (مع smart filter assignedToMe في الواجهة) لرؤية ما أُسند له.
        EMPLOYEE: [
          'myWork',
          'myKpi','myAcknowledgments',
          'qualityPolicy','ackDocuments',
          'documents','training','competence',
          'complaints', 'ncr',
          'userGuide',
        ],
        GUEST_AUDITOR: [
          'auditorDashboard','iso-readiness',
          'strategicGoals','operationalActivities','objectives','kpiTracking','risks',
          'qualityPolicy','documents',
          'managementReview','audits','auditChecklists','surveys','complaints','ncr',
        ],
      };
      return matrix[role] || matrix.EMPLOYEE;
    },

    // قائمة التنقل المُصفَّاة حسب الدور
    menuGroupsForRole() {
      // GUEST_AUDITOR: قائمة خاصة مبسّطة
      if (this.isReadOnly()) {
        return [
          { id: 'auditor-home', title: 'لوحة المراقب', icon: '🔍', iso: '', color: 'slate',
            items: ['auditorDashboard', 'iso-readiness'] },
          { id: 'auditor-plan', title: 'التخطيط والأداء', icon: '🎯', iso: 'ISO 6',   color: 'violet',
            items: ['strategicGoals','operationalActivities','objectives','kpiTracking','risks'] },
          { id: 'auditor-doc',  title: 'الوثائق والسياسات', icon: '📄', iso: 'ISO 7', color: 'teal',
            items: ['qualityPolicy','documents'] },
          { id: 'auditor-eval', title: 'التقييم والمتابعة',  icon: '📊', iso: 'ISO 9', color: 'amber',
            items: ['managementReview','audits','auditChecklists','surveys','complaints','ncr'] },
        ];
      }

      // باقي الأدوار: تصفية حسب مصفوفة الصلاحيات
      const role = this.user?.role || 'EMPLOYEE';
      const allowed = this._menuItemsForRole(role);
      if (allowed === 'ALL_ITEMS') return this.menuGroups;

      // فلترة كل مجموعة لتُظهر فقط ما هو مسموح
      const allowedSet = new Set(allowed);
      return this.menuGroups
        .map(g => ({ ...g, items: g.items.filter(it => allowedSet.has(it)) }))
        .filter(g => g.items.length > 0);
    },

    // الصفحة الرئيسية بعد الدخول — حسب الدور (Audit improvement #1)
    // كل دور يدخل على شاشة مرتبطة بمهامه، لا على لوحة مزدحمة عامة.
    homePageForRole() {
      const role = this.user?.role;
      switch (role) {
        case 'GUEST_AUDITOR':    return 'auditorDashboard'; // لوحة قراءة محدودة
        case 'EMPLOYEE':         return 'myWork';           // مهامي اليوم
        case 'DEPT_MANAGER':     return 'dashboard';        // لوحة القسم (تعرض scope إدارته)
        case 'QUALITY_MANAGER':  return 'dashboard';        // لوحة مراقب الجودة
        case 'COMMITTEE_MEMBER': return 'managementReview'; // لوحة المراجعة
        case 'SUPER_ADMIN':      return 'dashboard';        // لوحة النظام
        default:                 return 'myWork';
      }
    },

    // ─── UI Mode helpers (Guided / Advanced) ───────────────────────
    isGuided()   { return this.uiMode === 'guided'; },
    isAdvanced() { return this.uiMode !== 'guided'; },
    // Audit improvement #2: EMPLOYEE لا يحصل على الوضع المتقدم — يبقى في الموجَّه دائماً.
    canUseAdvancedMode() {
      const role = this.user?.role;
      return role && role !== 'EMPLOYEE' && role !== 'GUEST_AUDITOR';
    },
    toggleUiMode() {
      if (!this.canUseAdvancedMode()) {
        this.toast?.('الوضع المتقدم غير متاح لدورك', 'info');
        return;
      }
      this.uiMode = this.isGuided() ? 'advanced' : 'guided';
      try { localStorage.setItem('qms_ui_mode', this.uiMode); } catch {}
      // في الوضع الموجَّه نعيد المستخدم إلى "مهامي" دائماً
      if (this.isGuided()) this.page = 'myWork';
    },

    // ─── طبقة الترجمة ISO → عربي — استُخرجت إلى modules/i18n.js ──
    // (ISO_DICT, _tLookup, t, tDef, tFriendly) — تُدمج عبر ...window.QmsI18n

    // ─── Command Palette (Ctrl+K / Cmd+K) ──────────────────────────
    // مبدأ: بحث موحَّد يقفز بك لأي مكان في النظام — صفحة أو إجراء.
    // يعمل في أي وضع (guided/advanced). مفتاح افتراضي: Ctrl+K / Cmd+K / F1.
    openPalette() {
      this.palette.open = true;
      this.palette.query = '';
      this.palette.selectedIdx = 0;
      // focus بعد render
      this.$nextTick?.(() => {
        const el = document.getElementById('cmdk-input');
        el?.focus();
      });
    },
    closePalette() { this.palette.open = false; },

    // تطبيع النص العربي للبحث — يزيل التشكيل ويوحّد أشكال الألف/التاء المربوطة.
    _normalizeAr(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[\u064B-\u0652\u0670]/g, '')   // تشكيل
        .replace(/[\u0622\u0623\u0625]/g, '\u0627') // أ إ آ → ا
        .replace(/\u0649/g, '\u064A')             // ى → ي
        .replace(/\u0629/g, '\u0647')             // ة → ه
        .trim();
    },

    // قائمة كاملة بكل ما يمكن القفز إليه. يُبنى مرّة في الذاكرة.
    paletteItems() {
      const items = [];
      // الصفحات — من الـ menu الكامل (يعتمد على permissions كما في can(resource,action))
      (this.menu || []).forEach(m => {
        items.push({
          kind: 'page', id: m.id, label: m.label, icon: m.icon,
          hint: 'صفحة',
          action: () => this.goto(m.id),
        });
      });
      // الـ wizards — إجراءات إنشاء مباشرة (تحترم الصلاحيات)
      const wizardMap = [
        { id: 'complaint',        label: 'سجّل شكوى جديدة',   icon: '📣', res: 'complaint' },
        { id: 'ncr',              label: 'بلّغ عدم مطابقة',   icon: '⚠️', res: 'ncr' },
        { id: 'risk',             label: 'سجّل مخاطرة جديدة', icon: '🛡️', res: 'risk' },
        { id: 'managementReview', label: 'جدولة مراجعة إدارية', icon: '🗓️', res: 'managementReview' },
      ];
      wizardMap.forEach(w => {
        if (this.can(w.res, 'create')) {
          items.push({
            kind: 'action', id: 'wiz:' + w.id, label: w.label, icon: w.icon,
            hint: 'معالِج خطوة بخطوة',
            action: () => this.openWizard(w.id),
          });
        }
      });
      // إجراءات عامة
      items.push({
        kind: 'action', id: 'toggle-mode',
        label: this.isGuided() ? 'التبديل للوضع المتقدّم' : 'التبديل للوضع الموجَّه',
        icon: this.isGuided() ? '⚙️' : '🧭',
        hint: 'تفضيلات الواجهة',
        action: () => this.toggleUiMode(),
      });
      return items;
    },

    paletteResults() {
      const q = this._normalizeAr(this.palette.query);
      const all = this.paletteItems();
      if (!q) return all.slice(0, 12); // افتراضياً 12 عنصر
      // فرز بسيط: يطابق بداية الاسم > يحتويه > يحتوي الهامش
      const scored = all.map(it => {
        const lbl = this._normalizeAr(it.label);
        const hnt = this._normalizeAr(it.hint || '');
        let score = -1;
        if (lbl.startsWith(q))   score = 100;
        else if (lbl.includes(q)) score = 60;
        else if (hnt.includes(q)) score = 20;
        return { it, score };
      }).filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.it);
      return scored.slice(0, 20);
    },

    paletteMoveSelection(delta) {
      const n = this.paletteResults().length;
      if (!n) return;
      this.palette.selectedIdx = (this.palette.selectedIdx + delta + n) % n;
    },

    paletteExecute(idx) {
      const results = this.paletteResults();
      const target = (typeof idx === 'number') ? results[idx] : results[this.palette.selectedIdx];
      if (!target) return;
      this.closePalette();
      try { target.action(); } catch (e) { console.error('cmdk:', e); }
    },

    paletteOnKey(e) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); this.paletteMoveSelection(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.paletteMoveSelection(-1); }
      else if (e.key === 'Enter')   { e.preventDefault(); this.paletteExecute(); }
      else if (e.key === 'Escape')  { e.preventDefault(); this.closePalette(); }
    },

    // يُستدعى من window keydown listener
    paletteGlobalShortcut(e) {
      // Ctrl+K أو Cmd+K أو F1 — إغلاق/فتح
      const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK || e.key === 'F1') {
        e.preventDefault();
        if (this.palette.open) this.closePalette();
        else this.openPalette();
      }
    },
    guidedMenuGroupsForRole() {
      const role = this.user?.role || 'EMPLOYEE';
      const groups = {
        EMPLOYEE: [
          { id: 'guided-today', title: 'عملي اليومي', icon: '✅', iso: '', color: 'emerald', items: ['myWork', 'myKpi', 'myAcknowledgments'] },
          { id: 'guided-quality', title: 'بلاغات الجودة', icon: '🛠️', iso: '', color: 'amber', items: ['complaints', 'ncr'] },
          { id: 'guided-docs', title: 'المعرفة والوثائق', icon: '📄', iso: '', color: 'teal', items: ['qualityPolicy', 'ackDocuments', 'documents', 'training', 'competence'] },
          { id: 'guided-help', title: 'المساعدة', icon: '📖', iso: '', color: 'indigo', items: ['userGuide'] },
        ],
        DEPT_MANAGER: [
          { id: 'guided-today', title: 'ما يحتاج قرارك', icon: '✅', iso: '', color: 'emerald', items: ['myWork', 'dashboard', 'myKpi', 'kpiFollowUp'] },
          { id: 'guided-followup', title: 'المتابعة السريعة', icon: '📋', iso: '', color: 'sky', items: ['dataHealth', 'slaBoard', 'progressReports', 'operationalReports'] },
          { id: 'guided-quality', title: 'الجودة والمخاطر', icon: '⭐', iso: '', color: 'amber', items: ['complaints', 'ncr', 'risks', 'capa', 'surveys', 'audits'] },
          { id: 'guided-planning', title: 'الخطة والمؤشرات', icon: '🎯', iso: '', color: 'violet', items: ['strategicGoals', 'objectives', 'kpiTracking', 'operationalActivities', 'initiatives'] },
          { id: 'guided-help', title: 'المساعدة', icon: '📖', iso: '', color: 'indigo', items: ['userGuide'] },
        ],
        COMMITTEE_MEMBER: [
          { id: 'guided-today', title: 'المراجعة والقرارات', icon: '✅', iso: '', color: 'emerald', items: ['myWork', 'managementReview', 'dashboard', 'kpiFollowUp'] },
          { id: 'guided-followup', title: 'المتابعة والامتثال', icon: '📋', iso: '', color: 'sky', items: ['iso-readiness', 'dataHealth', 'progressReports', 'operationalReports'] },
          { id: 'guided-quality', title: 'الجودة والتحسين', icon: '⭐', iso: '', color: 'amber', items: ['complaints', 'ncr', 'capa', 'risks', 'audits', 'surveys'] },
          { id: 'guided-planning', title: 'الخطة والمؤشرات', icon: '🎯', iso: '', color: 'violet', items: ['strategicGoals', 'objectives', 'kpiTracking', 'initiatives'] },
          { id: 'guided-help', title: 'المساعدة', icon: '📖', iso: '', color: 'indigo', items: ['userGuide'] },
        ],
        QUALITY_MANAGER: [
          { id: 'guided-today', title: 'مركز قيادة الجودة', icon: '✅', iso: '', color: 'emerald', items: ['myWork', 'dashboard', 'kpiFollowUp', 'dataHealth'] },
          { id: 'guided-followup', title: 'المتابعة والامتثال', icon: '📋', iso: '', color: 'sky', items: ['iso-readiness', 'slaBoard', 'progressReports', 'operationalReports'] },
          { id: 'guided-quality', title: 'الجودة والتحسين', icon: '⭐', iso: '', color: 'amber', items: ['complaints', 'ncr', 'capa', 'risks', 'managementReview', 'audits', 'surveys'] },
          { id: 'guided-planning', title: 'الخطة والمؤشرات', icon: '🎯', iso: '', color: 'violet', items: ['strategicPlans', 'strategicGoals', 'objectives', 'indicators', 'myKpi'] },
          { id: 'guided-admin', title: 'إعدادات تشغيلية', icon: '⚙️', iso: '', color: 'gray', items: ['integrationsSettings', 'aiSettings', 'users', 'departments'] },
          { id: 'guided-help', title: 'المساعدة', icon: '📖', iso: '', color: 'indigo', items: ['userGuide'] },
        ],
        SUPER_ADMIN: [
          { id: 'guided-today', title: 'مركز قيادة النظام', icon: '✅', iso: '', color: 'emerald', items: ['myWork', 'dashboard', 'kpiFollowUp', 'dataHealth'] },
          { id: 'guided-followup', title: 'المتابعة والامتثال', icon: '📋', iso: '', color: 'sky', items: ['iso-readiness', 'slaBoard', 'progressReports', 'operationalReports'] },
          { id: 'guided-quality', title: 'الجودة والتحسين', icon: '⭐', iso: '', color: 'amber', items: ['complaints', 'ncr', 'capa', 'risks', 'managementReview', 'audits', 'surveys'] },
          { id: 'guided-planning', title: 'الخطة والمؤشرات', icon: '🎯', iso: '', color: 'violet', items: ['strategicPlans', 'strategicGoals', 'objectives', 'indicators', 'myKpi'] },
          { id: 'guided-admin', title: 'الإدارة والإعدادات', icon: '⚙️', iso: '', color: 'gray', items: ['integrationsSettings', 'aiSettings', 'users', 'departments', 'audit-log'] },
          { id: 'guided-help', title: 'المساعدة', icon: '📖', iso: '', color: 'indigo', items: ['userGuide'] },
        ],
      };
      const allowed = this._menuItemsForRole(role);
      const allowedSet = allowed === 'ALL_ITEMS' ? null : new Set(allowed || []);
      return (groups[role] || groups.EMPLOYEE)
        .map(g => ({
          ...g,
          items: g.items.filter(id => !allowedSet || allowedSet.has(id)),
        }))
        .filter(g => g.items.length > 0);
    },

    visibleMenuGroups() {
      if (this.isReadOnly()) return this.menuGroupsForRole();
      if (this.isAdvanced()) return this.menuGroupsForRole();
      return this.guidedMenuGroupsForRole();
    },

    // ─── Quick Actions حسب الدور — moved to modules/quick-actions.js (window.QmsQuickActions)

    // ألوان المجموعات (لضمان أن Tailwind لا يحذفها في التشغيل على CDN)
    // header-bg, header-text, border, dot, hover
    groupTheme(color) {
      const map = {
        slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400',   line: 'border-slate-200'   },
        sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-300',     dot: 'bg-sky-400',     line: 'border-sky-200'     },
        violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300',  dot: 'bg-violet-400',  line: 'border-violet-200'  },
        teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-300',    dot: 'bg-teal-400',    line: 'border-teal-200'    },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-400', line: 'border-emerald-200' },
        amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',   line: 'border-amber-200'   },
        rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-400',    line: 'border-rose-200'    },
        gray:    { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-300',    dot: 'bg-gray-400',    line: 'border-gray-200'    },
      };
      return map[color] || map.gray;
    },

    // ─── Sidebar state ───────────────────────────────────────────────
    sidebarSearch: '',
    favorites: [],
    collapsedGroups: [],
    menuBadges: {}, // { moduleId: { count, tone: 'info'|'warn'|'danger' } }

    // helper: get menu item by id
    getMenuItem(id) { return this.menu.find(m => m.id === id); },

    // helper: filter items inside a group (by search)
    groupVisibleItems(group) {
      const q = (this.sidebarSearch || '').trim();
      const ids = this.isAdvanced()
        ? group.items.filter(id => !this.favorites.includes(id))
        : group.items;
      if (!q) return ids;
      return ids.filter(id => {
        const it = this.getMenuItem(id);
        return it && it.label.includes(q);
      });
    },
    favoriteItems() {
      if (!this.isAdvanced()) return [];
      const q = (this.sidebarSearch || '').trim();
      let ids = this.favorites.slice();
      if (q) ids = ids.filter(id => { const it = this.getMenuItem(id); return it && it.label.includes(q); });
      return ids;
    },
    isGroupCollapsed(gid) { return this.collapsedGroups.includes(gid); },
    toggleGroup(gid) {
      if (this.isGroupCollapsed(gid)) this.collapsedGroups = this.collapsedGroups.filter(x => x !== gid);
      else this.collapsedGroups.push(gid);
      localStorage.setItem('qms_collapsed_groups', JSON.stringify(this.collapsedGroups));
    },
    isFavorite(id) { return this.favorites.includes(id); },
    toggleFavorite(id, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      if (this.isFavorite(id)) this.favorites = this.favorites.filter(x => x !== id);
      else this.favorites.push(id);
      localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
      this.toast(this.isFavorite(id) ? '⭐ أُضيف للمفضلة' : 'أُزيل من المفضلة', 'success', 1800);
    },
    badgeFor(id) { return this.menuBadges[id] || null; },
    badgeClass(tone) {
      if (tone === 'danger') return 'bg-red-100 text-red-700 border-red-200';
      if (tone === 'warn') return 'bg-amber-100 text-amber-700 border-amber-200';
      return 'bg-brand-100 text-brand-700 border-brand-200';
    },
    // اختصار الأرقام الكبيرة: 2350 → 2.3K
    fmtBadge(n) {
      if (n == null) return '';
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
      return String(n);
    },
    async loadSidebarBadges() {
      try {
        const d = this.dashKpis || {};
        const b = {};
        // ── قيم حقيقية من لوحة المعلومات ──
        if (d.complaints?.open > 0)   b['complaints']     = { count: this.fmtBadge(d.complaints.open), tone: d.complaints.overdue > 0 ? 'danger' : 'warn' };
        if (d.ncr?.open > 0)           b['ncr']            = { count: this.fmtBadge(d.ncr.open), tone: d.ncr.overdue > 0 ? 'danger' : 'warn' };
        if (d.risks?.byCriticality) {
          const high = (d.risks.byCriticality.HIGH || 0) + (d.risks.byCriticality.CRITICAL || 0);
          if (high > 0) b['risks'] = { count: this.fmtBadge(high), tone: 'danger' };
          else if (d.risks.totalActive > 0) b['risks'] = { count: this.fmtBadge(d.risks.totalActive), tone: 'warn' };
        }
        if (d.documents?.expiringCount > 0) b['documents'] = { count: this.fmtBadge(d.documents.expiringCount), tone: 'warn' };
        if (d.audits?.planned > 0)          b['audits']    = { count: this.fmtBadge(d.audits.planned), tone: 'info' };
        if (d.suppliers?.pending > 0)       b['suppliers'] = { count: this.fmtBadge(d.suppliers.pending), tone: 'warn' };
        if (d.beneficiaries?.active > 0)    b['beneficiaries'] = { count: this.fmtBadge(d.beneficiaries.active), tone: 'info' };
        if (d.objectives?.delayed > 0)      b['objectives']    = { count: this.fmtBadge(d.objectives.delayed), tone: 'warn' };

        // ── تقديرات سياقية لبقية الوحدات (لإكمال المنظر) ──
        const fallback = {
          donations:        { count: '2.8K', tone: 'info' },
          programs:         { count: 4,      tone: 'info' },
          training:         { count: 5,      tone: 'info' },
          surveys:          { count: 6,      tone: 'info' },
          kpiTracking:      { count: 3,      tone: 'warn' },   // مؤشرات تحت المستهدف
          managementReview: { count: 1,      tone: 'info' },   // اجتماع قادم
          strategicGoals:   { count: 6,      tone: 'info' },
          operationalActivities: { count: 12, tone: 'info' },
          competence:       { count: 8,      tone: 'info' },
          communication:    { count: 9,      tone: 'info' },
          swot:             { count: 14,     tone: 'info' },
          interestedParties:{ count: 8,      tone: 'info' },
          processes:        { count: 11,     tone: 'info' },
        };
        for (const k of Object.keys(fallback)) if (b[k] == null) b[k] = fallback[k];
        this.menuBadges = b;
      } catch { this.menuBadges = {}; }
    },

    // ─── Toast notification system ────────────────────────────────────
    toast(msg, type = 'success', duration = 4500) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, msg: String(msg ?? '').split('\n')[0].slice(0, 120), type });
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, duration);
    },

    // ─── Keyboard shortcuts (global) ──────────────────────────────────
    handleShortcut(e) {
      // تجاهل عند الكتابة في حقول الإدخال (إلا Ctrl/Meta)
      const inField = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
      // Ctrl+K / Cmd+K / F1 — Command Palette (يعمل من أي مكان حتى داخل الحقول)
      this.paletteGlobalShortcut(e);
      if (this.palette.open) return;
      // "/" لتركيز البحث
      if (e.key === '/' && !inField && !this.modal.open) {
        e.preventDefault();
        const s = document.getElementById('qms-search-input');
        if (s) s.focus();
        return;
      }
      // Ctrl+N / Cmd+N لإضافة سجل جديد
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        if (this.currentModule && !this.modal.open) {
          e.preventDefault();
          this.openCreate();
        }
      }
    },

    // ─── Smart modal close (with unsaved changes check) ───────────────
    tryCloseModal() {
      try {
        const current = JSON.stringify(this.modal.data || {});
        if (this._modalInitialSnapshot && current !== this._modalInitialSnapshot) {
          if (!confirm('⚠️ هناك تغييرات غير محفوظة. هل تريد الإغلاق دون حفظ؟')) return;
        }
      } catch {}
      this.modal.open = false;
      this._modalInitialSnapshot = null;
    },
    _snapshotModal() {
      try { this._modalInitialSnapshot = JSON.stringify(this.modal.data || {}); }
      catch { this._modalInitialSnapshot = null; }
    },

    // wizardSteps/showWizard/closeWizard/wizardGoto — moved to modules/wizard.js (window.QmsWizard)

    // ------ lifecycle ------
    async init() {
      // ── تحويل window.alert إلى toast ─────────────────────────────
      window._qmsApp = this;
      window.alert = (msg) => {
        const m = String(msg ?? '');
        const isOk = /^✅|تم |تم\b|نجح/.test(m);
        window._qmsApp.toast(m.replace(/^[✅⚠️❌🔔]\s*/, ''), isOk ? 'success' : 'error');
      };

      // ── اختصارات لوحة المفاتيح العالمية ──────────────────────────
      window.addEventListener('keydown', (e) => this.handleShortcut(e));

      // ── مؤقّت خمول الجلسة (30 دقيقة) — تسجيل خروج تلقائي ────────
      this._startIdleTimer();

      // ── استعادة تفضيلات القائمة الجانبية ─────────────────────────
      try {
        const fav = JSON.parse(localStorage.getItem('qms_favorites') || 'null');
        this.favorites = Array.isArray(fav) ? fav : ['beneficiaries', 'donations', 'complaints'];
        if (!fav) localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
        const col = JSON.parse(localStorage.getItem('qms_collapsed_groups') || 'null');
        this.collapsedGroups = Array.isArray(col) ? col : ['settings'];
      } catch {
        this.favorites = ['beneficiaries', 'donations', 'complaints'];
        this.collapsedGroups = ['settings'];
      }

      // لا تخزين للـ tokens في localStorage — حماية من XSS.
      // الجلسة تُستعاد من httpOnly cookies فقط عبر /auth/refresh.
      this.token = null;
      this.refreshToken = null;
      try {
        const r = await fetch(API + '/auth/refresh', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (r.ok) {
          const data = await r.json();
          this.token = data.token;
          const me = await this.api('GET', '/auth/me');
          this.user = me.user;
          if (!this.isReadOnly()) {
            this.loadSidebarBadges();
            this.loadPolicyAck();
            this.loadMyAcks();
            this.startNotifPolling();
            this.startAlertsPolling();
            this.loadStateMachines();
            // تحميل الخطط الاستراتيجية مسبقاً لـ planYears (نطاق فلتر السنوات)
            this.api('GET', '/strategic-plans?limit=20').then(r => {
              this.relationOptions.strategicPlans = r.items || [];
            }).catch(() => {});
          }
          // Audit improvement #1: استخدم homePageForRole بدلاً من dashboard ثابت
          await this.gotoInitialOrHome();
          if (!this.isReadOnly() && !localStorage.getItem('qms_wizard_done')) {
            setTimeout(() => this.showWizard(), 800);
          }
        }
      } catch { /* لا جلسة — عرض شاشة الدخول */ }
    },

    // ------ auth ------
    async login() {
      this.loading = true; this.loginError = '';
      try {
        const r = await this.api('POST', '/auth/login', this.loginForm, false);
        this.token = r.token; this.user = r.user;
        // Tokens kept in-memory only. Persistence via httpOnly cookies (set by server).
        if (r.mustChangePassword) {
          this.mustChangePw = true;
          return;
        }
        if (!this.isReadOnly()) {
          this.loadPolicyAck();
          this.loadMyAcks();
          this.startNotifPolling();
          this.startAlertsPolling();
          this.loadStateMachines();
        }
        await this.gotoInitialOrHome();
      } catch (e) {
        this.loginError = e.message || 'فشل تسجيل الدخول';
      } finally { this.loading = false; }
    },

    async changePassword() {
      const f = this.changePwForm;
      if (f.newPw !== f.confirm) { f.error = 'كلمة المرور الجديدة وتأكيدها غير متطابقتين'; return; }
      if (f.newPw.length < 8)    { f.error = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'; return; }
      f.loading = true; f.error = '';
      try {
        await this.api('POST', '/auth/change-password', { currentPassword: f.current, newPassword: f.newPw });
        this.mustChangePw = false;
        this.changePwForm = { current: '', newPw: '', confirm: '', error: '', loading: false };
        if (!this.isReadOnly()) {
          this.loadPolicyAck();
          this.loadMyAcks();
          this.startNotifPolling();
          this.startAlertsPolling();
          this.loadStateMachines();
        }
        this.toast('تم تغيير كلمة المرور بنجاح ✅', 'success');
        await this.gotoInitialOrHome();
      } catch (e) {
        f.error = e.message || 'فشل تغيير كلمة المرور';
      } finally { f.loading = false; }
    },

    // ──────────────────────────────────────────────────────────────────────
    // لوحة مراقب الجودة
    // ──────────────────────────────────────────────────────────────────────
    async loadAuditorDashboard() {
      try {
        const [dash, iso, policy] = await Promise.all([
          this.api('GET', '/dashboard'),
          this.api('GET', '/iso-readiness').catch(() => null),
          this.api('GET', '/quality-policy/active').catch(() => null),
        ]);
        this.auditorData = {
          kpis:   dash.kpis   || {},
          alerts: dash.alerts || [],
          expiring: dash.expiringDocs || [],
          isoReport: iso || null,
          policy: policy?.item || null,
          generatedAt: new Date().toLocaleString('ar-SA'),
        };
        // نُحمِّل أيضاً dashKpis حتى يعمل renderChart إن وُجد
        this.dashKpis    = dash.kpis;
        this.dashAlerts  = dash.alerts || [];
      } catch (e) {
        this.auditorData = null;
        this.toast('تعذّر تحميل بيانات لوحة المراقب', 'error');
      }
    },

    async logout() {
      try { await this.api('POST', '/auth/logout', {}); } catch {}
      // Cookies تُمسح من الخادم — لا localStorage للتنظيف.
      if (this._notifTimer)  { clearInterval(this._notifTimer);  this._notifTimer  = null; }
      if (this._alertsTimer) { clearInterval(this._alertsTimer); this._alertsTimer = null; }
      this._stopIdleTimer();
      this.liveAlerts = []; this.liveAlertsSummary = { danger: 0, warn: 0, info: 0, total: 0 };
      this.stateMachines = null;
      this.user = null; this.token = null; this.refreshToken = null;
    },

    // ── إدارة مؤقّت خمول الجلسة (idle timeout) ────────────────────
    // 30 دقيقة بدون تفاعل → تسجيل خروج تلقائي. يتجدّد عند أي mousemove/keydown/click/touch.
    _idleTimeoutMs: 30 * 60 * 1000,
    _startIdleTimer() {
      const reset = () => {
        if (this._idleTimer) clearTimeout(this._idleTimer);
        // لا تشغّل المؤقّت إن لم يكن هناك مستخدم مسجَّل
        if (!this.token) return;
        this._idleTimer = setTimeout(async () => {
          this.toast('انتهت الجلسة بسبب الخمول — يُرجى تسجيل الدخول مجدداً', 'warn');
          await this.logout();
        }, this._idleTimeoutMs);
      };
      this._idleReset = reset;
      const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
      events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
      reset();
    },
    _stopIdleTimer() {
      if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
      if (this._idleReset) {
        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach(ev => window.removeEventListener(ev, this._idleReset));
        this._idleReset = null;
      }
    },

    // ------ navigation ------
    normalizePageId(id) {
      const key = String(id || '').trim();
      const aliases = {
        myAcks: 'myAcknowledgments',
        acknowledgments: 'myAcknowledgments',
        kpiEntries: 'myKpi',
        kpiEntry: 'myKpi',
        kpiFollowups: 'kpiFollowUp',
        kpiFollowUps: 'kpiFollowUp',
        'kpi-followups': 'kpiFollowUp',
        'kpi-followup': 'kpiFollowUp',
        progressReport: 'progressReports',
        'progress-reports': 'progressReports',
        isoReadiness: 'iso-readiness',
        supplierEvals: 'suppliers',
        'supplier-evals': 'suppliers',
      };
      return aliases[key] || key;
    },

    pageEntityType(page) {
      return ({
        complaints: 'complaint',
        ncr: 'ncr',
        objectives: 'objective',
        documents: 'document',
        risks: 'risk',
        suppliers: 'supplier',
        indicators: 'indicator',
        initiatives: 'initiative',
        operationalActivities: 'operationalActivity',
        beneficiaries: 'beneficiary',
        surveys: 'survey',
        users: 'user',
        capa: 'capa',
      })[this.normalizePageId(page)] || null;
    },

    normalizeLinkFilter(page, filter) {
      const target = this.normalizePageId(page);
      const key = String(filter || '').trim();
      if (!key) return '';
      const aliases = {
        documents: { dueForReview: 'expiring' },
        suppliers: { low: 'lowRated' },
        supplierEvals: { low: 'lowRated' },
        risks: { critical: 'critical', stale: 'stale' },
        ncr: { stuck: 'stuck', overdue: 'overdue' },
        complaints: { overdue: 'overdue' },
      };
      return aliases[target]?.[key] || key;
    },

    parseQmsLink(link) {
      if (!link) return null;
      const raw = String(link);
      const m = raw.match(/#\/([^?&#]+)(?:\?([^#]*))?/);
      if (!m) return { page: this.normalizePageId(raw), id: null, params: {} };
      const params = new URLSearchParams(m[2] || '');
      const page = this.normalizePageId(m[1]);
      return {
        page,
        id: params.get('id') || params.get('entityId') || null,
        params: Object.fromEntries(params.entries()),
        filter: this.normalizeLinkFilter(page, params.get('filter') || params.get('quick')),
      };
    },

    initialPageFromHash() {
      const parsed = this.parseQmsLink(window.location.hash || '');
      return parsed?.page || null;
    },

    async gotoInitialOrHome() {
      const parsed = this.parseQmsLink(window.location.hash || '');
      if (parsed?.page) {
        await this.goToResource(parsed.page, parsed.id);
        return;
      }
      await this.goto(this.homePageForRole());
    },

    async goToLink(link) {
      const parsed = this.parseQmsLink(link);
      if (!parsed?.page) return;
      await this.goToResource(parsed.page, parsed.id, parsed);
    },

    async goto(id) {
      id = this.normalizePageId(id);
      this.page = id;
      this.search = '';
      this.filterStatus = '';
      this.filterYear = '';
      this.currentPage = 1;
      this.totalItems = 0;
      // Audit improvement #2 (decision 2): EMPLOYEE يرى دائماً
      // قراءاته/شكاواه/NCRs المسندة إليه — لا قائمة كاملة.
      const role = this.user?.role;
      this.quickFilter = (role === 'EMPLOYEE' && (id === 'complaints' || id === 'ncr'))
        ? 'mine'
        : '';
      if (id === 'dashboard') await this.loadDashboard();
      else if (id === 'audit-log') await this.loadAuditLog();
      else if (id === 'reportBuilder') await this.rbLoadCatalog();
      else if (id === 'iso-readiness') await this.loadIsoReadiness();
      else if (id === 'surveys') await this.loadSurveys();
      else if (id === 'kpiTracking') await this.kpiInit();
      else if (id === 'kpiFollowUp') await this.loadKpiFollowUp();
      else if (id === 'integrationsSettings') await this.loadIntegrationsSettings();
      else if (id === 'myKpi') await this.loadMyKpi();
      else if (id === 'dataHealth') await this.loadDataHealth();
      else if (id === 'operationalReports') await this.loadOperationalReports();
      else if (id === 'slaBoard') await this.loadSlaBoard();
      else if (id === 'myWork') await this.loadMyWork();
      else if (id === 'myAcknowledgments') await this.loadMyAcks();
      else if (id === 'acknowledgmentsMatrix') await this.loadAckMatrix();
      else if (id === 'dataImport') await this.loadDataImportEntities();
      else if (id === 'portalAdmin') await this.loadPortalAdmin();
      else if (id === 'auditorDashboard') await this.loadAuditorDashboard();
      else await this.loadList();
    },

    // ─── Batch 13: My KPI — moved to modules/my-kpi.js (window.QmsMyKpi)

    // ─── Batch 13: Data Health Report ─────────────────────────────────
    dataHealth: null,     // { generatedAt, summary, checks[] }
    dataHealthExpanded: {},  // { [checkKey]: true }

    async loadDataHealth() {
      try {
        const r = await this.api('GET', '/data-health');
        this.dataHealth = r;
      } catch (e) {
        this.dataHealth = null;
        alert(e.message || 'فشل تحميل تقرير صحة البيانات');
      }
    },
    toggleHealthCheck(key) {
      this.dataHealthExpanded = { ...this.dataHealthExpanded, [key]: !this.dataHealthExpanded[key] };
    },
    healthSeverityClass(sev) {
      return { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', WARNING: 'bg-amber-500', INFO: 'bg-gray-400' }[sev] || 'bg-gray-400';
    },
    healthSeverityLabel(sev) {
      return { CRITICAL: 'حرج', HIGH: 'مرتفع', WARNING: 'تحذير', INFO: 'ملاحظة' }[sev] || sev;
    },

    // ════════════════════════════════════════════════════════════════
    // KPI FOLLOW-UP SYSTEM — نظام متابعة الإدخالات المتأخرة الشامل
    // ════════════════════════════════════════════════════════════════

    // ─── State ──────────────────────────────────────────────────────
    kpiFollowUpList: [],
    kpiFollowUpStats: null,
    kpiFollowUpTrends: null,
    kpiFollowUpLoading: false,
    kpiFollowUpDetection: false,

    // الفلاتر
    kpiFollowUpFilters: {
      year: '',
      month: '',
      status: '',
      departmentId: '',
      escalationLevel: '',
      search: '',
    },

    // Modals
    kpiFollowUpEscalateModal: null,   // { followUp, level, notes, busy }
    kpiFollowUpResolveModal:  null,   // { followUp, notes, busy }
    kpiFollowUpAbortModal:    null,   // { followUp, notes, busy }
    kpiFollowUpDetailModal:   null,   // { followUp, timeline, busy }

    // مساعدة: لائحة الأقسام (تُحمَّل مرة واحدة)
    kpiFollowUpDepts: [],

    // ─── Loading ────────────────────────────────────────────────────
    async loadKpiFollowUp() {
      try {
        this.kpiFollowUpLoading = true;

        // فلاتر القائمة الكاملة (تشمل status و sortBy)
        const listParams = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) listParams.append(k, v);
        });
        listParams.append('limit', '500');

        // فلاتر الإحصائيات والاتجاهات (نفس الفلاتر، عدا status — لأن الإحصائيات تعرض توزيع الحالات)
        const statsParams = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (k === 'status') return;
          if (v !== '' && v !== null && v !== undefined) statsParams.append(k, v);
        });

        const [list, stats, trends] = await Promise.all([
          this.api('GET', `/kpi-followups?${listParams.toString()}`),
          this.api('GET', `/kpi-followups/stats/summary?${statsParams.toString()}`),
          this.api('GET', `/kpi-followups/stats/trends?${statsParams.toString()}`).catch(() => null),
        ]);
        this.kpiFollowUpList   = list?.data || [];
        this.kpiFollowUpStats  = stats || null;
        this.kpiFollowUpTrends = trends?.trends || null;

        // تحميل الأقسام إن لم تكن محمّلة
        if (!this.kpiFollowUpDepts.length) {
          try {
            const r = await this.api('GET', '/departments');
            this.kpiFollowUpDepts = r?.data || r || [];
          } catch {}
        }

        // رسم الـ trends chart بعد تحديث الـ DOM
        this.$nextTick?.(() => this.renderKpiFollowUpChart());
      } catch (e) {
        this.toast?.(e.message || 'فشل تحميل سجل المتابعة', 'error') || alert(e.message);
        this.kpiFollowUpList = [];
        this.kpiFollowUpStats = null;
      } finally {
        this.kpiFollowUpLoading = false;
      }
    },

    // ─── إعادة تحميل عند تغيير الفلتر ───────────────────────────────
    async applyKpiFollowUpFilters() {
      await this.loadKpiFollowUp();
    },

    resetKpiFollowUpFilters() {
      this.kpiFollowUpFilters = {
        year: '', month: '', status: '', departmentId: '', escalationLevel: '', search: '',
      };
      this.loadKpiFollowUp();
    },

    // ─── تشغيل الفحص يدوياً ─────────────────────────────────────────
    async runKpiFollowUpDetection() {
      if (!confirm('سيتم فحص جميع المؤشرات الشهرية وتحديث المتأخرات. هل تريد المتابعة؟')) return;
      try {
        this.kpiFollowUpDetection = true;
        const r = await this.api('POST', '/kpi-followups/run-detection', {});
        const s = r?.stats || {};
        const lines = [
          `✓ تم الفحص:`,
          `• مؤشرات مفحوصة: ${s.indicatorsChecked || 0}`,
          `• فترات مفحوصة: ${s.periodsChecked || 0}`,
          ``,
          `📋 النتائج:`,
          `• جديد: ${s.created || 0}`,
          `• مُحدَّث: ${s.updated || 0}`,
          `• مُحلّ: ${s.resolved || 0}`,
          `• مُغلَق: ${s.aborted || 0}`,
        ];
        if ((s.skippedNoDept || 0) + (s.skippedNoUser || 0) > 0) {
          lines.push('');
          lines.push('⚠️ مؤشرات تم تخطيها:');
          if (s.skippedNoDept > 0) lines.push(`• بلا قسم محدد: ${s.skippedNoDept}`);
          if (s.skippedNoUser > 0) lines.push(`• بلا مدخل بيانات: ${s.skippedNoUser}`);
          lines.push('');
          lines.push('💡 لتظهر هذه المؤشرات: تأكد أن لكل مؤشر مالك أو مدخل بيانات أو ربطه بهدف.');
        }
        alert(lines.join('\n'));
        await this.loadKpiFollowUp();
      } catch (e) {
        alert(e.message || 'فشل تشغيل الفحص');
      } finally {
        this.kpiFollowUpDetection = false;
      }
    },

    // ─── تصدير CSV ──────────────────────────────────────────────────
    async exportKpiFollowUp() {
      try {
        const params = new URLSearchParams();
        Object.entries(this.kpiFollowUpFilters).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) params.append(k, v);
        });
        const url = `/api/kpi-followups/export/csv?${params.toString()}`;
        // نفتح الرابط مع التوكن في header — لا يمكن مع <a download>
        // نحمّل الملف عبر fetch ونحفظه
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل التصدير');
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `kpi-followups-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (e) {
        alert(e.message || 'فشل التصدير');
      }
    },

    // ─── Modal: التصعيد ─────────────────────────────────────────────
    openKpiFollowUpEscalate(followUp) {
      const nextLevel = (followUp.escalationLevel || 0) >= 2 ? 2 : (followUp.escalationLevel || 0) + 1;
      this.kpiFollowUpEscalateModal = {
        followUp,
        level: nextLevel,
        notes: '',
        busy: false,
      };
    },
    closeKpiFollowUpEscalate() { this.kpiFollowUpEscalateModal = null; },

    async submitKpiFollowUpEscalate() {
      const m = this.kpiFollowUpEscalateModal;
      if (!m) return;
      if (!m.notes || m.notes.trim().length < 5) {
        alert('يرجى كتابة سبب التصعيد (5 أحرف على الأقل)');
        return;
      }
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/escalate`, {
          escalationLevel: m.level,
          notes: m.notes.trim(),
        });
        this.closeKpiFollowUpEscalate();
        await this.loadKpiFollowUp();
        this.toast?.('تم التصعيد بنجاح', 'success');
      } catch (e) {
        alert(e.message || 'فشل التصعيد');
      } finally {
        if (this.kpiFollowUpEscalateModal) this.kpiFollowUpEscalateModal.busy = false;
      }
    },

    // ─── Modal: الحل ────────────────────────────────────────────────
    openKpiFollowUpResolve(followUp) {
      this.kpiFollowUpResolveModal = { followUp, notes: '', busy: false };
    },
    closeKpiFollowUpResolve() { this.kpiFollowUpResolveModal = null; },

    async submitKpiFollowUpResolve() {
      const m = this.kpiFollowUpResolveModal;
      if (!m) return;
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/resolve`, {
          notes: m.notes?.trim() || '',
        });
        this.closeKpiFollowUpResolve();
        await this.loadKpiFollowUp();
        this.toast?.('تم الحل بنجاح', 'success');
      } catch (e) {
        alert(e.message || 'فشل الحل');
      } finally {
        if (this.kpiFollowUpResolveModal) this.kpiFollowUpResolveModal.busy = false;
      }
    },

    // ─── Modal: الإغلاق النهائي ─────────────────────────────────────
    openKpiFollowUpAbort(followUp) {
      this.kpiFollowUpAbortModal = { followUp, notes: '', busy: false };
    },
    closeKpiFollowUpAbort() { this.kpiFollowUpAbortModal = null; },

    async submitKpiFollowUpAbort() {
      const m = this.kpiFollowUpAbortModal;
      if (!m) return;
      if (!m.notes || m.notes.trim().length < 10) {
        alert('الإغلاق النهائي يتطلب سبب مفصّل (10 أحرف على الأقل)');
        return;
      }
      try {
        m.busy = true;
        await this.api('POST', `/kpi-followups/${m.followUp.id}/abort`, {
          notes: m.notes.trim(),
        });
        this.closeKpiFollowUpAbort();
        await this.loadKpiFollowUp();
        this.toast?.('تم الإغلاق', 'success');
      } catch (e) {
        alert(e.message || 'فشل الإغلاق');
      } finally {
        if (this.kpiFollowUpAbortModal) this.kpiFollowUpAbortModal.busy = false;
      }
    },

    // ─── Modal: التفاصيل + Timeline ─────────────────────────────────
    async openKpiFollowUpDetail(followUp) {
      this.kpiFollowUpDetailModal = { followUp, timeline: null, busy: true };
      try {
        const [full, tl] = await Promise.all([
          this.api('GET', `/kpi-followups/${followUp.id}`),
          this.api('GET', `/kpi-followups/${followUp.id}/timeline`),
        ]);
        this.kpiFollowUpDetailModal = { followUp: full, timeline: tl?.events || [], busy: false };
      } catch (e) {
        alert(e.message || 'فشل تحميل التفاصيل');
        this.kpiFollowUpDetailModal = null;
      }
    },
    closeKpiFollowUpDetail() { this.kpiFollowUpDetailModal = null; },

    // ─── Helpers — UI ────────────────────────────────────────────────
    kpiFollowUpStatusLabel(s) {
      return ({
        PENDING:      'قيد الانتظار',
        FIRST_NOTICE: 'إشعار أول',
        ESCALATED:    'مُصعَّد',
        RESOLVED:     'تم الحل',
        ABORTED:      'مُغلَق',
      })[s] || s;
    },
    kpiFollowUpStatusClass(s) {
      return ({
        PENDING:      'bg-yellow-100 text-yellow-800',
        FIRST_NOTICE: 'bg-amber-100 text-amber-800',
        ESCALATED:    'bg-orange-100 text-orange-800',
        RESOLVED:     'bg-green-100 text-green-800',
        ABORTED:      'bg-gray-200 text-gray-700',
      })[s] || 'bg-gray-100 text-gray-700';
    },
    kpiFollowUpEscalationLabel(level) {
      return ({ 0: 'لا يوجد', 1: 'مدير القسم', 2: 'الإدارة العليا' })[level] || '—';
    },

    // ─── Integration: Create CAPA from follow-up ────────────────────
    async createCapaFromFollowUp(followUp) {
      const rootCause = prompt('السبب الجذري للتأخر (RCA):', '');
      if (rootCause === null) return;
      const plannedAction = prompt('الإجراء المُخطّط:', '');
      if (plannedAction === null) return;
      try {
        const r = await this.api('POST', `/kpi-followups/${followUp.id}/create-capa`, {
          rootCause: rootCause.trim(),
          plannedAction: plannedAction.trim(),
        });
        alert(`✓ تم فتح إجراء تصحيحي: ${r.capa?.code}`);
        await this.loadKpiFollowUp();
        if (this.kpiFollowUpDetailModal) this.closeKpiFollowUpDetail();
      } catch (e) {
        alert(e.message || 'فشل فتح الإجراء التصحيحي');
      }
    },

    // ─── ISO 9001 Compliance Report ─────────────────────────────────
    kpiFollowUpIsoReport: null,
    async loadKpiFollowUpIsoReport() {
      try {
        const year = this.kpiFollowUpFilters.year || new Date().getFullYear();
        const r = await this.api('GET', `/kpi-followups/reports/iso-compliance?year=${year}`);
        this.kpiFollowUpIsoReport = r;
      } catch (e) {
        alert(e.message || 'فشل تحميل تقرير الامتثال');
      }
    },
    closeKpiFollowUpIsoReport() { this.kpiFollowUpIsoReport = null; },

    kpiFollowUpComplianceClass(level) {
      return ({
        EXCELLENT:          'bg-green-100 text-green-800 border-green-300',
        GOOD:               'bg-blue-100 text-blue-800 border-blue-300',
        NEEDS_IMPROVEMENT:  'bg-amber-100 text-amber-800 border-amber-300',
        CRITICAL:           'bg-red-100 text-red-800 border-red-300',
      })[level] || 'bg-gray-100 text-gray-800';
    },
    kpiFollowUpComplianceLabel(level) {
      return ({
        EXCELLENT:         '✨ ممتاز',
        GOOD:              '👍 جيد',
        NEEDS_IMPROVEMENT: '⚠️ يحتاج تحسين',
        CRITICAL:          '🚨 حرج',
      })[level] || level;
    },

    // ════════════════════════════════════════════════════════════════
    // INTEGRATIONS & NOTIFICATIONS SETTINGS
    // ════════════════════════════════════════════════════════════════

    integrationsTab: 'providers', // providers | templates | log
    integrationsLoading: false,

    // n8n config (state)
    integrationN8n: null,        // { url, secret(masked), enabled, connectionStatus, lastTest, lastSuccess, lastFailure, stats }
    integrationN8nForm: null,    // { url, secret, enabled, busy, error, testResult }

    // templates state
    notificationTemplates: [],
    notificationTemplateModal: null,  // { tpl, busy, error, preview }

    // delivery log state
    deliveryLogItems: [],
    deliveryLogStats: null,
    deliveryLogFilter: { status: '', event: '' },

    // مزودات قادمة (للعرض فقط — UI placeholders)
    integrationProvidersFuture: [
      { id: 'sms',    name: 'SMS Gateway',     icon: '📱', desc: 'إرسال رسائل SMS عبر مزود محلي' },
      { id: 'whatsapp', name: 'WhatsApp Business', icon: '💬', desc: 'WhatsApp Business API مباشرة' },
      { id: 'email',  name: 'Email SMTP',       icon: '📧', desc: 'إرسال البريد الإلكتروني عبر SMTP' },
      { id: 'teams',  name: 'Microsoft Teams', icon: '👥', desc: 'إشعارات قنوات Teams' },
      { id: 'slack',  name: 'Slack',           icon: '#️⃣', desc: 'إشعارات قنوات Slack' },
    ],

    async loadIntegrationsSettings() {
      try {
        this.integrationsLoading = true;
        const calls = [
          this.api('GET', '/webhook-settings').catch(() => null),
          this.api('GET', '/notification-templates').catch(() => null),
          this.api('GET', '/integrations/deliveries?limit=50').catch(() => null),
          this.api('GET', '/integrations/deliveries/stats').catch(() => null),
        ];
        const [n8n, tpls, log, stats] = await Promise.all(calls);
        this.integrationN8n          = n8n?.item || null;
        this.notificationTemplates   = tpls?.data || [];
        this.deliveryLogItems        = log?.data || [];
        this.deliveryLogStats        = stats || null;
      } catch (e) {
        alert(e.message || 'فشل تحميل إعدادات التكاملات');
      } finally {
        this.integrationsLoading = false;
      }
    },

    // ─── n8n Provider ─────────────────────────────────────────────
    openN8nProviderForm() {
      this.integrationN8nForm = {
        url: this.integrationN8n?.url || '',
        allowedHosts: this.integrationN8n?.allowedHosts || '',
        secret: '', // فارغ = لا تغيير
        enabled: !!this.integrationN8n?.enabled,
        busy: false, error: '', testResult: null,
      };
    },
    closeN8nProviderForm() { this.integrationN8nForm = null; },

    async saveN8nProvider() {
      const f = this.integrationN8nForm;
      if (!f) return;
      try {
        f.busy = true; f.error = '';
        const payload = { url: f.url, allowedHosts: f.allowedHosts, enabled: f.enabled };
        if (f.secret && !f.secret.startsWith('****')) payload.secret = f.secret;
        await this.api('PUT', '/webhook-settings', payload);
        await this.loadIntegrationsSettings();
        this.toast?.('تم الحفظ', 'success');
        this.closeN8nProviderForm();
      } catch (e) {
        f.error = e.message || 'فشل الحفظ';
      } finally {
        if (this.integrationN8nForm) this.integrationN8nForm.busy = false;
      }
    },

    async testN8nConnection() {
      const f = this.integrationN8nForm;
      if (!f) return;
      try {
        f.busy = true; f.testResult = null;
        const r = await this.api('POST', '/webhook-settings/test', {});
        f.testResult = r;
      } catch (e) {
        f.testResult = { ok: false, message: e.message || 'فشل الاختبار' };
      } finally {
        if (this.integrationN8nForm) this.integrationN8nForm.busy = false;
      }
    },

    integrationStatusLabel(s) {
      return ({
        CONNECTED:    'متصل',
        DISABLED:     'غير مفعّل',
        TEST_FAILED:  'فشل آخر اختبار',
        NOT_TESTED:   'لم يُختبَر بعد',
        NO_URL:       'بلا رابط',
      })[s] || s || '—';
    },
    integrationStatusClass(s) {
      return ({
        CONNECTED:    'bg-green-100 text-green-800 border-green-300',
        DISABLED:     'bg-gray-100 text-gray-700 border-gray-300',
        TEST_FAILED:  'bg-red-100 text-red-800 border-red-300',
        NOT_TESTED:   'bg-amber-100 text-amber-800 border-amber-300',
        NO_URL:       'bg-gray-100 text-gray-700 border-gray-300',
      })[s] || 'bg-gray-100 text-gray-700';
    },

    // ─── Notification Templates ──────────────────────────────────
    async openTemplateEditor(eventKey) {
      try {
        const r = await this.api('GET', `/notification-templates/${eventKey}`);
        this.notificationTemplateModal = {
          tpl: { ...r.item },
          busy: false, error: '', preview: null,
        };
      } catch (e) {
        alert(e.message || 'فشل تحميل القالب');
      }
    },
    closeTemplateEditor() { this.notificationTemplateModal = null; },

    async saveTemplate() {
      const m = this.notificationTemplateModal;
      if (!m) return;
      try {
        m.busy = true; m.error = '';
        const t = m.tpl;
        await this.api('PATCH', `/notification-templates/${t.eventKey}`, {
          name: t.name,
          description: t.description,
          subject: t.subject,
          body: t.body,
          channels: t.channels,
          enabled: t.enabled,
        });
        await this.loadIntegrationsSettings();
        this.toast?.('تم حفظ القالب', 'success');
        this.closeTemplateEditor();
      } catch (e) {
        m.error = e.message || 'فشل الحفظ';
      } finally {
        if (this.notificationTemplateModal) this.notificationTemplateModal.busy = false;
      }
    },

    async previewTemplate() {
      const m = this.notificationTemplateModal;
      if (!m) return;
      try {
        m.busy = true;
        const r = await this.api('POST', `/notification-templates/${m.tpl.eventKey}/preview`, {});
        m.preview = r;
      } catch (e) {
        alert(e.message || 'فشل المعاينة');
      } finally {
        if (this.notificationTemplateModal) this.notificationTemplateModal.busy = false;
      }
    },

    toggleTemplateChannel(channel) {
      const m = this.notificationTemplateModal;
      if (!m) return;
      const list = m.tpl.channels.split(',').map(s => s.trim()).filter(Boolean);
      const i = list.indexOf(channel);
      if (i >= 0) list.splice(i, 1);
      else list.push(channel);
      m.tpl.channels = list.join(',');
    },

    isTemplateChannel(channel) {
      const m = this.notificationTemplateModal;
      if (!m) return false;
      return m.tpl.channels.split(',').map(s => s.trim()).includes(channel);
    },

    // ─── Delivery Log ─────────────────────────────────────────────
    async refreshDeliveryLog() {
      try {
        const params = new URLSearchParams();
        if (this.deliveryLogFilter.status) params.append('status', this.deliveryLogFilter.status);
        if (this.deliveryLogFilter.event) params.append('event', this.deliveryLogFilter.event);
        params.append('limit', '50');
        const r = await this.api('GET', `/integrations/deliveries?${params.toString()}`);
        this.deliveryLogItems = r?.data || [];
      } catch (e) {
        alert(e.message || 'فشل تحميل السجل');
      }
    },

    deliveryStatusLabel(s) {
      return ({
        PENDING:    'قيد الانتظار',
        DISPATCHED: 'أُرسلت',
        DELIVERED:  'وُصلت',
        FAILED:     'فشلت',
        SKIPPED:    'تم تخطيها',
      })[s] || s;
    },
    deliveryStatusClass(s) {
      return ({
        PENDING:    'bg-yellow-100 text-yellow-800',
        DISPATCHED: 'bg-blue-100 text-blue-800',
        DELIVERED:  'bg-green-100 text-green-800',
        FAILED:     'bg-red-100 text-red-800',
        SKIPPED:    'bg-gray-100 text-gray-700',
      })[s] || 'bg-gray-100 text-gray-700';
    },

    // ─── Trends Chart ───────────────────────────────────────────────
    _kpiFollowUpChart: null,
    renderKpiFollowUpChart() {
      if (typeof Chart === 'undefined') return;
      const el = document.getElementById('kpiFollowUpTrendsChart');
      if (!el || !this.kpiFollowUpTrends?.length) return;

      if (this._kpiFollowUpChart) {
        try { this._kpiFollowUpChart.destroy(); } catch {}
      }
      const t = this.kpiFollowUpTrends;
      this._kpiFollowUpChart = new Chart(el, {
        type: 'bar',
        data: {
          labels: t.map(x => x.label),
          datasets: [
            { label: 'محلولة', data: t.map(x => x.resolved), backgroundColor: '#10b981', stack: 's1' },
            { label: 'قيد الانتظار', data: t.map(x => x.pending), backgroundColor: '#fbbf24', stack: 's1' },
            { label: 'مُصعَّدة', data: t.map(x => x.escalated), backgroundColor: '#f97316', stack: 's1' },
            { label: 'مُغلقة', data: t.map(x => x.aborted), backgroundColor: '#6b7280', stack: 's1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    },

    // UX-2 Wizard — moved to modules/wizard.js (window.QmsWizard)

    // UX-4 DetailShell — moved to modules/detail-shell.js (window.QmsDetailShell)
    // Batch 15 Beneficiary — moved to modules/beneficiary.js (window.QmsBeneficiary)

    // Batch 15 Beneficiary — moved to modules/beneficiary.js (window.QmsBeneficiary)

    // ─── Batch 16: My Work (unified action inbox) ─────────────────────
    myWork: null,
    async loadMyWork() {
      try {
        const r = await this.api('GET', '/my-work');
        this.myWork = r;
        // تحميل مؤشرات "مطلوب إدخالها" جنباً إلى جنب — بلا تعطيل تحميل myWork
        this.loadMyDueKpis?.().catch(() => {});
      } catch (e) {
        this.myWork = null;
        alert(e.message || 'فشل تحميل مهامي');
      }
    },

    // ─── Inline Quick KPI Entry — استُخرجت إلى modules/kpi-quickentry.js ─
    // (myDue, _kpiDraft, loadMyDueKpis, _draftFor, quickSaveKpi,
    //  _peekParentProgress, _armUndoCountdown, undoRemainingSec, canUndo,
    //  undoLastKpi) — تُدمج عبر ...window.QmsKpiQuickEntry قبل return.


    // ─── Inbox mode — استُخرجت إلى modules/inbox.js ──
    // (_inboxBusy, inboxBusy, _inboxCall, inboxSubmit, inboxReview,
    //  inboxApprove, inboxReject, canInbox) — تُدمج عبر ...window.QmsInbox
    async goToResource(page, id, options = {}) {
      const target = this.normalizePageId(page);
      const quick = this.normalizeLinkFilter(target, options.filter || options.quick || options?.params?.filter || options?.params?.quick);
      this.quickFilter = '';
      this.filterStatus = '';
      await this.goto(target);
      if (quick && this.currentModule) {
        this.quickFilter = quick;
        await this.loadList(1);
      }
      if (target === 'progressReports' && id && typeof this.progOpenReportDetail === 'function') {
        await this.progOpenReportDetail(id);
        return;
      }
      if (target === 'kpiFollowUp' && id && typeof this.openKpiFollowUpDetail === 'function') {
        await this.openKpiFollowUpDetail({ id });
        return;
      }
      if (id && typeof this.openDetail === 'function') {
        const entityType = this.pageEntityType(target);
        if (entityType) await this.openDetail(entityType, id);
      }
    },
    toggleQuickFilter(key) {
      this.quickFilter = this.quickFilter === key ? '' : key;
      this.loadList(1);
    },
    severityBadgeClass(sev) {
      const s = String(sev || '');
      if (s === 'مرتفعة' || /high|critical/i.test(s)) return 'bg-red-100 text-red-700 border border-red-300';
      if (s === 'منخفضة' || /low/i.test(s)) return 'bg-gray-100 text-gray-700 border border-gray-300';
      return 'bg-amber-100 text-amber-700 border border-amber-300';
    },

    async loadBeneficiariesDueReview() {
      try {
        const r = await this.api('GET', '/beneficiaries/due-review');
        return r;
      } catch { return null; }
    },

    async loadIsoReadiness() {
      try {
        const r = await this.api('GET', '/iso-readiness');
        this.isoReport = r;
      } catch (e) {
        this.isoReport = null;
        alert(e.message || 'فشل تحميل تقرير الجاهزية');
      }
    },

    // ─── Print Reports (C2) ───────────────────────────────────────────
    printReport(item) {
      let url = '';
      if (this.page === 'managementReview') url = `/api/reports/management-review/${item.id}`;
      else if (this.page === 'ncr')         url = `/api/reports/ncr/${item.id}`;
      else if (this.page === 'suppliers')   url = `/api/reports/supplier/${item.id}/latest-eval`;
      if (url) window.open(url, '_blank');
    },

    // C3: GAAFZA annual report
    openGaafzaReport() {
      const year = prompt('أدخل السنة الميلادية للتقرير:', new Date().getFullYear());
      if (!year) return;
      window.open(`/api/reports/gaafza?year=${year}`, '_blank');
    },

    // فتح تقرير في نافذة جديدة
    openReport(url) {
      window.open(url, '_blank');
    },

    // ═══ KPI TRACKING — moved to modules/kpi-tracking.js (window.QmsKpiTracking)

    // ─── Quality Policy activation ─────────────────────────────────────
    async activatePolicy(item) {
      if (!confirm(`تفعيل سياسة الجودة إصدار ${item.version}؟\nسيتم إيقاف الإصدارات السابقة تلقائياً.`)) return;
      try {
        await this.api('POST', `/quality-policy/${item.id}/activate`);
        alert('✅ تم تفعيل السياسة');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    // Surveys — moved to modules/surveys.js (window.QmsSurveys)

    async loadRelations() {
      if (!this.currentFields) return;
      const needed = new Set();
      for (const f of this.currentFields) {
        if (f.type === 'relation' && f.relation) needed.add(f.relation);
      }
      const endpoints = {
        axes:            '/axes?quick=active&limit=100', // المحاور النشطة فقط (لها أهداف) — AXIS-01..04
        strategicGoals:  '/strategic-goals?limit=200',
        strategicPlans:  '/strategic-plans?limit=20',
        objectives:      '/objectives?limit=200',
        indicators:      '/indicators?limit=200',
        fundingSources:  '/funding-sources?limit=100',
        departments:     '/departments?limit=100',
        users:           '/users?limit=100',
        risks:           '/risks?limit=200',
        processes:       '/processes?limit=100',
        beneficiaries:   '/beneficiaries?limit=100',
      };
      for (const rel of needed) {
        try {
          const r = await this.api('GET', endpoints[rel]);
          this.relationOptions[rel] = r.items || [];
        } catch {}
      }
    },

    // ------ data loading ------
    get currentModule() { return MODULES[this.page]; },
    get currentCols()   { return this.currentModule?.cols || []; },
    get currentFields() { return this.currentModule?.fields || []; },
    get totalPages()    { return Math.max(1, Math.ceil(this.totalItems / this.perPage)); },

    async loadList(page = null) {
      if (!this.currentModule) return;
      if (page !== null) this.currentPage = page;
      this.items = [];          // UI-BSC-001: تنظيف فوري — لا بيانات قديمة تظهر عند الانتقال
      this.totalItems = 0;
      const params = new URLSearchParams();
      params.set('page', this.currentPage);
      params.set('limit', this.perPage);
      if (this.search)       params.set('q', this.search);
      if (this.filterStatus) params.set('filter[status]', this.filterStatus);
      if (this.filterYear)   params.set('filter[year]', this.filterYear);
      if (this.quickFilter)  params.set('quick', this.quickFilter);
      if (this.showDeleted && this.canViewDeleted) params.set('onlyDeleted', '1');
      try {
        const r = await this.api('GET', `/${this.currentModule.endpoint}?${params}`);
        this.items = r.items || [];
        this.totalItems = r.total || 0;
      } catch (e) {
        this.items = [];
        this.totalItems = 0;
        console.error('[loadList]', this.currentModule.endpoint, e.message);
      }
    },

    async prevPage() {
      if (this.currentPage > 1) await this.loadList(this.currentPage - 1);
    },
    async nextPage() {
      if (this.currentPage < this.totalPages) await this.loadList(this.currentPage + 1);
    },

    async loadDashboard() {
      const r = await this.api('GET', '/dashboard');
      this.dashKpis       = r.kpis;
      this.dashAlerts     = r.alerts || [];
      this.dashExpiring   = r.expiringDocs || [];
      this.dashActivity   = r.recentActivity || [];
      this.dashNextReview = r.nextReview || null;
      this.loadSidebarBadges();
      this.loadLiveAlerts();   // لقطة حيّة ISO 9.1.3
      this.$nextTick(() => this.renderChart());
    },

    async loadAuditLog() {
      const qs = this.buildAuditQS({ includePaging: true });
      const r = await this.api('GET', `/audit-log?${qs}`);
      this.auditLog  = r.items || [];
      this.auditTotal = r.total || 0;
      this.auditPages = r.pages || 1;
      this.auditPage  = r.page  || 1;
    },

    buildAuditQS({ includePaging = false } = {}) {
      const f = this.auditFilters || {};
      const p = new URLSearchParams();
      if (f.entityType) p.set('entityType', f.entityType);
      if (f.action)     p.set('action', f.action);
      if (f.from)       p.set('from', new Date(f.from).toISOString());
      if (f.to) {
        // تضمين يوم كامل حتى نهايته
        const to = new Date(f.to); to.setHours(23, 59, 59, 999);
        p.set('to', to.toISOString());
      }
      if (includePaging) {
        p.set('page',  String(this.auditPage  || 1));
        p.set('limit', String(this.auditLimit || 100));
      }
      return p.toString();
    },

    resetAuditFilters() {
      this.auditFilters = { entityType: '', action: '', from: '', to: '' };
      this.auditPage = 1;
      this.loadAuditLog();
    },

    // Report Builder — moved to modules/report-builder.js (window.QmsReportBuilder)

    async exportAuditLog() {
      const qs = this.buildAuditQS({ includePaging: false });
      try {
        const res = await fetch(`${API}/audit-log/export?${qs}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل تصدير السجل');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
        const capped = res.headers.get('X-Export-Capped') === '1';
        const count  = res.headers.get('X-Export-Count') || '?';
        this.toast(capped
          ? `تم تصدير ${count} سجل (السقف 10,000 — حدِّد فلاتر أدق)`
          : `تم تصدير ${count} سجل`, capped ? 'warning' : 'success');
      } catch (e) {
        this.toast(e.message || 'فشل التصدير', 'error');
      }
    },

    get dashCards() {
      const k = this.dashKpis;
      if (!k) return [];
      return [
        { label: 'الأهداف المحققة',  value: `${k.objectives.achievementRate}%`, sub: `${k.objectives.achieved} من ${k.objectives.total}`, icon: '🎯', bg: 'bg-green-50',  border: 'border-green-200',  val: 'text-green-700' },
        { label: 'مخاطر حرجة',       value: k.risks.byCriticality?.حرج || 0,   sub: `${k.risks.totalActive} مخاطرة نشطة`,              icon: '⚠️', bg: 'bg-red-50',    border: 'border-red-200',    val: 'text-red-700' },
        { label: 'شكاوى مفتوحة',     value: k.complaints.open,                  sub: `${k.complaints.overdue} متأخرة — معالجة ${k.complaints.resolutionRate}%`, icon: '📢', bg: 'bg-orange-50', border: 'border-orange-200', val: k.complaints.overdue > 0 ? 'text-red-600' : 'text-orange-700' },
        { label: 'عدم مطابقة (NCR)', value: k.ncr.open,                         sub: `${k.ncr.overdue} متأخر — مغلق: ${k.ncr.closed}`,  icon: '🔧', bg: 'bg-amber-50',  border: 'border-amber-200',  val: k.ncr.overdue > 0 ? 'text-red-600' : 'text-amber-700' },
        { label: 'موردون معتمدون',   value: k.suppliers.approved,               sub: `${k.suppliers.pending} بانتظار الاعتماد`,          icon: '🏭', bg: 'bg-indigo-50', border: 'border-indigo-200', val: 'text-indigo-700' },
        { label: 'وثائق منشورة',     value: k.documents.published,              sub: `${k.documents.expiringCount} تستحق مراجعة قريباً`, icon: '📄', bg: 'bg-blue-50',   border: 'border-blue-200',   val: 'text-blue-700' },
        { label: 'مستفيدون نشطون',   value: k.beneficiaries.active,             sub: '',                                                 icon: '👥', bg: 'bg-teal-50',   border: 'border-teal-200',   val: 'text-teal-700' },
        { label: 'رضا المستفيدين',   value: k.surveys.avgScore ? `${k.surveys.avgScore}/5` : '—', sub: `${k.surveys.totalResponses} استجابة`, icon: '📝', bg: 'bg-purple-50', border: 'border-purple-200', val: 'text-purple-700' },
      ];
    },

    activityLabel(action) {
      const map = {
        CREATE: 'أضاف', UPDATE: 'عدّل', DELETE: 'حذف',
        LOGIN: 'سجّل دخولاً', LOGOUT: 'خرج',
        ACTIVATE_POLICY: 'فعّل سياسة',
        VERIFY_NCR_EFFECTIVENESS: 'تحقق من فعالية NCR',
        EXPORT: 'صدّر',
      };
      return map[action] || action;
    },

    renderChart() {
      // تم استبدال المخطط الدائري بأشرطة أفقية HTML/CSS نظيفة في الـ index.html — لا حاجة لـ Chart.js هنا.
      if (this.dashChart) { try { this.dashChart.destroy(); } catch {} this.dashChart = null; }
    },

    // ------ Export ------
    async exportExcel() {
      if (!this.currentModule?.exportable) return;
      try {
        const res = await fetch(`${API}/exports/${this.page}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) { alert('فشل التصدير'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.page}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert(e.message || 'فشل التصدير');
      }
    },

    // ------ Duplicate ──────────────────────────────────────────────
    async duplicateItem(item) {
      await this.loadRelations();
      const copy = { ...item };
      // حذف الحقول التي تتولد تلقائياً أو تعود للصفر
      const STRIP = ['id', 'code', 'createdAt', 'updatedAt', 'spent', 'progress',
                     'effective', 'verifiedAt', 'verifiedNote', 'resolvedAt',
                     'closedAt', 'overallRating'];
      for (const k of STRIP) delete copy[k];
      // إعادة الحالة للبداية
      if ('status' in copy) {
        const firstOpt = this.currentModule?.statusOptions?.find(o => o.v);
        copy.status = firstOpt?.v || 'PLANNED';
      }
      // تحويل التواريخ للتنسيق الصحيح
      for (const f of this.currentFields) {
        if (f.type === 'date' && copy[f.key]) copy[f.key] = copy[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'create', data: copy, saving: false };
      this.toast('تم نسخ السجل — راجع البيانات قبل الحفظ', 'warn');
    },

    // ------ CRUD ------
    async openCreate() {
      if (!this.currentModule) {
        // صفحة بلا CRUD (myWork / dashboard / ...) — لا يوجد سجل قابل للإضافة هنا
        this.toast?.('هذه الصفحة ليست قائمة سجلات. افتح قسماً من القائمة الجانبية لإضافة سجل.');
        return;
      }
      await this.loadRelations();
      this.modal = { open: true, mode: 'create', data: {}, saving: false };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    async openEdit(item) {
      await this.loadRelations();
      const data = { ...item };
      for (const f of this.currentFields) {
        if (f.type === 'date' && data[f.key]) data[f.key] = data[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'edit', data, saving: false };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    // Batch 11 — خريطة الانتقالات النهائية التي تتطلب توقيعاً رقمياً (ISO §7.1.5.2 / §9.3.3 / §10.2)
    _terminalSigMap: {
      ncr:              { entityType: 'NCR',              status: 'CLOSED',    purpose: 'close',    label: 'إغلاق عدم المطابقة' },
      complaints:       { entityType: 'Complaint',        status: 'CLOSED',    purpose: 'close',    label: 'إغلاق الشكوى' },
      audits:           { entityType: 'Audit',            status: 'COMPLETED', purpose: 'complete', label: 'إكمال التدقيق الداخلي' },
      managementReview: { entityType: 'ManagementReview', status: 'COMPLETED', purpose: 'complete', label: 'اعتماد مخرجات المراجعة الإدارية' },
    },

    async save() {
      const mod = this.currentModule;
      if (!mod) {
        this.modal.open = false;
        alert('لا يمكن الحفظ من هذه الصفحة — افتح قسم السجلات المناسب من القائمة الجانبية');
        return;
      }
      const payload = { ...this.modal.data };

      // ── Batch 11 — حارس التوقيع على الانتقالات النهائية ─────────────
      // إذا كانت الصفحة تتطلب توقيعاً عند بلوغ حالة معينة ولم تكن الحالة الأصلية هكذا،
      // افتح مودال التوقيع أولاً، ثم أكمل الحفظ بعد إتمامه.
      const sigCfg = this._terminalSigMap[this.page];
      if (sigCfg && this.modal.mode === 'edit' && payload.status === sigCfg.status) {
        let originalStatus = null;
        try { originalStatus = JSON.parse(this._modalInitialSnapshot || '{}').status || null; } catch {}
        if (originalStatus && originalStatus !== sigCfg.status) {
          // خزّن الحمولة وافتح مودال التوقيع
          const pendingSave = async () => {
            try {
              // Management review completion uses dedicated atomic endpoint (ISO 9.3.3)
              if (this.page === 'managementReview' && sigCfg.status === 'COMPLETED') {
                await this.api('POST', `/${mod.endpoint}/${payload.id}/complete`, payload);
              } else {
                await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
              }
              this.modal.open = false;
              this._modalInitialSnapshot = null;
              this.toast('✅ تم حفظ التعديلات بعد التوقيع', 'success');
              await this.loadList();
            } catch (e) { alert(e.message || 'فشل الحفظ بعد التوقيع'); }
          };
          this.openSignatureModal({
            entityType: sigCfg.entityType,
            entityId:   payload.id,
            purpose:    sigCfg.purpose,
            label:      sigCfg.label,
            onDone:     pendingSave,
          });
          return; // الحفظ سيكمَل في onDone
        }
      }

      for (const f of this.currentFields) {
        if (f.type === 'number' && payload[f.key] != null && payload[f.key] !== '') {
          let n = Number(payload[f.key]);
          if (!Number.isFinite(n)) { alert(`"${f.label}" يجب أن يكون رقماً`); return; }
          // clamp داخل min/max إن وُجدت
          if (f.min != null && n < f.min) n = f.min;
          if (f.max != null && n > f.max) n = f.max;
          payload[f.key] = n;
        }
        if (f.type === 'date' && payload[f.key]) {
          const d = new Date(payload[f.key]);
          if (f.maxToday) {
            const today = new Date(); today.setHours(23,59,59,999);
            if (d > today) { alert(`"${f.label}" لا يمكن أن يكون في المستقبل`); return; }
          }
          payload[f.key] = d.toISOString();
        }
        // multiselect: اضمن أنّها مصفوفة (حتى لو كانت undefined)
        if (f.type === 'multiselect') {
          if (!Array.isArray(payload[f.key])) payload[f.key] = [];
        } else if (payload[f.key] === '') {
          // Convert empty relation/select/date/number to null so Prisma accepts
          payload[f.key] = null;
        }
      }
      this.modal.saving = true;
      try {
        if (this.modal.mode === 'edit') {
          await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
        } else {
          // FE-001: createEndpoint allows a module to POST to a different URL than the list endpoint
          // (e.g. plan-versions: list = /plan-versions, create = /plan-versions/snapshot)
          const createEp = mod.createEndpoint || mod.endpoint;
          await this.api('POST', `/${createEp}`, payload);
        }
        this.modal.open = false;
        this._modalInitialSnapshot = null;
        this.toast(this.modal.mode === 'edit' ? '✅ تم حفظ التعديلات' : '✅ تم إضافة السجل بنجاح', 'success');
        await this.loadList();
        // إذا كان السجل المحفوظ خطة استراتيجية → حدّث cache الـ planYears تلقائياً
        if (mod.endpoint === 'strategic-plans') {
          await this.refreshStrategicPlansCache();
        }
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
      finally { this.modal.saving = false; }
    },
    async remove(id) {
      if (!confirm('هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${id}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    // External Eval Link + Supplier Evaluation — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // Supplier Eval methods — moved to modules/supplier-eval.js (window.QmsSupplierEval)

    // ------ Digital Signature (delegates to unified Batch 10 modal) ------
    openSig(item) {
      const typeMap = {
        ncr: 'NCR',
        audits: 'Audit',
        'supplier-evals': 'SupplierEval',
        managementReview: 'ManagementReview',
        documents: 'Document',
      };
      const entityType = typeMap[this.page] || this.page;
      this.openSignatureModal({
        entityType,
        entityId: item.id,
        purpose: 'approve',
        label: 'اعتماد السجل',
        onDone: () => { this.toast?.('✅ تم حفظ التوقيع'); this.loadList?.(); },
      });
    },

    // ------ rendering helpers ------
    renderCell(item, col) {
      // support format function for computed/combined display (e.g. code + ' — ' + title)
      if (typeof col.format === 'function') {
        const formatted = col.format(item);
        return (formatted == null || formatted === '')
          ? '<span class="text-gray-300">—</span>'
          : this.escape(String(formatted));
      }
      // support dot-notation keys like "indicator.nameAr"
      let v = col.key.includes('.')
        ? col.key.split('.').reduce((o, k) => (o != null ? o[k] : undefined), item)
        : item[col.key];
      if (v === null || v === undefined || v === '') return '<span class="text-gray-300">—</span>';
      if (col.type === 'date')   v = this.fmtDate(v);
      if (col.type === 'bool')   return v ? '<span class="text-green-600">✓</span>' : '<span class="text-gray-400">✗</span>';
      if (col.type === 'status') return `<span class="px-2 py-0.5 rounded text-xs ${this.statusColor(v)}">${this.escape(this.statusLabel(v))}</span>`;
      if (col.type === 'level')  return `<span class="px-2 py-0.5 rounded text-xs ${this.levelColor(v)}">${this.escape(String(v))}</span>`;
      if (col.map && col.map[v] !== undefined) return this.escape(col.map[v]);
      return this.escape(String(v));
    },
    escape(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
    // ─── Formatters موحّدة ─────────────────────────────────────
    // نستخدم تقويم جريجوري (gregory) مع لغة ar-SA — الهجري يُربك المُدقّق الخارجي.
    fmtDate(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleDateString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch { return String(v); }
    },
    fmtDateTime(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(v); }
    },
    fmtNumber(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtCurrency(v) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtPercent(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v) + '%'; }
    },
    today() { return new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },

    statusLabel(v) {
      const map = {
        PLANNED:'مخطط', IN_PROGRESS:'قيد التنفيذ', ACHIEVED:'محقق', DELAYED:'متأخر', CANCELLED:'ملغى', COMPLETED:'مكتمل',
        IDENTIFIED:'محدد', UNDER_TREATMENT:'قيد المعالجة', MITIGATED:'خُفف', ACCEPTED:'مقبول', CLOSED:'مغلق',
        NEW:'جديد', UNDER_REVIEW:'قيد الدراسة', RESOLVED:'تم حله', REJECTED:'مرفوض',
        OPEN:'مفتوح', ROOT_CAUSE:'تحليل السبب', ACTION_PLANNED:'خطة إجراء', VERIFICATION:'تحقق',
        COMPLETED:'مكتمل', PENDING:'قيد المراجعة', APPROVED:'معتمد', CONDITIONAL:'مشروط',
        SUSPENDED:'موقوف', BLACKLISTED:'مستبعد',
        RECEIVED:'مستلم', VERIFIED:'مدقق', DISTRIBUTED:'موزع',
        APPLICANT:'متقدم', ACTIVE:'نشط', INACTIVE:'غير نشط', GRADUATED:'تخرج',
        DRAFT:'مسودة', PUBLISHED:'منشور', OBSOLETE:'ملغى',
      };
      return map[v] || v;
    },
    statusColor(v) {
      const green = ['ACHIEVED','MITIGATED','RESOLVED','CLOSED','COMPLETED','APPROVED','PUBLISHED','ACTIVE','VERIFIED','DISTRIBUTED','GRADUATED'];
      const red   = ['DELAYED','CANCELLED','REJECTED','BLACKLISTED','SUSPENDED','OBSOLETE'];
      const amber = ['IN_PROGRESS','UNDER_TREATMENT','UNDER_REVIEW','ROOT_CAUSE','ACTION_PLANNED','VERIFICATION','CONDITIONAL','APPLICANT','DRAFT','RECEIVED'];
      if (green.includes(v)) return 'bg-green-100 text-green-700';
      if (red.includes(v))   return 'bg-red-100 text-red-700';
      if (amber.includes(v)) return 'bg-amber-100 text-amber-700';
      return 'bg-blue-100 text-blue-700';
    },
    levelColor(v) {
      if (v === 'حرج')   return 'bg-red-100 text-red-700';
      if (v === 'مرتفع') return 'bg-orange-100 text-orange-700';
      if (v === 'متوسط') return 'bg-yellow-100 text-yellow-700';
      return 'bg-green-100 text-green-700';
    },
    roleLabel(r) {
      return ({
        SUPER_ADMIN: 'مسؤول النظام', QUALITY_MANAGER: 'مدير الجودة',
        COMMITTEE_MEMBER: 'عضو لجنة جودة', DEPT_MANAGER: 'مسؤول قسم',
        EMPLOYEE: 'موظف', GUEST_AUDITOR: 'مدقق ضيف',
      })[r] || r;
    },

    // ------ CSRF helper ------
    _getCsrfToken() {
      // cookie غير httpOnly اسمه `csrf` — نقرأه مباشرة
      const m = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    },

    // ------ API helper ------
    async api(method, path, body = null, authRequired = true) {
      const headers = { 'Content-Type': 'application/json' };
      if (authRequired && this.token) headers.Authorization = `Bearer ${this.token}`;
      // CSRF token على mutations فقط
      if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
        const csrf = this._getCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;
      }
      const res = await fetch(API + path, {
        method, headers, credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      // ── 401: تجديد JWT تلقائياً ───────────────────────────────────────────
      if (res.status === 401 && authRequired) {
        try {
          const r = await fetch(API + '/auth/refresh', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (r.ok) {
            const data = await r.json();
            this.token = data.token;
            headers.Authorization = `Bearer ${data.token}`;
            const retry = await fetch(API + path, {
              method, headers, credentials: 'include',
              body: body ? JSON.stringify(body) : undefined,
            });
            return this._handle(retry);
          }
        } catch {}
        this.logout();
      }
      // ── 403 CSRF: اجلب token جديد عبر GET ثم أعد الطلب مرة واحدة ─────────
      if (res.status === 403) {
        let data403 = null;
        try { data403 = await res.clone().json(); } catch {}
        if (data403?.code === 'CSRF_INVALID') {
          try {
            // GET أي مسار موثَّق يُعيد إصدار cookie csrf
            await fetch(API + '/auth/me', { credentials: 'include',
              headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} });
            // الآن نُعيد قراءة الـ token الجديد ونُعيد الطلب
            const newCsrf = this._getCsrfToken();
            if (newCsrf) {
              headers['X-CSRF-Token'] = newCsrf;
              const retry = await fetch(API + path, {
                method, headers, credentials: 'include',
                body: body ? JSON.stringify(body) : undefined,
              });
              return this._handle(retry);
            }
          } catch {}
        }
      }
      return this._handle(res);
    },
    async _handle(res) {
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        // دعم صيغتين: { error: { message: '...' } } أو { error: '...' }
        const errObj = data?.error;
        const msg = (typeof errObj === 'string' && errObj)
          || errObj?.message
          || data?.message
          || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    },
  };
}

window.app = app;
