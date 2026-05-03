CREATE TABLE "IntegrationDelivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channel" TEXT NOT NULL DEFAULT 'N8N',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "recipientUserId" TEXT,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientRole" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "payloadJson" TEXT NOT NULL,
    "responseJson" TEXT,
    "error" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationDelivery_eventKey_key" ON "IntegrationDelivery"("eventKey");
CREATE INDEX "IntegrationDelivery_status_idx" ON "IntegrationDelivery"("status");
CREATE INDEX "IntegrationDelivery_event_idx" ON "IntegrationDelivery"("event");
CREATE INDEX "IntegrationDelivery_recipientUserId_idx" ON "IntegrationDelivery"("recipientUserId");
CREATE INDEX "IntegrationDelivery_entityType_entityId_idx" ON "IntegrationDelivery"("entityType", "entityId");
CREATE INDEX "IntegrationDelivery_requestedAt_idx" ON "IntegrationDelivery"("requestedAt");
