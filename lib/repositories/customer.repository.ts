import { prisma } from '@/lib/prisma';
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

    if (!includeDeleted) {
      where.deletedAt = null;
    }

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

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              yards: { where: { deletedAt: null } },
              horses: { where: { deletedAt: null } },
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
    return prisma.customer.findFirst({
      where: options.includeDeleted ? { id } : { id, deletedAt: null },
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
   * Operator-only: restore a tombstoned customer and its owned rows.
   *
   * Symmetric with `delete`: only un-tombstones yards/horses that were
   * cascaded by THIS customer-delete. We identify them by matching
   * their `deletedAt` to the parent customer's `deletedAt` — the
   * delete transaction writes the same `Date` instance to all three
   * tables, so children tombstoned in the same cascade share that
   * timestamp at the microsecond precision Postgres stores.
   *
   * A child that was independently soft-deleted at a different
   * moment (before or after the parent) has a different `deletedAt`
   * and is intentionally LEFT tombstoned by this restore.
   */
  async restore(id: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id },
        select: { deletedAt: true },
      });
      if (!existing) throw new Error(`Customer ${id} not found`);

      const parentDeletedAt = existing.deletedAt;

      const customer = await tx.customer.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });

      // If the parent wasn't tombstoned, there can't be cascaded
      // children. Skip the updateMany calls entirely so we don't
      // accidentally touch a row with a null filter.
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
      where: options.includeDeleted ? undefined : { deletedAt: null },
    });
  },
};
