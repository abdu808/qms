# KPI Follow-Up System - Implementation Summary

**Quick Reference Guide**  
**Date:** 2026-05-02  
**Status:** Ready for Development Sprint

---

## Overview

This document provides a one-page executive summary of the KPI Follow-Up system implementation.

---

## What Is It?

A module that **automatically detects when KPI data entries are overdue** and escalates them through a management chain (Department Manager → Executive Director) until resolved.

**Use Case:** ISO 9001 requires data-driven decision making. If KPI entries are missing, quality managers can't assess performance. This system enforces accountability.

---

## Key Components

### 1. Database Model: `KpiFollowUp`

| Field | Purpose |
|-------|---------|
| `indicatorId, year, month` | Identifies the delayed KPI (unique constraint) |
| `departmentId` | Which department is responsible |
| `dataEntryUserId` | Who should enter the data |
| `daysLate` | Auto-calculated: how many days overdue |
| `status` | PENDING → FIRST_NOTICE → ESCALATED → RESOLVED |
| `escalationLevel` | 0=none, 1=Dept Manager, 2=Executive Director |
| `qmNotes` | QMS manager's intervention trail |
| `resolvedEntryId` | The KpiEntry that finally resolved this |

**Storage:** PostgreSQL table with 8 indices for fast filtering

### 2. API Endpoints (5 core + admin)

```
GET  /api/kpi-followups              → List with filters (year, month, status, dept)
GET  /api/kpi-followups/:id          → Detailed view
GET  /api/kpi-followups/stats        → Dashboard metrics
POST /api/kpi-followups/:id/escalate → Move to next level (L1 or L2)
POST /api/kpi-followups/:id/note     → Add QMS comment
POST /api/kpi-followups/:id/resolve  → Mark done when entry submitted
```

### 3. Permission Model (Role-Based)

| Role | Can View | Can Escalate | Can Resolve |
|------|----------|-------------|------------|
| SUPER_ADMIN | All | Yes (L1-L2) | Yes |
| QUALITY_MANAGER | All | Yes (L1-L2) | Yes |
| EXECUTIVE_DIRECTOR | All | Yes (L2 only) | Yes |
| DEPT_MANAGER | Own dept | Yes (L1 only) | Yes (own) |
| EMPLOYEE | Own entries | No | Auto (via entry) |
| GUEST_AUDITOR | All (read) | No | No |

### 4. Escalation Workflow

```
Day 0: Entry due (e.g., 5th of month)
       ↓
Day 0+5: PENDING → auto-detect, notify data entry person
         ↓
Day 0+10: FIRST_NOTICE → QM escalates to Dept Manager (Level 1)
          ↓
Day 0+15: ESCALATED → Escalate to Executive Director (Level 2)
          ↓
Entry submitted → RESOLVED (close follow-up)
OR
Day 0+25: ABORTED (month auto-closes, data must be imputed)
```

---

## Database Changes Required

**Single migration file will:**
1. Create `KpiFollowUp` table (28 fields)
2. Add foreign key to `Indicator`, `User`, `Department`, `KpiEntry`
3. Create 8 performance indices
4. Add back-relations to existing models (Indicator, User, Department, KpiEntry)

**Migration time:** < 10 seconds (new table, no data transformation)

---

## Files to Create/Modify

### New Backend Files (Create These)

```
apps/api/src/
├── routes/kpi-followups.js              ← Main API routes (250 lines)
├── services/kpi-followup.js             ← Business logic (150 lines)
├── lib/
│   ├── kpi-followup-engine.js           ← Detection & calculations (120 lines)
│   └── kpi-followup-scope.js            ← Permission checks (80 lines)
├── schemas/kpi-followup.schema.js       ← Zod validation (60 lines)
└── jobs/kpi-followup-detect.job.js      ← Cron job (40 lines)
```

### Schema Files to Modify

```
apps/api/prisma/schema.prisma            ← Add KpiFollowUp model + relations
```

### Frontend (TBD by UI team)

