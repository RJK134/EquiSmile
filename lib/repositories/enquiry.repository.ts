import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateEnquiryInput, UpdateEnquiryInput, EnquiryQuery } from '@/lib/validations/enquiry.schema';
import type { PaginatedResult } from '@/lib/types';

/**
 * Repository for Enquiry.
 *
 * Soft-delete invariant (Phase 16):
 *   - `delete(id, actorId)` sets `deletedAt` / `deletedById`; the row stays.
 *   - Every read (`findMany`, `findById`, `findRecent`, `countByStatus`)
 *     filters `deletedAt: null` by default so callers cannot accidentally
 *     surface tombstoned messages on the UI.
 *   - `restore(id)` and `hardDelete(id)` are explicit, operator-only paths.
 *     Hard delete is reserved for GDPR/FADP erasure requests.
 */
export const enquiryRepository = {
  async findMany(query: EnquiryQuery) {
    const { customerId, triageStatus, channel, search, page, pageSize, includeDeleted } = query;
    const where: Prisma.EnquiryWhereInput = {};

    if (!includeDeleted) where.deletedAt = null;
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

  async findById(id: string, options: { includeDeleted?: boolean } = {}) {
    return prisma.enquiry.findFirst({
      where: options.includeDeleted ? { id } : { id, deletedAt: null },
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
    // Guard against updating a tombstoned enquiry via the standard path.
    return prisma.enquiry.update({ where: { id, deletedAt: null }, data });
  },

  /**
   * Soft delete — tombstones the enquiry. The cascading visitRequests
   * are intentionally NOT tombstoned here: they may already be on a
   * route run or in clinical history. An operator who needs to remove
   * a visit request goes through the visit-request endpoints.
   */
  async delete(id: string, actorId?: string | null) {
    return prisma.enquiry.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actorId ?? null },
    });
  },

  async restore(id: string) {
    return prisma.enquiry.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  },

  async hardDelete(id: string) {
    return prisma.enquiry.delete({ where: { id } });
  },

  async countByStatus(options: { includeDeleted?: boolean } = {}) {
    const results = await prisma.enquiry.groupBy({
      by: ['triageStatus'],
      where: options.includeDeleted ? undefined : { deletedAt: null },
      _count: { id: true },
    });
    return Object.fromEntries(
      results.map((r) => [r.triageStatus, r._count.id])
    ) as Record<string, number>;
  },

  async findRecent(limit: number = 5) {
    return prisma.enquiry.findMany({
      where: { deletedAt: null },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        customer: { select: { id: true, fullName: true } },
      },
    });
  },
};
