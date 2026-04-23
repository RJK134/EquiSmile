import { randomUUID } from 'node:crypto';

import type { Customer, Prisma } from '@prisma/client';

import { customerRepository } from '@/lib/repositories/customer.repository';

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
    // Distinguishing "we inserted" from "parallel tx beat us to it":
    // we pre-generate the row's UUID on the client and pass it into
    // the create payload. The INSERT path persists OUR id; the
    // update-branch path returns the parallel transaction's existing
    // id. Comparing them afterwards is exact and doesn't depend on
    // app-vs-Postgres clock alignment (which a createdAt-timestamp
    // check did).
    const candidateId = randomUUID();
    customer = await tx.customer.upsert({
      where,
      create: { ...create, id: candidateId },
      update: {},
    });
    isNewCustomer = customer.id === candidateId;
  }

  let wasRestored = false;
  if (customer.deletedAt) {
    // Phase 15 — inbound message from a tombstoned customer is strong
    // signal of live relationship. Restore inline WITH CASCADE so
    // yards/horses come back symmetrically. Children are matched by
    // the parent's own `deletedAt` so rows independently soft-deleted
    // at another moment stay tombstoned.
    //
    // Delegates to the repository's shared cascade helper so this
    // path and the admin-initiated `customerRepository.restore` can
    // never drift in their cascade semantics.
    customer = await customerRepository.cascadeRestoreWithin(
      tx,
      customer.id,
      customer.deletedAt,
    );
    wasRestored = true;
  }

  return { customer, isNewCustomer, wasRestored };
}
