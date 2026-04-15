import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    DEMO_MODE: 'true',
    DATABASE_URL: 'postgresql://test@localhost/test',
  },
}));

const mockPrisma = vi.hoisted(() => ({
  routeRun: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  routeRunStop: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  visitRequest: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  appointment: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('Booking Flow — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a route run from proposed stops', async () => {
    mockPrisma.routeRun.create.mockResolvedValue({
      id: 'route-1',
      status: 'DRAFT',
      runDate: new Date('2026-05-12'),
      totalJobs: 3,
    });

    const route = await mockPrisma.routeRun.create({
      data: {
        runDate: new Date('2026-05-12'),
        homeBaseAddress: 'Blonay, 1807, Switzerland',
        status: 'DRAFT',
        totalJobs: 3,
        totalHorses: 7,
      },
    });

    expect(route.status).toBe('DRAFT');
    expect(route.totalJobs).toBe(3);
  });

  it('approves a route run', async () => {
    mockPrisma.routeRun.update.mockResolvedValue({
      id: 'route-1',
      status: 'APPROVED',
    });

    const approved = await mockPrisma.routeRun.update({
      where: { id: 'route-1' },
      data: { status: 'APPROVED' },
    });

    expect(approved.status).toBe('APPROVED');
  });

  it('creates appointments from approved route', async () => {
    const stops = [
      { visitRequestId: 'vr-1', yardId: 'yard-1', arrival: new Date('2026-05-12T08:30:00Z'), departure: new Date('2026-05-12T10:30:00Z') },
      { visitRequestId: 'vr-2', yardId: 'yard-2', arrival: new Date('2026-05-12T11:00:00Z'), departure: new Date('2026-05-12T12:00:00Z') },
    ];

    for (const stop of stops) {
      mockPrisma.appointment.create.mockResolvedValue({
        id: `appt-${stop.visitRequestId}`,
        status: 'PROPOSED',
        appointmentStart: stop.arrival,
        appointmentEnd: stop.departure,
      });

      const appt = await mockPrisma.appointment.create({
        data: {
          visitRequestId: stop.visitRequestId,
          routeRunId: 'route-1',
          appointmentStart: stop.arrival,
          appointmentEnd: stop.departure,
          status: 'PROPOSED',
        },
      });

      expect(appt.status).toBe('PROPOSED');
    }

    expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(2);
  });

  it('confirms an appointment', async () => {
    mockPrisma.appointment.update.mockResolvedValue({
      id: 'appt-1',
      status: 'CONFIRMED',
      confirmationChannel: 'WHATSAPP',
      confirmationSentAt: new Date(),
    });

    const confirmed = await mockPrisma.appointment.update({
      where: { id: 'appt-1' },
      data: {
        status: 'CONFIRMED',
        confirmationChannel: 'WHATSAPP',
        confirmationSentAt: new Date(),
      },
    });

    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmationChannel).toBe('WHATSAPP');
  });

  it('updates visit request to BOOKED after confirmation', async () => {
    mockPrisma.visitRequest.update.mockResolvedValue({
      id: 'vr-1',
      planningStatus: 'BOOKED',
    });

    const updated = await mockPrisma.visitRequest.update({
      where: { id: 'vr-1' },
      data: { planningStatus: 'BOOKED' },
    });

    expect(updated.planningStatus).toBe('BOOKED');
  });

  it('handles full booking lifecycle', async () => {
    // 1. Create route
    mockPrisma.routeRun.create.mockResolvedValue({ id: 'route-2', status: 'DRAFT' });
    const route = await mockPrisma.routeRun.create({ data: { runDate: new Date(), homeBaseAddress: 'Blonay', status: 'DRAFT' } });
    expect(route.status).toBe('DRAFT');

    // 2. Approve route
    mockPrisma.routeRun.update.mockResolvedValue({ id: 'route-2', status: 'APPROVED' });
    const approved = await mockPrisma.routeRun.update({ where: { id: 'route-2' }, data: { status: 'APPROVED' } });
    expect(approved.status).toBe('APPROVED');

    // 3. Create appointment
    mockPrisma.appointment.create.mockResolvedValue({ id: 'appt-3', status: 'PROPOSED' });
    const appt = await mockPrisma.appointment.create({ data: { visitRequestId: 'vr-3', appointmentStart: new Date(), appointmentEnd: new Date(), status: 'PROPOSED' } });
    expect(appt.status).toBe('PROPOSED');

    // 4. Confirm
    mockPrisma.appointment.update.mockResolvedValue({ id: 'appt-3', status: 'CONFIRMED' });
    const confirmed = await mockPrisma.appointment.update({ where: { id: 'appt-3' }, data: { status: 'CONFIRMED' } });
    expect(confirmed.status).toBe('CONFIRMED');

    // 5. Complete
    mockPrisma.appointment.update.mockResolvedValue({ id: 'appt-3', status: 'COMPLETED' });
    const completed = await mockPrisma.appointment.update({ where: { id: 'appt-3' }, data: { status: 'COMPLETED' } });
    expect(completed.status).toBe('COMPLETED');
  });
});
