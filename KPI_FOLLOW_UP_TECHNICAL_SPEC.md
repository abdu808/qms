# KPI Follow-Up System - Technical Specification
**Version:** 1.0  
**Date:** 2026-05-02  
**Status:** APPROVED FOR IMPLEMENTATION  
**Author:** Performance Systems Engineer + QMS Architecture Team

---

## Executive Summary

This document defines the KPI Follow-Up (متابعة الأداء) subsystem for the QMS platform. The system tracks delayed KPI entries, escalates non-compliant departments, and manages the lifecycle of follow-up actions until resolution.

**Key Objectives:**
- Enforce KPI entry deadlines at department/indicator level
- Auto-detect late submissions and trigger escalation workflows
- Provide visibility to quality managers on delinquent entries
- Maintain audit trail for ISO 9001 compliance
- Enable data-driven intervention decisions

---

## 1. DATABASE SCHEMA (Prisma Models)

### 1.1 Core Model: `KpiFollowUp`

```prisma
model KpiFollowUp {
  // ── Identification & Audit ─────────────────────────────
  id                String    @id @default(cuid())
  code              String    @unique  // KFU-2026-0001 format
  
  // ── KPI Reference ─────────────────────────────────────
  indicatorId       String
  indicator         Indicator @relation(fields: [indicatorId], references: [id], onDelete: Cascade)
  
  // ── Period Reference ──────────────────────────────────
  year              Int
  month             Int       // 1-12; uniqueness enforced via @@unique
  
  // ── Department & Personnel ─────────────────────────────
  departmentId      String
  department        Department @relation(fields: [departmentId], references: [id])
  
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

### 1.2 Supporting Modifications to Existing Models

**KpiEntry Model** — Add back-relation:
```prisma
model KpiEntry {
  // ... existing fields ...
  
  // Link to any KpiFollowUp that references this as "resolved"
  followUpResolved  KpiFollowUp? @relation("ResolvedKpiEntry")
  followUpPrevious  KpiFollowUp? @relation("PreviousKpiEntry")
}
```

**User Model** — Add back-relations:
```prisma
model User {
  // ... existing fields ...
  
  // KPI Follow-Up relations
  kpiFollowUpsAsDataEntry     KpiFollowUp[] @relation("KpiFollowUpDataEntry")
  kpiFollowUpsAsPerfOwner     KpiFollowUp[] @relation("KpiFollowUpPerfOwner")
  kpiFollowUpsEscalated       KpiFollowUp[] @relation("KpiFollowUpEscalatedBy")
}
```

**Department Model** — Add back-relation:
```prisma
model Department {
  // ... existing fields ...
  kpiFollowUps  KpiFollowUp[]
}
```

**Indicator Model** — Add back-relation:
```prisma
model Indicator {
  // ... existing fields ...
  kpiFollowUps  KpiFollowUp[]
}
```

---

## 2. RELATIONSHIPS & DATA FLOW

### 2.1 Relationship Diagram

```
KpiFollowUp
├─ indicatorId → Indicator (1:N)
│  └─ belongs to QMS objective/goal (defines frequency, owner, targets)
├─ year, month → Calendar period
├─ departmentId → Department (1:N)
│  └─ organizational context
├─ dataEntryUserId → User (1:N)
│  └─ person responsible for data entry (usually EMPLOYEE or DEPT_MANAGER)
├─ performanceOwnerId → User? (optional 1:N)
│  └─ person accountable for performance (usually DEPT_MANAGER or objective owner)
├─ previousEntryId → KpiEntry? (optional)
│  └─ reference to last month's successful entry
├─ resolvedEntryId → KpiEntry? (optional)
│  └─ the entry that finally resolved this follow-up
└─ escalatedById → User? (optional)
   └─ QMS manager who initiated escalation

```

### 2.2 Lifecycle State Transitions

```
┌─────────────┐
│   PENDING   │  ← Auto-detected when (NOW > dueDate) AND (no KpiEntry exists)
└──────┬──────┘
       │ (QM sends first reminder)
       ├─→ RESOLVED (entry submitted within grace period)
       │
       ├─→ FIRST_NOTICE (→ after X days, escalate to DEPT_MANAGER)
       │       │
       │       ├─→ RESOLVED (entry submitted after escalation)
       │       │
       │       └─→ ESCALATED (→ after Y days, escalate to EXEC_DIRECTOR)
       │               │
       │               ├─→ RESOLVED (entry finally submitted)
       │               │
       │               └─→ ABORTED (month locks, data imputation required)
       │
       └─→ ABORTED (month auto-closes, entry missing)

