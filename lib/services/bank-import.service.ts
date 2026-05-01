/**
 * Phase D4 — Bank import: CAMT.054 + CSV parsers with auto-match
 * by QR reference.
 *
 * CAMT.054 is the ISO 20022 notification XML used by Swiss banks
 * to deliver per-transaction confirmations. We extract the entries
 * and any structured creditor reference (QRR/SCOR) so the auto-
 * matcher can find the corresponding Invoice row.
 *
 * CSV is the operator's escape hatch when the bank only offers a
 * spreadsheet export. Expected columns (header row required):
 *   date, amount, currency, reference, description, counterparty
 */

import { Prisma } from '@prisma/client';
import type {
  BankEntryMatchStatus,
  BankImportFormat,
  Invoice,
} from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '@/lib/prisma';
import { invoiceService } from './invoice.service';

export interface ParsedBankEntry {
  transactionDate: Date;
  amount: Prisma.Decimal;
  currency: string;
  qrReference?: string | null;
  description?: string | null;
  counterparty?: string | null;
}

export interface ImportBatchInput {
  filename: string;
  format: BankImportFormat;
  content: string;
  importedById?: string | null;
}

const QR_REFERENCE_PATTERN = /^\d{27}$/;

/**
 * Normalise a free-form reference string to QR-reference form (27
 * digits, no spaces). Returns null if the result wouldn't be a
 * valid QR reference.
 */
export function normaliseQrReference(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/\s+/g, '');
  return QR_REFERENCE_PATTERN.test(stripped) ? stripped : null;
}

// ---------------------------------------------------------------------------
// CSV parser — simple, header-required, comma-separated.
// ---------------------------------------------------------------------------

type CsvHeader = 'date' | 'amount' | 'currency' | 'reference' | 'description' | 'counterparty';

