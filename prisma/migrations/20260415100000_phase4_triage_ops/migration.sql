-- Phase 4: Triage Operations
-- Add follow-up tracking and auto-triage fields to VisitRequest

ALTER TABLE "VisitRequest" ADD COLUMN "followUpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VisitRequest" ADD COLUMN "lastFollowUpAt" TIMESTAMP(3);
ALTER TABLE "VisitRequest" ADD COLUMN "autoTriageConfidence" DOUBLE PRECISION;

-- Add escalation tracking to TriageTask
ALTER TABLE "TriageTask" ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TriageAuditLog" (
    "id" TEXT NOT NULL,
    "visitRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriageAuditLog_visitRequestId_idx" ON "TriageAuditLog"("visitRequestId");

-- CreateIndex
CREATE INDEX "TriageAuditLog_createdAt_idx" ON "TriageAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TriageAuditLog" ADD CONSTRAINT "TriageAuditLog_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
