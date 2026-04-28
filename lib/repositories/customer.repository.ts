import { prisma } from '@/lib/prisma';
import type { PrismaTransactionClient } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from '@/lib/validations/customer.schema';
import type { PaginatedResult } from '@/lib/types';

/**
 * Repository for Customer.
 *
 * Soft-delete invariant (Phase 15):
 *   - `delete(id, actorId)` sets `deletedAt` / `deletedById`; the row stays.
 *   - Every read (`findMany`, `findById`, `count`) filters `deletedAt: null`
 *     by default so callers can't accidentally see tombstoned rows.
 *   - `restore(id)` and `hardDelete(id)` are explicit, operator-only paths.
 */
export const customerRepository = {
  async findMany(query: CustomerQuery) {
    const { search, preferredChannel, page, pageSize, includeDeleted } = query;
    const where: Prisma.CustomerWhereInput = {};

    // Always set `deletedAt` explicitly (`null` for live-only,
    // `undefined` for include-deleted). The Prisma soft-delete
    // extension in `lib/prisma.ts` uses *key presence* as the opt-out
    // signal — leaving the key absent would trigger an auto-injected
    // `deletedAt: null` filter even when the caller asked to see
    // tombstoned rows.
    where.deletedAt = includeDeleted ? undefined : null;

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobilePhone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (preferredChannel) {
      where.preferredChannel = preferredChannel;
    }

    // Nested `_count` filters must mirror the top-level `includeDeleted`
    // flag so an admin auditing tombstoned customers sees the true
    // yard/horse count, not the post-cascade "0 yards, 0 horses"
    // illusion (every cascaded child shares the parent's deletedAt).
    const childCountWhere = includeDeleted ? undefined : { deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              yards: { where: childCountWhere },
              horses: { where: childCountWhere },
              enquiries: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const result: PaginatedResult<typeof data[number]> = {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
    return result;
  },

  async findById(id: string, options: { includeDeleted?: boolean } = {}) {
    // Propagate the `includeDeleted` flag to the nested yards/horses
    // relations so that a tombstoned parent actually shows the
    // cascaded children an operator would need to see before restoring.
    // With the default (includeDeleted: false) we still hide deleted
    // children — the standard UI list invariant.
    const childWhere = options.includeDeleted ? undefined : { deletedAt: null };
    // `deletedAt` key is always present (see findMany comment above on
    // the extension's opt-out semantics).
    return prisma.customer.findFirst({
      where: { id, deletedAt: options.includeDeleted ? undefined : null },
      include: {
        yards: { where: childWhere },
        horses: {
          where: childWhere,
          include: { primaryYard: true },
        },
        enquiries: { orderBy: { receivedAt: 'desc' }, take: 10 },
      },
    });
  },

  async create(data: CreateCustomerInput) {
    return prisma.customer.create({ data });
  },

  async update(id: string, data: UpdateCustomerInput) {
    // Guard against updating a tombstoned customer via the standard path.
    return prisma.customer.update({
      where: { id, deletedAt: null },
      data,
    });
  },

  /**
   * Soft delete — tombstones the customer and cascades the tombstone to
   * owned yards/horses in a single transaction. Data is retained and
   * recoverable via `restore`.
   */
  async delete(id: string, actorId?: string | null) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id, deletedAt: null },
        data: { deletedAt: now, deletedById: actorId ?? null },
      });
      await tx.yard.updateMany({
        where: { customerId: id, deletedAt: null },
        data: { deletedAt: now, deletedById: actorId ?? null },
      });
      await tx.horse.updateMany({
        where: { customerId: id, deletedAt: null },
        data: { deletedAt: now, deletedById: actorId ?? null },
      });
      return customer;
    });
  },

  /**
   * Shared restore primitive — un-tombstones a customer and the
   * yards/horses that were cascaded by THIS customer-delete.
   *
   * Children are matched by `deletedAt = parent.deletedAt` — the
   * delete transaction writes the same `Date` instance to all three
   * tables at once, so cascaded children share that timestamp at the
   * microsecond precision Postgres stores. A child that was
   * independently soft-deleted at a different moment has a different
   * `deletedAt` and is intentionally LEFT tombstoned by this restore.
   *
   * Runs inside the caller's transaction so the caller can compose
   * further work atomically (e.g. the inbound-message webhook
   * immediately follows the restore with an enquiry insert). The
   * caller is expected to have the parent customer row already — pass
   * `parentDeletedAt` explicitly so this helper doesn't have to
   * re-query.
   */
  async cascadeRestoreWithin(
    tx: PrismaTransactionClient,
    id: string,
    parentDeletedAt: Date | null,
  ) {
    const customer = await tx.customer.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
    if (parentDeletedAt !== null) {
      await tx.yard.updateMany({
        where: { customerId: id, deletedAt: parentDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
      await tx.horse.updateMany({
        where: { customerId: id, deletedAt: parentDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
    }
    return customer;
  },

  /**
   * Operator-only: restore a tombstoned customer and its owned rows.
   *
   * Symmetric with `delete`. Delegates to `cascadeRestoreWithin` so the
   * inbound-message auto-restore path in `resolveInboundCustomer` runs
   * exactly the same cascade logic and can't drift.
   */
  async restore(id: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id },
        select: { deletedAt: true },
      });
      if (!existing) throw new Error(`Customer ${id} not found`);
      return this.cascadeRestoreWithin(tx, id, existing.deletedAt);
    });
  },

  /**
   * Hard delete — destroys the row and cascades via FK. Reserved for
   * GDPR/FADP erasure requests. Never call from routine UI paths.
   */
  async hardDelete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },

  async count(options: { includeDeleted?: boolean } = {}) {
    return prisma.customer.count({
      // Always present; see findMany comment.
      where: { deletedAt: options.includeDeleted ? undefined : null },
    });
  },
};
