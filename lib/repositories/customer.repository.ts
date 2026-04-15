import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from '@/lib/validations/customer.schema';
import type { PaginatedResult } from '@/lib/types';

export const customerRepository = {
  async findMany(query: CustomerQuery) {
    const { search, preferredChannel, page, pageSize } = query;
    const where: Prisma.CustomerWhereInput = {};

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
          _count: { select: { yards: true, horses: true, enquiries: true } },
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

  async findById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        yards: true,
        horses: { include: { primaryYard: true } },
        enquiries: { orderBy: { receivedAt: 'desc' }, take: 10 },
      },
    });
  },

  async create(data: CreateCustomerInput) {
    return prisma.customer.create({ data });
  },

  async update(id: string, data: UpdateCustomerInput) {
    return prisma.customer.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },

  async count() {
    return prisma.customer.count();
  },
};
