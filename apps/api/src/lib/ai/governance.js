/**
 * Central AI governance policy.
 *
 * The AI layer must never infer its own authority from the model, prompt, or
 * selected provider. It receives a small role policy from here, then routes
 * every request through the same limits.
 */

export const AI_ROLE_POLICIES = {
  EMPLOYEE: {
    label: 'موظف',
    canChat: true,
    canReadContext: false,
    canUploadFiles: false,
    forceMode: 'explain',
    scope: 'self',
    maxMessages: 4,
    maxInputChars: 1500,
    maxTokens: 350,
    allowProviderOverride: false,
    allowModelOverride: false,
    notes: 'شرح وتوجيه فقط، دون قراءة شاملة للنظام أو تنفيذ أدوات.',
  },

  DEPT_MANAGER: {
    label: 'مدير قسم',
    canChat: true,
    canReadContext: true,
    canUploadFiles: false,
    forceMode: 'review',
    scope: 'department',
    maxMessages: 6,
    maxInputChars: 5000,
    maxTokens: 900,
    allowProviderOverride: false,
    allowModelOverride: false,
    notes: 'استشارة وقراءة ضمن نطاق القسم، وكل تعديل يبقى مقترحاً للمراجعة.',
  },

  COMMITTEE_MEMBER: {
    label: 'عضو لجنة',
    canChat: true,
    canReadContext: true,
    canUploadFiles: false,
    forceMode: 'review',
    scope: 'committee_readonly',
    maxMessages: 6,
    maxInputChars: 6000,
    maxTokens: 1100,
    allowProviderOverride: false,
    allowModelOverride: false,
    notes: 'قراءة ومراجعة مؤسسية دون تنفيذ أو رفع ملفات.',
  },

  QUALITY_MANAGER: {
    label: 'مدير الجودة',
    canChat: true,
    canReadContext: true,
    canUploadFiles: true,
    forceMode: null,
    scope: 'organization',
    maxMessages: 8,
    maxInputChars: 12000,
    maxTokens: 1800,
    allowProviderOverride: false,
    allowModelOverride: false,
    notes: 'متابعة شاملة، مع بقاء التعديلات الهيكلية والسجلات الرسمية للمراجعة البشرية.',
  },

  SUPER_ADMIN: {
    label: 'مسؤول النظام',
    canChat: true,
    canReadContext: true,
    canUploadFiles: true,
    forceMode: null,
    scope: 'system',
    maxMessages: 10,
    maxInputChars: 20000,
    maxTokens: 2600,
    allowProviderOverride: true,
    allowModelOverride: true,
    notes: 'تحكم كامل بالإعدادات والموديلات، مع استمرار حواجز الأدوات الحساسة.',
  },
};

export function getAiRolePolicy(role) {
  return AI_ROLE_POLICIES[role] || {
    label: 'غير مصرح',
    canChat: false,
    canReadContext: false,
    canUploadFiles: false,
    forceMode: 'none',
    scope: 'none',
    maxMessages: 0,
    maxInputChars: 0,
    maxTokens: 0,
    allowProviderOverride: false,
    allowModelOverride: false,
    notes: 'هذا الدور لا يملك صلاحية استخدام AI.',
  };
}

export function getAiChatRoles() {
  return Object.entries(AI_ROLE_POLICIES)
    .filter(([, policy]) => policy.canChat)
    .map(([role]) => role);
}

export function getAiContextRoles() {
  return Object.entries(AI_ROLE_POLICIES)
    .filter(([, policy]) => policy.canReadContext)
    .map(([role]) => role);
}

export function getAiUploadRoles() {
  return Object.entries(AI_ROLE_POLICIES)
    .filter(([, policy]) => policy.canUploadFiles)
    .map(([role]) => role);
}

export function sanitizeMessagesForPolicy(messages, policy) {
  const safe = (messages || [])
    .slice(-policy.maxMessages)
    .map((m) => ({
      role: m.role,
      content: String(m.content || '').slice(0, policy.maxInputChars),
    }));
  return safe;
}

export function validateMessagesForPolicy(messages, policy) {
  for (const m of messages || []) {
    const content = String(m?.content || '');
    if (content.length > policy.maxInputChars) {
      const err = new Error(`الرسالة أطول من الحد المسموح لهذا الدور (${policy.maxInputChars} حرف). اختصر الطلب أو ارفقه كملف لمسؤول الجودة.`);
      err.status = 400;
      err.code = 'AI_INPUT_TOO_LONG';
      throw err;
    }
  }
}

export function resolveGovernedAiRequest({ role, requestedMode = 'auto', providerOverride, modelOverride }) {
  const policy = getAiRolePolicy(role);
  const mode = policy.forceMode && policy.forceMode !== 'explain'
    ? policy.forceMode
    : requestedMode;

  return {
    policy,
    mode,
    providerOverride: policy.allowProviderOverride ? providerOverride : undefined,
    modelOverride: policy.allowModelOverride ? modelOverride : undefined,
  };
}

export function listAiGovernancePolicies() {
  return Object.entries(AI_ROLE_POLICIES).map(([role, policy]) => ({
    role,
    label: policy.label,
    canChat: policy.canChat,
    canReadContext: policy.canReadContext,
    canUploadFiles: policy.canUploadFiles,
    forceMode: policy.forceMode || 'حسب الطلب',
    scope: policy.scope,
    maxMessages: policy.maxMessages,
    maxInputChars: policy.maxInputChars,
    maxTokens: policy.maxTokens,
    allowProviderOverride: policy.allowProviderOverride,
    allowModelOverride: policy.allowModelOverride,
    notes: policy.notes,
  }));
}
