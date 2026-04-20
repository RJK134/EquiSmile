import { prisma } from '@/lib/prisma';
import { staffRepository, type CreateStaffInput, type UpdateStaffInput } from '@/lib/repositories/staff.repository';
import type { Staff, Prisma } from '@prisma/client';

export interface AssignAppointmentInput {
  appointmentId: string;
  staffId: string;
  primary?: boolean;
}

export interface AssignRouteRunInput {
  routeRunId: string;
  staffId: string;
  isLead?: boolean;
}

export const staffService = {
  async list(options: Parameters<typeof staffRepository.list>[0] = {}) {
    return staffRepository.list(options);
  },

  async create(data: CreateStaffInput): Promise<Staff> {
    if (!data.name?.trim()) throw new Error('Staff name is required');
    if (data.email) {
      const existing = await staffRepository.findByEmail(data.email.toLowerCase());
      if (existing) throw new Error(`Staff with email ${data.email} already exists`);
      data.email = data.email.toLowerCase();
    }
    return staffRepository.create(data);
  },

  async update(id: string, data: UpdateStaffInput): Promise<Staff> {
    if (data.email) data.email = data.email.toLowerCase();
    return staffRepository.update(id, data);
  },

  async deactivate(id: string): Promise<Staff> {
    return staffRepository.deactivate(id);
  },

  async assignToAppointment(input: AssignAppointmentInput) {
    const { appointmentId, staffId, primary } = input;

    return prisma.$transaction(async (tx) => {
      // If marking primary, unflag any other primary on the same appointment first.
      if (primary) {
        await tx.appointmentAssignment.updateMany({
          where: { appointmentId, primary: true },
          data: { primary: false },
        });
      }

      return tx.appointmentAssignment.upsert({
        where: { appointmentId_staffId: { appointmentId, staffId } },
        create: { appointmentId, staffId, primary: primary ?? false },
        update: { primary: primary ?? undefined },
      });
    });
  },

  async unassignFromAppointment(input: { appointmentId: string; staffId: string }) {
    return prisma.appointmentAssignment.deleteMany({
      where: { appointmentId: input.appointmentId, staffId: input.staffId },
    });
  },

  async assignToRouteRun(input: AssignRouteRunInput) {
    const { routeRunId, staffId, isLead } = input;

    if (isLead) {
      return prisma.routeRun.update({
        where: { id: routeRunId },
        data: { leadStaffId: staffId },
      });
    }

    return prisma.routeRunAssistant.upsert({
      where: { routeRunId_staffId: { routeRunId, staffId } },
      create: { routeRunId, staffId },
      update: {},
    });
  },

  async unassignFromRouteRun(input: { routeRunId: string; staffId: string; wasLead?: boolean }) {
    if (input.wasLead) {
      return prisma.routeRun.updateMany({
        where: { id: input.routeRunId, leadStaffId: input.staffId },
        data: { leadStaffId: null },
      });
    }
    return prisma.routeRunAssistant.deleteMany({
      where: { routeRunId: input.routeRunId, staffId: input.staffId },
    });
  },

  /**
   * List appointments falling inside a date range, optionally filtered by
   * staff. A staff member "owns" an appointment if they are either directly
   * assigned (AppointmentAssignment) or they lead/assist the parent RouteRun.
   */
  async appointmentsForCalendar(options: {
    staffId?: string;
    from: Date;
    to: Date;
  }) {
    const { staffId, from, to } = options;

    const where: Prisma.AppointmentWhereInput = {
      appointmentStart: { gte: from, lt: to },
    };

    if (staffId) {
      where.OR = [
        { assignments: { some: { staffId } } },
        { routeRun: { leadStaffId: staffId } },
        { routeRun: { assistants: { some: { staffId } } } },
      ];
    }

    return prisma.appointment.findMany({
      where,
      orderBy: { appointmentStart: 'asc' },
      include: {
        visitRequest: { include: { customer: true, yard: true } },
        assignments: { include: { staff: true } },
        routeRun: {
          select: {
            id: true,
            runDate: true,
            leadStaffId: true,
            leadStaff: { select: { id: true, name: true, colour: true } },
            assistants: { include: { staff: { select: { id: true, name: true, colour: true } } } },
          },
        },
      },
    });
  },
};
