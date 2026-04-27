-- ════════════════════════════════════════════════════════════════════
-- Integration Layer — ربط جميع النماذج المعزولة (24 نموذج)
-- ════════════════════════════════════════════════════════════════════
-- يحوّل النظام من جزر منعزلة إلى منظومة مترابطة:
--   • SWOT → Risk + StrategicGoal
--   • InterestedParty → User (responsible) + Risk
--   • Process → User (owner) + Department + Objective + Risk + Indicator
--   • Beneficiary → User (case manager) + Department + Programs (M-M)
--   • Program → User (manager) + Department + Donations (M-M)
--   • Donation → Programs (allocations) + Beneficiary (recipient)
--   • CompetenceRequirement → Department + Trainings (M-M)
--   • PerformanceReview → User (employee, reviewer) — proper FKs
--   • Audit → Department + Process + NCRs (findings M-M)
--   • ManagementReview → StrategicPlan + year
--   • QualityPolicy → AckDocument (auto-generated)
--   • CommunicationPlan → User + Parties (M-M)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. SwotItem ──────────────────────────────────────────────────────
ALTER TABLE "SwotItem"
  ADD COLUMN IF NOT EXISTS "relatedRiskId"  TEXT,
  ADD COLUMN IF NOT EXISTS "relatedGoalId"  TEXT,
  ADD COLUMN IF NOT EXISTS "ownerUserId"    TEXT,
  ADD COLUMN IF NOT EXISTS "departmentId"   TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SwotItem_relatedRiskId_fkey') THEN
    ALTER TABLE "SwotItem" ADD CONSTRAINT "SwotItem_relatedRiskId_fkey"
      FOREIGN KEY ("relatedRiskId") REFERENCES "Risk"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SwotItem_relatedGoalId_fkey') THEN
    ALTER TABLE "SwotItem" ADD CONSTRAINT "SwotItem_relatedGoalId_fkey"
      FOREIGN KEY ("relatedGoalId") REFERENCES "StrategicGoal"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SwotItem_ownerUserId_fkey') THEN
    ALTER TABLE "SwotItem" ADD CONSTRAINT "SwotItem_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SwotItem_departmentId_fkey') THEN
    ALTER TABLE "SwotItem" ADD CONSTRAINT "SwotItem_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SwotItem_relatedRiskId_idx" ON "SwotItem"("relatedRiskId");
CREATE INDEX IF NOT EXISTS "SwotItem_relatedGoalId_idx" ON "SwotItem"("relatedGoalId");
CREATE INDEX IF NOT EXISTS "SwotItem_ownerUserId_idx"   ON "SwotItem"("ownerUserId");
CREATE INDEX IF NOT EXISTS "SwotItem_departmentId_idx"  ON "SwotItem"("departmentId");

-- ── 2. InterestedParty ───────────────────────────────────────────────
ALTER TABLE "InterestedParty"
  ADD COLUMN IF NOT EXISTS "responsibleUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedRiskId"     TEXT,
  ADD COLUMN IF NOT EXISTS "departmentId"      TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterestedParty_responsibleUserId_fkey') THEN
    ALTER TABLE "InterestedParty" ADD CONSTRAINT "InterestedParty_responsibleUserId_fkey"
      FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterestedParty_relatedRiskId_fkey') THEN
    ALTER TABLE "InterestedParty" ADD CONSTRAINT "InterestedParty_relatedRiskId_fkey"
      FOREIGN KEY ("relatedRiskId") REFERENCES "Risk"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterestedParty_departmentId_fkey') THEN
    ALTER TABLE "InterestedParty" ADD CONSTRAINT "InterestedParty_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InterestedParty_responsibleUserId_idx" ON "InterestedParty"("responsibleUserId");
CREATE INDEX IF NOT EXISTS "InterestedParty_relatedRiskId_idx"     ON "InterestedParty"("relatedRiskId");
CREATE INDEX IF NOT EXISTS "InterestedParty_departmentId_idx"      ON "InterestedParty"("departmentId");

