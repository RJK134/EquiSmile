-- AlterTable
ALTER TABLE "Enquiry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "SecurityAuditLog_target_idx" RENAME TO "SecurityAuditLog_targetType_targetId_idx";
