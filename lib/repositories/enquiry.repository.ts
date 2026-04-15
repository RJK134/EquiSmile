import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateEnquiryInput, UpdateEnquiryInput, EnquiryQuery } from '@/lib/validations/enquiry.schema';
import type { PaginatedResult } from '@/lib/types';

export const enquiryRepository = {
  async findMany(query: EnquiryQuery) {
    const { customerId, triageStatus, channel, search, page, pageSize } = query;
    const where: Prisma.EnquiryWhereInput = {};

    if (customerId) where.customerId = customerId;
    if (triageStatus) where.triageStatus = triageStatus;
    if (channel) where.channel = channel;

    if (search) {
      where.OR = [
        { rawText: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { sourceFrom: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, fullName: true } },
          yard: { select: { id: true, yardName: true, postcode: true } },
          _count: { select: { visitRequests: true } },
        },
      }),
      prisma.enquiry.count({ where }),
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
    return prisma.enquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        yard: true,
        messages: { orderBy: { sentOrReceivedAt: 'desc' } },
        visitRequests: {
          include: {
            triageTasks: true,
            yard: { select: { id: true, yardName: true, postcode: true } },
          },
        },
      },
    });
  },

  async create(data: CreateEnquiryInput) {
    return prisma.enquiry.create({ data });
  },

  async update(id: string, data: UpdateEnquiryInput) {
    return prisma.enquiry.update({ where: { id }, data });
  },

  async countByStatus() {
    const results = await prisma.enquiry.groupBy({
      by: ['triageStatus'],
      _count: { id: true },
    });
    return Object.fromEntries(
      results.map((r) => [r.triageStatus, r._count.id])
    ) as Record<string, number>;
  },

  async findRecent(limit: number = 5) {
    return prisma.enquiry.findMany({
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        customer: { select: { id: true, fullName: true } },
      },
    });
  },
};