```

---

## 3. REQUIRED FIELDS & VALIDATION

### 3.1 Field Matrix

| Field | Type | Required | Auto-Computed | Validation |
|-------|------|----------|---------------|-----------|
| `id` | String | Yes | Yes (cuid) | Unique, immutable |
| `code` | String | Yes | Yes (KFU-YYYY-NNNNN) | Unique, readonly |
| `indicatorId` | String | Yes | No | Must exist in Indicator table |
| `year` | Int | Yes | No | 2000 ≤ year ≤ 2099 |
| `month` | Int | Yes | No | 1 ≤ month ≤ 12 |
| `departmentId` | String | Yes | No | Must exist in Department table |
| `dataEntryUserId` | String | Yes | No | Must exist in User table |
| `performanceOwnerId` | String | No | No | If set, must exist in User table |
| `dueDate` | DateTime | Yes | No | > NOW for future creation; ≥ period-start for backlog |
| `submittedAt` | DateTime | No | Yes | Set when resolvedEntryId is assigned |
| `daysLate` | Int | No | Yes | MAX(0, floor((NOW - dueDate) / 86400)) |
| `previousEntryId` | String | No | No | Must exist in KpiEntry table (same indicator) |
| `resolvedEntryId` | String | No | No | Set when entry submitted; enforces (year, month, indicatorId) match |
| `status` | String | Yes | No | ∈ {PENDING, FIRST_NOTICE, ESCALATED, RESOLVED, ABORTED} |
| `escalationLevel` | Int | Yes | No | 0 \| 1 \| 2 |
| `escalatedAt` | DateTime | No | No | NULL until escalation action |
| `escalatedById` | String | No | No | NULL until escalation action |
| `qmNotes` | String | No | No | Free text; audit trail |
| `createdAt` | DateTime | Yes | Yes (now()) | Auto-set |
| `updatedAt` | DateTime | Yes | Yes (@updatedAt) | Auto-updated |
| `resolvedAt` | DateTime | No | No | Set when status → RESOLVED or ABORTED |

### 3.2 Constraints

1. **Uniqueness**: `(indicatorId, year, month)` must be unique
   - Only one follow-up record per indicator per month

2. **Foreign Key Integrity**:
   - All User references must exist and be active
   - All Indicator references must exist
   - All Department references must exist

3. **Status Invariants**:
   - `RESOLVED` → `resolvedAt` NOT NULL and `resolvedEntryId` NOT NULL
   - `ABORTED` → `resolvedAt` NOT NULL
   - `ESCALATED` → `escalatedAt` NOT NULL and `escalatedById` NOT NULL

4. **Date Logic**:
   - `daysLate` is NULL if `submittedAt IS NOT NULL`
   - `daysLate` is calculated as `ceil((NOW - dueDate) / 86400)` if overdue
   - `submittedAt` must be ≥ `dueDate` (cannot mark as submitted if not yet due)

---

## 4. AUTOMATED CALCULATIONS & BUSINESS LOGIC

### 4.1 Days Late Calculation

```typescript
// Executed whenever KpiFollowUp is read or evaluated
function calculateDaysLate(dueDate: Date, submittedAt: Date | null): number | null {
  if (submittedAt) return null;  // On-time or resolved
  
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : null;  // Null if not yet overdue
}
```

### 4.2 Status Determination Logic

```typescript
function determineStatus(
  record: KpiFollowUp,
  now: Date,
  escalationThresholds = { first: 5, escalate: 15 }
): string {
  // If resolved, stay resolved
  if (record.resolvedEntryId) return 'RESOLVED';
  
  const daysLate = calculateDaysLate(record.dueDate, record.submittedAt);
  if (!daysLate) return 'PENDING';  // Not yet overdue
  
  // Escalation tree
  if (daysLate >= escalationThresholds.escalate) {
    return 'ESCALATED';
  }
  if (daysLate >= escalationThresholds.first) {
    return 'FIRST_NOTICE';
  }
  
  return 'PENDING';
}
```

### 4.3 Automatic Detection Workflow

**Trigger**: Once per day (via scheduled job or cron)

```typescript
async function detectAndCreateFollowUps(month: number, year: number) {
  // 1. Find all Indicators with MONTHLY frequency (or matching seasonality)
  const indicators = await prisma.indicator.findMany({
    where: { frequency: 'MONTHLY', deletedAt: null },
    include: {
      objective: { select: { departmentId: true } },
      dataEntryUser: { select: { id: true, departmentId: true } },
      owner: { select: { id: true } },
    },
  });
  
  for (const indicator of indicators) {
    // 2. Check if KpiEntry exists for (indicator, year, month)
    const entry = await prisma.kpiEntry.findUnique({
      where: {
        indicatorId_year_month: {
          indicatorId: indicator.id,
          year,
          month,
        },
      },
    });
    
    if (entry) continue;  // Entry exists, no follow-up needed
    
    // 3. Calculate dueDate (e.g., 5th day of following month)
    const dueDate = new Date(year, month, 5);  // month is 0-indexed
    if (new Date() <= dueDate) continue;  // Not yet due
    
    // 4. Check if KpiFollowUp already exists
    const existingFollowUp = await prisma.kpiFollowUp.findUnique({
      where: {
        indicatorId_year_month: {
          indicatorId: indicator.id,
          year,
          month,
        },
      },
    });
    
    if (existingFollowUp) continue;  // Already tracked
    
    // 5. Create KpiFollowUp record
    await prisma.kpiFollowUp.create({
      data: {
        code: generateFollowUpCode(),
        indicatorId: indicator.id,
        year,
        month,
        departmentId: indicator.objective?.departmentId || indicator.owner?.departmentId,
        dataEntryUserId: indicator.dataEntryUser?.id || indicator.owner?.id,
        performanceOwnerId: indicator.owner?.id,
        dueDate,
        status: 'PENDING',
        escalationLevel: 0,
      },
    });
  }
}
```

### 4.4 Escalation Logic

**Escalation Path:**

```typescript
async function escalateFollowUp(
  followUpId: string,
  escalatedById: string,
  newLevel: number,
  notes?: string
) {
  if (newLevel < 1 || newLevel > 2) {
    throw new BadRequest('Escalation level must be 1 or 2');
  }
  
  const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) throw NotFound('KpiFollowUp not found');
  if (followUp.resolvedEntryId) {
    throw BadRequest('Cannot escalate resolved follow-ups');
  }
  
  const updated = await prisma.kpiFollowUp.update({
    where: { id: followUpId },
    data: {
      escalationLevel: newLevel,
      status: newLevel >= 2 ? 'ESCALATED' : 'FIRST_NOTICE',
      escalatedAt: new Date(),
      escalatedById,
      qmNotes: notes
        ? `${followUp.qmNotes || ''}\n\n[${new Date().toISOString()}] Escalated to level ${newLevel}: ${notes}`
        : followUp.qmNotes,
    },
  });
  
  // TODO: Send notifications to relevant parties
  // - Level 1: Department Manager
  // - Level 2: Executive Director + Quality Manager
  
  return updated;
}
```

---

## 5. API ENDPOINTS

### 5.1 List Follow-Ups (GET)

**Endpoint:** `GET /api/kpi-followups`

**Query Parameters:**
```typescript
{
  year?: number;                // Filter by year
  month?: number;               // Filter by month
  status?: string;              // PENDING | FIRST_NOTICE | ESCALATED | RESOLVED
  departmentId?: string;        // Filter by department
  sortBy?: 'daysLate' | 'dueDate' | 'escalationLevel';
  sortOrder?: 'asc' | 'desc';
  skip?: number;                // Pagination offset
  take?: number;                // Pagination limit (max 100)
}
```

**Response:**
```typescript
{
  ok: true,
  total: number;
  data: KpiFollowUp[] with computed fields;
  pagination: { skip, take, total };
}
```

**Permissions:**
- `SUPER_ADMIN`, `QUALITY_MANAGER`: see all
- `EXECUTIVE_DIRECTOR`: see all (no filter)
- `DEPT_MANAGER`: see own department only
- `EMPLOYEE`: see own entries only
- `GUEST_AUDITOR`: read-only, no filter

**Example:**
```bash
curl -X GET "http://localhost:3000/api/kpi-followups?status=PENDING&year=2026" \
  -H "Authorization: Bearer <token>"
