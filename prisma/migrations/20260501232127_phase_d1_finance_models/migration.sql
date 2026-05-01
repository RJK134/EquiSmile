-- Phase D1 — Finance: Invoice + InvoicePayment + BankImportBatch + BankImportEntry.
-- Additive migration. No existing rows touched.

-- CreateEnum
CREATE TYPE "FinanceInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "BankImportFormat" AS ENUM ('CAMT_054', 'CSV');

-- CreateEnum
CREATE TYPE "BankImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankEntryMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'REVIEW_REQUIRED', 'IGNORED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitOutcomeId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "status" "FinanceInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "qrReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "bankImportEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "format" "BankImportFormat" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BankImportStatus" NOT NULL DEFAULT 'PROCESSING',

    CONSTRAINT "BankImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankImportEntry" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "qrReference" TEXT,
    "description" TEXT,
    "counterparty" TEXT,
    "matchStatus" "BankEntryMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankImportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_visitOutcomeId_key" ON "Invoice"("visitOutcomeId");
CREATE UNIQUE INDEX "Invoice_qrReference_key" ON "Invoice"("qrReference");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_dueAt_idx" ON "Invoice"("dueAt");
CREATE INDEX "Invoice_qrReference_idx" ON "Invoice"("qrReference");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_bankImportEntryId_key" ON "InvoicePayment"("bankImportEntryId");
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");
CREATE INDEX "InvoicePayment_paidAt_idx" ON "InvoicePayment"("paidAt");

-- CreateIndex
CREATE INDEX "BankImportBatch_importedAt_idx" ON "BankImportBatch"("importedAt");
CREATE INDEX "BankImportBatch_status_idx" ON "BankImportBatch"("status");

-- CreateIndex
CREATE INDEX "BankImportEntry_batchId_idx" ON "BankImportEntry"("batchId");
CREATE INDEX "BankImportEntry_qrReference_idx" ON "BankImportEntry"("qrReference");
CREATE INDEX "BankImportEntry_matchStatus_idx" ON "BankImportEntry"("matchStatus");
CREATE INDEX "BankImportEntry_transactionDate_idx" ON "BankImportEntry"("transactionDate");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_visitOutcomeId_fkey" FOREIGN KEY ("visitOutcomeId") REFERENCES "VisitOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_bankImportEntryId_fkey" FOREIGN KEY ("bankImportEntryId") REFERENCES "BankImportEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankImportEntry" ADD CONSTRAINT "BankImportEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BankImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportEntry" ADD CONSTRAINT "BankImportEntry_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
