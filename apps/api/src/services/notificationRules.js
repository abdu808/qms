import { prisma } from '../db.js';

export const NOTIFICATION_RULES_SETTING_KEY = 'notification_rules_v1';

export const ALLOWED_NOTIFICATION_CHANNELS = ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'];

export const DEFAULT_NOTIFICATION_RULES = [
  {
    eventKey: 'KPI_PRE_DEADLINE',
    name: 'تذكير قبل موعد قراءة المؤشر',
    category: 'KPI',
    audience: 'مدخل البيانات',
    timing: 'قبل تاريخ الاستحقاق',
    repeatPolicy: 'مرة واحدة لكل فترة قياس',
    escalation: 'لا يوجد تصعيد',
    enabled: true,
    channels: ['IN_APP'],
    createsTask: false,
    description: 'ينبه الموظف قبل حلول موعد إدخال قراءة المؤشر حتى لا يتحول إلى متأخر.',
  },
  {
    eventKey: 'KPI_FIRST_NOTICE',
    name: 'تنبيه أول لقراءة مؤشر متأخرة',
    category: 'KPI',
    audience: 'مدخل البيانات',
    timing: 'بعد 5 أيام من التأخر',
    repeatPolicy: 'مرة يومياً حتى الإدخال أو التصعيد',
    escalation: 'ينتقل لمدير القسم بعد 10 أيام',
    enabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    createsTask: true,
    description: 'تنبيه لطيف للموظف عند تأخر إدخال قراءة مؤشر مطلوبة.',
  },
  {
    eventKey: 'KPI_ESCALATED_L1',
    name: 'تصعيد قراءة مؤشر متأخرة لمدير القسم',
    category: 'KPI',
    audience: 'مدير القسم',
    timing: 'بعد 10 أيام من التأخر',
    repeatPolicy: 'مرة يومياً حتى الإدخال أو التصعيد الأعلى',
    escalation: 'ينتقل لمدير الجودة بعد 15 يوم',
    enabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    createsTask: true,
    description: 'يعطي مدير القسم فرصة معالجة التأخر داخل القسم قبل تصعيده للجودة.',
  },
  {
    eventKey: 'KPI_ESCALATED_L2',
    name: 'تصعيد حرج لمدير الجودة والإدارة',
    category: 'KPI',
    audience: 'مدير الجودة / الإدارة العليا',
    timing: 'بعد 15 يوم فأكثر',
    repeatPolicy: 'مرة يومياً حتى الحل أو الإغلاق اليدوي',
    escalation: 'يتحول إلى متابعة جودة وقد يتطلب CAPA',
    enabled: true,
    channels: ['IN_APP', 'WHATSAPP', 'EMAIL'],
    createsTask: true,
    description: 'تنبيه حرج للحالات التي تجاوزت حد التصعيد التشغيلي وتحتاج تدخل جودة.',
  },
  {
    eventKey: 'KPI_QM_DAILY_SUMMARY',
    name: 'ملخص يومي لمدير الجودة عن المتأخرات',
    category: 'KPI',
    audience: 'مدير الجودة / مسؤول النظام',
    timing: 'يومياً بعد الفحص الآلي',
    repeatPolicy: 'مرة واحدة يومياً',
    escalation: 'لا يوجد، ملخص رقابي',
    enabled: true,
    channels: ['IN_APP', 'EMAIL'],
    createsTask: false,
    description: 'ملخص رقابي يومي يوضح عدد المتأخرات ومستويات التصعيد حسب الإدارات.',
  },
  {
    eventKey: 'NCR_OVERDUE',
    name: 'عدم مطابقة تجاوزت المهلة',
    category: 'NCR',
    audience: 'مالك الحالة / مدير الجودة',
    timing: 'عند تجاوز موعد الإغلاق',
    repeatPolicy: 'حسب قاعدة المتابعة',
    escalation: 'تصعيد لمدير الجودة عند استمرار التأخر',
    enabled: true,
    channels: ['IN_APP'],
    createsTask: true,
    description: 'قاعدة جاهزة لتفعيل التنبيه على عدم المطابقات المتأخرة عند ربطها بالمجدول.',
  },
  {
    eventKey: 'COMPLAINT_SLA_OVERDUE',
    name: 'شكوى تجاوزت زمن الاستجابة',
    category: 'COMPLAINT',
    audience: 'مالك الشكوى / مدير القسم',
    timing: 'عند تجاوز SLA',
    repeatPolicy: 'حسب قاعدة المتابعة',
    escalation: 'تصعيد لمدير الجودة عند استمرار التأخر',
    enabled: true,
    channels: ['IN_APP'],
    createsTask: true,
    description: 'قاعدة جاهزة لتفعيل تنبيهات الشكاوى المتأخرة عند ربطها بالمجدول.',
  },
  {
    eventKey: 'DOC_REVIEW_DUE',
    name: 'وثيقة تحتاج مراجعة',
    category: 'DOCUMENT',
    audience: 'مالك الوثيقة / مدير الجودة',
    timing: 'قبل موعد المراجعة',
    repeatPolicy: 'مرة لكل وثيقة وفترة',
    escalation: 'تصعيد عند تجاوز تاريخ المراجعة',
    enabled: true,
    channels: ['IN_APP'],
    createsTask: true,
    description: 'قاعدة جاهزة لتذكير ملاك الوثائق بمراجعتها قبل انتهاء الصلاحية.',
  },
  {
    eventKey: 'TRAINING_DUE',
    name: 'تدريب أو توعية مطلوبة',
    category: 'TRAINING',
    audience: 'الموظف / مدير القسم',
    timing: 'حسب تاريخ التدريب أو خطة الكفاءة',
    repeatPolicy: 'مرة قبل الموعد ومرة عند التأخر',
    escalation: 'تصعيد للمدير عند عدم الحضور أو عدم الإكمال',
    enabled: true,
    channels: ['IN_APP'],
    createsTask: true,
    description: 'قاعدة جاهزة لتوجيه الموظفين للتدريب والتوعية المطلوبة دون ضغط يدوي.',
  },
];

