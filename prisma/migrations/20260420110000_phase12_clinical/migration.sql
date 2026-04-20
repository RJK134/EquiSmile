-- Phase 12: Clinical records (attachments, dental charts, findings, prescriptions).
-- Additive-only: no existing tables modified beyond FK back-relations.

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('DENTAL_CHART_PDF', 'DENTAL_IMAGE', 'XRAY_IMAGE', 'OTHER_IMAGE', 'OTHER');
CREATE TYPE "FindingCategory" AS ENUM ('HOOK', 'WAVE', 'RAMP', 'DIASTEMA', 'EOTRH', 'FRACTURE', 'CARIES', 'WEAR', 'MISSING', 'OTHER');
CREATE TYPE "FindingSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- HorseAttachment
CREATE TABLE "HorseAttachment" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'OTHER',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HorseAttachment_horseId_idx" ON "HorseAttachment"("horseId");
CREATE INDEX "HorseAttachment_kind_idx" ON "HorseAttachment"("kind");
CREATE INDEX "HorseAttachment_uploadedAt_idx" ON "HorseAttachment"("uploadedAt");
ALTER TABLE "HorseAttachment" ADD CONSTRAINT "HorseAttachment_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HorseAttachment" ADD CONSTRAINT "HorseAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DentalChart
CREATE TABLE "DentalChart" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generalNotes" TEXT,
    "attachmentId" TEXT,

    CONSTRAINT "DentalChart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DentalChart_attachmentId_key" ON "DentalChart"("attachmentId");
CREATE INDEX "DentalChart_horseId_idx" ON "DentalChart"("horseId");
CREATE INDEX "DentalChart_recordedAt_idx" ON "DentalChart"("recordedAt");
ALTER TABLE "DentalChart" ADD CONSTRAINT "DentalChart_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DentalChart" ADD CONSTRAINT "DentalChart_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DentalChart" ADD CONSTRAINT "DentalChart_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "HorseAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ClinicalFinding
CREATE TABLE "ClinicalFinding" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "dentalChartId" TEXT,
    "findingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toothId" TEXT,
    "category" "FindingCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MILD',
    "description" TEXT NOT NULL,
    "attachmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClinicalFinding_horseId_idx" ON "ClinicalFinding"("horseId");
CREATE INDEX "ClinicalFinding_dentalChartId_idx" ON "ClinicalFinding"("dentalChartId");
CREATE INDEX "ClinicalFinding_category_idx" ON "ClinicalFinding"("category");
CREATE INDEX "ClinicalFinding_findingDate_idx" ON "ClinicalFinding"("findingDate");
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_dentalChartId_fkey" FOREIGN KEY ("dentalChartId") REFERENCES "DentalChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "HorseAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prescription
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "visitRequestId" TEXT,
    "appointmentId" TEXT,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prescribedById" TEXT,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "durationDays" INTEGER,
    "withdrawalPeriodDays" INTEGER,
    "instructions" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Prescription_horseId_idx" ON "Prescription"("horseId");
CREATE INDEX "Prescription_status_idx" ON "Prescription"("status");
CREATE INDEX "Prescription_prescribedAt_idx" ON "Prescription"("prescribedAt");
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_prescribedById_fkey" FOREIGN KEY ("prescribedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
