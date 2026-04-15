import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { CreateTriageTaskInput, UpdateTriageTaskInput, TriageTaskQuery } from '@/lib/validations/triage-task.schema';
import type { PaginatedResult } from '@/lib/types';

export const triageTaskRepository = {
  async findMany(query: TriageTaskQuery) {
    const { visitRequestId, status, taskType, page, pageSize } = query;
    const where: Prisma.TriageTaskWhereInput = {};

    if (visitRequestId) where.visitRequestId = visitRequestId;
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;

    const [data, total] = await Promise.all([
      prisma.triageTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          visitRequest: {
            include: {
              customer: { select: { id: true, fullName: true } },
              yard: { select: { id: true, yardName: true, postcode: true } },
              enquiry: { select: { id: true, channel: true } },
            },
          },
        },
      }),
      prisma.triageTask.count({ where }),
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
    return prisma.triageTask.findUnique({
      where: { id },
      include: {
        visitRequest: {
          include: {
            customer: true,
            yard: true,
            enquiry: true,
          },
        },
      },
    });
  },

  async create(data: CreateTriageTaskInput) {
    return prisma.triageTask.create({ data });
  },

  async update(id: string, data: UpdateTriageTaskInput) {
    return prisma.triageTask.update({ where: { id }, data });
  },

  async findOpenTasks() {
    return prisma.triageTask.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        visitRequest: {
          include: {
            customer: { select: { id: true, fullName: true } },
            yard: { select: { id: true, yardName: true } },
            enquiry: { select: { id: true, channel: true, rawText: true } },
          },
        },
      },
    });
  },
};