function normalizeChannels(channels) {
  const list = Array.isArray(channels)
    ? channels
    : String(channels || '').split(',');
  return Array.from(new Set(
    list.map(c => String(c).trim().toUpperCase()).filter(c => ALLOWED_NOTIFICATION_CHANNELS.includes(c))
  ));
}

function normalizeRule(rule, fallback = {}) {
  return {
    ...fallback,
    ...rule,
    eventKey: fallback.eventKey || rule.eventKey,
    enabled: rule.enabled !== undefined ? !!rule.enabled : fallback.enabled !== false,
    channels: normalizeChannels(rule.channels?.length ? rule.channels : fallback.channels),
    createsTask: rule.createsTask !== undefined ? !!rule.createsTask : !!fallback.createsTask,
  };
}

function parseStoredRules(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listNotificationRules() {
  const row = await prisma.setting.findUnique({ where: { key: NOTIFICATION_RULES_SETTING_KEY } });
  const stored = parseStoredRules(row?.value);
  const storedByKey = new Map(stored.map(r => [r.eventKey, r]));
  const defaults = DEFAULT_NOTIFICATION_RULES.map(def => normalizeRule(storedByKey.get(def.eventKey) || {}, def));
  const defaultKeys = new Set(defaults.map(r => r.eventKey));
  const custom = stored
    .filter(r => r?.eventKey && !defaultKeys.has(r.eventKey))
    .map(r => normalizeRule(r, r));
  return [...defaults, ...custom];
}

export async function getNotificationRule(eventKey) {
  const rules = await listNotificationRules();
  return rules.find(r => r.eventKey === eventKey) || null;
}

export async function saveNotificationRules(rules) {
  const normalized = (Array.isArray(rules) ? rules : [])
    .filter(r => r?.eventKey)
    .map(r => normalizeRule(r, r));
  await prisma.setting.upsert({
    where: { key: NOTIFICATION_RULES_SETTING_KEY },
    create: { key: NOTIFICATION_RULES_SETTING_KEY, value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  });
  return normalized;
}

export async function updateNotificationRule(eventKey, patch = {}) {
  const rules = await listNotificationRules();
  const idx = rules.findIndex(r => r.eventKey === eventKey);
  if (idx < 0) return null;
  rules[idx] = normalizeRule({ ...rules[idx], ...patch }, rules[idx]);
  await saveNotificationRules(rules);
  return rules[idx];
}

export function ruleChannelsCsv(rule, fallbackChannels = '') {
  const channels = normalizeChannels(rule?.channels?.length ? rule.channels : fallbackChannels);
  return channels.join(',');
}
