/**
 * Phase 6 — Appointment Repository
 */

import { prisma } from '@/lib/prisma';
import type { AppointmentStatus } from '@prisma/client';

export interface AppointmentQuery {
  status?: AppointmentStatus;
  routeRunId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface CreateAppointmentInput {
  visitRequestId: string;
  routeRunId?: string;
  appointmentStart: Date;
  appointmentEnd: Date;
  status?: AppointmentStatus;
  confirmationChannel?: 'WHATSAPP' | 'EMAIL' | 'PHONE';
}

const appointmentInclude = {
  visitRequest: {
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          mobilePhone: true,
          email: true,
          preferredChannel: true,
          preferredLanguage: true,
        },
      },
      yard: {
        select: {
          id: true,
          yardName: true,
          addressLine1: true,
          town: true,
          postcode: true,
        },
      },
    },
  },
  routeRun: {
    select: {
      id: true,
      runDate: true,
      status: true,
    },
  },
  visitOutcome: true,
} as const;

export const appointmentRepository = {
  async findMany(query: AppointmentQuery) {
    const { status, routeRunId, customerId, dateFrom, dateTo, page, pageSize } = query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (routeRunId) where.routeRunId = routeRunId;
    if (customerId) {
      where.visitRequest = { customerId };
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.appointmentStart = dateFilter;
    }

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: [{ appointmentStart: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async findById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
  },

  async findByRouteRunId(routeRunId: string) {
    return prisma.appointment.findMany({
      where: { routeRunId },
      include: appointmentInclude,
      orderBy: { appointmentStart: 'asc' },
    });
  },

  async create(data: CreateAppointmentInput) {
    return prisma.appointment.create({
      data,
      include: appointmentInclude,
    });
  },

  async update(id: string, data: Partial<{
    status: AppointmentStatus;
    confirmationSentAt: Date;
    reminderSentAt24h: Date;
    reminderSentAt2h: Date;
    cancellationReason: string;
  }>) {
    return prisma.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });
  },

  async findDueForReminder(type: '24h' | '2h') {
    const now = new Date();

    if (type === '24h') {
      const from = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 26 * 60 * 60 * 1000);
      return prisma.appointment.findMany({
        where: {
          status: { in: ['PROPOSED', 'CONFIRMED'] },
          appointmentStart: { gte: from, lte: to },
          reminderSentAt24h: null,
        },
        include: appointmentInclude,
      });
    }

    const from = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return prisma.appointment.findMany({
      where: {
        status: { in: ['PROPOSED', 'CONFIRMED'] },
        appointmentStart: { gte: from, lte: to },
        reminderSentAt2h: null,
      },
      include: appointmentInclude,
    });
  },

  async countByStatus() {
    const results = await prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
    });
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.status] = r._count;
    }
    return counts;
  },

  async findUpcoming(days: number = 7) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return prisma.appointment.findMany({
      where: {
        appointmentStart: { gte: now, lte: until },
        status: { in: ['PROPOSED', 'CONFIRMED'] },
      },
      include: appointmentInclude,
      orderBy: { appointmentStart: 'asc' },
    });
  },

  async findToday() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return prisma.appointment.findMany({
      where: {
        appointmentStart: { gte: todayStart, lt: todayEnd },
      },
      include: appointmentInclude,
      orderBy: { appointmentStart: 'asc' },
    });
  },

  async findPotentialNoShows() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return prisma.appointment.findMany({
      where: {
        status: { in: ['PROPOSED', 'CONFIRMED'] },
        appointmentEnd: { lt: twoHoursAgo },
      },
      include: appointmentInclude,
    });
  },

  async countPendingConfirmations() {
    return prisma.appointment.count({
      where: {
        status: 'PROPOSED',
        confirmationSentAt: null,
      },
    });
  },

  async countCompletedThisWeek() {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return prisma.appointment.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: weekStart },
      },
    });
  },

  async countFollowUpsDue() {
    return prisma.visitOutcome.count({
      where: {
        followUpRequired: true,
        followUpDueDate: { lte: new Date() },
      },
    });
  },
};