-- ── 3. Process ───────────────────────────────────────────────────────
ALTER TABLE "Process"
  ADD COLUMN IF NOT EXISTS "ownerUserId"  TEXT,
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Process_ownerUserId_fkey') THEN
    ALTER TABLE "Process" ADD CONSTRAINT "Process_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Process_departmentId_fkey') THEN
    ALTER TABLE "Process" ADD CONSTRAINT "Process_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Process_ownerUserId_idx"  ON "Process"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Process_departmentId_idx" ON "Process"("departmentId");

-- ── 4. Beneficiary ───────────────────────────────────────────────────
ALTER TABLE "Beneficiary"
  ADD COLUMN IF NOT EXISTS "caseManagerId" TEXT,
  ADD COLUMN IF NOT EXISTS "departmentId"  TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Beneficiary_caseManagerId_fkey') THEN
    ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_caseManagerId_fkey"
      FOREIGN KEY ("caseManagerId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Beneficiary_departmentId_fkey') THEN
    ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Beneficiary_caseManagerId_idx" ON "Beneficiary"("caseManagerId");
CREATE INDEX IF NOT EXISTS "Beneficiary_departmentId_idx"  ON "Beneficiary"("departmentId");

-- ── 5. Program ───────────────────────────────────────────────────────
ALTER TABLE "Program"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "managerId"    TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Program_departmentId_fkey') THEN
    ALTER TABLE "Program" ADD CONSTRAINT "Program_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Program_managerId_fkey') THEN
    ALTER TABLE "Program" ADD CONSTRAINT "Program_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Program_departmentId_idx" ON "Program"("departmentId");
CREATE INDEX IF NOT EXISTS "Program_managerId_idx"    ON "Program"("managerId");

-- ── 6. Donation ──────────────────────────────────────────────────────
ALTER TABLE "Donation"
  ADD COLUMN IF NOT EXISTS "recipientId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Donation_recipientId_fkey') THEN
    ALTER TABLE "Donation" ADD CONSTRAINT "Donation_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Donation_recipientId_idx" ON "Donation"("recipientId");

-- ── 7. CompetenceRequirement ─────────────────────────────────────────
ALTER TABLE "CompetenceRequirement"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompetenceRequirement_departmentId_fkey') THEN
    ALTER TABLE "CompetenceRequirement" ADD CONSTRAINT "CompetenceRequirement_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CompetenceRequirement_departmentId_idx" ON "CompetenceRequirement"("departmentId");

-- ── 8. PerformanceReview — تحويل employeeId/reviewerId إلى FK حقيقي ──
-- (الحقول موجودة كـ String، الآن نضيف القيود)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceReview_employeeId_fkey') THEN
    ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceReview_reviewerId_fkey') THEN
    ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_reviewerId_idx" ON "PerformanceReview"("reviewerId");

-- ── 9. Audit ─────────────────────────────────────────────────────────
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "processId"    TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Audit_departmentId_fkey') THEN
    ALTER TABLE "Audit" ADD CONSTRAINT "Audit_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Audit_processId_fkey') THEN
    ALTER TABLE "Audit" ADD CONSTRAINT "Audit_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Audit_departmentId_idx" ON "Audit"("departmentId");
CREATE INDEX IF NOT EXISTS "Audit_processId_idx"    ON "Audit"("processId");

-- ── 10. ManagementReview ─────────────────────────────────────────────
ALTER TABLE "ManagementReview"
  ADD COLUMN IF NOT EXISTS "planId"  TEXT,
  ADD COLUMN IF NOT EXISTS "year"    INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManagementReview_planId_fkey') THEN
    ALTER TABLE "ManagementReview" ADD CONSTRAINT "ManagementReview_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "StrategicPlan"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ManagementReview_planId_idx" ON "ManagementReview"("planId");
CREATE INDEX IF NOT EXISTS "ManagementReview_year_idx"   ON "ManagementReview"("year");

-- ── 11. QualityPolicy ────────────────────────────────────────────────
ALTER TABLE "QualityPolicy"
  ADD COLUMN IF NOT EXISTS "ackDocumentId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QualityPolicy_ackDocumentId_fkey') THEN
    ALTER TABLE "QualityPolicy" ADD CONSTRAINT "QualityPolicy_ackDocumentId_fkey"
      FOREIGN KEY ("ackDocumentId") REFERENCES "AckDocument"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "QualityPolicy_ackDocumentId_idx" ON "QualityPolicy"("ackDocumentId");

-- ── 12. CommunicationPlan ────────────────────────────────────────────
ALTER TABLE "CommunicationPlan"
  ADD COLUMN IF NOT EXISTS "responsibleUserId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationPlan_responsibleUserId_fkey') THEN
    ALTER TABLE "CommunicationPlan" ADD CONSTRAINT "CommunicationPlan_responsibleUserId_fkey"
      FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CommunicationPlan_responsibleUserId_idx" ON "CommunicationPlan"("responsibleUserId");

-- ════════════════════════════════════════════════════════════════════
-- Junction Tables (8 جداول جديدة للعلاقات M-M)
-- ════════════════════════════════════════════════════════════════════

-- ── A. BeneficiaryProgram ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BeneficiaryProgram" (
    "id"            TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "programId"     TEXT NOT NULL,
    "enrolledAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt"      TIMESTAMP(3),
    "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BeneficiaryProgram_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BeneficiaryProgram_beneficiaryId_programId_key" ON "BeneficiaryProgram"("beneficiaryId","programId");
CREATE INDEX IF NOT EXISTS "BeneficiaryProgram_beneficiaryId_idx" ON "BeneficiaryProgram"("beneficiaryId");
CREATE INDEX IF NOT EXISTS "BeneficiaryProgram_programId_idx"     ON "BeneficiaryProgram"("programId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BeneficiaryProgram_beneficiaryId_fkey') THEN
    ALTER TABLE "BeneficiaryProgram" ADD CONSTRAINT "BeneficiaryProgram_beneficiaryId_fkey"
      FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BeneficiaryProgram_programId_fkey') THEN
    ALTER TABLE "BeneficiaryProgram" ADD CONSTRAINT "BeneficiaryProgram_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── B. ProgramDonation ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProgramDonation" (
    "id"           TEXT NOT NULL,
    "programId"    TEXT NOT NULL,
    "donationId"   TEXT NOT NULL,
    "amount"       DOUBLE PRECISION NOT NULL,
    "allocatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramDonation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramDonation_programId_donationId_key" ON "ProgramDonation"("programId","donationId");
CREATE INDEX IF NOT EXISTS "ProgramDonation_programId_idx"  ON "ProgramDonation"("programId");
CREATE INDEX IF NOT EXISTS "ProgramDonation_donationId_idx" ON "ProgramDonation"("donationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgramDonation_programId_fkey') THEN
    ALTER TABLE "ProgramDonation" ADD CONSTRAINT "ProgramDonation_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgramDonation_donationId_fkey') THEN
    ALTER TABLE "ProgramDonation" ADD CONSTRAINT "ProgramDonation_donationId_fkey"
      FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── C. ProcessObjective ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProcessObjective" (
    "id"          TEXT NOT NULL,
    "processId"   TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessObjective_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessObjective_processId_objectiveId_key" ON "ProcessObjective"("processId","objectiveId");
CREATE INDEX IF NOT EXISTS "ProcessObjective_processId_idx"   ON "ProcessObjective"("processId");
CREATE INDEX IF NOT EXISTS "ProcessObjective_objectiveId_idx" ON "ProcessObjective"("objectiveId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessObjective_processId_fkey') THEN
    ALTER TABLE "ProcessObjective" ADD CONSTRAINT "ProcessObjective_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessObjective_objectiveId_fkey') THEN
    ALTER TABLE "ProcessObjective" ADD CONSTRAINT "ProcessObjective_objectiveId_fkey"
      FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── D. ProcessRisk ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProcessRisk" (
    "id"        TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "riskId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessRisk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessRisk_processId_riskId_key" ON "ProcessRisk"("processId","riskId");
CREATE INDEX IF NOT EXISTS "ProcessRisk_processId_idx" ON "ProcessRisk"("processId");
CREATE INDEX IF NOT EXISTS "ProcessRisk_riskId_idx"    ON "ProcessRisk"("riskId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessRisk_processId_fkey') THEN
    ALTER TABLE "ProcessRisk" ADD CONSTRAINT "ProcessRisk_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessRisk_riskId_fkey') THEN
    ALTER TABLE "ProcessRisk" ADD CONSTRAINT "ProcessRisk_riskId_fkey"
      FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── E. ProcessIndicator ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProcessIndicator" (
    "id"          TEXT NOT NULL,
    "processId"   TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessIndicator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessIndicator_processId_indicatorId_key" ON "ProcessIndicator"("processId","indicatorId");
CREATE INDEX IF NOT EXISTS "ProcessIndicator_processId_idx"   ON "ProcessIndicator"("processId");
CREATE INDEX IF NOT EXISTS "ProcessIndicator_indicatorId_idx" ON "ProcessIndicator"("indicatorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessIndicator_processId_fkey') THEN
    ALTER TABLE "ProcessIndicator" ADD CONSTRAINT "ProcessIndicator_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcessIndicator_indicatorId_fkey') THEN
    ALTER TABLE "ProcessIndicator" ADD CONSTRAINT "ProcessIndicator_indicatorId_fkey"
      FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── F. CommunicationPlanParty ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CommunicationPlanParty" (
    "id"        TEXT NOT NULL,
    "planId"    TEXT NOT NULL,
    "partyId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationPlanParty_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationPlanParty_planId_partyId_key" ON "CommunicationPlanParty"("planId","partyId");
CREATE INDEX IF NOT EXISTS "CommunicationPlanParty_planId_idx"  ON "CommunicationPlanParty"("planId");
CREATE INDEX IF NOT EXISTS "CommunicationPlanParty_partyId_idx" ON "CommunicationPlanParty"("partyId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationPlanParty_planId_fkey') THEN
    ALTER TABLE "CommunicationPlanParty" ADD CONSTRAINT "CommunicationPlanParty_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "CommunicationPlan"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationPlanParty_partyId_fkey') THEN
    ALTER TABLE "CommunicationPlanParty" ADD CONSTRAINT "CommunicationPlanParty_partyId_fkey"
      FOREIGN KEY ("partyId") REFERENCES "InterestedParty"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── G. AuditNCR ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AuditNCR" (
    "id"        TEXT NOT NULL,
    "auditId"   TEXT NOT NULL,
    "ncrId"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditNCR_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditNCR_auditId_ncrId_key" ON "AuditNCR"("auditId","ncrId");
CREATE INDEX IF NOT EXISTS "AuditNCR_auditId_idx" ON "AuditNCR"("auditId");
CREATE INDEX IF NOT EXISTS "AuditNCR_ncrId_idx"   ON "AuditNCR"("ncrId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditNCR_auditId_fkey') THEN
    ALTER TABLE "AuditNCR" ADD CONSTRAINT "AuditNCR_auditId_fkey"
      FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditNCR_ncrId_fkey') THEN
    ALTER TABLE "AuditNCR" ADD CONSTRAINT "AuditNCR_ncrId_fkey"
      FOREIGN KEY ("ncrId") REFERENCES "NCR"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── H. TrainingCompetence ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TrainingCompetence" (
    "id"                      TEXT NOT NULL,
    "trainingId"              TEXT NOT NULL,
    "competenceRequirementId" TEXT NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCompetence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingCompetence_trainingId_competenceRequirementId_key" ON "TrainingCompetence"("trainingId","competenceRequirementId");
CREATE INDEX IF NOT EXISTS "TrainingCompetence_trainingId_idx"              ON "TrainingCompetence"("trainingId");
CREATE INDEX IF NOT EXISTS "TrainingCompetence_competenceRequirementId_idx" ON "TrainingCompetence"("competenceRequirementId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingCompetence_trainingId_fkey') THEN
    ALTER TABLE "TrainingCompetence" ADD CONSTRAINT "TrainingCompetence_trainingId_fkey"
      FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingCompetence_competenceRequirementId_fkey') THEN
    ALTER TABLE "TrainingCompetence" ADD CONSTRAINT "TrainingCompetence_competenceRequirementId_fkey"
      FOREIGN KEY ("competenceRequirementId") REFERENCES "CompetenceRequirement"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- نهاية Integration Layer
-- ════════════════════════════════════════════════════════════════════
