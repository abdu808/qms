/**
 * Dry-run importer for the approved 2025-2027 plan matrix.
 *
 * This script DOES NOT write to the database. It reads the approved workbook,
 * compares planned axes/goals/indicators/activities/targets with current DB
 * records, and writes a review report under outputs/plan-reset.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { normalizeFrequency, frequencyLabel } from '../src/lib/kpiFrequency.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const DEFAULT_FILE = path.join(
  repoRoot,
  'outputs',
  'plan-reset',
  'matrix_albir_v2_final_for_system.xlsx',
);
const DEFAULT_OUT = path.join(repoRoot, 'outputs', 'plan-reset');
const OWNER_TO_DEPT_CODE = new Map([
  ['قسم الكفالات', 'KAF'],
  ['قسم الخدمة المجتمعية', 'SOC'],
  ['قسم المساعدات العينية / المستودع', 'WH'],
  ['قسم التمكين', 'EMP'],
  ['إدارة تنمية الموارد', 'RES'],
  ['وحدة الاستثمار', 'INV'],
  ['إدارة المالية', 'FIN'],
  ['وحدة التميز المؤسسي', 'QM'],
  ['المدير التنفيذي', 'ADM'],
  ['إدارة التحول التقني', 'IT'],
  ['إدارة الموارد البشرية', 'HR'],
  ['إدارة الاتصال والشراكات', 'COM'],
  ['إدارة تنمية الموارد / إدارة المالية', 'RES'],
  ['وحدة التطوع', 'COM'],
  ['إدارة الاتصال', 'COM'],
]);

function argValue(name, fallback) {
  const flag = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

function cleanText(value) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s === '—' || s === '-' ? '' : s;
}

function normalizeKey(value) {
  return cleanText(value)
    .replace(/[ـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

function parseNumber(value) {
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text.replace(/,/g, '').replace(/%/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function inferUnit(title, target2026, target2027) {
  const text = `${title} ${target2026 ?? ''} ${target2027 ?? ''}`;
  if (text.includes('%') || /نسبة|معدل|رضا|التزام|فعالية|إغلاق|انتظام|تحسين/.test(text)) return '%';
  if (/ريال|إيراد|عائد|ميزانية|تكلفة|تمويل|استثمار/.test(text)) return 'ريال';
  if (/ساعة/.test(text)) return 'ساعة';
  if (/يوم/.test(text)) return 'يوم';
  return 'عدد';
}

function inferKpiType(frequency, title) {
  if (/نسبة|معدل|رضا|التزام|فعالية|إغلاق|انتظام|تحسين/.test(title)) return 'SNAPSHOT';
  if (frequency === 'MONTHLY') return 'SNAPSHOT';
  return 'CUMULATIVE';
}

function inferSeasonality(timing, frequency) {
  const t = cleanText(timing);
  if (/يناير.*سبتمبر|سبتمبر|مدرس/.test(t)) return 'SCHOOL_START';
  if (/عيد|الفطر|الأضحى/.test(t)) return 'EID_SEASONAL';
  if (/رمضان/.test(t)) return 'RAMADAN_RELIEF';
  if (frequency === 'QUARTERLY' || /ربعي|Q[1-4]|4 دفعات/.test(t)) return 'QUARTERLY';
  return 'UNIFORM';
}

function readRows(workbook) {
  const ws = workbook.worksheets[0];
  const rows = [];
  for (let rowNumber = 4; rowNumber <= ws.rowCount; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const no = parseNumber(row.getCell(1).value);
    const axis = cleanText(row.getCell(2).value);
    const goal = cleanText(row.getCell(3).value);
    const level = cleanText(row.getCell(4).value);
    const title = cleanText(row.getCell(5).value);
    const decision = cleanText(row.getCell(15).value);
    if (!no || !axis || !title || decision.includes('يحذف') || decision.includes('يؤجل')) continue;
    const frequency = normalizeFrequency(row.getCell(14).value);
    const target2026Raw = cleanText(row.getCell(12).value);
    const target2027Raw = cleanText(row.getCell(13).value);
    rows.push({
      rowNumber,
      no,
      axis,
      goal,
      level,
      title,
      ownerText: cleanText(row.getCell(6).value),
      monitorText: cleanText(row.getCell(7).value),
      isoClause: cleanText(row.getCell(8).value),
      budget: parseNumber(row.getCell(9).value),
      timing2026: cleanText(row.getCell(10).value),
      baseline2025: parseNumber(row.getCell(11).value),
      target2026: parseNumber(target2026Raw),
      target2027: parseNumber(target2027Raw),
      target2026Raw,
      target2027Raw,
      frequency,
      frequencyLabel: frequencyLabel(frequency),
      unit: inferUnit(title, target2026Raw, target2027Raw),
      kpiType: inferKpiType(frequency, title),
      seasonality: inferSeasonality(row.getCell(10).value, frequency),
      decision,
    });
  }
  return rows;
}

function uniqueBy(items, fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

async function loadDbSnapshot() {
  const [
    plans,
    axes,
    goals,
    indicators,
    activities,
    annualTargets,
    departments,
    users,
  ] = await Promise.all([
    prisma.strategicPlan.findMany({ where: { deletedAt: null }, select: { id: true, code: true, title: true, startYear: true, endYear: true, status: true } }),
    prisma.axis.findMany({ where: { deletedAt: null }, select: { id: true, code: true, nameAr: true } }),
    prisma.strategicGoal.findMany({ where: { deletedAt: null }, select: { id: true, code: true, title: true, perspective: true } }),
    prisma.indicator.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        nameAr: true,
        frequency: true,
        baseline: true,
        unit: true,
        isoClause: true,
        annualTargets: { select: { year: true, targetValue: true } },
      },
    }),
    prisma.operationalActivity.findMany({ where: { deletedAt: null }, select: { id: true, code: true, title: true, year: true } }),
    prisma.annualTarget.findMany({ select: { id: true, indicatorId: true, year: true, targetValue: true } }),
    prisma.department.findMany({ select: { id: true, code: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, departmentId: true } }),
  ]);
  return { plans, axes, goals, indicators, activities, annualTargets, departments, users };
}

function matchByName(existing, titleField, plannedName) {
  const key = normalizeKey(plannedName);
  return existing.find(item => normalizeKey(item[titleField]) === key) || null;
}

function ownerResolution(rows, db) {
  const deptByKey = new Map(db.departments.map(d => [normalizeKey(d.name), d]));
  const deptByCode = new Map(db.departments.map(d => [d.code, d]));
  const uniqueOwners = uniqueBy(rows.map(r => r.ownerText).filter(Boolean), x => normalizeKey(x));
  return uniqueOwners.map(owner => {
    const mappedCode = OWNER_TO_DEPT_CODE.get(owner);
    const mapped = mappedCode ? deptByCode.get(mappedCode) : null;
    const direct = mapped || deptByKey.get(normalizeKey(owner));
    const fuzzy = direct || db.departments.find(d => normalizeKey(owner).includes(normalizeKey(d.name)) || normalizeKey(d.name).includes(normalizeKey(owner)));
    return { owner, departmentMatch: fuzzy?.name || null, status: fuzzy ? 'matched_department' : 'needs_mapping' };
  });
}

function buildPlan(rows, db) {
  const activeRows = rows.filter(r => !/محذوف|مؤجل/.test(r.decision));
  const axes = uniqueBy(activeRows, r => normalizeKey(r.axis));
  const goals = uniqueBy(activeRows.filter(r => r.goal), r => `${normalizeKey(r.axis)}::${normalizeKey(r.goal)}`);
  const indicators = activeRows.filter(r => r.level.includes('استراتيجي') || r.level.includes('تشغيلي'));
  const activities = activeRows.filter(r => r.level.includes('نشاط'));

  const plannedTargets = indicators.flatMap(row => [
    row.target2026 == null ? null : { row, year: 2026, value: row.target2026 },
    row.target2027 == null ? null : { row, year: 2027, value: row.target2027 },
  ].filter(Boolean));

  const indicatorActions = indicators.map(row => {
    const existing = matchByName(db.indicators, 'nameAr', row.title);
    const targetDiffs = [];
    if (existing) {
      for (const year of [2026, 2027]) {
        const desired = row[`target${year}`];
        if (desired == null) continue;
        const current = existing.annualTargets.find(t => t.year === year);
        if (!current) targetDiffs.push({ year, action: 'create', value: desired });
        else if (Number(current.targetValue) !== desired) targetDiffs.push({ year, action: 'update', from: current.targetValue, to: desired });
      }
    }
    return {
      row: row.no,
      title: row.title,
      level: row.level,
      action: existing ? 'update' : 'create',
      existingCode: existing?.code || null,
      frequency: row.frequency,
      frequencyLabel: row.frequencyLabel,
      baseline2025: row.baseline2025,
      target2026: row.target2026,
      target2027: row.target2027,
      targetDiffs,
    };
  });

  return {
    counts: {
      workbookRows: rows.length,
      activeRows: activeRows.length,
      axes: axes.length,
      goals: goals.length,
      indicators: indicators.length,
      activities: activities.length,
      plannedTargets: plannedTargets.length,
    },
    dbCounts: {
      plans: db.plans.length,
      axes: db.axes.length,
      goals: db.goals.length,
      indicators: db.indicators.length,
      activities: db.activities.length,
      annualTargets: db.annualTargets.length,
    },
    planAction: db.plans.find(p => p.code === 'PLAN-2025-2027') ? 'update PLAN-2025-2027' : 'create PLAN-2025-2027',
    axes: axes.map((r, i) => ({ order: i + 1, name: r.axis, action: matchByName(db.axes, 'nameAr', r.axis) ? 'update' : 'create' })),
    goals: goals.map((r, i) => ({ order: i + 1, axis: r.axis, title: r.goal, action: matchByName(db.goals, 'title', r.goal) ? 'update' : 'create' })),
    indicatorActions,
    activities: activities.map((r, i) => ({ order: i + 1, title: r.title, axis: r.axis, goal: r.goal, action: matchByName(db.activities, 'title', r.title) ? 'update' : 'create', budget: r.budget })),
    ownerResolution: ownerResolution(activeRows, db),
  };
}

function toMarkdown(report, filePath) {
  const createCount = report.indicatorActions.filter(i => i.action === 'create').length;
  const updateCount = report.indicatorActions.filter(i => i.action === 'update').length;
  const unresolvedOwners = report.ownerResolution.filter(o => o.status === 'needs_mapping');
  const lines = [];
  lines.push('# Dry Run — تحديث الخطة 2025-2027');
  lines.push('');
  lines.push(`المصدر: \`${filePath}\``);
  lines.push('');
  lines.push('## الملخص');
  lines.push('');
  lines.push(`- إجراء الخطة: ${report.planAction}`);
  lines.push(`- المحاور المخططة: ${report.counts.axes}`);
  lines.push(`- الأهداف الاستراتيجية المخططة: ${report.counts.goals}`);
  lines.push(`- المؤشرات المخططة: ${report.counts.indicators} (${createCount} إنشاء، ${updateCount} تحديث)`);
  lines.push(`- الأنشطة المخططة: ${report.counts.activities}`);
  lines.push(`- المستهدفات السنوية القابلة للإدخال: ${report.counts.plannedTargets}`);
  lines.push('');
  lines.push('## الوضع الحالي في قاعدة البيانات');
  lines.push('');
  lines.push(`- الخطط: ${report.dbCounts.plans}`);
  lines.push(`- المحاور: ${report.dbCounts.axes}`);
  lines.push(`- الأهداف: ${report.dbCounts.goals}`);
  lines.push(`- المؤشرات: ${report.dbCounts.indicators}`);
  lines.push(`- الأنشطة: ${report.dbCounts.activities}`);
  lines.push(`- المستهدفات السنوية: ${report.dbCounts.annualTargets}`);
  lines.push('');
  lines.push('## المحاور');
  lines.push('');
  lines.push('| # | المحور | الإجراء |');
  lines.push('|---:|---|---|');
  for (const axis of report.axes) lines.push(`| ${axis.order} | ${axis.name} | ${axis.action} |`);
  lines.push('');
  lines.push('## أول 15 مؤشر للتحديث');
  lines.push('');
  lines.push('| # | المؤشر | المستوى | الإجراء | التردد | خط أساس 2025 | مستهدف 2026 | مستهدف 2027 |');
  lines.push('|---:|---|---|---|---|---:|---:|---:|');
  for (const item of report.indicatorActions.slice(0, 15)) {
    lines.push(`| ${item.row} | ${item.title} | ${item.level} | ${item.action} | ${item.frequencyLabel} | ${item.baseline2025 ?? '—'} | ${item.target2026 ?? '—'} | ${item.target2027 ?? '—'} |`);
  }
  lines.push('');
  lines.push('## ربط الملاك المؤسسيين');
  lines.push('');
  if (!unresolvedOwners.length) {
    lines.push('- جميع الملاك النصيين وجد لهم تطابق قسم تقريبي.');
  } else {
    lines.push(`- يحتاج ربط/تأكيد: ${unresolvedOwners.length}`);
    for (const item of unresolvedOwners) lines.push(`  - ${item.owner}`);
  }
  lines.push('');
  lines.push('## ملاحظة مهمة');
  lines.push('');
  lines.push('هذا التقرير لم يغيّر قاعدة البيانات. قبل التطبيق الفعلي يجب اعتماد سياسة الأرشفة: حذف فعلي أم soft-delete للبيانات القديمة.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const filePath = path.resolve(argValue('file', DEFAULT_FILE));
  const outDir = path.resolve(argValue('out', DEFAULT_OUT));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = readRows(workbook);
  const db = await loadDbSnapshot();
  const report = buildPlan(rows, db);

  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'dry-run-plan-2025-2027.json');
  const mdPath = path.join(outDir, 'dry-run-plan-2025-2027.md');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(mdPath, `\ufeff${toMarkdown(report, filePath)}`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    filePath,
    jsonPath,
    mdPath,
    counts: report.counts,
    dbCounts: report.dbCounts,
    unresolvedOwners: report.ownerResolution.filter(o => o.status === 'needs_mapping').map(o => o.owner),
  }, null, 2));
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