```

---

### 5.2 Get Follow-Up Details (GET)

**Endpoint:** `GET /api/kpi-followups/:id`

**Response:**
```typescript
{
  ok: true,
  data: {
    id: string;
    code: string;
    indicator: {
      id: string;
      code: string;
      nameAr: string;
      owner: { id, name, email };
    };
    year: number;
    month: number;
    department: { id, name };
    dataEntryUser: { id, name, email };
    performanceOwner?: { id, name, email };
    dueDate: DateTime;
    submittedAt?: DateTime;
    daysLate?: number;
    previousEntry?: KpiEntry;
    resolvedEntry?: KpiEntry;
    status: string;
    escalationLevel: number;
    escalatedAt?: DateTime;
    escalatedBy?: { id, name, email };
    qmNotes?: string;
    createdAt: DateTime;
    updatedAt: DateTime;
  }
}
```

---

### 5.3 Get Statistics/Dashboard (GET)

**Endpoint:** `GET /api/kpi-followups/stats`

**Query Parameters:**
```typescript
{
  year?: number;
  month?: number;
  departmentId?: string;
}
```

**Response:**
```typescript
{
  ok: true,
  stats: {
    total: number;
    byStatus: {
      PENDING: number;
      FIRST_NOTICE: number;
      ESCALATED: number;
      RESOLVED: number;
      ABORTED: number;
    };
    byEscalation: {
      level0: number;    // No escalation
      level1: number;    // Dept manager level
      level2: number;    // Executive director level
    };
    avgDaysLate: number;
    mostLateIndicators: Array<{ indicatorCode, indicatorName, count, avgDaysLate }>;
    mostLateDepartments: Array<{ deptName, count, avgDaysLate }>;
  }
}
```

---

### 5.4 Add QM Note (POST)

**Endpoint:** `POST /api/kpi-followups/:id/note`

**Body:**
```typescript
{
  note: string;  // Required, max 5000 chars
}
```

**Response:**
```typescript
{
  ok: true;
  data: KpiFollowUp;  // Updated record with new note appended
}
```

**Permissions:**
- `SUPER_ADMIN`, `QUALITY_MANAGER`: can add notes to any
- `DEPT_MANAGER`: can add notes to own department

---

### 5.5 Escalate Follow-Up (POST)

**Endpoint:** `POST /api/kpi-followups/:id/escalate`

**Body:**
```typescript
{
  escalationLevel: number;  // 1 or 2
  reason: string;           // Required, max 5000 chars
}
```

**Response:**
```typescript
{
  ok: true;
  data: KpiFollowUp;  // Updated with escalation metadata
  notificationsSent: string[];  // Emails/notifications sent
}
```

**Permissions:**
- `SUPER_ADMIN`, `QUALITY_MANAGER`: can escalate any
- `DEPT_MANAGER`: can escalate own department (max level 1)

**Side Effects:**
- Sends notification to target escalation level
- Logs action in AuditLog
- Triggers optional SMS/email

---

### 5.6 Resolve Follow-Up (POST)

**Endpoint:** `POST /api/kpi-followups/:id/resolve`

**Body:**
```typescript
{
  resolvedEntryId: string;  // ID of the KpiEntry that resolves this
  note?: string;            // Optional resolution note
}
```

**Response:**
```typescript
{
  ok: true;
  data: KpiFollowUp;  // status=RESOLVED, resolvedAt set
}
```

**Validation:**
- `resolvedEntryId` KpiEntry must match (year, month, indicatorId)
- Entry must have `entryStatus === 'APPROVED'`

**Permissions:**
- `SUPER_ADMIN`, `QUALITY_MANAGER`: can resolve any
- `DEPT_MANAGER`: can resolve own department
- `EMPLOYEE`: can submit entry that auto-resolves

---

### 5.7 Auto-Detect Overdue Entries (POST) - Admin Only

**Endpoint:** `POST /api/kpi-followups/admin/detect`

**Body:**
```typescript
{
  year: number;
  month: number;
  force?: boolean;  // Force re-detection even if some exist
}
```

**Response:**
```typescript
{
  ok: true;
  created: number;
  updated: number;
  skipped: number;
}
```

**Permissions:**
- `SUPER_ADMIN` only

---

## 6. PERMISSIONS & AUTHORIZATION

### 6.1 Role-Based Access Control (RBAC)

| Role | List | View Own | View Dept | View All | Escalate | Add Notes | Resolve |
|------|------|----------|----------|----------|----------|-----------|---------|
| `SUPER_ADMIN` | ✓ All | ✓ | ✓ | ✓ | ✓ Level 1-2 | ✓ | ✓ |
| `QUALITY_MANAGER` | ✓ All | ✓ | ✓ | ✓ | ✓ Level 1-2 | ✓ | ✓ |
| `EXECUTIVE_DIRECTOR` | ✓ All | ✓ | ✓ | ✓ | ✓ Level 2 only | ✓ | ✓ |
| `DEPT_MANAGER` | Own Dept | ✓ | ✓ Own | ✗ | ✓ Level 1 | ✓ Own | ✓ Own |
| `EMPLOYEE` | Own Only | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ Auto (via entry) |
| `GUEST_AUDITOR` | Read | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### 6.2 Scope Helpers

```typescript
// lib/kpi-followup-scope.js
async function canAccessFollowUp(user: User, followUp: KpiFollowUp, action: string): Promise<boolean> {
  const role = user.role;
  
  // Full access
  if (['SUPER_ADMIN', 'QUALITY_MANAGER', 'EXECUTIVE_DIRECTOR'].includes(role)) {
    return action !== 'delete';  // No deletion, only soft delete via status
  }
  
  // Guest auditor
  if (role === 'GUEST_AUDITOR') return action === 'read';
  
  // Department manager
  if (role === 'DEPT_MANAGER') {
    return followUp.departmentId === user.departmentId
      && ['read', 'note', 'escalate', 'resolve'].includes(action);
  }
  
  // Employee
  if (role === 'EMPLOYEE') {
    return followUp.dataEntryUserId === user.id && action === 'read';
  }
  
  return false;
}

