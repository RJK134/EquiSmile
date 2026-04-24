import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Appointment mutation endpoints were previously wide open to any
// signed-in user — including a 'readonly' session — because the route
// handlers delegated to services without calling `requireRole`. Each
// handler now gates on ROLES.VET and threads the real actor into the
// audit trail. This suite locks both behaviours in.

const requireRoleMock = vi.hoisted(() => vi.fn());
const confirmationSendMock = vi.hoisted(() => vi.fn());
const confirmationSendForRouteMock = vi.hoisted(() => vi.fn());
const cancelAppointmentMock = vi.hoisted(() => vi.fn());
const rescheduleAppointmentMock = vi.hoisted(() => vi.fn());
const markNoShowMock = vi.hoisted(() => vi.fn());
const completeAppointmentMock = vi.hoisted(() => vi.fn());
const bookRouteRunMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/rbac')>('@/lib/auth/rbac');
  return { ...actual, requireRole: requireRoleMock };
});

import { AuthzError } from '@/lib/auth/rbac';

vi.mock('@/lib/services/confirmation.service', () => ({
  confirmationService: {
    sendConfirmation: confirmationSendMock,
    sendConfirmationsForRouteRun: confirmationSendForRouteMock,
  },
}));

vi.mock('@/lib/services/reschedule.service', () => ({
  rescheduleService: {
    cancelAppointment: cancelAppointmentMock,
    rescheduleAppointment: rescheduleAppointmentMock,
    markNoShow: markNoShowMock,
  },
}));

vi.mock('@/lib/services/visit-outcome.service', () => ({
  visitOutcomeService: {
    completeAppointment: completeAppointmentMock,
  },
}));

vi.mock('@/lib/services/booking.service', () => ({
  bookingService: {
    bookRouteRun: bookRouteRunMock,
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

function signedInAs(role: 'admin' | 'vet' | 'nurse' | 'readonly') {
  requireRoleMock.mockImplementation(async (required: 'admin' | 'vet' | 'nurse' | 'readonly') => {
    const rank = { readonly: 1, nurse: 2, vet: 3, admin: 4 } as const;
    if (rank[role] < rank[required]) {
      throw new AuthzError(`Insufficient role: ${required} required`, 403);
    }
    return {
      id: 'u1',
      email: 'vet@example.com',
      githubLogin: 'rjk134',
      role,
      actorLabel: 'rjk134',
    };
  });
}

function postJson(path: string, body: unknown = {}): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('appointment mutations — RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmationSendMock.mockResolvedValue({ appointmentId: 'a1', sent: true, channel: 'EMAIL' });
    confirmationSendForRouteMock.mockResolvedValue([]);
    cancelAppointmentMock.mockResolvedValue({ appointmentId: 'a1', cancelled: true, returnedToPool: true });
    rescheduleAppointmentMock.mockResolvedValue({
      appointmentId: 'a1', cancelled: true, returnedToPool: true, note: 'Rescheduled',
    });
    markNoShowMock.mockResolvedValue(undefined);
    completeAppointmentMock.mockResolvedValue({ appointmentId: 'a1', visitOutcomeId: 'vo1' });
    bookRouteRunMock.mockResolvedValue({ routeRunId: 'r1', appointmentIds: [], appointmentCount: 0 });
  });

  describe('readonly is forbidden from every mutation', () => {
    beforeEach(() => signedInAs('readonly'));

    it('POST /api/appointments/[id]/confirm → 403', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/confirm/route');
      const response = await POST(postJson('/api/appointments/a1/confirm'), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(403);
      expect(confirmationSendMock).not.toHaveBeenCalled();
    });

    it('POST /api/appointments/[id]/cancel → 403', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/cancel/route');
      const response = await POST(postJson('/api/appointments/a1/cancel', { reason: 'x' }), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(403);
      expect(cancelAppointmentMock).not.toHaveBeenCalled();
    });

    it('POST /api/appointments/[id]/reschedule → 403', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/reschedule/route');
      const response = await POST(postJson('/api/appointments/a1/reschedule', { notes: 'x' }), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(403);
      expect(rescheduleAppointmentMock).not.toHaveBeenCalled();
    });

    it('POST /api/appointments/[id]/complete → 403', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/complete/route');
      const response = await POST(postJson('/api/appointments/a1/complete', {}), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(403);
      expect(completeAppointmentMock).not.toHaveBeenCalled();
    });

    it('POST /api/appointments/[id]/no-show → 403', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/no-show/route');
      const response = await POST(postJson('/api/appointments/a1/no-show'), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(403);
      expect(markNoShowMock).not.toHaveBeenCalled();
    });

    it('POST /api/appointments/from-route/[routeRunId] → 403', async () => {
      const { POST } = await import('@/app/api/appointments/from-route/[routeRunId]/route');
      const response = await POST(postJson('/api/appointments/from-route/r1'), {
        params: Promise.resolve({ routeRunId: 'r1' }),
      });
      expect(response.status).toBe(403);
      expect(bookRouteRunMock).not.toHaveBeenCalled();
    });
  });

  describe('vet is permitted and the actor is threaded into the service call', () => {
    beforeEach(() => signedInAs('vet'));

    it('confirm passes the actor label into confirmationService.sendConfirmation', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/confirm/route');
      const response = await POST(postJson('/api/appointments/a1/confirm'), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(200);
      expect(confirmationSendMock).toHaveBeenCalledWith('a1', { actor: 'rjk134' });
    });

    it('cancel passes the actor into rescheduleService.cancelAppointment', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/cancel/route');
      const response = await POST(postJson('/api/appointments/a1/cancel', { reason: 'customer' }), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(200);
      expect(cancelAppointmentMock).toHaveBeenCalledWith('a1', 'customer', { actor: 'rjk134' });
    });

    it('reschedule passes the actor into rescheduleService.rescheduleAppointment', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/reschedule/route');
      const response = await POST(postJson('/api/appointments/a1/reschedule', { notes: 'later' }), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(200);
      expect(rescheduleAppointmentMock).toHaveBeenCalledWith('a1', 'later', { actor: 'rjk134' });
    });

    it('complete passes the actor into visitOutcomeService.completeAppointment', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/complete/route');
      const response = await POST(postJson('/api/appointments/a1/complete', { notes: 'ok' }), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(200);
      expect(completeAppointmentMock).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ notes: 'ok' }),
        { actor: 'rjk134' },
      );
    });

    it('no-show passes the actor into rescheduleService.markNoShow', async () => {
      const { POST } = await import('@/app/api/appointments/[id]/no-show/route');
      const response = await POST(postJson('/api/appointments/a1/no-show'), {
        params: Promise.resolve({ id: 'a1' }),
      });
      expect(response.status).toBe(200);
      expect(markNoShowMock).toHaveBeenCalledWith('a1', { actor: 'rjk134' });
    });

    it('from-route books and threads actor into confirmation fan-out', async () => {
      const { POST } = await import('@/app/api/appointments/from-route/[routeRunId]/route');
      const response = await POST(postJson('/api/appointments/from-route/r1'), {
        params: Promise.resolve({ routeRunId: 'r1' }),
      });
      expect(response.status).toBe(201);
      expect(bookRouteRunMock).toHaveBeenCalledWith('r1');
      expect(confirmationSendForRouteMock).toHaveBeenCalledWith('r1', { actor: 'rjk134' });
    });
  });
});
