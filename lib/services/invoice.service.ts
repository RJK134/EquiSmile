/**
 * Phase D2 — Invoice service.
 *
 * Owns invoice lifecycle: issue, list, query by status, and the
 * single source of truth for status recomputation based on payments
 * + the dueAt timestamp.
 *
 * Status state machine (FinanceInvoiceStatus):
 *   DRAFT      — operator-only, before issuing.
 *   OPEN       — issued, no payments yet.
 *   PARTIAL    — issued, sum(payments) < total.
 *   PAID       — issued, sum(payments) >= total.
 *   OVERDUE    — issued, past dueAt, sum(payments) < total.
 *   CANCELLED  — operator-set, never auto-recomputed.
 *
 * recomputeStatus() is called automatically by addPayment() and
 * cancel(); operators can also call it manually if dueAt was edited.
 */

import { Prisma } from '@prisma/client';
import type {
  FinanceInvoiceStatus,
  Invoice,
  InvoicePayment,
  PaymentMethod,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface IssueInvoiceInput {
  customerId: string;
  visitOutcomeId?: string | null;
  invoiceNumber: string;
  dueAt: Date;
  subtotal: number | string;
  taxAmount?: number | string;
  total: number | string;
  currency?: string;
  qrReference?: string | null;
  notes?: string | null;
  /**
   * If true, leaves the invoice in DRAFT. Default `false` issues
   * straight to OPEN for the typical "I just rendered the visit
   * outcome and want to bill it now" path.
   */
  asDraft?: boolean;
}

export interface AddPaymentInput {
  amount: number | string | Prisma.Decimal;
  paidAt: Date;
  method?: PaymentMethod;
  reference?: string | null;
  bankImportEntryId?: string | null;
  notes?: string | null;
}

export interface ListInvoicesQuery {
  status?: FinanceInvoiceStatus | FinanceInvoiceStatus[];
  customerId?: string;
  fromDueAt?: Date;
  toDueAt?: Date;
  limit?: number;
  offset?: number;
}

const DECIMAL_ZERO = new Prisma.Decimal(0);

/**
 * Pure function — given the persisted invoice fields plus the
 * sum of payments and "now", return the status that the database
 * row should hold. Carved out so unit tests can drive the matrix
 * without hitting Prisma.
 */
export function computeStatus(args: {
  current: FinanceInvoiceStatus;
  total: Prisma.Decimal;
  paidSum: Prisma.Decimal;
  dueAt: Date;
  now?: Date;
}): FinanceInvoiceStatus {
  const { current, total, paidSum, dueAt } = args;
  const now = args.now ?? new Date();

  // Operator-only states never get auto-overridden.
  if (current === 'CANCELLED' || current === 'DRAFT') return current;

  if (paidSum.greaterThanOrEqualTo(total)) return 'PAID';
  if (paidSum.greaterThan(DECIMAL_ZERO)) return 'PARTIAL';
  if (now.getTime() > dueAt.getTime()) return 'OVERDUE';
  return 'OPEN';
}

// Helper accepts whichever client (root prisma or transaction `tx`)
// the caller passes. The extended root client's `tx` type doesn't
// match `Prisma.TransactionClient` once a $extends is in place, so
// we keep the type loose and rely on the called methods being
// available on both shapes.
type AnyPrismaClient = {
  invoicePayment: {
    aggregate: (args: {
      where: { invoiceId: string };
      _sum: { amount: true };
    }) => Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  };
};

async function readPaymentSum(
  client: AnyPrismaClient,
  invoiceId: string,
): Promise<Prisma.Decimal> {
  const aggregate = await client.invoicePayment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? DECIMAL_ZERO;
}

export const invoiceService = {
  /**
   * Issue (or draft) a new invoice. Returns the persisted row.
   * Subtotal/total are accepted as numbers or strings to keep
   * caller ergonomics simple — Prisma's Decimal handles the
   * rounding to 2dp.
   */
  async issue(input: IssueInvoiceInput): Promise<Invoice> {
    const status: FinanceInvoiceStatus = input.asDraft ? 'DRAFT' : 'OPEN';
    return prisma.invoice.create({
      data: {
        invoiceNumber: input.invoiceNumber,
        customerId: input.customerId,
        visitOutcomeId: input.visitOutcomeId ?? null,
        dueAt: input.dueAt,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount ?? 0),
        total: new Prisma.Decimal(input.total),
        currency: input.currency ?? 'CHF',
        qrReference: input.qrReference ?? null,
        notes: input.notes ?? null,
        status,
      },
    });
  },

  /**
   * Recompute the status of one invoice from its payments + dueAt.
   * Used internally by `addPayment` and externally by ops scripts
   * that edit `dueAt` or sweep for overdue invoices.
   */
  async recomputeStatus(invoiceId: string, now: Date = new Date()): Promise<Invoice> {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      const paidSum = await readPaymentSum(tx, invoiceId);
      const next = computeStatus({
        current: invoice.status,
        total: invoice.total,
        paidSum,
        dueAt: invoice.dueAt,
        now,
      });
      if (next === invoice.status) return invoice;
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status: next },
      });
    });
  },

  /**
   * Record a payment against an invoice. Recomputes status atomically.
   */
  async addPayment(
    invoiceId: string,
    payment: AddPaymentInput,
  ): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: new Prisma.Decimal(payment.amount),
          paidAt: payment.paidAt,
          method: payment.method ?? 'BANK_TRANSFER',
          reference: payment.reference ?? null,
          bankImportEntryId: payment.bankImportEntryId ?? null,
          notes: payment.notes ?? null,
        },
      });

      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      const paidSum = await readPaymentSum(tx, invoiceId);
      const next = computeStatus({
        current: invoice.status,
        total: invoice.total,
        paidSum,
        dueAt: invoice.dueAt,
      });
      const updated =
        next === invoice.status
          ? invoice
          : await tx.invoice.update({
              where: { id: invoiceId },
              data: { status: next },
            });
      return { invoice: updated, payment: created };
    });
  },

  /**
   * Cancel an invoice. Soft-cancellation by status change; payments
   * survive so the audit trail remains intact.
   */
  async cancel(invoiceId: string): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });
  },

  async list(query: ListInvoicesQuery = {}) {
    const { status, customerId, fromDueAt, toDueAt, limit = 50, offset = 0 } = query;

    const where: Prisma.InvoiceWhereInput = {};
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }
    if (customerId) where.customerId = customerId;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { data, total, limit, offset };
  },

  /**
   * Bulk sweep: re-evaluate every OPEN/PARTIAL invoice past dueAt and
   * flip to OVERDUE. Idempotent — safe to run on a cron.
   */
  async sweepOverdue(now: Date = new Date()): Promise<number> {
    const candidates = await prisma.invoice.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] },
        dueAt: { lt: now },
      },
      select: { id: true },
    });
    let touched = 0;
    for (const { id } of candidates) {
      const before = await prisma.invoice.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      const after = await this.recomputeStatus(id, now);
      if (after.status !== before.status) touched++;
    }
    return touched;
  },
};
