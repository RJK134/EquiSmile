import type { Customer, Prisma } from '@prisma/client';

/**
 * Resolve the customer a webhook handler should attach an inbound
 * message to, inside the caller's Prisma transaction.
 *
 * Why a shared helper:
 *   - The email and WhatsApp webhooks need identical customer
 *     resolution semantics (find-or-create, restore if tombstoned,
 *     cascade the un-tombstone to yards/horses). Duplicating the
 *     logic across both handlers is how two copies silently diverge.
 *
 * Why `upsert` not `findUnique + create + catch P2002`:
 *   - Prisma interactive transactions ride a single Postgres
 *     transaction with no automatic per-statement savepoints. A P2002
 *     (unique constraint) from `create` aborts the whole transaction,
 *     so any follow-up `findUnique` to "join the parallel row" itself
 *     fails with "current transaction is aborted". The race path is
 *     therefore structurally unrecoverable in-line.
 *   - `upsert`'s no-op `update: {}` branch is SQL-level race-safe —
 *     Postgres handles the ON CONFLICT at the row level, and the
 *     transaction stays valid. No P2002 ever surfaces.
 *
 * Why we still do a `findUnique` first:
 *   - We need to know whether the caller's inbound message is from an
 *     already-tombstoned row (restore path) and whether the customer
 *     is genuinely new (log line). The upsert alone can't distinguish
 *     "I just created this" from "joined the parallel row" cleanly
 *     enough for that.
 */

type TxClient = Prisma.TransactionClient;

export interface InboundCustomerBase {
  fullName: string;
  preferredChannel: 'WHATSAPP' | 'EMAIL' | 'PHONE';
  preferredLanguage: string;
  email?: string | null;
  mobilePhone?: string | null;
}

export interface InboundCustomerLookup {
  /** The uniquely-indexed field we look up by. */
  by: 'email' | 'mobilePhone';
  value: string;
}

export interface ResolveInboundCustomerResult {
  customer: Customer;
  isNewCustomer: boolean;
  wasRestored: boolean;
}

export async function resolveInboundCustomer(
  tx: TxClient,
  args: {
    lookup: InboundCustomerLookup;
    create: InboundCustomerBase;
  },
): Promise<ResolveInboundCustomerResult> {
  const { lookup, create } = args;
  const where =
    lookup.by === 'email'
      ? { email: lookup.value }
      : { mobilePhone: lookup.value };

  let customer = await tx.customer.findUnique({ where });
  let isNewCustomer = false;

  if (!customer) {
    // Race-safe create. If another transaction created the row
    // between our findUnique above and this upsert, Postgres returns
    // the existing row via the `update: {}` (no-op) branch without
    // throwing. No P2002 can surface here.
    //
    // `createdAt` is set ONLY on INSERT (Prisma `@default(now())`),
    // so we can distinguish "we inserted" from "parallel transaction
    // beat us to it and we joined their row" by snapshotting a
    // timestamp before the upsert and checking whether the returned
    // row's createdAt is strictly after it. This stops the webhook
    // logging a misleading "Created new customer" for a row we
    // didn't actually create.
    const preUpsertAt = new Date();
    customer = await tx.customer.upsert({
      where,
      create,
      update: {},
    });
    isNewCustomer = customer.createdAt.getTime() >= preUpsertAt.getTime();
  }

  let wasRestored = false;
  if (customer.deletedAt) {
    // Phase 15 — inbound message from a tombstoned customer is strong
    // signal of live relationship. Restore inline WITH CASCADE so
    // yards/horses come back symmetrically. Children are matched by
    // the parent's own `deletedAt` so rows independently soft-deleted
    // at another moment stay tombstoned.
    const parentDeletedAt = customer.deletedAt;
    customer = await tx.customer.update({
      where: { id: customer.id },
      data: { deletedAt: null, deletedById: null },
    });
    await tx.yard.updateMany({
      where: { customerId: customer.id, deletedAt: parentDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
    await tx.horse.updateMany({
      where: { customerId: customer.id, deletedAt: parentDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
    wasRestored = true;
  }

  return { customer, isNewCustomer, wasRestored };
}
