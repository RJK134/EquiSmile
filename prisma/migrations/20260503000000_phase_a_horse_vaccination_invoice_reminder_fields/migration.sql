-- Phase A (May 2026 client user-story triage) — additive nullable columns
-- for the reminders trio (G-3a / G-3b / G-3c).
--
-- - Horse.vaccinationDueDate powers the new annual vaccination reminder
--   dispatch (G-3b). Field-only in this migration; cron path is wired in
--   reminder.service.ts in the same commit.
-- - Invoice.lastReminderSentAt debounces the new overdue-invoice
--   WhatsApp reminder dispatch (G-3c). Reminder service skips invoices
--   touched within the debounce window (default 14d) to avoid pestering
--   customers on every cron tick.
--
-- Both columns are nullable with no default — fully reversible by a
-- subsequent DROP COLUMN if the feature is rolled back.

ALTER TABLE "Horse" ADD COLUMN "vaccinationDueDate" TIMESTAMP(3);

ALTER TABLE "Invoice" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3);
