-- Audit task 9 (architectural): AuditFinding model
-- ISO 9001:2015 §9.2 — Internal Audit output
-- يُسجَّل كلُّ نتيجة تدقيق كسجل مستقل بدلاً من JSON field في Audit.findings
-- يدعم: OBSERVATION | MINOR_NC | MAJOR_NC | POSITIVE_FINDING
-- يمكن تصعيد MINOR_NC/MAJOR_NC إلى NCR رسمي (ncrId FK)

CREATE TABLE "AuditFinding" (
  "id"           TEXT          NOT NULL,
  "code"         TEXT          NOT NULL,
  "auditId"      TEXT          NOT NULL,
  "type"         TEXT          NOT NULL DEFAULT 'OBSERVATION',
  "clauseRef"    TEXT,
  "departmentId" TEXT,
  "processId"    TEXT,
  "title"        TEXT          NOT NULL,
  "description"  TEXT          NOT NULL,
  "evidence"     TEXT,
  "ownerId"      TEXT,
  "dueDate"      TIMESTAMP(3),
  "status"       TEXT          NOT NULL DEFAULT 'OPEN',
  "response"     TEXT,
  "closureNote"  TEXT,
  "closedAt"     TIMESTAMP(3),
  "ncrId"        TEXT,
  "createdById"  TEXT          NOT NULL,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL,
  "deletedAt"    TIMESTAMP(3),

  CONSTRAINT "AuditFinding_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "AuditFinding_code_key" UNIQUE ("code")
);

-- Indexes
CREATE INDEX "AuditFinding_auditId_idx"    ON "AuditFinding"("auditId");
CREATE INDEX "AuditFinding_status_idx"     ON "AuditFinding"("status");
CREATE INDEX "AuditFinding_type_idx"       ON "AuditFinding"("type");
CREATE INDEX "AuditFinding_ownerId_idx"    ON "AuditFinding"("ownerId");
CREATE INDEX "AuditFinding_deletedAt_idx"  ON "AuditFinding"("deletedAt");

-- Foreign keys
ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_processId_fkey"
    FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_ncrId_fkey"
    FOREIGN KEY ("ncrId") REFERENCES "NCR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
