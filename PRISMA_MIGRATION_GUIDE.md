# KPI Follow-Up Prisma Schema Migration Guide

**Version:** 1.0  
**Date:** 2026-05-02

---

## Quick Start

This guide walks through adding the KPI Follow-Up system to the existing QMS Prisma schema.

### Prerequisites
- Node.js 18+
- Prisma CLI installed: `npm install -g prisma@latest`
- PostgreSQL connection string in `.env`

---

## Step 1: Update `prisma/schema.prisma`

### 1.1 Add KpiFollowUp Model (after Indicator model)

Open `/c/Users/abdu8/Documents/dev/qms/apps/api/prisma/schema.prisma` and add:

```prisma
// =====================================================
// KPI FOLLOW-UP SYSTEM
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
  month             Int       // 1-12
  
  // ── Department & Personnel ─────────────────────────────
  departmentId      String
  department        Department @relation("DepartmentFollowUp", fields: [departmentId], references: [id])
  
  // Data entry responsibility
  dataEntryUserId   String
  dataEntryUser     User      @relation("KpiFollowUpDataEntry", fields: [dataEntryUserId], references: [id])
  
  // Performance owner
  performanceOwnerId String?
  performanceOwner   User?     @relation("KpiFollowUpPerfOwner", fields: [performanceOwnerId], references: [id])
  
  // ── Deadline & Calculation ────────────────────────────
  dueDate           DateTime  // Deadline for submission
  submittedAt       DateTime? // When was entry submitted?
  daysLate          Int?      // AUTO: calculated from (NOW - dueDate)
  
  // ── Previous Entry Reference ───────────────────────────
  previousEntryId   String?
  previousEntry     KpiEntry? @relation("PreviousKpiEntry", fields: [previousEntryId], references: [id])
  
  // ── Resolved Entry Reference ───────────────────────────
  resolvedEntryId   String?
  resolvedEntry     KpiEntry? @relation("ResolvedKpiEntry", fields: [resolvedEntryId], references: [id])
  
  // ── Status & Escalation ────────────────────────────────
  status            String    @default("PENDING")
  escalationLevel   Int       @default(0)
  escalatedAt       DateTime?
  escalatedById     String?
  escalatedBy       User?     @relation("KpiFollowUpEscalatedBy", fields: [escalatedById], references: [id])
  
  // ── QMS Manager Notes ──────────────────────────────────
  qmNotes           String?   @db.Text
  
  // ── Audit Trail ────────────────────────────────────────
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  resolvedAt        DateTime?
  
  // ── Constraints ────────────────────────────────────────
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

### 1.2 Update Indicator Model

Find the `model Indicator` block and add back-relation at the end:

```prisma
model Indicator {
  // ... existing fields ...
  
  kpiFollowUps      KpiFollowUp[]  @relation("IndicatorFollowUp")
}
```

### 1.3 Update KpiEntry Model

Find the `model KpiEntry` block and add back-relations:

```prisma
model KpiEntry {
  // ... existing fields ...
  
  followUpResolved  KpiFollowUp? @relation("ResolvedKpiEntry")
  followUpPrevious  KpiFollowUp? @relation("PreviousKpiEntry")
}
```

### 1.4 Update User Model

Find the `model User` block and add back-relations (append to existing relation list):

```prisma
model User {
  // ... existing fields ...
  
  // ── KPI Follow-Up Relations ────────────────────────────
  kpiFollowUpsAsDataEntry     KpiFollowUp[] @relation("KpiFollowUpDataEntry")
  kpiFollowUpsAsPerfOwner     KpiFollowUp[] @relation("KpiFollowUpPerfOwner")
  kpiFollowUpsEscalated       KpiFollowUp[] @relation("KpiFollowUpEscalatedBy")
}
```

### 1.5 Update Department Model

Find the `model Department` block and add back-relation:

```prisma
model Department {
  // ... existing fields ...
  
  kpiFollowUps                KpiFollowUp[]              @relation("DepartmentFollowUp")
}
```

---

## Step 2: Validate Schema

After editing `schema.prisma`, validate it:

```bash
cd /c/Users/abdu8/Documents/dev/qms/apps/api

# Validate the schema (no DB changes)
npx prisma validate

# Expected output: ✓ Your schema is valid!
```

---

## Step 3: Create Migration

Generate a migration file:

```bash
npx prisma migrate dev --name add_kpi_followup_system
```

**What this does:**
1. Compares current schema with last migration
2. Generates SQL for KpiFollowUp creation
3. Creates indices
4. Applies migration to local DB
5. Regenerates Prisma client

**Expected output:**
```
✓ Prisma schema has been validated.
✓ New migration created at prisma/migrations/[timestamp]_add_kpi_followup_system

