-- Phase 10: Staff model + per-appointment/per-route assignments.
-- Additive-only: no existing tables modified.

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('VET', 'ADMIN', 'NURSE');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "StaffRole" NOT NULL DEFAULT 'VET',
    "colour" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX "Staff_role_idx" ON "Staff"("role");
CREATE INDEX "Staff_active_idx" ON "Staff"("active");

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AppointmentAssignment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentAssignment_appointmentId_staffId_key" ON "AppointmentAssignment"("appointmentId", "staffId");
CREATE INDEX "AppointmentAssignment_staffId_idx" ON "AppointmentAssignment"("staffId");
CREATE INDEX "AppointmentAssignment_appointmentId_idx" ON "AppointmentAssignment"("appointmentId");

ALTER TABLE "AppointmentAssignment" ADD CONSTRAINT "AppointmentAssignment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentAssignment" ADD CONSTRAINT "AppointmentAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RouteRunAssistant" (
    "id" TEXT NOT NULL,
    "routeRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteRunAssistant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RouteRunAssistant_routeRunId_staffId_key" ON "RouteRunAssistant"("routeRunId", "staffId");
CREATE INDEX "RouteRunAssistant_staffId_idx" ON "RouteRunAssistant"("staffId");

ALTER TABLE "RouteRunAssistant" ADD CONSTRAINT "RouteRunAssistant_routeRunId_fkey" FOREIGN KEY ("routeRunId") REFERENCES "RouteRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteRunAssistant" ADD CONSTRAINT "RouteRunAssistant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable — add leadStaffId to RouteRun (nullable, no data migration needed)
ALTER TABLE "RouteRun" ADD COLUMN "leadStaffId" TEXT;
CREATE INDEX "RouteRun_leadStaffId_idx" ON "RouteRun"("leadStaffId");
ALTER TABLE "RouteRun" ADD CONSTRAINT "RouteRun_leadStaffId_fkey" FOREIGN KEY ("leadStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
