# Prisma Schema Changes - Copy & Paste Ready

**Quick Apply Guide**  
**Use this for rapid implementation**

---

## Instructions

1. Open: `apps/api/prisma/schema.prisma`
2. Find each section below (using Ctrl+F)
3. Copy the provided code and insert it in the correct location
4. Save and run `npx prisma migrate dev --name add_kpi_followup_system`

---

## CHANGE #1: Add KpiFollowUp Model

**Where:** After `model Indicator` (around line 1950)

**Find This (last lines of Indicator model):**
```prisma
  @@index([objectiveId])
  @@index([axisId])
  @@index([ownerId])
  @@index([deletedAt])
}
```

**Add After (paste after closing brace of Indicator):**

```prisma
// =====================================================
// KPI FOLLOW-UP SYSTEM
// Tracks overdue KPI entries and escalation workflow
// =====================================================

model KpiFollowUp {
  // ── Identification & Audit ─────────────────────────────
  id                String    @id @default(cuid())
  code              String    @unique  // KFU-2026-0001

  // ── KPI Reference ─────────────────────────────────────
  indicatorId       String
  indicator         Indicator @relation("IndicatorFollowUp", fields: [indicatorId], references: [id], onDelete: Cascade)

  // ── Period Reference ──────────────────────────────────
  year              Int
  month             Int       // 1-12; uniqueness enforced via @@unique

  // ── Department & Personnel ─────────────────────────────
  departmentId      String
  department        Department @relation("DepartmentFollowUp", fields: [departmentId], references: [id])

  // Who is responsible for entering the data?
  dataEntryUserId   String
  dataEntryUser     User      @relation("KpiFollowUpDataEntry", fields: [dataEntryUserId], references: [id])

  // Who owns the performance target/objective?
  performanceOwnerId String?
  performanceOwner   User?     @relation("KpiFollowUpPerfOwner", fields: [performanceOwnerId], references: [id])

  // ── Deadline & Calculation ────────────────────────────
  dueDate           DateTime  // Deadline for entry submission
  submittedAt       DateTime? // When was the entry actually submitted?
  daysLate          Int?      // Auto-calculated: (NOW - dueDate) / 86400, NULL if on-time

  // ── Previous Entry Reference ───────────────────────────
  // Links to the last successful entry (for comparison/context)
  previousEntryId   String?
  previousEntry     KpiEntry? @relation("PreviousKpiEntry", fields: [previousEntryId], references: [id])

  // ── Related Entry After Action ─────────────────────────
  // Once resolved, links to the finally-submitted entry
  resolvedEntryId   String?
  resolvedEntry     KpiEntry? @relation("ResolvedKpiEntry", fields: [resolvedEntryId], references: [id])

  // ── Status & Escalation ────────────────────────────────
  // PENDING      → just detected, awaiting action
  // FIRST_NOTICE → QM sent first reminder
  // ESCALATED    → escalated to dept manager / executive director
  // RESOLVED     → entry submitted after escalation
  // ABORTED      → month closed without entry; requires data imputation
  status            String    @default("PENDING")

  // Escalation tracking
  escalationLevel   Int       @default(0)  // 0: none, 1: dept manager, 2: exec director
  escalatedAt       DateTime?
  escalatedById     String?
  escalatedBy       User?     @relation("KpiFollowUpEscalatedBy", fields: [escalatedById], references: [id])

  // ── QMS Manager Notes ──────────────────────────────────
  qmNotes           String?   @db.Text  // Context, intervention history, etc.

  // ── Audit Trail ────────────────────────────────────────
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  resolvedAt        DateTime?

  // ── Constraints & Indexes ──────────────────────────────
  @@unique([indicatorId, year, month])
  @@index([departmentId])
  @@index([dataEntryUserId])
  @@index([performanceOwnerId])
  @@index([year, month])
  @@index([status])
  @@index([dueDate])
  @@index([escalationLevel])
}
```

---

## CHANGE #2: Update Indicator Model

**Where:** Find the closing brace of `model Indicator`

**Find This:**
```prisma
  @@index([objectiveId])
  @@index([axisId])
  @@index([ownerId])
  @@index([deletedAt])
}
```

**Replace With:**
```prisma
  @@index([objectiveId])
  @@index([axisId])
  @@index([ownerId])
  @@index([deletedAt])

  // ── KPI Follow-Up back-relation ────────────────────────
  kpiFollowUps      KpiFollowUp[]  @relation("IndicatorFollowUp")
}
```

---

## CHANGE #3: Update KpiEntry Model

**Where:** Find the closing brace of `model KpiEntry` (around line 1116)

**Find This:**
```prisma
  @@unique([objectiveId, year, month])
  @@unique([activityId, year, month])
  @@unique([indicatorId, year, month])
  @@index([year, month])
  @@index([objectiveId])
  @@index([activityId])
  @@index([indicatorId])
}
```

**Replace With:**
```prisma
  @@unique([objectiveId, year, month])
  @@unique([activityId, year, month])
  @@unique([indicatorId, year, month])
  @@index([year, month])
  @@index([objectiveId])
  @@index([activityId])
  @@index([indicatorId])

  // ── KPI Follow-Up back-relations ───────────────────────
  followUpResolved  KpiFollowUp? @relation("ResolvedKpiEntry")
  followUpPrevious  KpiFollowUp? @relation("PreviousKpiEntry")
}
```

