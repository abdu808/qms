-- CreateTable
CREATE TABLE "StrategicPlan" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "startYear"   INTEGER NOT NULL,
    "endYear"     INTEGER NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'DRAFT',
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),

    CONSTRAINT "StrategicPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrategicPlan_code_key" ON "StrategicPlan"("code");
CREATE INDEX "StrategicPlan_status_idx" ON "StrategicPlan"("status");
CREATE INDEX "StrategicPlan_deletedAt_idx" ON "StrategicPlan"("deletedAt");

-- AlterTable: add planId to StrategicGoal
ALTER TABLE "StrategicGoal" ADD COLUMN "planId" TEXT;

-- CreateIndex
CREATE INDEX "StrategicGoal_planId_idx" ON "StrategicGoal"("planId");

-- AddForeignKey
ALTER TABLE "StrategicGoal"
    ADD CONSTRAINT "StrategicGoal_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "StrategicPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
