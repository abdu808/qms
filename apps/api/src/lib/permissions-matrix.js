/**
 * permissions-matrix.js — Single Source of Truth for Role-Based Access Control
 *
 * ISO 9001:2015 §5.3 — Organizational roles, responsibilities and authorities
 * ISO 9001:2015 §7.1.2 — People (competence and separation of duty)
 *
 * Roles (tiered, lowest → highest):
 *   GUEST_AUDITOR   — external auditor, read-only (enforced by denyReadOnly)
 *   EMPLOYEE        — data entry (maker)
 *   DEPT_MANAGER    — departmental manager (checker for own dept)
 *   COMMITTEE_MEMBER— quality committee reviewer
 *   QUALITY_MANAGER — quality dept manager (approver)
 *   SUPER_ADMIN     — system administrator
 *
 * Actions:
 *   read     — list + detail   (GET)
 *   create   — new record      (POST)
 *   update   — modify record   (PUT/PATCH)
 *   delete   — remove record   (DELETE)
 *   approve  — workflow approve (custom endpoints)
 *   close    — close/finalize  (custom endpoints)
 *
 * If a resource is NOT listed here, crudRouter falls back to SAFE DEFAULT:
 *   read   → any authenticated user
 *   create → EMPLOYEE+
 *   update → DEPT_MANAGER+
 *   delete → QUALITY_MANAGER+
 */

// ── Role tiers (array order = seniority, lowest → highest) ─────────────
export const ROLE_TIERS = [
  'GUEST_AUDITOR',
  'EMPLOYEE',
  'DEPT_MANAGER',
  'COMMITTEE_MEMBER',
  'QUALITY_MANAGER',
  'SUPER_ADMIN',
];

