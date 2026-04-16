-- AlterTable: Add missing updatedAt column to Enquiry
ALTER TABLE "Enquiry" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
