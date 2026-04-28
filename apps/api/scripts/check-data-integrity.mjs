#!/usr/bin/env node
/**
 * check-data-integrity.mjs — فحص سلامة بيانات QMS (قراءة فقط)
 *
 * الاستخدام:
 *   node apps/api/scripts/check-data-integrity.mjs
 *   node apps/api/scripts/check-data-integrity.mjs --json        # ناتج JSON
 *   node apps/api/scripts/check-data-integrity.mjs --fail-fast   # توقف عند أول مشكلة
 *
 * ملاحظة: هذا السكربت قراءة فقط — لا يُعدِّل أي بيانات.
 * يُشغَّل دورياً (أو بعد كل migration كبير) للتحقق من:
 *   1. KpiEntry يتامى (لا FK محدد)
 *   2. KpiEntry بـ FK مزدوج (أكثر من رابط واحد)
 *   3. AnnualTarget مكرر لنفس Indicator × سنة
 *   4. Indicator مكرر لنفس Objective (أكثر من مؤشر للهدف نفسه)
 *   5. FollowUpTask بلا مالك نشط
 *   6. AuditFinding يتيم (auditId يشير إلى Audit محذوف)
 *   7. Risk بمستوى HIGH/CRITICAL بلا حقول أساسية (owner, department, treatment, reviewDate)
 *   8. NCR بحالة CLOSED بلا توثيق الإغلاق (verifiedAt أو verifiedNote أو effective)
 *   9. CAPA بحالة CLOSED بلا فحص الفاعلية (effective = null)
 *  10. KpiEntry بلا قيمة فعلية (actualValue = null — تعني إدخالاً ناقصاً)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args   = process.argv.slice(2);
const JSON_MODE  = args.includes('--json');
const FAIL_FAST  = args.includes('--fail-fast');

// ─── طباعة مساعدة ────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function log(msg) { if (!JSON_MODE) process.stdout.write(msg + '\n'); }
function ok(label)        { log(`  ${GREEN}✅${RESET} ${label}`); }
function warn(label, n)   { log(`  ${YELLOW}⚠️ ${RESET} ${label} — ${YELLOW}${n} سجل${RESET}`); }
function err(label, n)    { log(`  ${RED}❌${RESET} ${label} — ${RED}${n} سجل${RESET}`); }
function section(title)   { log(`\n${BOLD}${CYAN}── ${title} ──${RESET}`); }

// ─── هيكل النتائج ────────────────────────────────────────────────────────────
const results = [];
let hasErrors   = false;
let hasWarnings = false;

function record({ id, label, count, severity, samples = [] }) {
  results.push({ id, label, count, severity, samples });
  if (count === 0) {
    ok(label);
    return;
  }
  if (severity === 'ERROR') {
    hasErrors = true;
    err(label, count);
  } else {
    hasWarnings = true;
    warn(label, count);
  }
  if (samples.length && !JSON_MODE) {
    for (const s of samples.slice(0, 3)) {
      log(`        ${YELLOW}↳${RESET} ${s}`);
    }
    if (samples.length > 3) log(`        ${YELLOW}↳${RESET} ... و${samples.length - 3} آخرين`);
  }
}

// ─── helper: تشغيل فحص واحد بأمان ────────────────────────────────────────────
async function runCheck(checkFn) {
  try {
    return await checkFn();
  } catch (e) {
    return { id: '?', label: 'خطأ في الفحص', count: -1, severity: 'ERROR', error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// الفحوصات
// ═══════════════════════════════════════════════════════════════════════════════

/** 1. KpiEntry يتامى — لا objectiveId ولا activityId ولا indicatorId */
async function checkKpiOrphans() {
  const rows = await prisma.kpiEntry.findMany({
    where: { objectiveId: null, activityId: null, indicatorId: null },
    select: { id: true, year: true, month: true },
    take: 20,
  });
  return {
    id: 'KPI-001',
    label: 'KpiEntry يتامى (بلا FK)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r => `id=${r.id} (${r.year}/${r.month})`),
  };
}

/** 2. KpiEntry بـ FK مزدوج — أكثر من رابط واحد محدد */
async function checkKpiDualFk() {
  // نحسب عدد FKs غير-null لكل صف
  const rows = await prisma.$queryRaw`
    SELECT id, year, month,
           "objectiveId", "activityId", "indicatorId"
    FROM   "KpiEntry"
    WHERE  (CASE WHEN "objectiveId"  IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN "activityId"   IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN "indicatorId"  IS NOT NULL THEN 1 ELSE 0 END) > 1
    LIMIT  20
  `;
  return {
    id: 'KPI-002',
    label: 'KpiEntry بـ FK مزدوج (أكثر من رابط واحد)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r =>
      `id=${r.id} (${r.year}/${r.month}) obj=${r.objectiveId ?? '-'} act=${r.activityId ?? '-'} ind=${r.indicatorId ?? '-'}`
    ),
  };
}