✓ Database has been successfully migrated to the latest schema.
✓ Generated Prisma Client to ./.prisma/client in 234ms
```

---

## Step 4: Verify Migration

### 4.1 Check Tables in DB

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List tables (should see KpiFollowUp)
\dt KpiFollowUp

# Check columns
\d "KpiFollowUp"

# Expected output shows all fields from schema
```

### 4.2 Test with Prisma Studio

```bash
npx prisma studio

# Opens browser at http://localhost:5555
# Navigate to KpiFollowUp table → should be empty
```

### 4.3 Regenerate Prisma Client

```bash
npx prisma generate

# Expected: ✓ Generated Prisma Client to ./.prisma/client
```

---

## Step 5: Add Seed Data (Optional)

Create test data for development:

**File:** `apps/api/prisma/seed.js` (update existing)

```javascript
async function seedKpiFollowUps() {
  // Get sample data
  const indicators = await prisma.indicator.findMany({
    where: { frequency: 'MONTHLY', deletedAt: null },
    take: 5,
  });
  
  const users = await prisma.user.findMany({ take: 2 });
  const departments = await prisma.department.findMany({ take: 1 });
  
  if (!indicators.length || !users.length || !departments.length) {
    console.log('[seed] Skipping KpiFollowUp seed — missing prerequisites');
    return;
  }
  
  // Create some follow-ups
  for (let i = 0; i < 3; i++) {
    const indicator = indicators[i % indicators.length];
    
    await prisma.kpiFollowUp.upsert({
      where: {
        indicatorId_year_month: {
          indicatorId: indicator.id,
          year: 2026,
          month: i + 1,
        },
      },
      create: {
        code: `KFU-2026-${String(i + 1).padStart(4, '0')}`,
        indicatorId: indicator.id,
        year: 2026,
        month: i + 1,
        departmentId: departments[0].id,
        dataEntryUserId: users[0].id,
        performanceOwnerId: users[1].id,
        dueDate: new Date(2026, i + 1, 5),
        status: i === 0 ? 'PENDING' : 'FIRST_NOTICE',
        escalationLevel: i > 0 ? 1 : 0,
        qmNotes: `Test follow-up for ${indicator.nameAr}`,
      },
      update: {},
    });
  }
  
  console.log('✓ Seeded KPI Follow-Ups');
}

// Call from main seed function:
async function main() {
  // ... existing seed calls ...
  await seedKpiFollowUps();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Run seeding:

```bash
npx prisma db seed

# Expected: ✓ Seeded KPI Follow-Ups
```

---

## Step 6: Update TypeScript Types (if applicable)

If you use TypeScript, regenerate types:

```bash
npx prisma generate

# Creates types in node_modules/.prisma/client
```

---

## Step 7: Deploy to Staging/Production

### 7.1 Prepare Migration Script

```bash
# Generate standalone migration script (for production safety)
npx prisma migrate resolve --applied add_kpi_followup_system

# This marks migration as "already applied" — use only if migrating manually
```

### 7.2 Production Deployment

**Option A: Automated (CI/CD)**

```yaml
# .github/workflows/deploy.yml
- name: Run Prisma migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

**Option B: Manual**

```bash
# On production server (via SSH):
cd /app/qms/api

# Run pending migrations
npx prisma migrate deploy

# Verify
npx prisma db execute --stdin < verify.sql
```

---

## Rollback Procedure

If something goes wrong:

### 7.3.1 Rollback Last Migration (Dev Only)

```bash
npx prisma migrate resolve --rolled-back add_kpi_followup_system

# This removes the migration from _prisma_migrations table
# Only safe in development!
```

### 7.3.2 Manual Rollback (Production)

```sql
-- Connect to production DB
-- DROP TABLE IF EXISTS "KpiFollowUp" CASCADE;
-- DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%add_kpi_followup_system%';
```

**⚠️ WARNING:** Only execute after backup confirmation!

---

## Troubleshooting

### Issue: Migration Fails with "Foreign Key Constraint"

**Cause:** A referenced User/Department/Indicator doesn't exist.

**Solution:**
```bash
# Check for orphaned records
SELECT * FROM "User" WHERE id NOT IN (
  SELECT DISTINCT "dataEntryUserId" FROM "KpiFollowUp"
);

# If records exist, update seed or adjust migration
```

### Issue: Prisma Client Generation Fails

**Cause:** Schema syntax error.

**Solution:**
```bash
npx prisma validate

# Shows exact line with error
# Common: missing @relation directive, wrong field type
```

### Issue: Duplicate Key Error on Unique Constraint

**Cause:** Test data has duplicate (indicatorId, year, month).

