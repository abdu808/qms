const CORE_TOOLS = ['get_system_state'];

const TOOL_GROUPS = {
  planning: [
    'get_system_state',
    'evaluate_strategic_plan',
    'detect_goal_conflicts',
    'suggest_missing_objectives',
    'check_department_coverage',
    'assess_org_structure_fit',
    'create_strategic_plan',
    'update_strategic_plan',
    'create_strategic_goal',
    'update_strategic_goal',
    'create_operational_activity',
    'update_operational_activity',
    'link_activity_to_goal',
    'create_indicator',
    'update_indicator',
    'create_initiative',
    'update_initiative',
    'create_annual_target',
    'update_annual_target',
  ],

  performance: [
    'get_system_state',
    'scan_overdue',
    'read_progress_report',
    'generate_progress_report',
    'evaluate_kpi_quality',
    'suggest_target_adjustment',
    'log_kpi_entry',
    'create_indicator',
    'update_indicator',
    'create_annual_target',
    'update_annual_target',
  ],

  iso: [
    'get_system_state',
    'compute_iso_maturity',
    'generate_management_report',
    'generate_audit_checklist',
    'evaluate_policy_completeness',
    'plan_audit',
    'create_management_review',
    'update_management_review',
    'create_ncr',
    'update_ncr',
    'create_capa',
    'update_capa',
  ],

  qualityCases: [
    'get_system_state',
    'create_risk',
    'update_risk',
    'link_risks_to_objectives',
    'create_ncr',
    'update_ncr',
    'analyze_ncr_patterns',
    'create_capa',
    'update_capa',
    'measure_capa_effectiveness',
    'create_complaint',
    'update_complaint',
    'orchestrate_complaint',
    'analyze_complaints_pattern',
    'track_beneficiary_satisfaction',
  ],

  departments: [
    'get_system_state',
    'compare_departments',
    'detect_department_trends',
    'detect_distressed_departments',
    'list_investigation_flags',
    'investigate_cross_contradictions',
    'assign_responsible',
    'assign_owner',
  ],

  training: [
    'get_system_state',
    'assess_training_needs',
    'schedule_training',
  ],

  reports: [
    'get_system_state',
    'generate_management_report',
    'read_progress_report',
    'generate_progress_report',
    'compare_departments',
    'detect_department_trends',
  ],
};

const INTENT_PATTERNS = [
  {
    intent: 'planning',
    pattern: /خطة|استراتيجي|استراتيجية|محور|هدف|اهداف|أهداف|مبادرة|مبادرات|نشاط|انشطة|أنشطة|مستهدف|خريطة|ترابط|plan|strategy|goal|objective|initiative|activity/i,
  },
  {
    intent: 'performance',
    pattern: /مؤشر|مؤشرات|قراءة|قراءات|ادخال|إدخال|متأخر|متاخر|انحراف|انجاز|إنجاز|مستهدف|ربع|شهري|سنوي|kpi|performance|target|overdue/i,
  },
  {
    intent: 'iso',
    pattern: /iso|9001|جودة|تدقيق|مراجعة ادارية|مراجعة إدارية|سياسة|سياسات|اجراء|إجراء|اجراءات|إجراءات|امتثال|audit|management review|policy/i,
  },
  {
    intent: 'qualityCases',
    pattern: /مخاطر|خطر|فرص|فرصة|عدم مطابقة|مطابقة|capa|ncr|شكوى|شكاوى|تصحيحي|رضا|مستفيد|risk|complaint|satisfaction/i,
  },
  {
    intent: 'departments',
    pattern: /قسم|اقسام|أقسام|ادارة|إدارة|موظف|موظفين|مالك|مسؤول|صلاحيات|department|employee|owner|responsible/i,
  },
  {
    intent: 'training',
    pattern: /تدريب|دورة|دورات|كفاءة|كفاءات|احتياج تدريبي|شهادة|شهادات|training|competenc|certificate/i,
  },
  {
    intent: 'reports',
    pattern: /تقرير|تقارير|لوحة|ملخص|اعرض|عرض|قائمة|dashboard|report|summary|show|list/i,
  },
];

const TIER_LIMITS = {
  QUICK: 4,
  STANDARD: 16,
  DEEP: 26,
  MANUAL: 26,
};

function latestText(messages = []) {
  const last = [...messages].reverse().find(m => m?.role === 'user');
  return typeof last?.content === 'string' ? last.content : '';
}

export function detectToolIntent(messages = []) {
  const text = latestText(messages);
  for (const item of INTENT_PATTERNS) {
    if (item.pattern.test(text)) return item.intent;
  }
  return 'reports';
}

export function selectToolsForRequest({
  tools = [],
  messages = [],
  callerRole,
  routingTier = 'STANDARD',
  mode = 'auto',
} = {}) {
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const intent = detectToolIntent(messages);
  const tier = String(routingTier || 'STANDARD').toUpperCase();

  let candidateNames;
  if (tier === 'QUICK') {
    candidateNames = CORE_TOOLS;
  } else {
    candidateNames = [
      ...CORE_TOOLS,
      ...(TOOL_GROUPS[intent] || TOOL_GROUPS.reports),
    ];
  }

  if (callerRole === 'EMPLOYEE') {
    candidateNames = CORE_TOOLS;
  }

  if (mode === 'review' && tier !== 'DEEP') {
    candidateNames = candidateNames.filter(name =>
      name === 'get_system_state' ||
      name.startsWith('generate_') ||
      name.startsWith('evaluate_') ||
      name.startsWith('detect_') ||
      name.startsWith('analyze_') ||
      name.startsWith('assess_') ||
      name.startsWith('read_') ||
      name.startsWith('scan_') ||
      name.startsWith('compare_') ||
      name.startsWith('suggest_') ||
      name.startsWith('list_') ||
      name.startsWith('track_') ||
      name.startsWith('compute_') ||
      name.startsWith('investigate_')
    );
  }

  const selected = [];
  const seen = new Set();
  for (const name of candidateNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    const tool = byName.get(name);
    if (tool) selected.push(tool);
  }

  const limit = TIER_LIMITS[tier] || TIER_LIMITS.STANDARD;
  const capped = selected.slice(0, limit);

  return {
    tools: capped,
    intent,
    tier,
    originalToolCount: tools.length,
    selectedToolCount: capped.length,
    selectedToolNames: capped.map(t => t.name),
  };
}

