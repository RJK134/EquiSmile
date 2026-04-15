-- Phase 6: Booking & Confirmations
-- Add reminder tracking and cancellation reason fields to Appointment

ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt24h" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt2h" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" TEXT;