/** 3. AnnualTarget مكرر — نفس indicatorId + year أكثر من مرة */
async function checkAnnualTargetDuplicates() {
  const dupes = await prisma.$queryRaw`
    SELECT "indicatorId", year, COUNT(*) as cnt
    FROM   "AnnualTarget"
    GROUP  BY "indicatorId", year
    HAVING COUNT(*) > 1
    LIMIT  20
  `;
  return {
    id: 'AT-001',
    label: 'AnnualTarget مكرر (indicatorId + year)',
    count: dupes.length,
    severity: 'ERROR',
    samples: dupes.map(r => `indicatorId=${r.indicatorId} year=${r.year} (${r.cnt} مرة)`),
  };
}

/** 4. Indicator مكرر لنفس Objective (أكثر من indicator يشير لنفس objective) */
async function checkIndicatorDuplicatesPerObjective() {
  const dupes = await prisma.$queryRaw`
    SELECT "objectiveId", COUNT(*) as cnt
    FROM   "Indicator"
    WHERE  "objectiveId" IS NOT NULL
      AND  "deletedAt"   IS NULL
    GROUP  BY "objectiveId"
    HAVING COUNT(*) > 1
    LIMIT  20
  `;
  // هذا ليس خطأ بالضرورة (objective قد يملك عدة مؤشرات)
  // لكنه يستحق التحقق — WARN
  return {
    id: 'IND-001',
    label: 'Objective تحمل أكثر من Indicator واحد (تحقق من القصد)',
    count: dupes.length,
    severity: 'WARN',
    samples: dupes.map(r => `objectiveId=${r.objectiveId} (${r.cnt} مؤشرات)`),
  };
}

/** 5. FollowUpTask بلا مالك نشط (ownerId يشير لمستخدم محذوف/غير نشط) */
async function checkFollowUpTaskOwner() {
  // نجد FollowUpTasks الغير منتهية بلا مالك نشط
  const rows = await prisma.$queryRaw`
    SELECT f.id, f.code, f.status, f."ownerId"
    FROM   "FollowUpTask" f
    WHERE  f."deletedAt" IS NULL
      AND  f.status NOT IN ('DONE', 'CANCELLED')
      AND  (
        f."ownerId" IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM "User" u
          WHERE u.id = f."ownerId" AND u.active = true
        )
      )
    LIMIT  20
  `;
  return {
    id: 'FUT-001',
    label: 'FollowUpTask نشطة بلا مالك فعّال',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r => `id=${r.id} code=${r.code} status=${r.status} ownerId=${r.ownerId ?? 'NULL'}`),
  };
}

/** 6. AuditFinding يتيم — auditId يشير إلى Audit غير موجود */
async function checkAuditFindingOrphans() {
  const rows = await prisma.$queryRaw`
    SELECT af.id, af.code, af."auditId"
    FROM   "AuditFinding" af
    WHERE  NOT EXISTS (
      SELECT 1 FROM "Audit" a WHERE a.id = af."auditId"
    )
    LIMIT  20
  `;
  return {
    id: 'AF-001',
    label: 'AuditFinding بلا Audit أب (يتيم)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r => `id=${r.id} code=${r.code} auditId=${r.auditId}`),
  };
}

/** 7. Risk بمستوى HIGH/CRITICAL بلا حقول أساسية */
async function checkCriticalRisksMissingFields() {
  const rows = await prisma.$queryRaw`
    SELECT id, code, level
    FROM   "Risk"
    WHERE  "deletedAt" IS NULL
      AND  level IN ('مرتفع', 'حرج', 'HIGH', 'CRITICAL')
      AND  (
        "ownerId"    IS NULL OR
        "departmentId" IS NULL OR
        treatment    IS NULL OR
        "reviewDate" IS NULL
      )
    LIMIT  30
  `;
  return {
    id: 'RSK-001',
    label: 'Risk مرتفع/حرج ناقص بيانات (owner/dept/treatment/reviewDate)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r => `code=${r.code} level=${r.level}`),
  };
}

/** 8. NCR CLOSED بلا توثيق الإغلاق (verifiedAt أو verifiedNote أو effective) */
async function checkNcrClosedWithoutVerification() {
  const rows = await prisma.nCR.findMany({
    where: {
      deletedAt: null,
      status: 'CLOSED',
      OR: [
        { verifiedAt:   null },
        { verifiedNote: null },
        { effective:    null },
      ],
    },
    select: { id: true, code: true, verifiedAt: true, verifiedNote: true, effective: true },
    take: 20,
  });
  return {
    id: 'NCR-001',
    label: 'NCR مُغلق بلا توثيق التحقق (verifiedAt/verifiedNote/effective)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r =>
      `code=${r.code} verifiedAt=${r.verifiedAt ? '✓' : '✗'} note=${r.verifiedNote ? '✓' : '✗'} effective=${r.effective ?? 'null'}`
    ),
  };
}

