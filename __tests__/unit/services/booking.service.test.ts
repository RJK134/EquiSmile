import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { bookingService } from '@/lib/services/booking.service';

describe('bookingService', () => {
  let mockRouteRunFindUnique: ReturnType<typeof vi.fn>;
  let mockAppointmentCreate: ReturnType<typeof vi.fn>;
  let mockVisitRequestUpdate: ReturnType<typeof vi.fn>;
  let mockRouteRunStopUpdate: ReturnType<typeof vi.fn>;
  let mockRouteRunUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRouteRunFindUnique = vi.fn();
    mockAppointmentCreate = vi.fn();
    mockVisitRequestUpdate = vi.fn();
    mockRouteRunStopUpdate = vi.fn();
    mockRouteRunUpdate = vi.fn();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        routeRun: { findUnique: mockRouteRunFindUnique, update: mockRouteRunUpdate },
        appointment: { create: mockAppointmentCreate },
        visitRequest: { update: mockVisitRequestUpdate },
        routeRunStop: { update: mockRouteRunStopUpdate },
      };
      return fn(tx);
    });
  });

  describe('bookRouteRun', () => {
    it('throws if route run not found', async () => {
      mockRouteRunFindUnique.mockResolvedValue(null);

      await expect(bookingService.bookRouteRun('rr1')).rejects.toThrow(
        'Route run not found'
      );
    });

    it('throws if route run is not APPROVED', async () => {
      mockRouteRunFindUnique.mockResolvedValue({
        id: 'rr1',
        status: 'PROPOSED',
        stops: [],
      });

      await expect(bookingService.bookRouteRun('rr1')).rejects.toThrow(
        'Route run must be APPROVED to book'
      );
    });

    it('creates appointments for all stops with visit requests', async () => {
      mockRouteRunFindUnique.mockResolvedValue({
        id: 'rr1',
        status: 'APPROVED',
        startTime: new Date('2026-05-01T09:00:00Z'),
        stops: [
          {
            id: 'stop1',
            sequenceNo: 1,
            visitRequestId: 'vr1',
            plannedArrival: new Date('2026-05-01T09:00:00Z'),
            serviceMinutes: 60,
            visitRequest: {
              customer: { preferredChannel: 'WHATSAPP' },
            },
          },
          {
            id: 'stop2',
            sequenceNo: 2,
            visitRequestId: 'vr2',
            plannedArrival: new Date('2026-05-01T11:00:00Z'),
            serviceMinutes: 45,
            visitRequest: {
              customer: { preferredChannel: 'EMAIL' },
            },
          },
        ],
      });

      mockAppointmentCreate
        .mockResolvedValueOnce({ id: 'appt1' })
        .mockResolvedValueOnce({ id: 'appt2' });
      mockVisitRequestUpdate.mockResolvedValue({});
      mockRouteRunStopUpdate.mockResolvedValue({});
      mockRouteRunUpdate.mockResolvedValue({});

      const result = await bookingService.bookRouteRun('rr1');

      expect(result.routeRunId).toBe('rr1');
      expect(result.appointmentCount).toBe(2);
      expect(result.appointmentIds).toEqual(['appt1', 'appt2']);

      // Verify appointment creation
      expect(mockAppointmentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'vr1',
          routeRunId: 'rr1',
          status: 'PROPOSED',
          confirmationChannel: 'WHATSAPP',
        }),
      });

      expect(mockAppointmentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'vr2',
          confirmationChannel: 'EMAIL',
        }),
      });

      // Verify visit requests updated to BOOKED
      expect(mockVisitRequestUpdate).toHaveBeenCalledWith({
        where: { id: 'vr1' },
        data: { planningStatus: 'BOOKED' },
      });

      // Verify stops updated to CONFIRMED
      expect(mockRouteRunStopUpdate).toHaveBeenCalledWith({
        where: { id: 'stop1' },
        data: { stopStatus: 'CONFIRMED' },
      });

      // Verify route run updated to BOOKED
      expect(mockRouteRunUpdate).toHaveBeenCalledWith({
        where: { id: 'rr1' },
        data: { status: 'BOOKED' },
      });
    });

    it('skips stops without visit requests', async () => {
      mockRouteRunFindUnique.mockResolvedValue({
        id: 'rr1',
        status: 'APPROVED',
        startTime: new Date('2026-05-01T09:00:00Z'),
        stops: [
          {
            id: 'stop1',
            sequenceNo: 1,
            visitRequestId: null,
            visitRequest: null,
          },
        ],
      });
      mockRouteRunUpdate.mockResolvedValue({});

      const result = await bookingService.bookRouteRun('rr1');

      expect(result.appointmentCount).toBe(0);
      expect(mockAppointmentCreate).not.toHaveBeenCalled();
    });

    it('uses Prisma transaction for atomicity', async () => {
      mockRouteRunFindUnique.mockResolvedValue({
        id: 'rr1',
        status: 'APPROVED',
        stops: [],
      });
      mockRouteRunUpdate.mockResolvedValue({});

      await bookingService.bookRouteRun('rr1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
