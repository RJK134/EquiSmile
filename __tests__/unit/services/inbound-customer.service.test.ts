import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveInboundCustomer } from '@/lib/services/inbound-customer.service';

// `resolveInboundCustomer` takes the caller's `tx` object, so the test
// passes a hand-rolled tx surface rather than mocking `@/lib/prisma`.
function createTx() {
  return {
    customer: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    yard: { updateMany: vi.fn() },
    horse: { updateMany: vi.fn() },
  };
}

describe('resolveInboundCustomer', () => {
  let tx: ReturnType<typeof createTx>;

  beforeEach(() => {
    tx = createTx();
  });

  it('returns the existing live customer and does NOT upsert', async () => {
    const existing = {
      id: 'c1',
      email: 'a@b.com',
      mobilePhone: null,
      deletedAt: null,
    };
    tx.customer.findUnique.mockResolvedValue(existing);

    const result = await resolveInboundCustomer(tx as never, {
      lookup: { by: 'email', value: 'a@b.com' },
      create: {
        fullName: 'A',
        email: 'a@b.com',
        preferredChannel: 'EMAIL',
        preferredLanguage: 'en',
      },
    });

    expect(result).toEqual({
      customer: existing,
      isNewCustomer: false,
      wasRestored: false,
    });
    expect(tx.customer.upsert).not.toHaveBeenCalled();
  });

  it('uses upsert (not create + catch P2002) when the customer is absent', async () => {
    tx.customer.findUnique.mockResolvedValue(null);
    const created = {
      id: 'c2',
      email: 'x@y.com',
      mobilePhone: null,
      deletedAt: null,
      // createdAt well into the future so the isNewCustomer check
      // treats this as a fresh insert.
      createdAt: new Date(Date.now() + 60_000),
    };
    tx.customer.upsert.mockResolvedValue(created);

    const result = await resolveInboundCustomer(tx as never, {
      lookup: { by: 'email', value: 'x@y.com' },
      create: {
        fullName: 'X',
        email: 'x@y.com',
        preferredChannel: 'EMAIL',
        preferredLanguage: 'en',
      },
    });

    expect(result.customer).toEqual(created);
    expect(result.isNewCustomer).toBe(true);

    const upsertArg = tx.customer.upsert.mock.calls[0][0];
    // `update: {}` is the race-safe no-op branch — Postgres returns
    // the existing row if a parallel transaction beat us to it.
    expect(upsertArg.update).toEqual({});
    expect(upsertArg.where).toEqual({ email: 'x@y.com' });
  });

  it('marks isNewCustomer=false when upsert no-ops on a pre-existing row', async () => {
    // findUnique returned null (so the caller enters the upsert
    // branch), but by the time upsert ran in Postgres a parallel
    // transaction had already committed the insert. The row we get
    // back has a createdAt from BEFORE our call — we didn't create
    // it, so the log line must not lie.
    tx.customer.findUnique.mockResolvedValue(null);
    const preExistingCreatedAt = new Date(Date.now() - 60_000);
    tx.customer.upsert.mockResolvedValue({
      id: 'c-race',
      email: 'r@y.com',
      mobilePhone: null,
      deletedAt: null,
      createdAt: preExistingCreatedAt,
    });

    const result = await resolveInboundCustomer(tx as never, {
      lookup: { by: 'email', value: 'r@y.com' },
      create: {
        fullName: 'R',
        email: 'r@y.com',
        preferredChannel: 'EMAIL',
        preferredLanguage: 'en',
      },
    });

    expect(result.isNewCustomer).toBe(false);
  });

  it('restores a tombstoned customer inline with cascade by deletedAt', async () => {
    const parentDeletedAt = new Date('2026-04-22T12:00:00.000Z');
    const tombstoned = {
      id: 'c3',
      email: 'ghost@x.com',
      mobilePhone: null,
      deletedAt: parentDeletedAt,
    };
    tx.customer.findUnique.mockResolvedValue(tombstoned);
    tx.customer.update.mockResolvedValue({ ...tombstoned, deletedAt: null });

    const result = await resolveInboundCustomer(tx as never, {
      lookup: { by: 'email', value: 'ghost@x.com' },
      create: {
        fullName: 'Ghost',
        email: 'ghost@x.com',
        preferredChannel: 'EMAIL',
        preferredLanguage: 'en',
      },
    });

    expect(result.wasRestored).toBe(true);
    expect(result.isNewCustomer).toBe(false);

    // Cascade un-tombstone only for children whose deletedAt matches
    // the parent's — rows independently soft-deleted at a different
    // moment must stay tombstoned.
    expect(tx.yard.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'c3', deletedAt: parentDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
    expect(tx.horse.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'c3', deletedAt: parentDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
  });
});
