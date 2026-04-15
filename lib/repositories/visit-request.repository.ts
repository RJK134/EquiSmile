import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateVisitRequestInput, UpdateVisitRequestInput, VisitRequestQuery } from '@/lib/validations/visit-request.schema';
import type { PaginatedResult } from '@/lib/types';

export const visitRequestRepository = {
  async findMany(query: VisitRequestQuery) {
    const { customerId, planningStatus, urgencyLevel, requestType, page, pageSize } = query;
    const where: Prisma.VisitRequestWhereInput = {};

    if (customerId) where.customerId = customerId;
    if (planningStatus) where.planningStatus = planningStatus;
    if (urgencyLevel) where.urgencyLevel = urgencyLevel;
    if (requestType) where.requestType = requestType;

    const [data, total] = await Promise.all([
      prisma.visitRequest.findMany({
        where,
        orderBy: [{ urgencyLevel: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, fullName: true } },
          yard: { select: { id: true, yardName: true, postcode: true, areaLabel: true } },
          enquiry: { select: { id: true, channel: true, triageStatus: true } },
          _count: { select: { triageTasks: true } },
        },
      }),
      prisma.visitRequest.count({ where }),
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
    return prisma.visitRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        yard: true,
        enquiry: true,
        triageTasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  },

  async create(data: CreateVisitRequestInput) {
    return prisma.visitRequest.create({ data });
  },

  async update(id: string, data: UpdateVisitRequestInput) {
    return prisma.visitRequest.update({ where: { id }, data });
  },

  async findForPlanningPool() {
    return prisma.visitRequest.findMany({
      where: {
        planningStatus: { in: ['PLANNING_POOL', 'READY_FOR_REVIEW'] },
      },
      orderBy: [{ urgencyLevel: 'asc' }, { createdAt: 'asc' }],
      include: {
        customer: { select: { id: true, fullName: true } },
        yard: { select: { id: true, yardName: true, postcode: true, areaLabel: true } },
      },
    });
  },

  async countByPlanningStatus() {
    const results = await prisma.visitRequest.groupBy({
      by: ['planningStatus'],
      _count: { id: true },
    });
    return Object.fromEntries(
      results.map((r) => [r.planningStatus, r._count.id])
    ) as Record<string, number>;
  },

  async countUrgent() {
    return prisma.visitRequest.count({
      where: { urgencyLevel: 'URGENT', planningStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
  },

  async countNeedsInfo() {
    return prisma.visitRequest.count({
      where: { needsMoreInfo: true, planningStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
  },

  async countInPlanningPool() {
    return prisma.visitRequest.count({
      where: { planningStatus: { in: ['PLANNING_POOL', 'READY_FOR_REVIEW'] } },
    });
  },
};
