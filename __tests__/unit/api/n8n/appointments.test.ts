import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// n8n-authenticated appointment routes exist because the browser-session
// endpoints (`/api/appointments/*`) now call requireRole(VET), which
// automation cannot satisfy. These mirrors accept N8N_API_KEY Bearer
// tokens instead and write `actor: 'n8n'` into the audit trail.

vi.mock('@/lib/env', () => ({
  env: {
    N8N_API_KEY: 'test-api-key',
    DEMO_MODE: 'false',
  },
}));

const bookRouteRunMock = vi.hoisted(() => vi.fn());
const sendConfirmationsMock = vi.hoisted(() => vi.fn());
const cancelAppointmentMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/booking.service', () => ({
  bookingService: { bookRouteRun: bookRouteRunMock },
}));

vi.mock('@/lib/services/confirmation.service', () => ({
  confirmationService: { sendConfirmationsForRouteRun: sendConfirmationsMock },
}));

vi.mock('@/lib/services/reschedule.service', () => ({
  rescheduleService: { cancelAppointment: cancelAppointmentMock },
}));

function authedPost(path: string, body: unknown, apiKey: string | null = 'test-api-key'): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  bookRouteRunMock.mockResolvedValue({ routeRunId: 'r1', appointmentIds: ['a1'], appointmentCount: 1 });
  sendConfirmationsMock.mockResolvedValue([]);
  cancelAppointmentMock.mockResolvedValue({ appointmentId: 'a1', cancelled: true, returnedToPool: true });
});

describe('POST /api/n8n/appointments/from-route/[routeRunId]', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const { POST } = await import('@/app/api/n8n/appointments/from-route/[routeRunId]/route');
    const response = await POST(authedPost('/api/n8n/appointments/from-route/r1', {}, null), {
      params: Promise.resolve({ routeRunId: 'r1' }),
    });
    expect(response.status).toBe(401);
    expect(bookRouteRunMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong key with 401', async () => {
    const { POST } = await import('@/app/api/n8n/appointments/from-route/[routeRunId]/route');
    const response = await POST(authedPost('/api/n8n/appointments/from-route/r1', {}, 'bad-key'), {
      params: Promise.resolve({ routeRunId: 'r1' }),
    });
    expect(response.status).toBe(401);
  });

  it('books the route and stamps the confirmation fan-out with actor "n8n"', async () => {
    const { POST } = await import('@/app/api/n8n/appointments/from-route/[routeRunId]/route');
    const response = await POST(authedPost('/api/n8n/appointments/from-route/r1', {}), {
      params: Promise.resolve({ routeRunId: 'r1' }),
    });
    expect(response.status).toBe(201);
    expect(bookRouteRunMock).toHaveBeenCalledWith('r1');
    expect(sendConfirmationsMock).toHaveBeenCalledWith('r1', { actor: 'n8n' });
  });
});

describe('POST /api/n8n/appointments/[id]/cancel', () => {
  it('rejects unauthenticated with 401', async () => {
    const { POST } = await import('@/app/api/n8n/appointments/[id]/cancel/route');
    const response = await POST(authedPost('/api/n8n/appointments/a1/cancel', {}, null), {
      params: Promise.resolve({ id: 'a1' }),
    });
    expect(response.status).toBe(401);
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it('cancels with actor "n8n" on a valid key', async () => {
    const { POST } = await import('@/app/api/n8n/appointments/[id]/cancel/route');
    const response = await POST(
      authedPost('/api/n8n/appointments/a1/cancel', { reason: 'customer phoned' }),
      { params: Promise.resolve({ id: 'a1' }) },
    );
    expect(response.status).toBe(200);
    expect(cancelAppointmentMock).toHaveBeenCalledWith('a1', 'customer phoned', { actor: 'n8n' });
  });
});