async function followUpScopeWhere(user: User): Promise<Prisma.KpiFollowUpWhereInput> {
  const role = user.role;
  
  if (['SUPER_ADMIN', 'QUALITY_MANAGER', 'EXECUTIVE_DIRECTOR'].includes(role)) {
    return {};  // No filter
  }
  if (role === 'GUEST_AUDITOR') return {};  // Read all
  if (role === 'DEPT_MANAGER') {
    return { departmentId: user.departmentId };
  }
  if (role === 'EMPLOYEE') {
    return { dataEntryUserId: user.id };
  }
  
  return { id: '__never__' };  // Deny access
}
```

---

## 7. INTEGRATION POINTS

### 7.1 Integration with Existing Systems

#### A. KpiEntry Submission Workflow

When a `KpiEntry` is created or approved:

```typescript
async function handleKpiEntryApproved(kpiEntry: KpiEntry) {
  // 1. Find matching KpiFollowUp
  const followUp = await prisma.kpiFollowUp.findUnique({
    where: {
      indicatorId_year_month: {
        indicatorId: kpiEntry.indicatorId,
        year: kpiEntry.year,
        month: kpiEntry.month,
      },
    },
  });
  
  if (!followUp) return;  // No follow-up tracking for this entry
  
  // 2. Resolve the follow-up
  await prisma.kpiFollowUp.update({
    where: { id: followUp.id },
    data: {
      status: 'RESOLVED',
      resolvedEntryId: kpiEntry.id,
      submittedAt: new Date(),
      resolvedAt: new Date(),
      qmNotes: `${followUp.qmNotes || ''}\n\n[AUTO] Resolved by KpiEntry ${kpiEntry.id} submitted by ${kpiEntry.enteredBy?.email}`,
    },
  });
}
```

#### B. Indicator Frequency Changes

If an Indicator's `frequency` changes from MONTHLY to QUARTERLY:

```typescript
// Cascade: update any pending follow-ups for that indicator
await prisma.kpiFollowUp.updateMany({
  where: { indicatorId, status: 'PENDING' },
  data: { status: 'ABORTED' },  // Mark pending ones as void
});
```

#### C. AuditLog Integration

Every follow-up action (create, escalate, resolve, note) logged:

```typescript
async function logFollowUpAction(
  followUpId: string,
  userId: string,
  action: string,
  details: Record<string, any>
) {
  await prisma.auditLog.create({
    data: {
      entity: 'KpiFollowUp',
      entityId: followUpId,
      action,
      changedBy: userId,
      details: JSON.stringify(details),
      timestamp: new Date(),
    },
  });
}
```

### 7.2 Notifications & Escalation Channels

**Note:** Actual implementation delegated to notification service (existing pattern in QMS).

```typescript
async function notifyEscalation(followUp: KpiFollowUp, escalationLevel: number) {
  const notificationService = new NotificationService();
  
  if (escalationLevel === 1) {
    // Notify: Data Entry User + Dept Manager + Perf Owner
    const recipients = [
      followUp.dataEntryUser.email,
      followUp.department.manager?.email,
      followUp.performanceOwner?.email,
    ].filter(Boolean);
    
    await notificationService.sendEmail({
      to: recipients,
      template: 'KPI_FOLLOWUP_L1_ESCALATION',
      context: {
        indicatorCode: followUp.indicator.code,
        indicatorName: followUp.indicator.nameAr,
        daysLate: followUp.daysLate,
        dueDate: followUp.dueDate,
        month: followUp.month,
        year: followUp.year,
      },
    });
  }
  
  if (escalationLevel === 2) {
    // Notify: Executive Director + Quality Manager
    const recipients = [
      'ceo@company.com',  // TODO: derive from User role
      'qm@company.com',
    ];
    
    await notificationService.sendEmail({
      to: recipients,
      template: 'KPI_FOLLOWUP_L2_ESCALATION',
      context: { ...followUp, escalationHistory: null },
    });
  }
}
```

---

## 8. DATA VALIDATION & ERROR HANDLING

### 8.1 Validation Rules

```typescript
// schemas/kpi-followup.schema.js
import { z } from 'zod';