function splitCsvLine(line: string): string[] {
  // Minimal CSV: handles quoted fields with commas and escaped quotes.
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

export function parseCSV(text: string): ParsedBankEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerLine = lines.shift()!;
  const headers = splitCsvLine(headerLine).map((h) => h.toLowerCase());
  const indexOf = (h: CsvHeader) => headers.indexOf(h);

  const dateIdx = indexOf('date');
  const amountIdx = indexOf('amount');
  if (dateIdx < 0 || amountIdx < 0) {
    throw new Error('CSV must include `date` and `amount` columns.');
  }

  const out: ParsedBankEntry[] = [];
  for (const [lineNumber, line] of lines.entries()) {
    const cells = splitCsvLine(line);
    const get = (h: CsvHeader) => {
      const idx = indexOf(h);
      return idx >= 0 ? cells[idx] : undefined;
    };
    const dateStr = cells[dateIdx];
    const amountStr = cells[amountIdx];
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`CSV row ${lineNumber + 2}: invalid date "${dateStr}"`);
    }
    out.push({
      transactionDate: date,
      amount: new Prisma.Decimal(amountStr.replace(/'/g, '')),
      currency: get('currency') || 'CHF',
      qrReference: normaliseQrReference(get('reference')),
      description: get('description') || null,
      counterparty: get('counterparty') || null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CAMT.054 parser — Swiss banks' ISO 20022 notification XML.
// We accept either the full <Document> root or a <Ntfctn> fragment.
// ---------------------------------------------------------------------------

interface CamtEntry {
  Amt?: { '#text'?: string; '@_Ccy'?: string };
  CdtDbtInd?: 'CRDT' | 'DBIT';
  BookgDt?: { Dt?: string; DtTm?: string };
  ValDt?: { Dt?: string; DtTm?: string };
  NtryDtls?: CamtNtryDtls | CamtNtryDtls[];
  AddtlNtryInf?: string;
}

interface CamtNtryDtls {
  TxDtls?: CamtTxDtls | CamtTxDtls[];
}

interface CamtTxDtls {
  RmtInf?: { Strd?: { CdtrRefInf?: { Ref?: string } } };
  RltdPties?: { Dbtr?: { Nm?: string }; Cdtr?: { Nm?: string } };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseCAMT054(xml: string): ParsedBankEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml);

  // Walk down to <Ntry> regardless of whether the caller passed the
  // full <Document> wrapper or just the notification element.
  const document = parsed?.Document ?? parsed;
  const notification = document?.BkToCstmrDbtCdtNtfctn ?? document;
  const ntfctn = notification?.Ntfctn ?? notification;
  const entries = asArray<CamtEntry>(ntfctn?.Ntry);

  const out: ParsedBankEntry[] = [];
  for (const ntry of entries) {
    const dateStr =
      ntry.BookgDt?.Dt ??
      ntry.BookgDt?.DtTm ??
      ntry.ValDt?.Dt ??
      ntry.ValDt?.DtTm;
    if (!dateStr) continue;

    const amountText = ntry.Amt?.['#text'];
    if (!amountText) continue;
    const sign = ntry.CdtDbtInd === 'DBIT' ? -1 : 1;
    const amount = new Prisma.Decimal(amountText).times(sign);

    // Pull the QR-reference out of the first transaction detail.
    const txDtls = asArray<CamtTxDtls>(asArray(ntry.NtryDtls)[0]?.TxDtls);
    const ref = txDtls[0]?.RmtInf?.Strd?.CdtrRefInf?.Ref;
    const counterparty =
      txDtls[0]?.RltdPties?.Dbtr?.Nm ?? txDtls[0]?.RltdPties?.Cdtr?.Nm ?? null;

    out.push({
      transactionDate: new Date(dateStr),
      amount,
      currency: ntry.Amt?.['@_Ccy'] ?? 'CHF',
      qrReference: normaliseQrReference(ref ?? null),
      description: ntry.AddtlNtryInf ?? null,
      counterparty,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Import + auto-match
// ---------------------------------------------------------------------------

export const bankImportService = {
  parseCSV,
  parseCAMT054,
  normaliseQrReference,

  /**
   * Persist a batch + entries and run the auto-matcher. Returns the
   * batch with up-to-date counts.
   */
  async importBatch(input: ImportBatchInput) {
    const entries =
      input.format === 'CAMT_054'
        ? parseCAMT054(input.content)
        : parseCSV(input.content);

    const batch = await prisma.bankImportBatch.create({
      data: {
        filename: input.filename,
        format: input.format,
        importedById: input.importedById ?? null,
        entryCount: entries.length,
        totalAmount: entries.reduce(
          (acc, e) => acc.plus(e.amount),
          new Prisma.Decimal(0),
        ),
        status: 'PROCESSING',
        entries: {
          create: entries.map((e) => ({
            transactionDate: e.transactionDate,
            amount: e.amount,
            currency: e.currency,
            qrReference: e.qrReference ?? null,
            description: e.description ?? null,
            counterparty: e.counterparty ?? null,
            matchStatus: 'UNMATCHED' as BankEntryMatchStatus,
          })),
        },
      },
      include: { entries: true },
    });

    const matched = await this.autoMatch(batch.id);

    return prisma.bankImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        matchedCount: matched,
      },
      include: { entries: true },
    });
  },

  /**
   * For every UNMATCHED entry in a batch, look up an Invoice row by
   * exact qrReference. Matched entries are flipped to MATCHED, the
   * Invoice's payment is recorded via invoiceService.addPayment, and
   * the entry's matchedInvoiceId is populated.
   *
   * Returns the count of newly matched entries.
   */
  async autoMatch(batchId: string): Promise<number> {
    const entries = await prisma.bankImportEntry.findMany({
      where: { batchId, matchStatus: 'UNMATCHED' },
    });

    let matched = 0;
    for (const entry of entries) {
      if (!entry.qrReference) continue;
      const invoice: Invoice | null = await prisma.invoice.findUnique({
        where: { qrReference: entry.qrReference },
      });
      if (!invoice) continue;

      // Record a payment + recompute invoice status (PARTIAL/PAID).
      // Negative amounts (refunds) are skipped — the operator should
      // process those manually.
      if (entry.amount.lessThanOrEqualTo(0)) continue;

      const { payment } = await invoiceService.addPayment(invoice.id, {
        amount: entry.amount,
        paidAt: entry.transactionDate,
        method: 'BANK_TRANSFER',
        reference: entry.qrReference,
        bankImportEntryId: entry.id,
      });

      await prisma.bankImportEntry.update({
        where: { id: entry.id },
        data: {
          matchStatus: 'MATCHED',
          matchedInvoiceId: invoice.id,
        },
      });

      // payment is unused beyond the side-effect; reference it to
      // satisfy strict no-unused-vars while keeping the binding name
      // in case a future caller wants the receipt.
      void payment;
      matched++;
    }

    return matched;
  },
};
