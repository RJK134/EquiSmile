-- Phase 14 PR B: security audit log.

CREATE TYPE "SecurityAuditEvent" AS ENUM (
  'SIGN_IN_DENIED',
  'ROLE_CHANGED',
  'EXPORT_DATASET',
  'ATTACHMENT_DELETED',
  'ATTACHMENT_DOWNLOADED',
  'CLINICAL_RECORD_CREATED',
  'CLINICAL_RECORD_UPDATED',
  'CLINICAL_RECORD_DELETED',
  'PRESCRIPTION_STATUS_CHANGED',
  'VISION_ANALYSIS_INVOKED',
  'STAFF_CREATED',
  'STAFF_UPDATED',
  'STAFF_DEACTIVATED',
  'CUSTOMER_DELETED',
  'YARD_DELETED',
  'HORSE_DELETED',
  'OTHER'
);

CREATE TABLE "SecurityAuditLog" (
    "id"         TEXT                 NOT NULL,
    "event"      "SecurityAuditEvent" NOT NULL,
    "actor"      TEXT                 NOT NULL,
    "actorRole"  TEXT,
    "targetType" TEXT,
    "targetId"   TEXT,
    "detail"     TEXT,
    "createdAt"  TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityAuditLog_event_idx"       ON "SecurityAuditLog"("event");
CREATE INDEX "SecurityAuditLog_actor_idx"       ON "SecurityAuditLog"("actor");
CREATE INDEX "SecurityAuditLog_createdAt_idx"   ON "SecurityAuditLog"("createdAt");
CREATE INDEX "SecurityAuditLog_target_idx"      ON "SecurityAuditLog"("targetType", "targetId");