---

## CHANGE #4: Update User Model

**Where:** Find the closing brace of `model User` (around line 119)

**Current ending looks like:**
```prisma
  // ── Audit task 9 (architectural): AuditFinding ──
  findingsOwned                AuditFinding[]          @relation("FindingOwner")
  findingsCreated              AuditFinding[]          @relation("FindingCreator")

  @@index([email])
  @@index([departmentId])
}
```

**Replace With:**
```prisma
  // ── Audit task 9 (architectural): AuditFinding ──
  findingsOwned                AuditFinding[]          @relation("FindingOwner")
  findingsCreated              AuditFinding[]          @relation("FindingCreator")

  // ── KPI Follow-Up back-relations ───────────────────────
  kpiFollowUpsAsDataEntry     KpiFollowUp[] @relation("KpiFollowUpDataEntry")
  kpiFollowUpsAsPerfOwner     KpiFollowUp[] @relation("KpiFollowUpPerfOwner")
  kpiFollowUpsEscalated       KpiFollowUp[] @relation("KpiFollowUpEscalatedBy")

  @@index([email])
  @@index([departmentId])
}
```

---

## CHANGE #5: Update Department Model

**Where:** Find the closing brace of `model Department` (around line 169)

**Find This:**
```prisma
  beneficiariesInDept        Beneficiary[]           @relation("BenDept")
  programs                   Program[]               @relation("ProgramDept")
  competenceRequirements     CompetenceRequirement[] @relation("CompDept")
  audits                     Audit[]                 @relation("AuditDept")
  auditFindings              AuditFinding[]
}
```

**Replace With:**
```prisma
  beneficiariesInDept        Beneficiary[]           @relation("BenDept")
  programs                   Program[]               @relation("ProgramDept")
  competenceRequirements     CompetenceRequirement[] @relation("CompDept")
  audits                     Audit[]                 @relation("AuditDept")
  auditFindings              AuditFinding[]

  // ── KPI Follow-Up back-relation ────────────────────────
  kpiFollowUps                KpiFollowUp[]           @relation("DepartmentFollowUp")
}
```

---

## Validation Script

After making all changes, run this to check syntax:

```bash
cd /c/Users/abdu8/Documents/dev/qms/apps/api

# Validate schema (shows line numbers if errors)
npx prisma validate

# Expected output:
# ✓ Your schema is valid!

# If you see errors, common issues:
# - Missing closing brace }
# - Typo in @relation name (must match exactly)
# - Duplicate field names
```

---

## Apply Migration

Once schema validates:

```bash
# Creates migration and applies to DB
npx prisma migrate dev --name add_kpi_followup_system

# Expected output:
# ✓ Prisma schema has been validated.
# ✓ New migration created at prisma/migrations/[timestamp]_add_kpi_followup_system
# ✓ Database has been successfully migrated to the latest schema.
# ✓ Generated Prisma Client to ./.prisma/client
```

---

## Verify Changes

```bash
# Open Prisma Studio to view tables
npx prisma studio

# Navigate to KpiFollowUp table → should be empty but table exists
# Verify relations to Indicator, User, Department, KpiEntry
```

---

## Rollback (If Needed)

```bash
# If something goes wrong (dev only):
npx prisma migrate resolve --rolled-back add_kpi_followup_system

# Then fix schema and try again
```

---

## Quick Checklist

- [ ] Line-by-line verify CHANGE #1 (KpiFollowUp model) is complete
- [ ] Verify CHANGE #2 (Indicator back-relation) is added
- [ ] Verify CHANGE #3 (KpiEntry back-relations) are added
- [ ] Verify CHANGE #4 (User back-relations) are added
- [ ] Verify CHANGE #5 (Department back-relation) is added
- [ ] Closing braces `}` are all present
- [ ] No duplicate field names
- [ ] No duplicate @relation directives
- [ ] Run `npx prisma validate` → passes
- [ ] Run migration → succeeds
- [ ] Open Prisma Studio → KpiFollowUp table visible

---

## Common Errors & Fixes

### Error: "Argument relation of @relation is invalid..."

**Cause:** Mismatch in relation name (e.g., "IndicatorFollowUp" vs "IndicatorFollowUp")

**Fix:** Verify exact spelling in both directions:
```prisma
// Indicator side:
kpiFollowUps KpiFollowUp[] @relation("IndicatorFollowUp")

// KpiFollowUp side:
indicator Indicator @relation("IndicatorFollowUp", fields: [indicatorId], references: [id])
// Names must match EXACTLY (case-sensitive)
```

### Error: "The relation X cannot reference the model Y because..."

**Cause:** Foreign key field not declared or wrong type

**Fix:** Ensure field exists before @relation:
```prisma
indicatorId  String              // Must be declared BEFORE
indicator    Indicator @relation(..., fields: [indicatorId], ...)
```

### Error: "Unexpected token }"

**Cause:** Missing closing brace or syntax error

**Fix:** Check previous field — usually missing comma or brace

---

## Support

If issues occur:
1. Check `PRISMA_MIGRATION_GUIDE.md` (detailed troubleshooting)
2. Run `npx prisma validate` for line numbers
3. Review Prisma docs: https://www.prisma.io/docs/orm/prisma-schema
4. Contact: abdu808@gmail.com

