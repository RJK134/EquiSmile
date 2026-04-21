-- AlterTable
ALTER TABLE "Enquiry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Yard" ADD COLUMN     "formattedAddress" TEXT,
ADD COLUMN     "geocodePlaceId" TEXT,
ADD COLUMN     "geocodePrecision" TEXT,
ADD COLUMN     "geocodeSource" TEXT;

-- CreateTable
CREATE TABLE "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "actorStaffId" TEXT,
    "actorRole" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAuditLog_action_idx" ON "SecurityAuditLog"("action");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_entityType_entityId_idx" ON "SecurityAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_actorUserId_idx" ON "SecurityAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_createdAt_idx" ON "SecurityAuditLog"("createdAt");