**Solution:**
```sql
-- Remove duplicates
DELETE FROM "KpiFollowUp" WHERE id NOT IN (
  SELECT DISTINCT ON (indicatorId, year, month) id
  FROM "KpiFollowUp"
  ORDER BY indicatorId, year, month, "createdAt"
);
```

---

## Verification Checklist

- [ ] `npx prisma validate` passes
- [ ] Migration file created in `prisma/migrations/`
- [ ] `psql $DATABASE_URL` shows `KpiFollowUp` table
- [ ] All columns present with correct types
- [ ] Indices created (check with `\d "KpiFollowUp"`)
- [ ] Foreign keys point to correct tables
- [ ] Prisma client regenerated
- [ ] Seed data inserted successfully (if applicable)
- [ ] Backend tests pass with new schema
- [ ] Frontend loads without errors

---

## Quick Reference: SQL Schema

Here's what gets created in PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS "KpiFollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "indicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "dataEntryUserId" TEXT NOT NULL,
    "performanceOwnerId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "daysLate" INTEGER,
    "previousEntryId" TEXT,
    "resolvedEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "escalatedById" TEXT,
    "qmNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    
    CONSTRAINT "KpiFollowUp_indicatorId_fkey" 
      FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") 
      ON DELETE CASCADE,
    CONSTRAINT "KpiFollowUp_departmentId_fkey" 
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id"),
    CONSTRAINT "KpiFollowUp_dataEntryUserId_fkey" 
      FOREIGN KEY ("dataEntryUserId") REFERENCES "User"("id"),
    CONSTRAINT "KpiFollowUp_performanceOwnerId_fkey" 
      FOREIGN KEY ("performanceOwnerId") REFERENCES "User"("id"),
    CONSTRAINT "KpiFollowUp_escalatedById_fkey" 
      FOREIGN KEY ("escalatedById") REFERENCES "User"("id"),
    CONSTRAINT "KpiFollowUp_previousEntryId_fkey" 
      FOREIGN KEY ("previousEntryId") REFERENCES "KpiEntry"("id"),
    CONSTRAINT "KpiFollowUp_resolvedEntryId_fkey" 
      FOREIGN KEY ("resolvedEntryId") REFERENCES "KpiEntry"("id"),
    
    UNIQUE("indicatorId", "year", "month")
);

CREATE INDEX "KpiFollowUp_departmentId_idx" ON "KpiFollowUp"("departmentId");
CREATE INDEX "KpiFollowUp_dataEntryUserId_idx" ON "KpiFollowUp"("dataEntryUserId");
CREATE INDEX "KpiFollowUp_performanceOwnerId_idx" ON "KpiFollowUp"("performanceOwnerId");
CREATE INDEX "KpiFollowUp_year_month_idx" ON "KpiFollowUp"("year", "month");
CREATE INDEX "KpiFollowUp_status_idx" ON "KpiFollowUp"("status");
CREATE INDEX "KpiFollowUp_dueDate_idx" ON "KpiFollowUp"("dueDate");
CREATE INDEX "KpiFollowUp_escalationLevel_idx" ON "KpiFollowUp"("escalationLevel");
```

---

## Testing After Migration

### Smoke Test (Node.js)

```javascript
// test-migration.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMigration() {
  try {
    // 1. Can we create?
    const followUp = await prisma.kpiFollowUp.create({
      data: {
        code: 'KFU-TEST-001',
        indicatorId: 'some-id',  // Replace with real ID
        year: 2026,
        month: 1,
        departmentId: 'some-id',
        dataEntryUserId: 'some-id',
        dueDate: new Date(),
      },
    });
    console.log('✓ Create works:', followUp.id);
    
    // 2. Can we query?
    const found = await prisma.kpiFollowUp.findUnique({
      where: { id: followUp.id },
    });
    console.log('✓ Query works:', found?.code);
    
    // 3. Can we update?
    const updated = await prisma.kpiFollowUp.update({
      where: { id: followUp.id },
      data: { status: 'FIRST_NOTICE' },
    });
    console.log('✓ Update works:', updated.status);
    
    // 4. Cleanup
    await prisma.kpiFollowUp.delete({
      where: { id: followUp.id },
    });
    console.log('✓ Delete works');
    
    console.log('\n✅ All migration tests passed!');
  } catch (e) {
    console.error('❌ Migration test failed:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
```

Run:
```bash
node test-migration.js
```

---

## Support

For issues or questions:
1. Check `KPI_FOLLOW_UP_TECHNICAL_SPEC.md` (section on validation)
2. Review Prisma docs: https://www.prisma.io/docs/
3. Contact: abdu808@gmail.com

