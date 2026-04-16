/**
 * Phase 5 — RouteRun & RouteRunStop Repository
 */

import { prisma } from '@/lib/prisma';
import type { RouteRunStatus } from '@prisma/client';

export interface CreateRouteRunInput {
  runDate: Date;
  homeBaseAddress: string;
  startTime?: Date;
  endTime?: Date;
  status?: RouteRunStatus;
  totalDistanceMeters?: number;
  totalTravelMinutes?: number;
  totalVisitMinutes?: number;
  totalJobs?: number;
  totalHorses?: number;
  optimizationScore?: number;
  notes?: string;
}

export interface CreateRouteRunStopInput {
  routeRunId: string;
  sequenceNo: number;
  visitRequestId?: string;
  yardId: string;
  plannedArrival?: Date;
  plannedDeparture?: Date;
  serviceMinutes?: number;
  travelFromPrevMinutes?: number;
  travelFromPrevMeters?: number;
  optimizationScore?: number;
}

export const routeRunRepository = {
  async findMany(query: { status?: RouteRunStatus; page: number; pageSize: number }) {
    const { status, page, pageSize } = query;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      prisma.routeRun.findMany({
        where,
        orderBy: [{ runDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          stops: {
            orderBy: { sequenceNo: 'asc' },
            include: {
              yard: { select: { id: true, yardName: true, postcode: true, town: true, latitude: true, longitude: true } },
              visitRequest: {
                select: {
                  id: true,
                  horseCount: true,
                  urgencyLevel: true,
                  customer: { select: { id: true, fullName: true } },
                },
              },
            },
          },
          _count: { select: { stops: true } },
        },
      }),
      prisma.routeRun.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async findById(id: string) {
    return prisma.routeRun.findUnique({
      where: { id },
      include: {
        stops: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            yard: {
              include: {
                customer: { select: { id: true, fullName: true } },
              },
            },
            visitRequest: {
              include: {
                customer: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });
  },

  async create(data: CreateRouteRunInput) {
    return prisma.routeRun.create({ data });
  },

  async update(id: string, data: Partial<CreateRouteRunInput> & { status?: RouteRunStatus }) {
    return prisma.routeRun.update({ where: { id }, data });
  },

  async createStop(data: CreateRouteRunStopInput) {
    return prisma.routeRunStop.create({ data });
  },

  async createStops(data: CreateRouteRunStopInput[]) {
    return prisma.routeRunStop.createMany({ data });
  },

  async deleteStopsByRouteRunId(routeRunId: string) {
    return prisma.routeRunStop.deleteMany({ where: { routeRunId } });
  },
};