export const createKpiFollowUpSchema = z.object({
  indicatorId: z.string().cuid(),
  year: z.number().int().min(2000).max(2099),
  month: z.number().int().min(1).max(12),
  departmentId: z.string().cuid(),
  dataEntryUserId: z.string().cuid(),
  performanceOwnerId: z.string().cuid().optional(),
  dueDate: z.coerce.date(),
  previousEntryId: z.string().cuid().optional(),
  qmNotes: z.string().max(5000).optional(),
});

export const escalateKpiFollowUpSchema = z.object({
  escalationLevel: z.number().int().min(1).max(2),
  reason: z.string().min(10).max(5000),
});

export const addNoteSchema = z.object({
  note: z.string().min(5).max(5000),
});

export const resolveKpiFollowUpSchema = z.object({
  resolvedEntryId: z.string().cuid(),
  note: z.string().max(5000).optional(),
});
```

### 8.2 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `FOLLOWUP_NOT_FOUND` | 404 | KpiFollowUp record doesn't exist |
| `FOLLOWUP_ALREADY_RESOLVED` | 409 | Cannot update resolved follow-up |
| `FOLLOWUP_ENTRY_MISMATCH` | 400 | Entry (year, month, indicator) doesn't match follow-up |
| `FOLLOWUP_ENTRY_UNAPPROVED` | 400 | Entry status not APPROVED |
| `FOLLOWUP_INVALID_ESCALATION` | 400 | Invalid escalation level (not 1 or 2) |
| `FOLLOWUP_PERMISSION_DENIED` | 403 | User lacks permission for this action |
| `FOLLOWUP_DEPT_MISMATCH` | 403 | User's department doesn't match follow-up |

---

## 9. DATABASE MIGRATIONS

### 9.1 Migration Steps

```bash
# 1. Add KpiFollowUp model
npx prisma migrate dev --name add_kpi_followup

# 2. Add relations to existing models
npx prisma migrate dev --name add_kpi_followup_relations

# 3. Create indices for performance
npx prisma migrate dev --name add_kpi_followup_indices
```

### 9.2 Schema Updates for Existing Models

**File:** `prisma/schema.prisma`

1. Add KpiFollowUp model (see section 1.1)
2. Update KpiEntry model:
   ```prisma
   model KpiEntry {
     // ... existing ...
     followUpResolved  KpiFollowUp? @relation("ResolvedKpiEntry")
     followUpPrevious  KpiFollowUp? @relation("PreviousKpiEntry")
   }
   ```
3. Update User model:
   ```prisma
   model User {
     // ... existing ...
     kpiFollowUpsAsDataEntry     KpiFollowUp[] @relation("KpiFollowUpDataEntry")
     kpiFollowUpsAsPerfOwner     KpiFollowUp[] @relation("KpiFollowUpPerfOwner")
     kpiFollowUpsEscalated       KpiFollowUp[] @relation("KpiFollowUpEscalatedBy")
   }
   ```
4. Update Department model:
   ```prisma
   model Department {
     // ... existing ...
     kpiFollowUps  KpiFollowUp[]
   }
   ```
5. Update Indicator model:
   ```prisma
   model Indicator {
     // ... existing ...
     kpiFollowUps  KpiFollowUp[]
   }
   ```

---

## 10. BACKEND IMPLEMENTATION ROADMAP

### 10.1 Files to Create

```
apps/api/src/
├── routes/
│   └── kpi-followups.js          (NEW)
├── services/
│   └── kpi-followup.js           (NEW)
├── lib/
│   ├── kpi-followup-engine.js    (NEW) — business logic (detect, escalate, resolve)
│   └── kpi-followup-scope.js     (NEW) — permission helpers
├── schemas/
│   └── kpi-followup.schema.js    (NEW) — Zod validation
└── jobs/
    └── kpi-followup-detect.job.js (NEW) — cron task
