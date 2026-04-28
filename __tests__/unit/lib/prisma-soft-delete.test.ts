import { describe, expect, it } from 'vitest';

import {
  SOFT_DELETE_MODELS,
  injectSoftDeleteFilter,
  shouldFilterSoftDelete,
} from '@/lib/prisma';

/**
 * Phase 16 — Prisma soft-delete extension.
 *
 * The extension itself (`buildSoftDeleteExtension`) wraps a real
 * PrismaClient. Spinning up Prisma in unit tests requires a live
 * Postgres, which we avoid here. Instead, we test the *helpers* the
 * extension dispatches to (`shouldFilterSoftDelete`, `injectSoftDeleteFilter`)
 * directly. They are pure functions; verifying them locks in the
 * exact semantics every `query` callback runs.
 *
 * The repository-level integration is covered by the existing
 * `__tests__/unit/repositories/*.test.ts` suites — they assert the
 * `deletedAt` key is always present in the where clause, which is
 * the contract this extension relies on.
 */

describe('shouldFilterSoftDelete', () => {
  it('matches the four PII-bearing soft-delete models', () => {
    expect(shouldFilterSoftDelete('Customer')).toBe(true);
    expect(shouldFilterSoftDelete('Yard')).toBe(true);
    expect(shouldFilterSoftDelete('Horse')).toBe(true);
    expect(shouldFilterSoftDelete('Enquiry')).toBe(true);
  });

  it('is case-insensitive (Prisma model names sometimes arrive lowercase)', () => {
    expect(shouldFilterSoftDelete('customer')).toBe(true);
    expect(shouldFilterSoftDelete('YARD')).toBe(true);
  });

  it('returns false for any non-soft-delete model', () => {
    expect(shouldFilterSoftDelete('Appointment')).toBe(false);
    expect(shouldFilterSoftDelete('VisitRequest')).toBe(false);
    expect(shouldFilterSoftDelete('SecurityAuditLog')).toBe(false);
    expect(shouldFilterSoftDelete('User')).toBe(false);
    expect(shouldFilterSoftDelete('AuditLog')).toBe(false);
  });

  it('returns false for undefined / empty string', () => {
    expect(shouldFilterSoftDelete(undefined)).toBe(false);
    expect(shouldFilterSoftDelete('')).toBe(false);
  });

  it('SOFT_DELETE_MODELS is exported as a closed set so adding new models is a one-line change', () => {
    expect(SOFT_DELETE_MODELS).toBeInstanceOf(Set);
    expect(SOFT_DELETE_MODELS.size).toBe(4);
  });
});

describe('injectSoftDeleteFilter', () => {
  it('auto-injects deletedAt: null when the where clause is missing entirely', () => {
    const args: { where?: Record<string, unknown> } = {};
    injectSoftDeleteFilter(args);
    expect(args.where).toEqual({ deletedAt: null });
  });

  it('auto-injects deletedAt: null when the where clause is present but lacks deletedAt', () => {
    const args = { where: { fullName: 'Sarah Jones' } as Record<string, unknown> };
    injectSoftDeleteFilter(args);
    expect(args.where).toEqual({ fullName: 'Sarah Jones', deletedAt: null });
  });

  it('does NOT auto-inject when the caller already set deletedAt: null', () => {
    const args = { where: { deletedAt: null } as Record<string, unknown> };
    injectSoftDeleteFilter(args);
    expect(args.where).toEqual({ deletedAt: null });
  });

  it('does NOT auto-inject when the caller passed deletedAt: undefined (the explicit opt-out)', () => {
    // This is the contract repositories rely on: when `includeDeleted`
    // is true they set `deletedAt: undefined`. The key is present so
    // the extension skips its auto-inject; Prisma's own treatment of
    // `undefined` means "no filter on this field". A regression here
    // would silently re-apply the live-only filter on /admin pages
    // that legitimately want to see tombstoned rows.
    const args = { where: { deletedAt: undefined } as Record<string, unknown> };
    injectSoftDeleteFilter(args);
    expect(Object.prototype.hasOwnProperty.call(args.where, 'deletedAt')).toBe(true);
    expect(args.where!.deletedAt).toBeUndefined();
  });

  it('preserves an explicit non-null deletedAt filter (e.g. tombstoned-only queries)', () => {
    const dateFilter = { not: null };
    const args = { where: { deletedAt: dateFilter } as Record<string, unknown> };
    injectSoftDeleteFilter(args);
    expect(args.where!.deletedAt).toBe(dateFilter);
  });

  it('mutates args.where in place (Prisma extension contract — caller forwards same args)', () => {
    const args: { where?: Record<string, unknown> } = {};
    const returned = injectSoftDeleteFilter(args);
    // Function returns void; the mutation IS the contract.
    expect(returned).toBeUndefined();
    expect(args.where).toBeDefined();
  });

  it('does not clobber other filters when injecting', () => {
    const args = {
      where: {
        fullName: 'Sarah',
        preferredChannel: 'EMAIL',
        OR: [{ email: 'a@b' }, { mobilePhone: '+447' }],
      } as Record<string, unknown>,
    };
    injectSoftDeleteFilter(args);
    expect(args.where).toMatchObject({
      fullName: 'Sarah',
      preferredChannel: 'EMAIL',
      deletedAt: null,
    });
    expect(args.where!.OR).toEqual([{ email: 'a@b' }, { mobilePhone: '+447' }]);
  });
});
