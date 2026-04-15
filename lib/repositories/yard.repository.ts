import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateYardInput, UpdateYardInput, YardQuery } from '@/lib/validations/yard.schema';
import type { PaginatedResult } from '@/lib/types';

export const yardRepository = {
  async findMany(query: YardQuery) {
    const { customerId, areaLabel, postcode, search, page, pageSize } = query;
    const where: Prisma.YardWhereInput = {};

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
          _count: { select: { horses: true } },
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

  async findById(id: string) {
    return prisma.yard.findUnique({
      where: { id },
      include: {
        customer: true,
        horses: true,
      },
    });
  },

  async create(data: CreateYardInput) {
    return prisma.yard.create({ data });
  },

  async update(id: string, data: UpdateYardInput) {
    return prisma.yard.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.yard.delete({ where: { id } });
  },
};
