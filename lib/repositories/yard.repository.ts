import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateYardInput, UpdateYardInput, YardQuery } from '@/lib/validations/yard.schema';
import type { PaginatedResult } from '@/lib/types';

/**
 * Repository for Yard.
 *
 * Soft-delete invariant (Phase 15): `delete` tombstones via `deletedAt`
 * and cascades to owned horses whose `primaryYardId` points at it.
 * Reads filter `deletedAt: null` by default.
 */
export const yardRepository = {
  async findMany(query: YardQuery) {
    const { customerId, areaLabel, postcode, search, page, pageSize, includeDeleted } = query;
    const where: Prisma.YardWhereInput = {};

    if (!includeDeleted) where.deletedAt = null;
    if (customerId) where.customerId = customerId;
    if (areaLabel) where.areaLabel = { contains: areaLabel, mode: 'insensitive' };
    if (postcode) where.postcode = { startsWith: postcode, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { yardName: { contains: search, mode: 'insensitive' } },
        { town: { contains: search, mode: 'insensitive' } },
        { postcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.yard.findMany({
        where,
        orderBy: { yardName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, fullName: true } },
          _count: { select: { horses: { where: { deletedAt: null } } } },
        },
      }),
      prisma.yard.count({ where }),
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
    // Propagate the flag to the nested horses relation — see
    // customer.repository.ts findById for the reasoning. A tombstoned
    // parent should expose its cascaded children when the caller
    // explicitly asks (e.g. a restore-preview UI).
    const childWhere = options.includeDeleted ? undefined : { deletedAt: null };
    return prisma.yard.findFirst({
      where: options.includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        customer: true,
        horses: { where: childWhere },
      },
    });
  },

  async create(data: CreateYardInput) {
    return prisma.yard.create({ data });
  },

  async update(id: string, data: UpdateYardInput) {
    return prisma.yard.update({ where: { id, deletedAt: null }, data });
  },

  /** Soft delete with cascade to horses whose primary yard was this one. */
  async delete(id: string, actorId?: string | null) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const yard = await tx.yard.update({
        where: { id, deletedAt: null },
        data: { deletedAt: now, deletedById: actorId ?? null },
      });
      await tx.horse.updateMany({
        where: { primaryYardId: id, deletedAt: null },
        data: { deletedAt: now, deletedById: actorId ?? null },
      });
      return yard;
    });
  },

  /**
   * Un-tombstone the yard and any horses cascaded by THIS yard's
   * delete. Symmetric with `delete` — a delete-then-restore cycle
   * must leave no row permanently soft-deleted and must NOT resurrect
   * children that were independently soft-deleted at another moment.
   *
   * Matches children by `deletedAt = parent.deletedAt`: the delete
   * transaction writes a single `Date` instance to both parent and
   * cascaded children, so timestamps match at microsecond precision.
   */
  async restore(id: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.yard.findUnique({
        where: { id },
        select: { deletedAt: true },
      });
      if (!existing) throw new Error(`Yard ${id} not found`);

      const parentDeletedAt = existing.deletedAt;

      const yard = await tx.yard.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });

      if (parentDeletedAt !== null) {
        await tx.horse.updateMany({
          where: { primaryYardId: id, deletedAt: parentDeletedAt },
          data: { deletedAt: null, deletedById: null },
        });
      }
      return yard;
    });
  },

  async hardDelete(id: string) {
    return prisma.yard.delete({ where: { id } });
  },
};