```
Dashboard widget showing:
  - Pending count
  - Escalated count
  - Avg days late
  - Worst 5 indicators/departments

List view with sortable columns:
  - Indicator | Department | Status | Days Late | Due Date

Detail view with:
  - Full follow-up record
  - Timeline of notes/escalations
  - Action buttons (escalate, note, resolve)
```

---

## Implementation Phases

### Phase 1: Database & API (Week 1)
- [ ] Add schema to Prisma
- [ ] Run migration
- [ ] Implement routes + services
- [ ] Write unit tests

### Phase 2: Business Logic (Week 2)
- [ ] Implement detection cron job
- [ ] Build escalation workflow
- [ ] Add notification integration
- [ ] Write integration tests

### Phase 3: Frontend (Week 3)
- [ ] Dashboard widgets
- [ ] List/detail views
- [ ] Action dialogs
- [ ] E2E testing

### Phase 4: Testing & Deployment (Week 4)
- [ ] QA sign-off
- [ ] Performance testing (1000+ records)
- [ ] Production deployment
- [ ] Monitoring alerts

---

## Example Usage (API)

### Create a Follow-Up (Auto-Detected Daily)

```bash
# Automated daily at 8 AM by cron job
POST /api/kpi-followups/admin/detect
{
  "year": 2026,
  "month": 5
}
```

### Get All Pending Follow-Ups

```bash
GET /api/kpi-followups?status=PENDING&year=2026
Authorization: Bearer <token>

Response:
{
  "ok": true,
  "total": 12,
  "data": [
    {
      "id": "cuid123",
      "code": "KFU-2026-0001",
      "indicator": { "code": "IND-001", "nameAr": "رضا العملاء" },
      "department": { "name": "التسويق" },
      "daysLate": 7,
      "status": "PENDING",
      "dueDate": "2026-05-05T00:00:00Z"
    },
    ...
  ]
}
```

### Escalate to Department Manager

```bash
POST /api/kpi-followups/cuid123/escalate
{
  "escalationLevel": 1,
  "reason": "No response after 5 days. Escalating to Dept Manager."
}

Response:
{
  "ok": true,
  "data": {
    "id": "cuid123",
    "status": "FIRST_NOTICE",
    "escalationLevel": 1,
    "escalatedAt": "2026-05-10T08:00:00Z",
    "qmNotes": "...[timestamp] Escalated to level 1: No response..."
  }
}
```

### Resolve When Entry Submitted

```bash
POST /api/kpi-followups/cuid123/resolve
{
  "resolvedEntryId": "entry-cuid456"
}

Response:
{
  "ok": true,
  "data": {
    "id": "cuid123",
    "status": "RESOLVED",
    "resolvedAt": "2026-05-12T14:30:00Z",
    "resolvedEntryId": "entry-cuid456"
  }
}
```

---

## Key Business Rules

1. **Uniqueness:** Only one follow-up per (indicator, year, month)
   - Prevents duplicate tracking

2. **Auto-Detection:** Daily cron scans for missing entries
   - Triggered if: entry due date passed AND no KpiEntry exists

3. **Escalation Chain:** 
   - Day 5 → PENDING (notify data entry person)
   - Day 10 → FIRST_NOTICE (notify dept manager)
   - Day 15 → ESCALATED (notify executive director)
   - Day 25 → ABORTED (month auto-closes)

4. **Resolution:** Entry submission auto-resolves follow-up
   - Links resolved entry for audit trail

5. **Scope:** Dept managers see only own department
   - Employees see only their own entries
   - QM sees all

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Data Loss** | Soft delete via status field; no hard deletes |
| **Performance** | 8 indices on hot-spot columns (status, dueDate, etc.) |
| **Permissions** | Role-based access control built-in |
| **Duplicate Escalations** | Unique constraint on (indicator, year, month) |
| **Notification Spam** | Track escalation level to avoid duplicate emails |
| **Foreign Key Orphans** | Cascade delete on Indicator only; others use SetNull |

---

## Testing Checklist

### Unit Tests
- [ ] `calculateDaysLate()` function
- [ ] `determineStatus()` logic
- [ ] Permission scope functions
- [ ] Zod schema validation

