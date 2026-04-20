-- Phase 14 PR D — AMBER gap closure.
-- Covers AMBER-06 (Yard geocoding metadata), AMBER-10 (ConfirmationDispatch),
-- AMBER-11 (AppointmentResponse), AMBER-13 (AppointmentStatusHistory),
-- AMBER-15 (FailedOperation dead-letter queue). Additive only.

-- AMBER-06
ALTER TABLE "Yard" ADD COLUMN "geocodeSource"    TEXT;
ALTER TABLE "Yard" ADD COLUMN "geocodePrecision" TEXT;
ALTER TABLE "Yard" ADD COLUMN "formattedAddress" TEXT;

-- AMBER-10
CREATE TABLE "ConfirmationDispatch" (
    "id"                TEXT                  NOT NULL,
    "appointmentId"     TEXT                  NOT NULL,
    "channel"           "ConfirmationChannel" NOT NULL,
    "sentAt"            TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success"           BOOLEAN               NOT NULL DEFAULT true,
    "externalMessageId" TEXT,
    "errorMessage"      TEXT,

    CONSTRAINT "ConfirmationDispatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConfirmationDispatch_appointmentId_idx" ON "ConfirmationDispatch"("appointmentId");
CREATE INDEX "ConfirmationDispatch_sentAt_idx"        ON "ConfirmationDispatch"("sentAt");
ALTER TABLE "ConfirmationDispatch"
  ADD CONSTRAINT "ConfirmationDispatch_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AMBER-11
CREATE TYPE "AppointmentResponseKind" AS ENUM (
  'CONFIRMED',
  'CANCELLED',
  'RESCHEDULE_REQUESTED',
  'OTHER'
);

CREATE TABLE "AppointmentResponse" (
    "id"               TEXT                      NOT NULL,
    "appointmentId"    TEXT                      NOT NULL,
    "kind"             "AppointmentResponseKind" NOT NULL DEFAULT 'OTHER',
    "channel"          "ConfirmationChannel"     NOT NULL,
    "receivedAt"       TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText"          TEXT,
    "enquiryMessageId" TEXT,

    CONSTRAINT "AppointmentResponse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppointmentResponse_appointmentId_idx" ON "AppointmentResponse"("appointmentId");
CREATE INDEX "AppointmentResponse_kind_idx"          ON "AppointmentResponse"("kind");
CREATE INDEX "AppointmentResponse_receivedAt_idx"    ON "AppointmentResponse"("receivedAt");
ALTER TABLE "AppointmentResponse"
  ADD CONSTRAINT "AppointmentResponse_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AMBER-13
CREATE TABLE "AppointmentStatusHistory" (
    "id"            TEXT                NOT NULL,
    "appointmentId" TEXT                NOT NULL,
    "fromStatus"    "AppointmentStatus",
    "toStatus"      "AppointmentStatus" NOT NULL,
    "changedBy"     TEXT                NOT NULL,
    "reason"        TEXT,
    "changedAt"     TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppointmentStatusHistory_appointmentId_idx" ON "AppointmentStatusHistory"("appointmentId");
CREATE INDEX "AppointmentStatusHistory_changedAt_idx"     ON "AppointmentStatusHistory"("changedAt");
ALTER TABLE "AppointmentStatusHistory"
  ADD CONSTRAINT "AppointmentStatusHistory_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AMBER-15
CREATE TYPE "FailedOperationStatus" AS ENUM ('PENDING', 'REPLAYED', 'ABANDONED');

CREATE TABLE "FailedOperation" (
    "id"           TEXT                    NOT NULL,
    "scope"        TEXT                    NOT NULL,
    "operationKey" TEXT,
    "payload"      TEXT                    NOT NULL,
    "lastError"    TEXT                    NOT NULL,
    "attempts"     INTEGER                 NOT NULL DEFAULT 0,
    "status"       "FailedOperationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"    TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)            NOT NULL,

    CONSTRAINT "FailedOperation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FailedOperation_scope_idx"     ON "FailedOperation"("scope");
CREATE INDEX "FailedOperation_status_idx"    ON "FailedOperation"("status");
CREATE INDEX "FailedOperation_createdAt_idx" ON "FailedOperation"("createdAt");
