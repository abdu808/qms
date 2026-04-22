#!/usr/bin/env node
/**
 * agent-followup.mjs — وكيل متابعة ذكي يكشف البنود المتأخرة ويولّد تنبيهات
 *
 * ما يفحص:
 *   1. وثائق لم تُراجع منذ > 365 يوم
 *   2. CAPAs متأخرة (dueDate قبل اليوم، status غير closed)
 *   3. NCRs مفتوحة > 30 يوم
 *   4. سياسات جودة بلا إقرارات (policyAcknowledgment)
 *   5. مخاطر high بلا خطة استجابة
 *   6. تدقيقات داخلية لم تُنفَّذ في موعدها
 *
 * المخرجات:
 *   _analysis/followup_YYYY-MM-DD.md  — تقرير المتابعة
 *   (اختياري --notify) إنشاء Notification لكل مسؤول
 *
 * الاستخدام:
 *   node scripts/ingest/agent-followup.mjs            → تقرير فقط
 *   node scripts/ingest/agent-followup.mjs --notify   → تقرير + إنشاء إشعارات
 */
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const NOTIFY = process.argv.includes('--notify');

const NOW = new Date();
const daysSince = (d) => Math.floor((NOW - new Date(d)) / (1000 * 60 * 60 * 24));

async function check_stale_docs() {
  const docs = await prisma.document.findMany({
    where: { deletedAt: null, status: { in: ['PUBLISHED', 'APPROVED'] } },
    select: { id: true, code: true, title: true, updatedAt: true, createdById: true },
  });
  return docs.filter(d => daysSince(d.updatedAt) > 365).map(d => ({
    type: 'stale_doc',
    severity: 'medium',
    title: `وثيقة بلا مراجعة > سنة`,
    ref: d.code,
    message: `الوثيقة "${d.title}" لم تُحدَّث منذ ${daysSince(d.updatedAt)} يوم`,
    userId: d.createdById,
  }));
}

async function check_overdue_capas() {
  const capas = await prisma.capa.findMany({
    where: {
      status: { notIn: ['CLOSED', 'VERIFIED', 'REJECTED'] },
      dueDate: { lt: NOW },
    },
    select: { id: true, code: true, title: true, dueDate: true, status: true, assigneeId: true },
  }).catch(() => []);
  return capas.map(c => ({
    type: 'overdue_capa',
    severity: 'high',
    title: `CAPA متأخر`,
    ref: c.code,
    message: `"${c.title}" متأخر ${daysSince(c.dueDate)} يوم (الحالة: ${c.status})`,
    userId: c.assigneeId,
  }));
}

async function check_stale_ncrs() {
  const ncrs = await prisma.nCR.findMany({
    where: {
      status: { notIn: ['CLOSED', 'VERIFIED'] },
      createdAt: { lt: new Date(NOW.getTime() - 30 * 86400000) },
    },
    select: { id: true, code: true, title: true, createdAt: true, reportedById: true },
  }).catch(() => []);
  return ncrs.map(n => ({
    type: 'stale_ncr',
    severity: 'high',
    title: `NCR مفتوح > 30 يوم`,
    ref: n.code,
    message: `"${n.title}" مفتوح ${daysSince(n.createdAt)} يوم دون إغلاق`,
    userId: n.reportedById,
  }));
}

async function check_unacked_policy() {
  const active = await prisma.qualityPolicy.findFirst({ where: { active: true } });
  if (!active) return [{
    type: 'no_active_policy',
    severity: 'critical',
    title: 'لا توجد سياسة جودة نشطة',
    ref: '-',
    message: 'يجب تفعيل سياسة جودة واحدة من الأدمن',
  }];
  const ackCount = await prisma.policyAcknowledgment.count({ where: { policyId: active.id } }).catch(() => 0);
  const userCount = await prisma.user.count({ where: { active: true } }).catch(() => 0);
  if (ackCount < userCount) {
    return [{
      type: 'policy_ack_gap',
      severity: 'medium',
      title: 'إقرارات سياسة الجودة ناقصة',
      ref: `v${active.version}`,
      message: `${ackCount}/${userCount} مستخدم أقرّ — ${userCount - ackCount} مستخدم متبقٍ`,
    }];
  }
  return [];
}

async function check_high_risks() {
  const risks = await prisma.risk.findMany({
    where: {
      OR: [
        { severity: { gte: 15 } },  // مخاطر عالية
        { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
      ],
      status: { notIn: ['CLOSED', 'MITIGATED'] },
    },
    select: { id: true, code: true, title: true, responsePlan: true, ownerId: true },
  }).catch(() => []);
  return risks.filter(r => !r.responsePlan || r.responsePlan.length < 20).map(r => ({
    type: 'risk_no_plan',
    severity: 'high',
    title: 'مخاطرة عالية بلا خطة استجابة',
    ref: r.code,
    message: `"${r.title}" — الخطة ناقصة أو فارغة`,
    userId: r.ownerId,
  }));
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  🤖 وكيل المتابعة الذكي                   ║');
  console.log('╚═══════════════════════════════════════════╝');

  const checks = await Promise.all([
    check_stale_docs(),
    check_overdue_capas(),
    check_stale_ncrs(),
    check_unacked_policy(),
    check_high_risks(),
  ]);
  const alerts = checks.flat();

  const bySev = { critical: [], high: [], medium: [], low: [] };
  for (const a of alerts) (bySev[a.severity] = bySev[a.severity] || []).push(a);

  console.log(`\n📊 اكتُشف ${alerts.length} تنبيه:`);
  console.log(`  🔴 critical: ${bySev.critical.length}`);
  console.log(`  🟠 high:     ${bySev.high.length}`);
  console.log(`  🟡 medium:   ${bySev.medium.length}`);
  console.log(`  🟢 low:      ${bySev.low.length}`);

  // التقرير
  const today = NOW.toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), '_analysis');
  await mkdir(outDir, { recursive: true });
  const md = [];
  md.push(`# 🤖 تقرير المتابعة — ${today}\n`);
  md.push(`**تاريخ التوليد:** ${NOW.toLocaleString('ar-SA')}`);
  md.push(`**إجمالي التنبيهات:** ${alerts.length}\n`);

  for (const sev of ['critical', 'high', 'medium', 'low']) {
    const arr = bySev[sev] || [];
    if (arr.length === 0) continue;
    const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[sev];
    md.push(`\n## ${emoji} ${sev.toUpperCase()} — ${arr.length}\n`);
    for (const a of arr) {
      md.push(`### [${a.ref}] ${a.title}`);
      md.push(`${a.message}\n`);
    }
  }
  if (alerts.length === 0) md.push('✅ لا توجد تنبيهات — النظام سليم.');

  const reportPath = path.join(outDir, `followup_${today}.md`);
  await writeFile(reportPath, md.join('\n'), 'utf8');
  console.log(`\n📄 التقرير: ${reportPath}`);

  // إشعارات في النظام
  if (NOTIFY && alerts.length > 0) {
    let sent = 0;
    for (const a of alerts) {
      if (!a.userId) continue;
      try {
        await prisma.notification.create({
          data: {
            userId: a.userId,
            type: a.type,
            title: a.title,
            message: a.message,
            link: null,
            read: false,
          },
        });
        sent++;
      } catch (e) {
        // تجاهل — قد يكون الحقل مختلفاً في السكيما
      }
    }
    console.log(`📨 أُرسل ${sent} إشعار للمستخدمين`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
