#!/usr/bin/env node
/**
 * Final QMS cleanup.
 *
 * Purpose:
 * - Remove archived legacy strategic-planning leftovers that have no real records.
 * - Remove obvious test/system placeholder users that have no references.
 * - Keep real KPI entries, follow-ups, targets, and active 2025-2027 plan data intact.
 *
 * Usage:
 *   node scripts/final-system-cleanup.mjs          # dry-run
 *   node scripts/final-system-cleanup.mjs --apply  # apply safe cleanup
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const legacyAxisCodes = ['FINANCIAL', 'CUSTOMER', 'PROCESS', 'LEARNING', 'GOVERNANCE'];
const legacyGoalPrefix = 'STR-2026-';
const legacyObjectivePrefix = 'OBJ-2026-';
const legacyIndicatorPrefix = 'IND-2026-';
const legacyActivityPrefix = 'ACT-2026-';

const result = {
  mode: APPLY ? 'apply' : 'dry-run',
  deleted: {},
  archived: {},
  skipped: {},
  warnings: [],
};

function add(bucket, key, value) {
  result[bucket][key] = (result[bucket][key] || 0) + value;
}

async function countUserReferences(userId) {
  const [
    ownedIndicators,
    dataIndicators,
    approvedIndicators,
    entries,
    ownedActivities,
    ownedGoals,
    initiatives,
    followUpData,
    followUpOwner,
    auditLogs,
    docsCreated,
    docsApproved,
    risksOwned,
    capaOwned,
    followTasks,
    findings,
  ] = await Promise.all([
    prisma.indicator.count({ where: { ownerId: userId } }),
    prisma.indicator.count({ where: { dataEntryUserId: userId } }),
    prisma.indicator.count({ where: { approverUserId: userId } }),
    prisma.kpiEntry.count({ where: { enteredById: userId } }),
    prisma.operationalActivity.count({ where: { ownerId: userId } }),
    prisma.strategicGoal.count({ where: { ownerUserId: userId } }),
    prisma.initiative.count({ where: { ownerId: userId } }),
    prisma.kpiFollowUp.count({ where: { dataEntryUserId: userId } }),
    prisma.kpiFollowUp.count({ where: { performanceOwnerId: userId } }),
    prisma.auditLog.count({ where: { userId } }),
    prisma.document.count({ where: { createdById: userId } }),
    prisma.document.count({ where: { approvedById: userId } }),
    prisma.risk.count({ where: { ownerId: userId } }),
    prisma.capa.count({ where: { ownerId: userId } }),
    prisma.followUpTask.count({ where: { ownerId: userId } }),
    prisma.auditFinding.count({ where: { ownerId: userId } }),
  ]);
  return ownedIndicators + dataIndicators + approvedIndicators + entries +
    ownedActivities + ownedGoals + initiatives + followUpData + followUpOwner +
    auditLogs + docsCreated + docsApproved + risksOwned + capaOwned + followTasks + findings;
}

async function deleteMany(model, key, where) {
  const count = await prisma[model].count({ where });
  if (!APPLY || count === 0) {
    add('deleted', key, APPLY ? 0 : count);
    return count;
  }
  const res = await prisma[model].deleteMany({ where });
  add('deleted', key, res.count);
  return res.count;
}

async function main() {
  // 1) Legacy deleted indicators have no entries/follow-ups/targets in the current data.
  const legacyIndicators = await prisma.indicator.findMany({
    where: { deletedAt: { not: null }, code: { startsWith: legacyIndicatorPrefix } },
    select: {
      id: true,
      code: true,
      _count: { select: { annualTargets: true, kpiEntries: true, kpiFollowUps: true, operationalActivities: true } },
    },
  });
  const purgeIndicatorIds = legacyIndicators
    .filter(i => i._count.annualTargets + i._count.kpiEntries + i._count.kpiFollowUps + i._count.operationalActivities === 0)
    .map(i => i.id);
  const skippedIndicators = legacyIndicators.length - purgeIndicatorIds.length;
  if (skippedIndicators) add('skipped', 'legacyIndicatorsWithReferences', skippedIndicators);
  await deleteMany('indicator', 'legacyDeletedIndicators', { id: { in: purgeIndicatorIds } });

  // 2) Deleted legacy activities with no KPI entries.
  const legacyActivities = await prisma.operationalActivity.findMany({
    where: {
      deletedAt: { not: null },
      OR: [
        { code: { startsWith: legacyActivityPrefix } },
        { title: { contains: 'موقع الجمعية الإلكتروني' } },
      ],
    },
    select: { id: true, code: true, _count: { select: { kpiEntries: true } } },
  });
  const purgeActivityIds = legacyActivities.filter(a => a._count.kpiEntries === 0).map(a => a.id);
  const skippedActivities = legacyActivities.length - purgeActivityIds.length;
  if (skippedActivities) add('skipped', 'legacyActivitiesWithEntries', skippedActivities);
  await deleteMany('operationalActivity', 'legacyDeletedActivities', { id: { in: purgeActivityIds } });

  // 3) Deleted legacy objectives after their legacy indicators are gone.
  const legacyObjectives = await prisma.objective.findMany({
    where: { deletedAt: { not: null }, code: { startsWith: legacyObjectivePrefix } },
    select: { id: true, code: true, _count: { select: { indicators: true, kpiEntries: true } } },
  });
  const purgeObjectiveIds = legacyObjectives
    .filter(o => o._count.indicators + o._count.kpiEntries === 0)
    .map(o => o.id);
  const skippedObjectives = legacyObjectives.length - purgeObjectiveIds.length;
  if (skippedObjectives) add('skipped', 'legacyObjectivesWithReferences', skippedObjectives);
  await deleteMany('objective', 'legacyDeletedObjectives', { id: { in: purgeObjectiveIds } });

  // 4) Deleted legacy goals after objectives/activities are gone.
  const legacyGoals = await prisma.strategicGoal.findMany({
    where: { deletedAt: { not: null }, code: { startsWith: legacyGoalPrefix } },
    select: { id: true, code: true, _count: { select: { activities: true, objectives: true, initiatives: true } } },
  });
  const purgeGoalIds = legacyGoals
    .filter(g => g._count.activities + g._count.objectives + g._count.initiatives === 0)
    .map(g => g.id);
  const skippedGoals = legacyGoals.length - purgeGoalIds.length;
  if (skippedGoals) add('skipped', 'legacyGoalsWithReferences', skippedGoals);
  await deleteMany('strategicGoal', 'legacyDeletedGoals', { id: { in: purgeGoalIds } });

  // 5) Deleted old BSC axes after legacy goals are gone.
  const oldAxes = await prisma.axis.findMany({
    where: { deletedAt: { not: null }, code: { in: legacyAxisCodes } },
    select: { id: true, code: true, _count: { select: { goals: true, indicators: true } } },
  });
  const purgeAxisIds = oldAxes.filter(a => a._count.goals + a._count.indicators === 0).map(a => a.id);
  const skippedAxes = oldAxes.length - purgeAxisIds.length;
  if (skippedAxes) add('skipped', 'legacyAxesWithReferences', skippedAxes);
  await deleteMany('axis', 'legacyDeletedAxes', { id: { in: purgeAxisIds } });

  // 6) Collapse duplicated notification follow-up tasks.
  // Keep one actionable task per notification source, preferring the formal QM account,
  // then the actual quality owner, then admin. Remove noisy clones assigned to test/system users.
  const duplicateNotificationSources = await prisma.$queryRaw`
    SELECT source, "sourceId", COUNT(*)::int AS cnt
    FROM "FollowUpTask"
    WHERE "deletedAt" IS NULL
      AND source = 'NOTIFICATION'
      AND status NOT IN ('DONE', 'CANCELLED')
    GROUP BY source, "sourceId"
    HAVING COUNT(*) > 1
  `;

  const keepEmailPriority = [
    'quality@bir-sabia.org.sa',
    'eylaf.ha12@gmail.com',
    'admin@bir-sabia.org.sa',
    'abdu808@gmail.com',
  ];

  for (const group of duplicateNotificationSources) {
    const tasks = await prisma.followUpTask.findMany({
      where: { deletedAt: null, source: group.source, sourceId: group.sourceId, status: { notIn: ['DONE', 'CANCELLED'] } },
      include: { owner: { select: { email: true } } },
      orderBy: { code: 'asc' },
    });
    const keep = tasks
      .slice()
      .sort((a, b) => {
        const ai = keepEmailPriority.indexOf(a.owner.email);
        const bi = keepEmailPriority.indexOf(b.owner.email);
        const ar = ai === -1 ? 999 : ai;
        const br = bi === -1 ? 999 : bi;
        return ar - br || a.code.localeCompare(b.code);
      })[0];
    const deleteIds = tasks.filter(t => t.id !== keep.id).map(t => t.id);
    if (deleteIds.length) {
      await deleteMany('followUpTask', 'duplicateNotificationTasks', { id: { in: deleteIds } });
    }
  }

  // 7) Reassign documents created by placeholder test accounts to the bootstrap admin,
  // then remove the placeholder users when no other references remain.
  const admin = await prisma.user.findUnique({ where: { email: 'admin@bir-sabia.org.sa' }, select: { id: true } });
  if (admin && APPLY) {
    const placeholderDocCreators = await prisma.user.findMany({
      where: {
        OR: [
          { email: { endsWith: '@test.local' } },
          { name: { contains: 'اختبار' } },
          { name: 'System' },
        ],
        NOT: { email: 'admin@bir-sabia.org.sa' },
      },
      select: { id: true },
    });
    if (placeholderDocCreators.length) {
      const res = await prisma.document.updateMany({
        where: { createdById: { in: placeholderDocCreators.map(u => u.id) } },
        data: { createdById: admin.id },
      });
      add('archived', 'documentsReassignedFromPlaceholderUsers', res.count);
    }
  }

  // 8) Add missing measured targets for the home delivery support indicator.
  // This keeps the indicator visible and trackable without inflating the plan.
  const homeDeliveryIndicator = await prisma.indicator.findFirst({
    where: { deletedAt: null, code: 'IND25-038' },
    select: { id: true },
  });
  if (homeDeliveryIndicator && admin) {
    const targets = [
      { year: 2026, value: 50 },
      { year: 2027, value: 80 },
    ];
    for (const target of targets) {
      const exists = await prisma.annualTarget.findUnique({
        where: { indicatorId_year: { indicatorId: homeDeliveryIndicator.id, year: target.year } },
        select: { id: true },
      });
      if (!exists) {
        if (APPLY) {
          await prisma.annualTarget.create({
            data: {
              indicatorId: homeDeliveryIndicator.id,
              year: target.year,
              targetValue: target.value,
              q1Target: target.value,
              q2Target: target.value,
              q3Target: target.value,
              q4Target: target.value,
              createdById: admin.id,
              modificationReason: 'مستهدف تأسيسي لمبادرة إيصال الدعم منزلياً خلال الفترة.',
            },
          });
        }
        add('archived', 'homeDeliveryTargetsCreated', 1);
      }
    }
  }

  // 9) Remove obvious placeholder/test accounts only when they have zero references.
  const candidateUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@test.local' } },
        { email: { endsWith: '@qms.local' } },
        { name: { contains: 'اختبار' } },
        { name: 'System' },
      ],
      NOT: { email: 'admin@bir-sabia.org.sa' },
    },
    select: { id: true, email: true, name: true, active: true },
  });

  for (const user of candidateUsers) {
    const refs = await countUserReferences(user.id);
    if (refs > 0) {
      add('skipped', 'placeholderUsersWithReferences', 1);
      result.warnings.push(`Skipped user ${user.email}: ${refs} references`);
      continue;
    }
    if (APPLY) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    add('deleted', 'placeholderUsersWithoutReferences', 1);
  }

  // 10) Report remaining active indicators with no annual targets.
  const activeIndicatorsWithoutTargets = await prisma.indicator.findMany({
    where: { deletedAt: null, annualTargets: { none: {} } },
    select: { code: true, nameAr: true },
    orderBy: { code: 'asc' },
  });
  if (activeIndicatorsWithoutTargets.length) {
    result.warnings.push(
      `Active indicators without annual targets: ${activeIndicatorsWithoutTargets.map(i => `${i.code} ${i.nameAr}`).join(' | ')}`
    );
  }

  // 8) Health counts after cleanup/dry-run.
  result.health = {
    axesActive: await prisma.axis.count({ where: { deletedAt: null } }),
    goalsActive: await prisma.strategicGoal.count({ where: { deletedAt: null } }),
    objectivesActive: await prisma.objective.count({ where: { deletedAt: null } }),
    indicatorsActive: await prisma.indicator.count({ where: { deletedAt: null } }),
    activitiesActive: await prisma.operationalActivity.count({ where: { deletedAt: null } }),
    usersActive: await prisma.user.count({ where: { active: true } }),
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
