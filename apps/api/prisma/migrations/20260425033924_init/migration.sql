-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'QUALITY_MANAGER', 'COMMITTEE_MEMBER', 'DEPT_MANAGER', 'EMPLOYEE', 'GUEST_AUDITOR');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('RISK', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'UNDER_TREATMENT', 'MITIGATED', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintSource" AS ENUM ('BENEFICIARY', 'DONOR', 'VOLUNTEER', 'EMPLOYEE', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintChannel" AS ENUM ('PHONE', 'EMAIL', 'WEBSITE', 'IN_PERSON', 'WHATSAPP', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NCRStatus" AS ENUM ('OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'SUPPLIER', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('GOODS', 'SERVICES', 'CONSTRUCTION', 'IT_SERVICES', 'IN_KIND_DONOR', 'TRANSPORT', 'CONSULTING', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PENDING', 'APPROVED', 'CONDITIONAL', 'REJECTED', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('CASH', 'IN_KIND', 'SERVICE');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'DISTRIBUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BeneficiaryCategory" AS ENUM ('ORPHAN', 'WIDOW', 'POOR_FAMILY', 'DISABLED', 'ELDERLY', 'STUDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('APPLICANT', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SurveyTarget" AS ENUM ('BENEFICIARY', 'DONOR', 'VOLUNTEER', 'EMPLOYEE', 'PARTNER');

-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('MANUAL', 'POLICY', 'PROCEDURE', 'WORK_INSTRUCTION', 'FORM', 'RECORD', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "PdcaPhase" AS ENUM ('PLAN', 'DO', 'CHECK', 'ACT', 'CLOSED');

-- CreateEnum
CREATE TYPE "ImprovementStatus" AS ENUM ('PROPOSED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PerfReviewStatus" AS ENUM ('DRAFT', 'EMPLOYEE_REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AckCategory" AS ENUM ('QUALITY_POLICY', 'CODE_OF_ETHICS', 'CONFLICT_OF_INTEREST', 'CONFIDENTIALITY', 'DATA_PROTECTION', 'SAFEGUARDING', 'ANTI_HARASSMENT', 'ANTI_CORRUPTION', 'WHISTLEBLOWER', 'WORK_REGULATIONS', 'HEALTH_SAFETY', 'IT_USAGE', 'SOCIAL_MEDIA', 'BOARD_CHARTER', 'BYLAWS', 'BENEFICIARY_RIGHTS', 'BENEFICIARY_CONSENT', 'SUPPLIER_CODE', 'DONOR_PRIVACY', 'VOLUNTEER_AGREEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AckAudience" AS ENUM ('EMPLOYEE', 'VOLUNTEER', 'BOARD_MEMBER', 'GENERAL_ASSEMBLY', 'BENEFICIARY', 'SUPPLIER', 'DONOR', 'AUDITOR', 'ALL');

-- CreateEnum
CREATE TYPE "AckMethod" AS ENUM ('DIGITAL', 'PAPER', 'VERBAL');

-- CreateEnum
CREATE TYPE "AckRenewFreq" AS ENUM ('ONCE', 'ANNUAL', 'ON_CHANGE');

-- CreateEnum
CREATE TYPE "ProgressReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('CONTRADICTION', 'OVERDUE_PROMISE', 'TREND_DROP', 'ANOMALY', 'MISSING_DATA', 'BEHAVIORAL');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" TEXT,
    "manager" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "kpi" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "currentValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "strategicGoalId" TEXT,
    "kpiType" TEXT NOT NULL DEFAULT 'SNAPSHOT',
    "seasonality" TEXT NOT NULL DEFAULT 'UNIFORM',
    "direction" TEXT NOT NULL DEFAULT 'HIGHER_BETTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "RiskType" NOT NULL DEFAULT 'RISK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "departmentId" TEXT,
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "treatment" TEXT,
    "treatmentType" TEXT,
    "ownerId" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "reviewDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "strategicGoalId" TEXT,
    "workflowState" "WorkflowState" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "source" "ComplaintSource" NOT NULL,
    "channel" "ComplaintChannel" NOT NULL,
    "complainantName" TEXT,
    "complainantPhone" TEXT,
    "complainantEmail" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "assigneeId" TEXT,
    "rootCause" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "satisfaction" INTEGER,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'NEW',
    "relatedNcrId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCR" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "severity" TEXT NOT NULL,
    "rootCause" TEXT,
    "correction" TEXT,
    "correctiveAction" TEXT,
    "dueDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedNote" TEXT,
    "effective" BOOLEAN,
    "status" "NCRStatus" NOT NULL DEFAULT 'OPEN',
    "workflowState" "WorkflowState" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NCR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AuditType" NOT NULL DEFAULT 'INTERNAL',
    "scope" TEXT NOT NULL,
    "criteria" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "leadAuditorId" TEXT,
    "team" TEXT,
    "findings" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "reportUrl" TEXT,
    "checklistTemplateId" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "category" TEXT,
    "crNumber" TEXT,
    "vatNumber" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'PENDING',
    "overallRating" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "evaluatorName" TEXT,
    "evaluatorOrg" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierEval" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "evalTokenId" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatorId" TEXT NOT NULL,
    "period" TEXT,
    "criteriaJson" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "workflowState" "WorkflowState" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierEval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DonationType" NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorPhone" TEXT,
    "donorEmail" TEXT,
    "donorType" TEXT,
    "itemName" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'SAR',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationEval" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conformity" BOOLEAN NOT NULL,
    "quality" INTEGER NOT NULL,
    "usability" INTEGER NOT NULL,
    "expiryCheck" BOOLEAN,
    "score" DOUBLE PRECISION NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DonationEval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "category" "BeneficiaryCategory" NOT NULL,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "city" TEXT,
    "district" TEXT,
    "familySize" INTEGER,
    "monthlyIncome" DOUBLE PRECISION,
    "status" "BeneficiaryStatus" NOT NULL DEFAULT 'APPLICANT',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "needsAssessment" TEXT,
    "priorityScore" INTEGER,
    "assessedAt" TIMESTAMP(3),
    "assessedBy" TEXT,
    "vulnerabilityFlags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "spent" DOUBLE PRECISION DEFAULT 0,
    "beneficiariesCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" "SurveyTarget" NOT NULL,
    "period" TEXT,
    "responses" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION,
    "questionsJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondentName" TEXT,
    "answersJson" TEXT NOT NULL,
    "idHash" TEXT NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "category" "DocCategory" NOT NULL,
    "departmentId" TEXT,
    "currentVersion" TEXT NOT NULL DEFAULT '1.0',
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "retentionYears" INTEGER DEFAULT 5,
    "isoClause" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "changeLog" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ack" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL,

    CONSTRAINT "Ack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trainer" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION,
    "location" TEXT,
    "category" TEXT,
    "competenceTarget" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "effective" BOOLEAN,
    "certUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "changesJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicGoal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "perspective" TEXT,
    "kpi" TEXT,
    "baseline" TEXT,
    "target" TEXT,
    "initiatives" TEXT,
    "responsible" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StrategicGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalActivity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "perspective" TEXT,
    "department" TEXT,
    "responsible" TEXT,
    "year" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "spent" DOUBLE PRECISION DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "strategicGoalId" TEXT,
    "kpiType" TEXT NOT NULL DEFAULT 'CUMULATIVE',
    "targetValue" DOUBLE PRECISION,
    "targetUnit" TEXT,
    "seasonality" TEXT NOT NULL DEFAULT 'UNIFORM',
    "direction" TEXT NOT NULL DEFAULT 'HIGHER_BETTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OperationalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiEntry" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT,
    "activityId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION,
    "evidenceUrl" TEXT,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwotItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "strategy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SwotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestedParty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "needs" TEXT,
    "expectations" TEXT,
    "influence" TEXT,
    "monitoring" TEXT,
    "responsible" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InterestedParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "owner" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "resources" TEXT,
    "kpis" TEXT,
    "risks" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityPolicy" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "commitments" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QualityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementReview" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT,
    "attendees" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "contextChanges" TEXT,
    "objectivesReview" TEXT,
    "processPerformance" TEXT,
    "conformityStatus" TEXT,
    "auditResults" TEXT,
    "customerFeedback" TEXT,
    "risksStatus" TEXT,
    "improvementOpps" TEXT,
    "decisions" TEXT,
    "resourceNeeds" TEXT,
    "improvementActions" TEXT,
    "systemChanges" TEXT,
    "topManagementPresent" BOOLEAN,
    "minutes" TEXT,
    "nextReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ManagementReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceRequirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "requiredSkills" TEXT,
    "minEducation" TEXT,
    "minExperience" INTEGER,
    "certifications" TEXT,
    "trainings" TEXT,
    "evaluationMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CompetenceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "purpose" TEXT,
    "channel" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "format" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "eventKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementProject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "proposedById" TEXT NOT NULL,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "sourceType" TEXT,
    "sourceRef" TEXT,
    "phase" "PdcaPhase" NOT NULL DEFAULT 'PLAN',
    "planDetails" TEXT,
    "planTarget" TEXT,
    "doDetails" TEXT,
    "doStartedAt" TIMESTAMP(3),
    "checkResults" TEXT,
    "checkMeasuredAt" TIMESTAMP(3),
    "actDecision" TEXT,
    "lessonsLearned" TEXT,
    "status" "ImprovementStatus" NOT NULL DEFAULT 'PROPOSED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ImprovementProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isoClauses" TEXT,
    "itemsJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "jobKnowledge" INTEGER,
    "qualityOfWork" INTEGER,
    "productivity" INTEGER,
    "teamwork" INTEGER,
    "communication" INTEGER,
    "initiative" INTEGER,
    "reliability" INTEGER,
    "overallRating" DOUBLE PRECISION,
    "grade" TEXT,
    "strengths" TEXT,
    "areasToImprove" TEXT,
    "goalsNextPeriod" TEXT,
    "developmentPlan" TEXT,
    "employeeComments" TEXT,
    "status" "PerfReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeSignedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcknowledgment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PolicyAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AckDocument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "AckCategory" NOT NULL,
    "audience" "AckAudience"[],
    "version" TEXT NOT NULL DEFAULT '1.0',
    "content" TEXT NOT NULL,
    "commitments" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "renewFrequency" "AckRenewFreq" NOT NULL DEFAULT 'ON_CHANGE',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AckDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AckToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "userId" TEXT,
    "externalType" TEXT,
    "externalName" TEXT,
    "externalContact" TEXT,
    "sentVia" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AckToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acknowledgment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "userId" TEXT,
    "externalType" TEXT,
    "externalId" TEXT,
    "externalName" TEXT,
    "externalContact" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "method" "AckMethod" NOT NULL DEFAULT 'DIGITAL',
    "evidenceUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "Acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orgName" TEXT NOT NULL DEFAULT 'الجمعية',
    "orgDescription" TEXT,
    "showPolicy" BOOLEAN NOT NULL DEFAULT true,
    "showDocuments" BOOLEAN NOT NULL DEFAULT true,
    "showAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "showSurveys" BOOLEAN NOT NULL DEFAULT true,
    "showKpis" BOOLEAN NOT NULL DEFAULT false,
    "footerText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CORRECTIVE',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "sourceCode" TEXT,
    "ncrId" TEXT,
    "complaintId" TEXT,
    "riskId" TEXT,
    "rootCauseAnalysis" TEXT,
    "plannedAction" TEXT,
    "implementedAction" TEXT,
    "verificationNote" TEXT,
    "effective" BOOLEAN,
    "lessonsLearned" TEXT,
    "dueDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'جلسة جديدة',
    "messages" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastModel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MigrationLog" (
    "name" TEXT NOT NULL,
    "appliedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_MigrationLog_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "piiRedacted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "rating" INTEGER,
    "ratingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressReport" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ProgressReportStatus" NOT NULL DEFAULT 'DRAFT',
    "autoFilled" TEXT NOT NULL,
    "deptFilled" TEXT,
    "aiQuestions" TEXT NOT NULL,
    "score" INTEGER,
    "scoreBreakdown" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedReason" TEXT,
    "extractedPromises" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProgressReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationFlag" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "departmentId" TEXT,
    "type" "FlagType" NOT NULL,
    "severity" "FlagSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestigationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Objective_code_key" ON "Objective"("code");

-- CreateIndex
CREATE INDEX "Objective_status_idx" ON "Objective"("status");

-- CreateIndex
CREATE INDEX "Objective_departmentId_idx" ON "Objective"("departmentId");

-- CreateIndex
CREATE INDEX "Objective_strategicGoalId_idx" ON "Objective"("strategicGoalId");

-- CreateIndex
CREATE INDEX "Objective_deletedAt_idx" ON "Objective"("deletedAt");

-- CreateIndex
CREATE INDEX "Objective_deletedAt_status_idx" ON "Objective"("deletedAt", "status");

-- CreateIndex
CREATE INDEX "Objective_ownerId_status_idx" ON "Objective"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_code_key" ON "Risk"("code");

-- CreateIndex
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

-- CreateIndex
CREATE INDEX "Risk_level_idx" ON "Risk"("level");

-- CreateIndex
CREATE INDEX "Risk_strategicGoalId_idx" ON "Risk"("strategicGoalId");

-- CreateIndex
CREATE INDEX "Risk_workflowState_idx" ON "Risk"("workflowState");

-- CreateIndex
CREATE INDEX "Risk_deletedAt_idx" ON "Risk"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_code_key" ON "Complaint"("code");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_source_idx" ON "Complaint"("source");

-- CreateIndex
CREATE INDEX "Complaint_relatedNcrId_idx" ON "Complaint"("relatedNcrId");

-- CreateIndex
CREATE INDEX "Complaint_deletedAt_idx" ON "Complaint"("deletedAt");

-- CreateIndex
CREATE INDEX "Complaint_deletedAt_status_receivedAt_idx" ON "Complaint"("deletedAt", "status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NCR_code_key" ON "NCR"("code");

-- CreateIndex
CREATE INDEX "NCR_status_idx" ON "NCR"("status");

-- CreateIndex
CREATE INDEX "NCR_departmentId_idx" ON "NCR"("departmentId");

-- CreateIndex
CREATE INDEX "NCR_workflowState_idx" ON "NCR"("workflowState");

-- CreateIndex
CREATE INDEX "NCR_deletedAt_idx" ON "NCR"("deletedAt");

-- CreateIndex
CREATE INDEX "NCR_deletedAt_status_dueDate_idx" ON "NCR"("deletedAt", "status", "dueDate");

-- CreateIndex
CREATE INDEX "NCR_assigneeId_status_idx" ON "NCR"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_code_key" ON "Audit"("code");

-- CreateIndex
CREATE INDEX "Audit_status_idx" ON "Audit"("status");

-- CreateIndex
CREATE INDEX "Audit_type_idx" ON "Audit"("type");

-- CreateIndex
CREATE INDEX "Audit_deletedAt_idx" ON "Audit"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Supplier_type_idx" ON "Supplier"("type");

-- CreateIndex
CREATE INDEX "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvalToken_token_key" ON "EvalToken"("token");

-- CreateIndex
CREATE INDEX "EvalToken_token_idx" ON "EvalToken"("token");

-- CreateIndex
CREATE INDEX "EvalToken_supplierId_idx" ON "EvalToken"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierEval_code_key" ON "SupplierEval"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierEval_evalTokenId_key" ON "SupplierEval"("evalTokenId");

-- CreateIndex
CREATE INDEX "SupplierEval_supplierId_idx" ON "SupplierEval"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierEval_workflowState_idx" ON "SupplierEval"("workflowState");

-- CreateIndex
CREATE INDEX "SupplierEval_deletedAt_idx" ON "SupplierEval"("deletedAt");

-- CreateIndex
CREATE INDEX "SupplierEval_supplierId_workflowState_idx" ON "SupplierEval"("supplierId", "workflowState");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_code_key" ON "Donation"("code");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_type_idx" ON "Donation"("type");

-- CreateIndex
CREATE INDEX "Donation_deletedAt_idx" ON "Donation"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonationEval_code_key" ON "DonationEval"("code");

-- CreateIndex
CREATE INDEX "DonationEval_donationId_idx" ON "DonationEval"("donationId");

-- CreateIndex
CREATE INDEX "DonationEval_deletedAt_idx" ON "DonationEval"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_code_key" ON "Beneficiary"("code");

-- CreateIndex
CREATE INDEX "Beneficiary_status_idx" ON "Beneficiary"("status");

-- CreateIndex
CREATE INDEX "Beneficiary_category_idx" ON "Beneficiary"("category");

-- CreateIndex
CREATE INDEX "Beneficiary_deletedAt_idx" ON "Beneficiary"("deletedAt");

-- CreateIndex
CREATE INDEX "Beneficiary_status_assessedAt_idx" ON "Beneficiary"("status", "assessedAt");

-- CreateIndex
CREATE INDEX "Beneficiary_deletedAt_status_idx" ON "Beneficiary"("deletedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex
CREATE INDEX "Program_deletedAt_idx" ON "Program"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_code_key" ON "Survey"("code");

-- CreateIndex
CREATE INDEX "Survey_deletedAt_idx" ON "Survey"("deletedAt");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_submittedAt_idx" ON "SurveyResponse"("surveyId", "submittedAt");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idHash_idx" ON "SurveyResponse"("surveyId", "idHash");

-- CreateIndex
CREATE UNIQUE INDEX "Document_code_key" ON "Document"("code");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE INDEX "DocVersion_documentId_idx" ON "DocVersion"("documentId");

-- CreateIndex
CREATE INDEX "Ack_userId_idx" ON "Ack"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ack_documentId_userId_version_key" ON "Ack"("documentId", "userId", "version");

-- CreateIndex
CREATE INDEX "Signature_entityType_entityId_idx" ON "Signature"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Signature_userId_idx" ON "Signature"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Training_code_key" ON "Training"("code");

-- CreateIndex
CREATE INDEX "Training_deletedAt_idx" ON "Training"("deletedAt");

-- CreateIndex
CREATE INDEX "TrainingRecord_userId_idx" ON "TrainingRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecord_trainingId_userId_key" ON "TrainingRecord"("trainingId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicGoal_code_key" ON "StrategicGoal"("code");

-- CreateIndex
CREATE INDEX "StrategicGoal_status_idx" ON "StrategicGoal"("status");

-- CreateIndex
CREATE INDEX "StrategicGoal_deletedAt_idx" ON "StrategicGoal"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalActivity_code_key" ON "OperationalActivity"("code");

-- CreateIndex
CREATE INDEX "OperationalActivity_status_idx" ON "OperationalActivity"("status");

-- CreateIndex
CREATE INDEX "OperationalActivity_year_idx" ON "OperationalActivity"("year");

-- CreateIndex
CREATE INDEX "OperationalActivity_strategicGoalId_idx" ON "OperationalActivity"("strategicGoalId");

-- CreateIndex
CREATE INDEX "OperationalActivity_deletedAt_idx" ON "OperationalActivity"("deletedAt");

-- CreateIndex
CREATE INDEX "KpiEntry_year_month_idx" ON "KpiEntry"("year", "month");

-- CreateIndex
CREATE INDEX "KpiEntry_objectiveId_idx" ON "KpiEntry"("objectiveId");

-- CreateIndex
CREATE INDEX "KpiEntry_activityId_idx" ON "KpiEntry"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiEntry_objectiveId_year_month_key" ON "KpiEntry"("objectiveId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "KpiEntry_activityId_year_month_key" ON "KpiEntry"("activityId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SwotItem_code_key" ON "SwotItem"("code");

-- CreateIndex
CREATE INDEX "SwotItem_type_idx" ON "SwotItem"("type");

-- CreateIndex
CREATE INDEX "SwotItem_status_idx" ON "SwotItem"("status");

-- CreateIndex
CREATE INDEX "SwotItem_deletedAt_idx" ON "SwotItem"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterestedParty_code_key" ON "InterestedParty"("code");

-- CreateIndex
CREATE INDEX "InterestedParty_type_idx" ON "InterestedParty"("type");

-- CreateIndex
CREATE INDEX "InterestedParty_status_idx" ON "InterestedParty"("status");

-- CreateIndex
CREATE INDEX "InterestedParty_deletedAt_idx" ON "InterestedParty"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Process_code_key" ON "Process"("code");

-- CreateIndex
CREATE INDEX "Process_type_idx" ON "Process"("type");

-- CreateIndex
CREATE INDEX "Process_deletedAt_idx" ON "Process"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualityPolicy_version_key" ON "QualityPolicy"("version");

-- CreateIndex
CREATE INDEX "QualityPolicy_active_idx" ON "QualityPolicy"("active");

-- CreateIndex
CREATE INDEX "QualityPolicy_deletedAt_idx" ON "QualityPolicy"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementReview_code_key" ON "ManagementReview"("code");

-- CreateIndex
CREATE INDEX "ManagementReview_status_idx" ON "ManagementReview"("status");

-- CreateIndex
CREATE INDEX "ManagementReview_deletedAt_idx" ON "ManagementReview"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompetenceRequirement_code_key" ON "CompetenceRequirement"("code");

-- CreateIndex
CREATE INDEX "CompetenceRequirement_status_idx" ON "CompetenceRequirement"("status");

-- CreateIndex
CREATE INDEX "CompetenceRequirement_deletedAt_idx" ON "CompetenceRequirement"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPlan_code_key" ON "CommunicationPlan"("code");

-- CreateIndex
CREATE INDEX "CommunicationPlan_status_idx" ON "CommunicationPlan"("status");

-- CreateIndex
CREATE INDEX "CommunicationPlan_deletedAt_idx" ON "CommunicationPlan"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImprovementProject_code_key" ON "ImprovementProject"("code");

-- CreateIndex
CREATE INDEX "ImprovementProject_status_idx" ON "ImprovementProject"("status");

-- CreateIndex
CREATE INDEX "ImprovementProject_phase_idx" ON "ImprovementProject"("phase");

-- CreateIndex
CREATE INDEX "ImprovementProject_ownerId_idx" ON "ImprovementProject"("ownerId");

-- CreateIndex
CREATE INDEX "ImprovementProject_deletedAt_idx" ON "ImprovementProject"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistTemplate_code_key" ON "AuditChecklistTemplate"("code");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_active_idx" ON "AuditChecklistTemplate"("active");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_deletedAt_idx" ON "AuditChecklistTemplate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_code_key" ON "PerformanceReview"("code");

-- CreateIndex
CREATE INDEX "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");

-- CreateIndex
CREATE INDEX "PerformanceReview_reviewerId_idx" ON "PerformanceReview"("reviewerId");

-- CreateIndex
CREATE INDEX "PerformanceReview_period_idx" ON "PerformanceReview"("period");

-- CreateIndex
CREATE INDEX "PerformanceReview_status_idx" ON "PerformanceReview"("status");

-- CreateIndex
CREATE INDEX "PerformanceReview_deletedAt_idx" ON "PerformanceReview"("deletedAt");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgment_userId_idx" ON "PolicyAcknowledgment"("userId");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgment_policyId_idx" ON "PolicyAcknowledgment"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcknowledgment_userId_policyId_policyVersion_key" ON "PolicyAcknowledgment"("userId", "policyId", "policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AckDocument_code_key" ON "AckDocument"("code");

-- CreateIndex
CREATE INDEX "AckDocument_active_category_idx" ON "AckDocument"("active", "category");

-- CreateIndex
CREATE INDEX "AckDocument_deletedAt_idx" ON "AckDocument"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AckToken_token_key" ON "AckToken"("token");

-- CreateIndex
CREATE INDEX "AckToken_token_idx" ON "AckToken"("token");

-- CreateIndex
CREATE INDEX "AckToken_documentId_idx" ON "AckToken"("documentId");

-- CreateIndex
CREATE INDEX "AckToken_userId_idx" ON "AckToken"("userId");

-- CreateIndex
CREATE INDEX "AckToken_externalType_externalContact_idx" ON "AckToken"("externalType", "externalContact");

-- CreateIndex
CREATE INDEX "Acknowledgment_documentId_idx" ON "Acknowledgment"("documentId");

-- CreateIndex
CREATE INDEX "Acknowledgment_userId_idx" ON "Acknowledgment"("userId");

-- CreateIndex
CREATE INDEX "Acknowledgment_externalType_externalId_idx" ON "Acknowledgment"("externalType", "externalId");

-- CreateIndex
CREATE INDEX "Acknowledgment_acknowledgedAt_idx" ON "Acknowledgment"("acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgment_documentId_documentVersion_userId_key" ON "Acknowledgment"("documentId", "documentVersion", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ack_ext_by_contact" ON "Acknowledgment"("documentId", "documentVersion", "externalType", "externalContact");

-- CreateIndex
CREATE UNIQUE INDEX "ack_ext_by_id" ON "Acknowledgment"("documentId", "documentVersion", "externalType", "externalId");

-- CreateIndex
CREATE INDEX "Announcement_isActive_publishedAt_idx" ON "Announcement"("isActive", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_code_key" ON "Capa"("code");

-- CreateIndex
CREATE INDEX "Capa_status_deletedAt_idx" ON "Capa"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Capa_sourceType_sourceId_idx" ON "Capa"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Capa_ownerId_idx" ON "Capa"("ownerId");

-- CreateIndex
CREATE INDEX "Capa_dueDate_idx" ON "Capa"("dueDate");

-- CreateIndex
CREATE INDEX "ConsultSession_userId_updatedAt_idx" ON "ConsultSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConsultSession_createdAt_idx" ON "ConsultSession"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_provider_createdAt_idx" ON "AiUsageLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_idx" ON "AiUsageLog"("userId");

-- CreateIndex
CREATE INDEX "ProgressReport_departmentId_idx" ON "ProgressReport"("departmentId");

-- CreateIndex
CREATE INDEX "ProgressReport_status_idx" ON "ProgressReport"("status");

-- CreateIndex
CREATE INDEX "ProgressReport_year_month_idx" ON "ProgressReport"("year", "month");

-- CreateIndex
CREATE INDEX "ProgressReport_deletedAt_idx" ON "ProgressReport"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressReport_departmentId_year_month_key" ON "ProgressReport"("departmentId", "year", "month");

-- CreateIndex
CREATE INDEX "InvestigationFlag_departmentId_idx" ON "InvestigationFlag"("departmentId");

-- CreateIndex
CREATE INDEX "InvestigationFlag_status_idx" ON "InvestigationFlag"("status");

-- CreateIndex
CREATE INDEX "InvestigationFlag_type_idx" ON "InvestigationFlag"("type");

-- CreateIndex
CREATE INDEX "InvestigationFlag_reportId_idx" ON "InvestigationFlag"("reportId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_strategicGoalId_fkey" FOREIGN KEY ("strategicGoalId") REFERENCES "StrategicGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_strategicGoalId_fkey" FOREIGN KEY ("strategicGoalId") REFERENCES "StrategicGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_relatedNcrId_fkey" FOREIGN KEY ("relatedNcrId") REFERENCES "NCR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalToken" ADD CONSTRAINT "EvalToken_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEval" ADD CONSTRAINT "SupplierEval_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEval" ADD CONSTRAINT "SupplierEval_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationEval" ADD CONSTRAINT "DonationEval_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationEval" ADD CONSTRAINT "DonationEval_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocVersion" ADD CONSTRAINT "DocVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ack" ADD CONSTRAINT "Ack_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ack" ADD CONSTRAINT "Ack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalActivity" ADD CONSTRAINT "OperationalActivity_strategicGoalId_fkey" FOREIGN KEY ("strategicGoalId") REFERENCES "StrategicGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "OperationalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AckToken" ADD CONSTRAINT "AckToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AckDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AckToken" ADD CONSTRAINT "AckToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AckDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultSession" ADD CONSTRAINT "ConsultSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationFlag" ADD CONSTRAINT "InvestigationFlag_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProgressReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

