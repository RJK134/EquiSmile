-- Phase 16 overnight hardening (second slice) — extend the
-- SecurityAuditEvent enum so the new Enquiry DELETE/restore HTTP
-- routes can write tamper-evident security-audit rows alongside the
-- existing CUSTOMER_DELETED / YARD_DELETED / HORSE_DELETED events.
--
-- Additive only. Postgres does not support `ALTER TYPE ... DROP
-- VALUE`, so a code rollback simply leaves these unused enum values
-- in the type with no rows referencing them — harmless.
ALTER TYPE "SecurityAuditEvent" ADD VALUE IF NOT EXISTS 'ENQUIRY_DELETED';
ALTER TYPE "SecurityAuditEvent" ADD VALUE IF NOT EXISTS 'ENQUIRY_RESTORED';
