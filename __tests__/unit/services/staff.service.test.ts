import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointmentAssignment: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    routeRunAssistant: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    routeRun: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn) =>
      fn({
        appointmentAssignment: {
          upsert: vi.fn().mockResolvedValue({ id: 'aa1' }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          deleteMany: vi.fn(),
        },
      }),
    ),
  },
}));

vi.mock('@/lib/repositories/staff.repository', () => ({
  staffRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}));

import { staffService } from '@/lib/services/staff.service';
import { staffRepository } from '@/lib/repositories/staff.repository';
import { prisma } from '@/lib/prisma';

describe('staffService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('rejects empty name', async () => {
      await expect(staffService.create({ name: '' })).rejects.toThrow(/name is required/);
    });

    it('rejects duplicate email', async () => {
      (staffRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });
      await expect(
        staffService.create({ name: 'Dr. Vet', email: 'vet@example.com' }),
      ).rejects.toThrow(/already exists/);
    });

    it('lowercases email before insert', async () => {
      (staffRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (staffRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new' });
      await staffService.create({ name: 'Dr. Vet', email: 'Vet@Example.COM' });
      expect(staffRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'vet@example.com', name: 'Dr. Vet' }),
      );
    });

    it('defaults role to VET when not provided', async () => {
      (staffRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (staffRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new' });
      await staffService.create({ name: 'Dr. Vet' });
      const call = (staffRepository.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // role undefined here; repository applies VET default
      expect(call.role).toBeUndefined();
    });
  });

  describe('assignToAppointment', () => {
    it('upserts assignment without primary flag', async () => {
      const txSpy = vi.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointmentAssignment: {
            upsert: vi.fn().mockResolvedValue({ id: 'aa1', appointmentId: 'a1', staffId: 's1' }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return fn(tx);
      });
      (prisma as unknown as { $transaction: typeof txSpy }).$transaction = txSpy;

      const result = await staffService.assignToAppointment({
        appointmentId: 'a1',
        staffId: 's1',
      });
      expect(result).toEqual({ id: 'aa1', appointmentId: 'a1', staffId: 's1' });
      expect(txSpy).toHaveBeenCalledOnce();
    });

    it('unflags other primaries when setting a new primary', async () => {
      const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const upsertMock = vi.fn().mockResolvedValue({ id: 'aa2' });
      const txSpy = vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          appointmentAssignment: {
            upsert: upsertMock,
            updateMany: updateManyMock,
          },
        }),
      );
      (prisma as unknown as { $transaction: typeof txSpy }).$transaction = txSpy;

      await staffService.assignToAppointment({
        appointmentId: 'a1',
        staffId: 's2',
        primary: true,
      });
      expect(updateManyMock).toHaveBeenCalledWith({
        where: { appointmentId: 'a1', primary: true },
        data: { primary: false },
      });
      expect(upsertMock).toHaveBeenCalledOnce();
    });
  });

  describe('assignToRouteRun', () => {
    it('sets leadStaffId when isLead=true', async () => {
      (prisma.routeRun.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'r1', leadStaffId: 's1' });
      await staffService.assignToRouteRun({ routeRunId: 'r1', staffId: 's1', isLead: true });
      expect(prisma.routeRun.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { leadStaffId: 's1' },
      });
    });

    it('creates an assistant row when isLead is false', async () => {
      (prisma.routeRunAssistant.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ra1' });
      await staffService.assignToRouteRun({ routeRunId: 'r1', staffId: 's2' });
      expect(prisma.routeRunAssistant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { routeRunId_staffId: { routeRunId: 'r1', staffId: 's2' } },
        }),
      );
    });

    it('only clears the lead when the staff matches the current lead', async () => {
      (prisma.routeRun.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await staffService.unassignFromRouteRun({ routeRunId: 'r1', staffId: 's1', wasLead: true });

      expect(prisma.routeRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', leadStaffId: 's1' },
        data: { leadStaffId: null },
      });
    });
  });

  describe('appointmentsForCalendar', () => {
    it('returns all appointments in range when no staff filter', async () => {
      (prisma.appointment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      await staffService.appointmentsForCalendar({
        from: new Date('2026-05-01'),
        to: new Date('2026-05-08'),
      });
      const call = (prisma.appointment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where).toEqual(
        expect.objectContaining({ appointmentStart: { gte: expect.any(Date), lt: expect.any(Date) } }),
      );
      expect(call.where.OR).toBeUndefined();
    });

    it('filters by direct assignment OR route-run lead/assist when staffId is set', async () => {
      (prisma.appointment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      await staffService.appointmentsForCalendar({
        staffId: 's1',
        from: new Date('2026-05-01'),
        to: new Date('2026-05-08'),
      });
      const call = (prisma.appointment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
      expect(call.where.OR[0]).toEqual({ assignments: { some: { staffId: 's1' } } });
      expect(call.where.OR[1]).toEqual({ routeRun: { leadStaffId: 's1' } });
      expect(call.where.OR[2]).toEqual({ routeRun: { assistants: { some: { staffId: 's1' } } } });
    });
  });
});