### Integration Tests
- [ ] Create follow-up → escalate → resolve flow
- [ ] Permission checks (RBAC)
- [ ] Foreign key validation
- [ ] Uniqueness constraint enforcement

### E2E Tests
- [ ] API endpoint CRUD
- [ ] Dashboard stats computation
- [ ] Notification dispatch (mock)
- [ ] Cron job detection

### Performance Tests
- [ ] Load with 1000+ follow-ups
- [ ] Query response time < 500ms
- [ ] Bulk operations (escalate 100 at once)

---

## Configuration Parameters (Customizable)

```javascript
// config/kpi-followup.js
export const thresholds = {
  firstNoticeAfterDays: 5,    // Day 5 → PENDING
  escalateL1AfterDays: 10,    // Day 10 → FIRST_NOTICE
  escalateL2AfterDays: 15,    // Day 15 → ESCALATED
  abortAfterDays: 25,         // Day 25 → ABORTED
};

export const notificationChannels = {
  l1: ['email', 'sms'],       // Dept Manager
  l2: ['email', 'sms', 'slack'], // Executive Director
};

export const gracePeriod = 3;  // Days after due date before flagged
```

---

## Integration Points

### 1. Existing KPI Entry Workflow
When entry submitted → auto-resolve matching follow-up

### 2. AuditLog Table
Every action logged for ISO 9001 compliance

### 3. Notification Service (Existing)
Sends emails/SMS on escalation

### 4. User Roles
Enforces SUPER_ADMIN, QUALITY_MANAGER, DEPT_MANAGER, EMPLOYEE, etc.

---

## Success Metrics

After implementation, track:

1. **Timeliness:** % of entries submitted on time (target: > 95%)
2. **Escalation Rate:** % requiring escalation (target: < 10%)
3. **Resolution Time:** Avg days to resolve after escalation (target: < 5 days)
4. **Compliance:** % of follow-ups with full audit trail (target: 100%)

---

## Cost Estimate

| Task | Effort | Notes |
|------|--------|-------|
| Schema + Migration | 2 hours | Prisma + SQL |
| API Routes + Services | 8 hours | 5 endpoints + logic |
| Business Logic (detection, escalation) | 6 hours | Cron job + calculations |
| Unit + Integration Tests | 6 hours | 20+ test cases |
| Frontend Dashboard | 6 hours | List + detail views |
| **Total** | **~28 hours** | **~4 days** |

---

## Deployment Checklist

- [ ] Prisma schema merged to main branch
- [ ] Migration tested on staging DB
- [ ] API routes registered in server.js
- [ ] Permission actions defined
- [ ] Cron job deployed
- [ ] Notification templates created
- [ ] Frontend components built
- [ ] All tests passing
- [ ] QA sign-off received
- [ ] Production deployment scheduled
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## Support Documents

1. **KPI_FOLLOW_UP_TECHNICAL_SPEC.md** (16 sections)
   - Complete schema, API design, business logic, testing strategy
   - 150+ pages equivalent

2. **PRISMA_MIGRATION_GUIDE.md** (Step-by-step)
   - How to apply schema changes
   - Verification checklist
   - Troubleshooting guide

3. **This document** (1-page summary)
   - Quick reference for team alignment

---

## Contact & Questions

**Lead Architect:** Performance Systems Engineer  
**Email:** abdu808@gmail.com  
**Repository:** `/c/Users/abdu8/Documents/dev/qms/`

**Key Documents:**
- Technical Spec: `KPI_FOLLOW_UP_TECHNICAL_SPEC.md`
- Migration Guide: `PRISMA_MIGRATION_GUIDE.md`
- Implementation Summary: `KPI_FOLLOWUP_IMPLEMENTATION_SUMMARY.md` (this file)

---

## Version History

| Version | Date | Status | Author |
|---------|------|--------|--------|
| 1.0 | 2026-05-02 | APPROVED | Performance Team |

---

**Ready to Build!** Start with Phase 1: Apply the Prisma migration and implement the API routes.

