-- Audit task 6 (architectural): KpiEntry — fields منفصلة لسبب الانحراف وإجراء التصحيح
ALTER TABLE "KpiEntry"
  ADD COLUMN "deviationReason" TEXT,
  ADD COLUMN "actionNote"      TEXT;

-- Audit task 8 (architectural): FollowUpTask — مهام متابعة من قرارات Mgmt Review
CREATE TABLE "FollowUpTask" (
  "id"          TEXT        NOT NULL,
  "code"        TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "description" TEXT,
  "ownerId"     TEXT        NOT NULL,
  "dueDate"     TIMESTAMP(3) NOT NULL,
  "source"      TEXT        NOT NULL,
  "sourceId"    TEXT        NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'OPEN',
  "priority"    TEXT,
  "notes"       TEXT,
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "FollowUpTask_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "FollowUpTask_code_key"    UNIQUE ("code")
);

CREATE INDEX "FollowUpTask_ownerId_status_idx"      ON "FollowUpTask"("ownerId", "status");
CREATE INDEX "FollowUpTask_source_sourceId_idx"     ON "FollowUpTask"("source", "sourceId");
CREATE INDEX "FollowUpTask_status_dueDate_idx"      ON "FollowUpTask"("status", "dueDate");
CREATE INDEX "FollowUpTask_deletedAt_idx"           ON "FollowUpTask"("deletedAt");

ALTER TABLE "FollowUpTask"
  ADD CONSTRAINT "FollowUpTask_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FollowUpTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