```

### 10.2 Core Implementation Files

#### `routes/kpi-followups.js`

```typescript
import express from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireAction } from '../lib/permissions.js';
import {
  createFollowUp,
  escalateFollowUp,
  resolveFollowUp,
  addFollowUpNote,
} from '../services/kpi-followup.js';
import { followUpScopeWhere, canAccessFollowUp } from '../lib/kpi-followup-scope.js';
import { runSchema } from '../schemas/_helpers.js';
import {
  createKpiFollowUpSchema,
  escalateKpiFollowUpSchema,
  addNoteSchema,
  resolveKpiFollowUpSchema,
} from '../schemas/kpi-followup.schema.js';

const router = express.Router();
router.use(authenticate);

// GET /api/kpi-followups
router.get('/', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const { year, month, status, departmentId, sortBy = 'dueDate', sortOrder = 'asc', skip = 0, take = 20 } = req.query;
    
    const where = await followUpScopeWhere(req.user);
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    
    const [followUps, total] = await Promise.all([
      prisma.kpiFollowUp.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: parseInt(skip),
        take: Math.min(parseInt(take), 100),
        include: {
          indicator: { select: { code: true, nameAr: true, owner: true } },
          department: { select: { name: true } },
          dataEntryUser: { select: { id: true, name: true, email: true } },
          performanceOwner: { select: { id: true, name: true, email: true } },
          escalatedBy: { select: { id: true, name: true } },
          resolvedEntry: { select: { id: true, actualValue: true, approvedAt: true } },
          previousEntry: { select: { id: true, actualValue: true } },
        },
      }),
      prisma.kpiFollowUp.count({ where }),
    ]);
    
    res.json({
      ok: true,
      total,
      data: followUps,
      pagination: { skip: parseInt(skip), take: Math.min(parseInt(take), 100), total },
    });
  } catch (e) { next(e); }
});

// GET /api/kpi-followups/stats
router.get('/stats', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const { year, month, departmentId } = req.query;
    const where = await followUpScopeWhere(req.user);
    
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (departmentId) where.departmentId = departmentId;
    
    const all = await prisma.kpiFollowUp.findMany({ where });
    
    const byStatus = {
      PENDING: all.filter(f => f.status === 'PENDING').length,
      FIRST_NOTICE: all.filter(f => f.status === 'FIRST_NOTICE').length,
      ESCALATED: all.filter(f => f.status === 'ESCALATED').length,
      RESOLVED: all.filter(f => f.status === 'RESOLVED').length,
      ABORTED: all.filter(f => f.status === 'ABORTED').length,
    };
    
    const byEscalation = {
      level0: all.filter(f => f.escalationLevel === 0).length,
      level1: all.filter(f => f.escalationLevel === 1).length,
      level2: all.filter(f => f.escalationLevel === 2).length,
    };
    
    const avgDaysLate = all
      .filter(f => f.daysLate !== null)
      .reduce((sum, f) => sum + (f.daysLate || 0), 0) / Math.max(all.filter(f => f.daysLate !== null).length, 1);
    
    res.json({
      ok: true,
      stats: {
        total: all.length,
        byStatus,
        byEscalation,
        avgDaysLate: Math.round(avgDaysLate),
      },
    });
  } catch (e) { next(e); }
});

// GET /api/kpi-followups/:id
router.get('/:id', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({
      where: { id: req.params.id },
      include: {
        indicator: true,
        department: true,
        dataEntryUser: true,
        performanceOwner: true,
        escalatedBy: true,
        resolvedEntry: true,
        previousEntry: true,
      },
    });
    
    if (!followUp) return res.status(404).json({ error: 'FOLLOWUP_NOT_FOUND' });
    
    if (!(await canAccessFollowUp(req.user, followUp, 'read'))) {
      return res.status(403).json({ error: 'FOLLOWUP_PERMISSION_DENIED' });
    }
    
    res.json({ ok: true, data: followUp });
  } catch (e) { next(e); }
});

// POST /api/kpi-followups/:id/escalate
router.post('/:id/escalate', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!followUp) return res.status(404).json({ error: 'FOLLOWUP_NOT_FOUND' });
    
    if (!(await canAccessFollowUp(req.user, followUp, 'escalate'))) {
      return res.status(403).json({ error: 'FOLLOWUP_PERMISSION_DENIED' });
    }
    
    const body = runSchema(escalateKpiFollowUpSchema)(req.body);
    
    const updated = await escalateFollowUp(followUp.id, req.user.sub, body.escalationLevel, body.reason);
    
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
});

