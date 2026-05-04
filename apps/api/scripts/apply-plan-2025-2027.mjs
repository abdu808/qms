/**
 * Apply the approved 2025-2027 plan matrix to the QMS database.
 *
 * Default mode is dry-run. Use:
 *   node scripts/apply-plan-2025-2027.mjs --dry-run
 *   node scripts/apply-plan-2025-2027.mjs --apply --archive-legacy
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { normalizeFrequency } from '../src/lib/kpiFrequency.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const APPLY = process.argv.includes('--apply');
const ARCHIVE_LEGACY = process.argv.includes('--archive-legacy');

const PLAN_FILE = path.join(repoRoot, 'outputs', 'plan-reset', 'matrix_albir_v2_final_for_system.xlsx');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

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

const DEPT_CODE_TO_OWNER_EMAIL = new Map([
  ['KAF', 'katema1058@gmail.com'],
  ['SOC', 'katema1058@gmail.com'],
  ['EMP', 'katema1058@gmail.com'],
  ['WH', 'abdu8008@gmail.com'],
  ['QM', 'eylaf.ha12@gmail.com'],
  ['IT', 'heho1515@hotmail.com'],
  ['HR', 'heho1515@hotmail.com'],
  ['SUP', 'heho1515@hotmail.com'],
  ['RES', 'nadiayhgalam@gmail.com'],
  ['FIN', 'abdalrhmansuhagi@gmail.com'],
  ['COM', 'sfsfsf229@gmail.com'],
  ['INV', 'abdu808@gmail.com'],
  ['ADM', 'abdu808@gmail.com'],
]);

function cleanText(value) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s === '—' || s === '-' ? '' : s;
}

function parseNumber(value) {
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text.replace(/,/g, '').replace(/%/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(value) {
  return cleanText(value)
    .replace(/[ـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

function inferUnit(title, target2026, target2027) {
  const text = `${title} ${target2026 ?? ''} ${target2027 ?? ''}`;
  if (text.includes('%') || /نسبة|معدل|رضا|التزام|فعالية|إغلاق|انتظام|تحسين|اكتمال|استبقاء/.test(text)) return '%';
  if (/ريال|إيراد|عائد|ميزانية|تكلفة|تمويل|استثمار/.test(text)) return 'ريال';
  if (/ساعة/.test(text)) return 'ساعة';
  if (/يوم/.test(text)) return 'يوم';
  return 'عدد';
}

function inferKpiType(frequency, title) {
  if (/نسبة|معدل|رضا|التزام|فعالية|إغلاق|انتظام|تحسين|اكتمال|استبقاء/.test(title)) return 'SNAPSHOT';
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

function slug(n, width = 2) {
  return String(n).padStart(width, '0');
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
      unit: inferUnit(title, target2026Raw, target2027Raw),
      frequency,
      kpiType: inferKpiType(frequency, title),
      seasonality: inferSeasonality(row.getCell(10).value, frequency),
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

async function loadReference() {
  const [departments, users, existing] = await Promise.all([
    prisma.department.findMany({ select: { id: true, code: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, email: true, role: true, departmentId: true } }),
    Promise.all([
      prisma.strategicPlan.count({ where: { deletedAt: null } }),
      prisma.axis.count({ where: { deletedAt: null } }),
      prisma.strategicGoal.count({ where: { deletedAt: null } }),
      prisma.indicator.count({ where: { deletedAt: null } }),
      prisma.operationalActivity.count({ where: { deletedAt: null } }),
      prisma.kpiEntry.count(),
      prisma.kpiFollowUp.count(),
      prisma.annualTarget.count(),
    ]),
  ]);
  return {
    departments,
    users,
    counts: {
      plans: existing[0],
      axes: existing[1],
      goals: existing[2],
      indicators: existing[3],
      activities: existing[4],
      kpiEntries: existing[5],
      followUps: existing[6],
      annualTargets: existing[7],
    },
  };
}

function buildResolvedRows(rows, ref) {
  const deptByCode = new Map(ref.departments.map(d => [d.code, d]));
  const userByEmail = new Map(ref.users.map(u => [u.email.toLowerCase(), u]));
  const admin = userByEmail.get('admin@bir-sabia.org.sa') || ref.users.find(u => u.role === 'SUPER_ADMIN');
  const quality = userByEmail.get('eylaf.ha12@gmail.com') || userByEmail.get('quality@bir-sabia.org.sa') || admin;

  const resolved = rows.map(row => {
    const deptCode = OWNER_TO_DEPT_CODE.get(row.ownerText) || null;
    const dept = deptCode ? deptByCode.get(deptCode) : null;
    const ownerEmail = deptCode ? DEPT_CODE_TO_OWNER_EMAIL.get(deptCode) : null;
    const owner = ownerEmail ? userByEmail.get(ownerEmail.toLowerCase()) : null;
    return {
      ...row,
      deptCode,
      deptId: dept?.id || null,
      ownerId: owner?.id || admin?.id || null,
      dataEntryUserId: owner?.id || admin?.id || null,
      approverUserId: quality?.id || admin?.id || null,
    };
  });

  const unresolved = resolved.filter(r => !r.deptId || !r.ownerId);
  return { rows: resolved, admin, unresolved };
}

function buildSummary(rows, ref, unresolved) {
  const axes = uniqueBy(rows, r => normalizeKey(r.axis));
  const goals = uniqueBy(rows.filter(r => r.goal), r => `${normalizeKey(r.axis)}::${normalizeKey(r.goal)}`);
  const indicators = rows.filter(r => r.level.includes('استراتيجي') || r.level.includes('تشغيلي'));
  const activities = rows.filter(r => r.level.includes('نشاط'));
  return {
    mode: APPLY ? 'apply' : 'dry-run',
    archiveLegacy: ARCHIVE_LEGACY,
    source: PLAN_FILE,
    current: ref.counts,
    planned: {
      axes: axes.length,
      goals: goals.length,
      indicators: indicators.length,
      activities: activities.length,
      annualTargets: indicators.reduce((sum, r) => sum + (r.target2026 == null ? 0 : 1) + (r.target2027 == null ? 0 : 1), 0),
    },
    unresolved: unresolved.map(r => ({ row: r.no, owner: r.ownerText, title: r.title })),
  };
}

async function writeSnapshot(summary) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `apply-plan-2025-2027-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(summary, null, 2), 'utf8');
  return file;
}

async function archiveLegacy(tx, now) {
  await tx.kpiFollowUp.deleteMany({});
  await tx.kpiEntry.deleteMany({});
  await tx.annualTarget.deleteMany({});
  await tx.indicator.updateMany({ where: { deletedAt: null }, data: { deletedAt: now } });
  await tx.operationalActivity.updateMany({ where: { deletedAt: null }, data: { deletedAt: now } });
  await tx.objective.updateMany({ where: { deletedAt: null }, data: { deletedAt: now, status: 'CANCELLED' } });
  await tx.strategicGoal.updateMany({ where: { deletedAt: null }, data: { deletedAt: now, status: 'ARCHIVED' } });
  await tx.axis.updateMany({ where: { deletedAt: null }, data: { deletedAt: now } });
  await tx.strategicPlan.updateMany({ where: { deletedAt: null }, data: { deletedAt: now, status: 'ARCHIVED' } });
}

async function applyPlan(rows, ref) {
  const { rows: resolvedRows, admin, unresolved } = buildResolvedRows(rows, ref);
  if (!admin?.id) throw new Error('No active SUPER_ADMIN/admin user found for createdBy fields.');
  if (unresolved.length) {
    throw new Error(`Unresolved owner mappings: ${unresolved.map(r => `${r.no}:${r.ownerText}`).join(', ')}`);
  }

  const axes = uniqueBy(resolvedRows, r => normalizeKey(r.axis));
  const goals = uniqueBy(resolvedRows.filter(r => r.goal), r => `${normalizeKey(r.axis)}::${normalizeKey(r.goal)}`);
  const indicators = resolvedRows.filter(r => r.level.includes('استراتيجي') || r.level.includes('تشغيلي'));
  const activities = resolvedRows.filter(r => r.level.includes('نشاط'));
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    if (ARCHIVE_LEGACY) await archiveLegacy(tx, now);

    const plan = await tx.strategicPlan.upsert({
      where: { code: 'PLAN-2025-2027' },
      update: {
        title: 'الخطة الاستراتيجية المحسّنة 2025-2027',
        description: 'نسخة محسّنة داخلياً مبنية على الخطة المعتمدة 2025-2027 والخطة التشغيلية 2026.',
        startYear: 2025,
        endYear: 2027,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        code: 'PLAN-2025-2027',
        title: 'الخطة الاستراتيجية المحسّنة 2025-2027',
        description: 'نسخة محسّنة داخلياً مبنية على الخطة المعتمدة 2025-2027 والخطة التشغيلية 2026.',
        startYear: 2025,
        endYear: 2027,
        status: 'ACTIVE',
      },
    });

    const axisByKey = new Map();
    for (let i = 0; i < axes.length; i += 1) {
      const row = axes[i];
      const axis = await tx.axis.upsert({
        where: { code: `AX25-${slug(i + 1)}` },
        update: { nameAr: row.axis, order: i + 1, weight: 25, deletedAt: null },
        create: { code: `AX25-${slug(i + 1)}`, nameAr: row.axis, order: i + 1, weight: 25 },
      });
      axisByKey.set(normalizeKey(row.axis), axis);
    }

    const goalByKey = new Map();
    for (let i = 0; i < goals.length; i += 1) {
      const row = goals[i];
      const axis = axisByKey.get(normalizeKey(row.axis));
      const owner = resolvedRows.find(r => normalizeKey(r.goal) === normalizeKey(row.goal)) || row;
      const goal = await tx.strategicGoal.upsert({
        where: { code: `SG25-${slug(i + 1, 3)}` },
        update: {
          title: row.goal,
          perspective: row.axis,
          startYear: 2025,
          endYear: 2027,
          status: 'ACTIVE',
          planId: plan.id,
          axisId: axis?.id || null,
          ownerUserId: owner.ownerId || null,
          responsible: owner.ownerText || null,
          deletedAt: null,
        },
        create: {
          code: `SG25-${slug(i + 1, 3)}`,
          title: row.goal,
          perspective: row.axis,
          startYear: 2025,
          endYear: 2027,
          status: 'ACTIVE',
          planId: plan.id,
          axisId: axis?.id || null,
          ownerUserId: owner.ownerId || null,
          responsible: owner.ownerText || null,
        },
      });
      goalByKey.set(`${normalizeKey(row.axis)}::${normalizeKey(row.goal)}`, goal);
    }

    for (let i = 0; i < indicators.length; i += 1) {
      const row = indicators[i];
      const axis = axisByKey.get(normalizeKey(row.axis));
      const goal = goalByKey.get(`${normalizeKey(row.axis)}::${normalizeKey(row.goal)}`);
      const ind = await tx.indicator.upsert({
        where: { code: `IND25-${slug(i + 1, 3)}` },
        update: {
          nameAr: row.title,
          definition: `${row.axis} / ${row.goal}`,
          formula: row.level,
          unit: row.unit,
          direction: 'HIGHER_BETTER',
          frequency: row.frequency,
          kpiType: row.kpiType,
          seasonality: row.seasonality,
          baseline: row.baseline2025,
          isoClause: row.isoClause || null,
          notes: `مالك الأداء: ${row.ownerText} | الجهة المراقبة: ${row.monitorText || '—'} | التوقيت: ${row.timing2026 || '—'}`,
          axisId: axis?.id || null,
          ownerId: row.ownerId,
          dataEntryUserId: row.dataEntryUserId,
          approverUserId: row.approverUserId,
          deletedAt: null,
        },
        create: {
          code: `IND25-${slug(i + 1, 3)}`,
          nameAr: row.title,
          definition: `${row.axis} / ${row.goal}`,
          formula: row.level,
          unit: row.unit,
          direction: 'HIGHER_BETTER',
          frequency: row.frequency,
          kpiType: row.kpiType,
          seasonality: row.seasonality,
          indicatorType: row.level.includes('استراتيجي') ? 'LAGGING' : 'LEADING',
          dataSource: 'MANUAL',
          baseline: row.baseline2025,
          isoClause: row.isoClause || null,
          notes: `مالك الأداء: ${row.ownerText} | الجهة المراقبة: ${row.monitorText || '—'} | التوقيت: ${row.timing2026 || '—'}${goal ? ` | الهدف الاستراتيجي: ${goal.code}` : ''}`,
          axisId: axis?.id || null,
          ownerId: row.ownerId,
          dataEntryUserId: row.dataEntryUserId,
          approverUserId: row.approverUserId,
        },
      });

      for (const year of [2026, 2027]) {
        const targetValue = row[`target${year}`];
        if (targetValue == null) continue;
        await tx.annualTarget.upsert({
          where: { indicatorId_year: { indicatorId: ind.id, year } },
          update: { targetValue, modificationReason: 'تحديث مستهدفات الخطة المحسّنة 2025-2027' },
          create: { indicatorId: ind.id, year, targetValue, createdById: admin.id },
        });
      }
    }

    for (let i = 0; i < activities.length; i += 1) {
      const row = activities[i];
      const goal = goalByKey.get(`${normalizeKey(row.axis)}::${normalizeKey(row.goal)}`);
      await tx.operationalActivity.upsert({
        where: { code: `ACT25-${slug(i + 1, 3)}` },
        update: {
          title: row.title,
          perspective: row.axis,
          department: row.ownerText,
          responsible: row.ownerText,
          year: 2026,
          budget: row.budget,
          targetValue: row.target2026,
          targetUnit: row.unit,
          kpiType: row.kpiType,
          seasonality: row.seasonality,
          strategicGoalId: goal?.id || null,
          ownerId: row.ownerId,
          deptId: row.deptId,
          deletedAt: null,
        },
        create: {
          code: `ACT25-${slug(i + 1, 3)}`,
          title: row.title,
          description: row.timing2026 || null,
          perspective: row.axis,
          department: row.ownerText,
          responsible: row.ownerText,
          year: 2026,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          budget: row.budget,
          status: 'PLANNED',
          strategicGoalId: goal?.id || null,
          kpiType: row.kpiType,
          targetValue: row.target2026,
          targetUnit: row.unit,
          seasonality: row.seasonality,
          ownerId: row.ownerId,
          deptId: row.deptId,
        },
      });
    }

    return {
      planId: plan.id,
      axes: axes.length,
      goals: goals.length,
      indicators: indicators.length,
      activities: activities.length,
    };
  }, { timeout: 120_000 });
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(PLAN_FILE);
  const rows = readRows(workbook);
  const ref = await loadReference();
  const resolved = buildResolvedRows(rows, ref);
  const summary = buildSummary(rows, ref, resolved.unresolved);
  const snapshot = await writeSnapshot(summary);

  if (!APPLY) {
    console.log(JSON.stringify({ ok: true, dryRun: true, snapshot, ...summary }, null, 2));
    return;
  }
  if (!ARCHIVE_LEGACY) {
    throw new Error('Refusing to apply without --archive-legacy. This plan reset must archive old planning records first.');
  }

  const result = await applyPlan(rows, ref);
  console.log(JSON.stringify({ ok: true, applied: true, snapshot, result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
