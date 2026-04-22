-- Phase 15 production-readiness — soft delete tombstones on the
-- customer-facing business entities (Customer, Yard, Horse).
--
-- Why: hard deletes previously cascaded horses, attachments, dental charts,
-- findings, prescriptions, and enquiries. That destroyed clinical history
-- the moment an admin clicked "delete" on a customer. We now mark rows as
-- deleted (`deletedAt`, `deletedById`) and filter them out in repositories;
-- hard delete is reserved for GDPR/FADP erasure requests through a
-- separate operator path.
--
-- Additive / reversible. Existing rows get NULL tombstones (i.e. live).
-- An index on `deletedAt` keeps the default "live rows" query fast.

ALTER TABLE "Customer" ADD COLUMN "deletedAt"   TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

ALTER TABLE "Yard" ADD COLUMN "deletedAt"   TIMESTAMP(3);
ALTER TABLE "Yard" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "Yard_deletedAt_idx" ON "Yard"("deletedAt");

ALTER TABLE "Horse" ADD COLUMN "deletedAt"   TIMESTAMP(3);
ALTER TABLE "Horse" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "Horse_deletedAt_idx" ON "Horse"("deletedAt");