// ── Role shortcuts ─────────────────────────────────────────────────────
export const ANY         = ROLE_TIERS;                                    // any authenticated user (incl. guest)
export const EMPLOYEE_UP = ['EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const MANAGER_UP  = ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const COMMITTEE_UP= ['COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const QM_UP       = ['QUALITY_MANAGER','SUPER_ADMIN'];
export const SA          = ['SUPER_ADMIN'];

// ── Default policy applied when a resource is absent ───────────────────
export const DEFAULT_POLICY = {
  read:    ANY,
  create:  EMPLOYEE_UP,
  update:  MANAGER_UP,
  delete:  QM_UP,
  approve: QM_UP,
  close:   QM_UP,
};

// ── Resource-specific policies ─────────────────────────────────────────
// Resource names = kebab-case segments matching server.js route mounts
//   (donations, ncr, audits, suppliers, beneficiaries …)
export const MATRIX = {
  // Cross-cutting sensitive surfaces
  dashboard:        { read: QM_UP },
  'system-state':   { read: MANAGER_UP },
  'operational-reports': { read: QM_UP },
  'data-health':    { read: QM_UP },
  exports:          { read: QM_UP },
  // 'reports' مُعرَّف في القسم السفلي بقيم محدّثة — أُزيل التعريف المكرر القديم

  // ── People & Org ─────────────────────────────────────────────────
  // QM may CRUD users for daily operations, but cannot touch SUPER_ADMIN — enforced in routes/users.js
  users:            { read: MANAGER_UP, create: QM_UP, update: QM_UP, delete: SA },
  departments:      { read: ANY,        create: QM_UP, update: QM_UP, delete: SA },
  'strategic-plans':{ read: ANY,        create: QM_UP, update: QM_UP, delete: QM_UP },
  'strategic-goals':{ read: ANY,        create: QM_UP, update: QM_UP, delete: QM_UP },

  // ── Planning (ISO clause 6) ──────────────────────────────────────
  objectives:       { read: ANY, create: QM_UP, update: MANAGER_UP, delete: QM_UP },
  risks:            { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  swot:             { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  'interested-parties': { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },

  // ── Context & Processes (ISO 4) ──────────────────────────────────
  processes:        { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  'quality-policy': { read: ANY, create: QM_UP, update: QM_UP, delete: SA, activate: QM_UP },

  // ── Support (ISO 7) ──────────────────────────────────────────────
  documents:        { read: ANY, create: EMPLOYEE_UP, update: EMPLOYEE_UP, delete: QM_UP, approve: QM_UP, publish: QM_UP },
  training:         { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },
  competence:       { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },
  // Performance reviews: manager creates/updates, QM finalizes (maps to `delete` role tier for guardrail)
  'performance-reviews': { read: MANAGER_UP, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  // Continual improvement: any employee can propose, managers update, QM approves/closes
  'improvement-projects': { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  // Audit checklists: QM-owned templates
  'audit-checklists': { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  // Ack documents (policies/charters): QM manages, all employees read + ack
  'ack-documents':    { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  communication:    { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },

  // ── Operation (ISO 8) ────────────────────────────────────────────
  'operational-activities': { read: ANY, create: QM_UP, update: MANAGER_UP, delete: QM_UP },
  suppliers:        { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  'supplier-evals': { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },

  // ── Charity-specific ─────────────────────────────────────────────
  donations:        { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  'donation-evals': { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },
  beneficiaries:    { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  programs:         { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },

  // ── Performance Evaluation (ISO 9) ───────────────────────────────
  complaints:       { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP, close: QM_UP },
  surveys:          { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },
  audits:           { read: ANY, create: QM_UP,       update: QM_UP,      delete: QM_UP },
  // SECURITY: management review minutes + /management-review-snapshot expose
  // organization-wide aggregates (financials, PII, risks). The snapshot has no
  // departmental scope (it's an aggregate by design), so we restrict to QM+
  // rather than try to scope-filter every cross-cut query.
  //
  // COMMITTEE_MEMBER POLICY (audit decision 2026-04-27):
  //   - Excluded here from /management-review-snapshot — it's a top-management
  //     financial+PII summary, outside quality-committee scope.
  //   - Retains full read on /api/integration/* aggregators and on AI
  //     get_system_state (committee role IS cross-departmental review per
  //     ISO 9001 §5.1.2 / §9.3).
  //   - Cannot execute any AI write tool (committee reviews; QM approves).
  'management-review': { read: QM_UP, create: QM_UP, update: QM_UP, delete: QM_UP },
  // تقارير التقدّم الشهرية (المحقق الشهري) — DEPT_MANAGER يملأ قسمه، QM يُعتمد
  'progress-reports': { read: MANAGER_UP, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP, approve: QM_UP },

  // ── Improvement (ISO 10) ─────────────────────────────────────────
  ncr:              { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP, close: QM_UP },
  capa:             { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP, close: QM_UP },

  // ── Signatures & audit logs ──────────────────────────────────────
  signatures:       { read: ANY, create: EMPLOYEE_UP, update: QM_UP, delete: SA },
  'audit-log':      { read: QM_UP, create: SA, update: SA, delete: SA },
  'eval-tokens':    { read: MANAGER_UP, create: MANAGER_UP, update: QM_UP, delete: QM_UP },

  // ── KPI & ISO readiness ──────────────────────────────────────────
  kpi:              { read: ANY, create: MANAGER_UP, update: EMPLOYEE_UP, delete: QM_UP },
  'iso-readiness':  { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  'report-builder': { read: COMMITTEE_UP, create: QM_UP, update: QM_UP, delete: SA, approve: QM_UP },

  // ── Proactive alerts (live health signals) ───────────────────────
  // للقراءة فقط لإدارة الجودة والمسؤولين؛ لا عمليات كتابة (detectors محسوبة).
  alerts:           { read: MANAGER_UP },

  // ── Strategic Planning v2 (BSC / Indicator model) ────────────────
  'axes':            { read: ANY,        create: SA,          update: SA,         delete: SA    },
  'indicators':      { read: ANY,        create: QM_UP,       update: QM_UP,      delete: QM_UP },
  'annual-targets':  { read: ANY,        create: QM_UP,       update: QM_UP,      delete: QM_UP },
  'initiatives':     { read: ANY,        create: QM_UP,       update: MANAGER_UP, delete: QM_UP },
  'change-requests': { read: ANY,        create: MANAGER_UP,  update: SA,         delete: SA, approve: QM_UP },
  'funding-sources': { read: MANAGER_UP, create: QM_UP,       update: QM_UP,      delete: QM_UP },
  'funding-plans':   { read: MANAGER_UP, create: QM_UP,       update: QM_UP,      delete: QM_UP },
  'plan-versions':   { read: ANY,        create: QM_UP,       update: SA,         delete: SA    },

  // ── Audit task 8 (architectural): مهام متابعة من Management Review ────────
  // أي موظف يستطيع رؤية مهامه (أحد smart filters هو 'mine'). الإنشاء اليدوي
  // وتحديث الحالة لمدير القسم وما فوق. الحذف لـ QM فقط.
  'follow-up-tasks':  { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },

  // ── Audit task 9 (architectural): ملاحظات التدقيق (ISO §9.2) ─────────────
  // المدقق (QUALITY_MANAGER) ينشئ الملاحظات خلال التدقيق.
  // أي موظف يمكنه قراءة الملاحظات المرتبطة بقسمه.
  // تصعيد MINOR_NC/MAJOR_NC → NCR: يشترط QUALITY_MANAGER فأعلى.
  'audit-findings':   { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },

  // ── Phase 9: تقارير HTML قابلة للطباعة ─────────────────────────────────────
  // Read restricted to managers+ — printable reports may aggregate sensitive cross-dept data.
  'reports':         { read: COMMITTEE_UP, create: SA,        update: SA,         delete: SA    },
};

/**
 * Lookup the allowed roles for a (resource, action) pair.
 *
 * Resolution order:
 *   1. MATRIX[resource][action]   — explicit per-resource, per-action policy
 *   2. DEFAULT_POLICY[action]     — safe default for the action
 *   3. null                       — forbidden (deny-by-default)
 *
 * IMPORTANT: When a resource is missing from MATRIX (e.g., new route added without
 * matrix entry), we fall back to DEFAULT_POLICY rather than returning null.
 * Returning null would deny ALL actions including read — far stricter than intended,
 * and inconsistent with the "safe default" documented at the top of this file.
 */
export function rolesFor(resource, action) {
  const policy = MATRIX[resource] || DEFAULT_POLICY;
  if (policy[action]) return policy[action];
  if (DEFAULT_POLICY[action]) return DEFAULT_POLICY[action];
  return null;
}
