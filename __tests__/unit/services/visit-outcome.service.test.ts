import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { visitOutcomeService } from '@/lib/services/visit-outcome.service';

describe('visitOutcomeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('completeAppointment', () => {
    it('throws if appointment not found', async () => {
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
          visitOutcome: { create: vi.fn() },
          visitRequest: { create: vi.fn(), update: vi.fn() },
          routeRunStop: { updateMany: vi.fn() },
          horse: { updateMany: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      await expect(
        visitOutcomeService.completeAppointment('appt1', {})
      ).rejects.toThrow('Appointment not found');
    });

    it('throws if appointment is already completed', async () => {
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'COMPLETED',
              visitRequest: {
                customer: { id: 'c1' },
                yard: { id: 'y1' },
              },
              visitOutcome: null,
            }),
            update: vi.fn(),
          },
          visitOutcome: { create: vi.fn() },
          visitRequest: { create: vi.fn(), update: vi.fn() },
          routeRunStop: { updateMany: vi.fn() },
          horse: { updateMany: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      await expect(
        visitOutcomeService.completeAppointment('appt1', {})
      ).rejects.toThrow('already completed');
    });

    it('creates visit outcome and updates status', async () => {
      const mockApptUpdate = vi.fn().mockResolvedValue({});
      const mockVrUpdate = vi.fn().mockResolvedValue({});
      const mockOutcomeCreate = vi.fn().mockResolvedValue({ id: 'vo1' });

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'CONFIRMED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                customer: { id: 'c1' },
                yard: { id: 'y1' },
              },
              visitOutcome: null,
            }),
            update: mockApptUpdate,
          },
          visitOutcome: { create: mockOutcomeCreate },
          visitRequest: { create: vi.fn(), update: mockVrUpdate },
          routeRunStop: { updateMany: vi.fn() },
          horse: { updateMany: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await visitOutcomeService.completeAppointment('appt1', {
        notes: 'All good',
      });

      expect(result.appointmentId).toBe('appt1');
      expect(result.visitOutcomeId).toBe('vo1');

      expect(mockOutcomeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appointmentId: 'appt1',
          notes: 'All good',
          followUpRequired: false,
        }),
      });

      expect(mockApptUpdate).toHaveBeenCalledWith({
        where: { id: 'appt1' },
        data: { status: 'COMPLETED' },
      });

      expect(mockVrUpdate).toHaveBeenCalledWith({
        where: { id: 'vr1' },
        data: { planningStatus: 'COMPLETED' },
      });
    });

    it('creates follow-up visit request when required', async () => {
      const mockVrCreate = vi.fn().mockResolvedValue({ id: 'vr2' });

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'CONFIRMED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                customer: { id: 'c1' },
                yard: { id: 'y1' },
              },
              visitOutcome: null,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitOutcome: { create: vi.fn().mockResolvedValue({ id: 'vo1' }) },
          visitRequest: { create: mockVrCreate, update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn() },
          horse: { updateMany: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await visitOutcomeService.completeAppointment('appt1', {
        followUpRequired: true,
        followUpDueDate: '2026-06-01',
      });

      expect(result.followUpVisitRequestId).toBe('vr2');
      expect(mockVrCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'c1',
          requestType: 'FOLLOW_UP',
          planningStatus: 'PLANNING_POOL',
        }),
      });
    });

    it('updates horse dental due dates when provided', async () => {
      const mockHorseUpdate = vi.fn().mockResolvedValue({});

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'CONFIRMED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                customer: { id: 'c1' },
                yard: { id: 'y1' },
              },
              visitOutcome: null,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitOutcome: { create: vi.fn().mockResolvedValue({ id: 'vo1' }) },
          visitRequest: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn() },
          horse: { updateMany: mockHorseUpdate },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      await visitOutcomeService.completeAppointment('appt1', {
        nextDentalDueDate: '2027-05-01',
      });

      expect(mockHorseUpdate).toHaveBeenCalledWith({
        where: {
          customerId: 'c1',
          primaryYardId: 'y1',
        },
        data: { dentalDueDate: new Date('2027-05-01') },
      });
    });
  });
});
