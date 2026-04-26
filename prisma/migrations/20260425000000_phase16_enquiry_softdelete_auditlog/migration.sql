-- Phase 16 overnight hardening — extend soft-delete tombstones to the
-- Enquiry table and add a generic business AuditLog.
--
-- Why:
--   1. Enquiry rows hold inbound customer messages (PII). Hard-delete
--      destroys the audit trail and prevents recovery of a misrouted
--      thread. Phase 15 added soft-delete to Customer/Yard/Horse;
--      this PR closes the gap on Enquiry to the same standard.
--   2. SecurityAuditLog (security events) and TriageAuditLog
--      (visit-request field changes) cover narrow slices. The new
--      AuditLog is a generic, append-only business trail for any
--      domain mutation that doesn't yet have its own tamper-evident
--      log (e.g. enquiry tombstones, route-run status changes,
--      bulk operator actions).
--
-- Both changes are additive and reversible. Existing rows get NULL
-- tombstones; new AuditLog table is empty on day zero.

-- 1. Enquiry soft delete ----------------------------------------------------
ALTER TABLE "Enquiry" ADD COLUMN "deletedAt"   TIMESTAMP(3);
ALTER TABLE "Enquiry" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "Enquiry_deletedAt_idx" ON "Enquiry"("deletedAt");

-- 2. Generic AuditLog -------------------------------------------------------
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "userId"     TEXT,
    "details"    JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