/** 9. CAPA CLOSED بلا فحص الفاعلية (effective = null) */
async function checkCapaClosedWithoutEffectiveness() {
  const rows = await prisma.capa.findMany({
    where: { status: 'CLOSED', effective: null },
    select: { id: true, code: true, closedAt: true },
    take: 20,
  });
  return {
    id: 'CAPA-001',
    label: 'CAPA مُغلقة بلا فحص فاعلية (effective = null)',
    count: rows.length,
    severity: 'ERROR',
    samples: rows.map(r => `code=${r.code} closedAt=${r.closedAt?.toISOString().slice(0,10) ?? '-'}`),
  };
}

/** 10. KpiEntry بـ actualValue = null (إدخال ناقص) */
async function checkKpiNullValues() {
  const count = await prisma.kpiEntry.count({
    where: { actualValue: null },
  });
  const samples = count > 0
    ? await prisma.kpiEntry.findMany({
        where:   { actualValue: null },
        select:  { id: true, year: true, month: true, objectiveId: true, activityId: true, indicatorId: true },
        take:    5,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
    : [];
  return {
    id: 'KPI-003',
    label: 'KpiEntry بـ actualValue = null (إدخال ناقص)',
    count,
    severity: 'WARN',
    samples: samples.map(r => `id=${r.id} (${r.year}/${r.month})`),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// التشغيل الرئيسي
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗`);
  log(`║      QMS — فحص سلامة البيانات (قراءة فقط)      ║`);
  log(`╚══════════════════════════════════════════════════╝${RESET}`);
  log(`  ${CYAN}التاريخ:${RESET} ${new Date().toISOString()}`);

  const checks = [
    { id: 'KPI',    title: 'KpiEntry — سلامة الروابط',              fns: [checkKpiOrphans, checkKpiDualFk, checkKpiNullValues] },
    { id: 'AT',     title: 'AnnualTarget — تكرار',                  fns: [checkAnnualTargetDuplicates] },
    { id: 'IND',    title: 'Indicator — هيكل الربط',                fns: [checkIndicatorDuplicatesPerObjective] },
    { id: 'FUT',    title: 'FollowUpTask — ملكية المهام',           fns: [checkFollowUpTaskOwner] },
    { id: 'AF',     title: 'AuditFinding — ارتباط التدقيق',         fns: [checkAuditFindingOrphans] },
    { id: 'RSK',    title: 'Risk — اكتمال البيانات',                fns: [checkCriticalRisksMissingFields] },
    { id: 'NCR',    title: 'NCR — توثيق الإغلاق',                   fns: [checkNcrClosedWithoutVerification] },
    { id: 'CAPA',   title: 'CAPA — فحص الفاعلية',                   fns: [checkCapaClosedWithoutEffectiveness] },
  ];

  for (const group of checks) {
    section(group.title);
    for (const fn of group.fns) {
      const result = await runCheck(fn);
      if (result.error) {
        log(`  ${RED}⛔ خطأ في تشغيل الفحص: ${result.error}${RESET}`);
        results.push({ ...result, id: fn.name });
        hasErrors = true;
      } else {
        record(result);
      }
      if (FAIL_FAST && hasErrors) break;
    }
    if (FAIL_FAST && hasErrors) break;
  }

  // ─── ملخص نهائي ────────────────────────────────────────────────────────────
  const totalIssues = results.filter(r => r.count > 0).length;
  const errorChecks = results.filter(r => r.count > 0 && r.severity === 'ERROR').length;
  const warnChecks  = results.filter(r => r.count > 0 && r.severity === 'WARN').length;

  log(`\n${BOLD}${CYAN}── الملخص ──${RESET}`);
  log(`  الفحوصات المُشغَّلة: ${results.length}`);
  log(`  ${GREEN}نظيفة:${RESET}   ${results.filter(r => r.count === 0).length}`);
  log(`  ${YELLOW}تحذيرات:${RESET} ${warnChecks}`);
  log(`  ${RED}أخطاء:${RESET}   ${errorChecks}`);

  if (!hasErrors && !hasWarnings) {
    log(`\n  ${GREEN}${BOLD}✅ جميع الفحوصات نظيفة — البيانات سليمة.${RESET}\n`);
  } else if (!hasErrors) {
    log(`\n  ${YELLOW}${BOLD}⚠️  توجد تحذيرات تستحق المراجعة.${RESET}\n`);
  } else {
    log(`\n  ${RED}${BOLD}❌ توجد مشكلات سلامة تحتاج معالجة فورية.${RESET}\n`);
  }

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify({
      at: new Date().toISOString(),
      summary: {
        total: results.length,
        clean: results.filter(r => r.count === 0).length,
        warnings: warnChecks,
        errors: errorChecks,
        hasErrors,
        hasWarnings,
      },
      checks: results,
    }, null, 2) + '\n');
  }

  await prisma.$disconnect();
  process.exit(hasErrors ? 1 : 0);
}

main().catch(async (e) => {
  console.error('❌ فشل فحص سلامة البيانات:', e.message);
  await prisma.$disconnect();
  process.exit(2);
});