// POST /api/kpi-followups/:id/note
router.post('/:id/note', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!followUp) return res.status(404).json({ error: 'FOLLOWUP_NOT_FOUND' });
    
    if (!(await canAccessFollowUp(req.user, followUp, 'note'))) {
      return res.status(403).json({ error: 'FOLLOWUP_PERMISSION_DENIED' });
    }
    
    const body = runSchema(addNoteSchema)(req.body);
    
    const updated = await addFollowUpNote(followUp.id, req.user.sub, body.note);
    
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
});

// POST /api/kpi-followups/:id/resolve
router.post('/:id/resolve', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: req.params.id } });
    if (!followUp) return res.status(404).json({ error: 'FOLLOWUP_NOT_FOUND' });
    
    if (!(await canAccessFollowUp(req.user, followUp, 'resolve'))) {
      return res.status(403).json({ error: 'FOLLOWUP_PERMISSION_DENIED' });
    }
    
    const body = runSchema(resolveKpiFollowUpSchema)(req.body);
    
    const updated = await resolveFollowUp(followUp.id, body.resolvedEntryId, body.note);
    
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
});

export default router;
```

#### `services/kpi-followup.js`

Core business logic for follow-up management:

```typescript
import { prisma } from '../db.js';
import { NotFound, BadRequest } from '../utils/errors.js';

export async function escalateFollowUp(followUpId, userId, escalationLevel, reason) {
  if (escalationLevel < 1 || escalationLevel > 2) {
    throw BadRequest('Escalation level must be 1 or 2');
  }
  
  const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) throw NotFound('KpiFollowUp not found');
  if (followUp.resolvedEntryId) {
    throw BadRequest('Cannot escalate resolved follow-ups');
  }
  
  return prisma.kpiFollowUp.update({
    where: { id: followUpId },
    data: {
      escalationLevel,
      status: escalationLevel >= 2 ? 'ESCALATED' : 'FIRST_NOTICE',
      escalatedAt: new Date(),
      escalatedById: userId,
      qmNotes: `${followUp.qmNotes || ''}\n\n[${new Date().toISOString()}] Escalated to level ${escalationLevel}: ${reason}`,
    },
  });
}

export async function addFollowUpNote(followUpId, userId, note) {
  const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) throw NotFound('KpiFollowUp not found');
  
  const timestamp = new Date().toISOString();
  const newNotes = `${followUp.qmNotes || ''}\n\n[${timestamp}] ${note}`;
  
  return prisma.kpiFollowUp.update({
    where: { id: followUpId },
    data: { qmNotes: newNotes },
  });
}

export async function resolveFollowUp(followUpId, entryId, note) {
  const followUp = await prisma.kpiFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) throw NotFound('KpiFollowUp not found');
  
  const entry = await prisma.kpiEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw NotFound('KpiEntry not found');
  
  // Validate entry matches follow-up context
  if (
    entry.indicatorId !== followUp.indicatorId ||
    entry.year !== followUp.year ||
    entry.month !== followUp.month
  ) {
    throw BadRequest('FOLLOWUP_ENTRY_MISMATCH');
  }
  
  if (entry.entryStatus !== 'APPROVED') {
    throw BadRequest('FOLLOWUP_ENTRY_UNAPPROVED');
  }
  
  const timestamp = new Date().toISOString();
  const newNotes = `${followUp.qmNotes || ''}\n\n[${timestamp}] Resolved by entry ${entryId}${note ? ': ' + note : ''}`;
  
  return prisma.kpiFollowUp.update({
    where: { id: followUpId },
    data: {
      status: 'RESOLVED',
      resolvedEntryId: entryId,
      submittedAt: new Date(),
      resolvedAt: new Date(),
      qmNotes: newNotes,
    },
  });
}
```

---

## 11. FRONTEND CONSIDERATIONS

### 11.1 Dashboard Widget

Display key metrics:
- **Pending Count**: Total PENDING follow-ups
- **Escalated Count**: FIRST_NOTICE + ESCALATED
- **Avg Days Late**: Running average
- **Worst 5 Indicators/Departments**

### 11.2 List View

Sortable columns:
- Indicator Code
- Department
- Status (badge: color-coded)
- Days Late (red if > threshold)
- Due Date
- Escalation Level (icons)

### 11.3 Detail View

Show full follow-up record with:
- Indicator details (formula, target, owner)
- Previous month's entry (for context)
- Timeline of notes and escalations
- QM action buttons (note, escalate, resolve)

### 11.4 Forms

**Escalate Dialog:**
```
[Escalation Level: Level 1 | Level 2]
[Reason: text area]
[Button: Send Escalation]
```

**Add Note Dialog:**
```
[Note: text area]
[Button: Save Note]
```

---

## 12. TECHNICAL RECOMMENDATIONS

### 12.1 Performance Optimization

1. **Indices**: Prioritize (year, month), (status), (dueDate), (escalationLevel)
   - These are query hot-spots for filtering and sorting

2. **Pagination**: Always paginate list endpoints (max 100 per page)
   - KPI systems often deal with 1000+ entries

3. **Lazy Loading**: Include relations only when necessary
   - Use `select` to fetch minimal fields for list views

### 12.2 Data Integrity

1. **Uniqueness Constraint**: `(indicatorId, year, month)` prevents duplicate tracking
   - Database enforces at schema level; no application logic needed

2. **Soft Deletes**: Consider adding `deletedAt` field if need to preserve history
   - Current schema uses hard delete via `onDelete: Cascade`; evaluate risk

3. **Transaction Wrapping**: Escalate/Resolve operations wrap in transaction
   - Ensures atomic updates to followUp + audit log

### 12.3 Notification Strategy

- **Level 1 Escalation**: Email to data entry user + dept manager
- **Level 2 Escalation**: Email to executive director + quality manager + CEO
- **Resolution**: Confirmation email to original data entry user

Consider: Webhook integration for Slack/Teams notifications

### 12.4 Cron Job Configuration

```javascript
// jobs/kpi-followup-detect.job.js
export async function detectOverdueKpis() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  
  // Run every day at 8 AM
  const result = await detectAndCreateFollowUps(month, year);
  
  console.log(`[KPI FollowUp Detection] Created ${result.created}, Updated ${result.updated}`);
}

