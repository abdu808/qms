-- KPI Follow-Up System (ISO 9001:2015 §9.1.3)
-- نظام متابعة الإدخالات المتأخرة للمؤشرات
-- يتتبّع تأخر إدخال قراءات المؤشرات الشهرية ويدير workflow التصعيد

CREATE TABLE "KpiFollowUp" (
    "id"                 TEXT          NOT NULL,
    "code"               TEXT          NOT NULL,
    "indicatorId"        TEXT          NOT NULL,
    "year"               INTEGER       NOT NULL,
    "month"              INTEGER       NOT NULL,
    "departmentId"       TEXT          NOT NULL,
    "dataEntryUserId"    TEXT          NOT NULL,
    "performanceOwnerId" TEXT,
    "dueDate"            TIMESTAMP(3)  NOT NULL,
    "submittedAt"        TIMESTAMP(3),
    "daysLate"           INTEGER,
    "previousEntryId"    TEXT,
    "resolvedEntryId"    TEXT,
    "status"             TEXT          NOT NULL DEFAULT 'PENDING',
    "escalationLevel"    INTEGER       NOT NULL DEFAULT 0,
    "escalatedAt"        TIMESTAMP(3),
    "escalatedById"      TEXT,
    "qmNotes"            TEXT,
    "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)  NOT NULL,
    "resolvedAt"         TIMESTAMP(3),

    CONSTRAINT "KpiFollowUp_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "KpiFollowUp_code_key"                       ON "KpiFollowUp"("code");
CREATE UNIQUE INDEX "KpiFollowUp_indicatorId_year_month_key"     ON "KpiFollowUp"("indicatorId", "year", "month");

-- Performance indexes (8 indexes — covers all common query patterns)
CREATE INDEX "KpiFollowUp_departmentId_idx"        ON "KpiFollowUp"("departmentId");
CREATE INDEX "KpiFollowUp_dataEntryUserId_idx"     ON "KpiFollowUp"("dataEntryUserId");
CREATE INDEX "KpiFollowUp_performanceOwnerId_idx"  ON "KpiFollowUp"("performanceOwnerId");
CREATE INDEX "KpiFollowUp_year_month_idx"          ON "KpiFollowUp"("year", "month");
CREATE INDEX "KpiFollowUp_status_idx"              ON "KpiFollowUp"("status");
CREATE INDEX "KpiFollowUp_dueDate_idx"             ON "KpiFollowUp"("dueDate");
CREATE INDEX "KpiFollowUp_escalationLevel_idx"     ON "KpiFollowUp"("escalationLevel");

-- Foreign keys
ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_dataEntryUserId_fkey"
    FOREIGN KEY ("dataEntryUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_performanceOwnerId_fkey"
    FOREIGN KEY ("performanceOwnerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_previousEntryId_fkey"
    FOREIGN KEY ("previousEntryId") REFERENCES "KpiEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_resolvedEntryId_fkey"
    FOREIGN KEY ("resolvedEntryId") REFERENCES "KpiEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KpiFollowUp"
    ADD CONSTRAINT "KpiFollowUp_escalatedById_fkey"
    FOREIGN KEY ("escalatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
