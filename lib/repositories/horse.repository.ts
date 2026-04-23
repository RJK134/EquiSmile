import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateHorseInput, UpdateHorseInput, HorseQuery } from '@/lib/validations/horse.schema';
import type { PaginatedResult } from '@/lib/types';

/**
 * Repository for Horse.
 *
 * Soft-delete invariant (Phase 15): `delete` tombstones the row;
 * clinical history (attachments, charts, findings, prescriptions) is
 * retained via the FK and stays recoverable.
 */
export const horseRepository = {
  async findMany(query: HorseQuery) {
    const { customerId, primaryYardId, active, search, page, pageSize, includeDeleted } = query;
    const where: Prisma.HorseWhereInput = {};

    if (!includeDeleted) where.deletedAt = null;
    if (customerId) where.customerId = customerId;
    if (primaryYardId) where.primaryYardId = primaryYardId;
    if (active !== undefined) where.active = active;

    if (search) {
      where.horseName = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.horse.findMany({
        where,
        orderBy: { horseName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, fullName: true } },
          primaryYard: { select: { id: true, yardName: true } },
        },
      }),
      prisma.horse.count({ where }),
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
    return prisma.horse.findFirst({
      where: options.includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        customer: true,
        primaryYard: true,
      },
    });
  },

  async create(data: CreateHorseInput) {
    return prisma.horse.create({ data });
  },

  async update(id: string, data: UpdateHorseInput) {
    return prisma.horse.update({ where: { id, deletedAt: null }, data });
  },

  async delete(id: string, actorId?: string | null) {
    return prisma.horse.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actorId ?? null },
    });
  },

  async restore(id: string) {
    return prisma.horse.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  },

  async hardDelete(id: string) {
    return prisma.horse.delete({ where: { id } });
  },
};