// In server.js or via node-cron:
import cron from 'node-cron';
detectOverdueKpis.schedule('0 8 * * *', detectOverdueKpis);
```

### 12.5 Audit Logging

Every change to KpiFollowUp should log:
- User ID + email
- Action (create, escalate, note, resolve)
- Before/after state (only changed fields)
- Timestamp
- IP address (optional)

Reuse existing AuditLog model in QMS.

---

## 13. TESTING STRATEGY

### 13.1 Unit Tests

- `kpi-followup-engine.js`: calculateDaysLate, determineStatus
- `kpi-followup-scope.js`: canAccessFollowUp, followUpScopeWhere
- Validation schemas: createKpiFollowUpSchema, etc.

### 13.2 Integration Tests

- Create follow-up → escalate → resolve flow
- Permission checks (RBAC)
- Foreign key validation
- Uniqueness constraint enforcement

### 13.3 E2E Tests

- User dashboard: verify stats computation
- API endpoints: CRUD operations
- Notification dispatch (mock)
- Cron job detection (with mocked time)

---

## 14. DEPLOYMENT CHECKLIST

- [ ] Prisma schema merged to main
- [ ] Migration scripts tested on staging DB
- [ ] API routes registered in `server.js`
- [ ] Permission actions defined in permissions matrix
- [ ] Cron job deployed (configure based on prod schedule)
- [ ] Notification templates created (email/SMS)
- [ ] Frontend widgets/pages implemented
- [ ] Documentation updated in wiki/confluence
- [ ] QA sign-off on all endpoints
- [ ] Performance testing (1000+ follow-ups in system)
- [ ] Production deployment with monitoring alerts

---

## 15. FUTURE ENHANCEMENTS

1. **Bulk Operations**: Mark multiple follow-ups as resolved/escalated
2. **Customizable Thresholds**: Days before escalation configurable per department/indicator
3. **SLA Reporting**: Track compliance with escalation timelines
4. **Auto-Imputation**: Propose placeholder values for aborted entries
5. **Analytics**: Trend analysis on follow-up patterns, repeat offenders
6. **Mobile Notifications**: Push alerts for escalation events
7. **Integration with Workflows**: BPMN process for complex escalation paths

---

## 16. APPENDIX: CODE EXAMPLES

### A. Complete Route Integration

File: `apps/api/src/server.js`

```javascript
import kpiFollowUpRoutes from './routes/kpi-followups.js';

// ... existing code ...

app.use('/api/kpi-followups', kpiFollowUpRoutes);
```

### B. Seeding Test Data

File: `apps/api/src/seed.js` — add to existing seed function:

```javascript
async function seedKpiFollowUps() {
  const indicators = await prisma.indicator.findMany({ take: 5 });
  const users = await prisma.user.findMany({ where: { role: 'EMPLOYEE' } });
  const departments = await prisma.department.findMany();
  
  for (const indicator of indicators) {
    for (let i = 0; i < 3; i++) {
      await prisma.kpiFollowUp.create({
        data: {
          code: `KFU-TEST-${Date.now()}-${i}`,
          indicatorId: indicator.id,
          year: 2026,
          month: 3 + i,
          departmentId: departments[0].id,
          dataEntryUserId: users[0].id,
          performanceOwnerId: users[1].id,
          dueDate: new Date(2026, 2 + i, 5),
          status: i === 0 ? 'PENDING' : 'FIRST_NOTICE',
          escalationLevel: i > 0 ? 1 : 0,
        },
      });
    }
  }
  
  console.log('✓ Seeded KPI Follow-Ups');
}
```

### C. Example Query: Find All Escalated Follow-Ups

```typescript
const escalated = await prisma.kpiFollowUp.findMany({
  where: {
    status: 'ESCALATED',
    year: 2026,
  },
  include: {
    indicator: true,
    department: true,
    dataEntryUser: true,
    escalatedBy: true,
  },
  orderBy: { daysLate: 'desc' },
});
```

---

## Sign-Off

**Reviewed By:**
- Quality Systems Engineer: _________________
- ISO Consultant: _________________
- Performance Manager: _________________

**Approved By:**
- Chief Quality Officer: _________________

**Date:** _______________

---

**Document Version Control:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-02 | Performance Team | Initial specification |

