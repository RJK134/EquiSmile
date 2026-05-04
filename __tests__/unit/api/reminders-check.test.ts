/**
 * Coverage for GET /api/reminders/check after Phase A wired three new
 * dispatch paths (dental due, vaccination due, overdue-invoice WhatsApp)
 * alongside the existing 24h/2h appointment reminders.
 *
 * Hard requirement: a single dispatch failing must not abort the others.
 * The route wraps each dispatch in its own try/catch and surfaces errors
 * via the response body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const checkAndSendRemindersMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const dispatchDentalMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const dispatchVaccinationMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const dispatchOverdueInvoiceMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('@/lib/services/reminder.service', () => ({
  reminderService: {
    checkAndSendReminders: checkAndSendRemindersMock,
    dispatchDentalDueReminders: dispatchDentalMock,
    dispatchVaccinationDueReminders: dispatchVaccinationMock,
    dispatchOverdueInvoiceReminders: dispatchOverdueInvoiceMock,
  },
}));

vi.mock('@/lib/utils/signature', () => ({
  requireN8nApiKey: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  rateLimiter: vi.fn(() => ({ check: () => ({ allowed: true }) })),
  clientKeyFromRequest: vi.fn(() => 'k'),
  rateLimitedResponse: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { N8N_API_KEY: 'test-key', DEMO_MODE: 'true' },
}));

describe('GET /api/reminders/check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all five dispatch paths (2 appointment + 3 customer-facing)', async () => {
    const { GET } = await import('@/app/api/reminders/check/route');
    const request = new NextRequest('http://localhost:3000/api/reminders/check', {
      headers: { authorization: 'Bearer test-key' },
    });
    await GET(request);

    expect(checkAndSendRemindersMock).toHaveBeenCalledTimes(1);
    expect(dispatchDentalMock).toHaveBeenCalledTimes(1);
    expect(dispatchVaccinationMock).toHaveBeenCalledTimes(1);
    expect(dispatchOverdueInvoiceMock).toHaveBeenCalledTimes(1);
  });

  it('continues running other dispatches when one throws', async () => {
    dispatchDentalMock.mockRejectedValueOnce(new Error('DB unreachable'));

    const { GET } = await import('@/app/api/reminders/check/route');
    const request = new NextRequest('http://localhost:3000/api/reminders/check', {
      headers: { authorization: 'Bearer test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    // The dental dispatch failed; the others must still have been called.
    expect(dispatchVaccinationMock).toHaveBeenCalledTimes(1);
    expect(dispatchOverdueInvoiceMock).toHaveBeenCalledTimes(1);
    expect(checkAndSendRemindersMock).toHaveBeenCalledTimes(1);
    // Response surfaces the error array.
    expect(body.errors).toBeDefined();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ kind: 'dental', message: 'DB unreachable' }),
    );
  });

  it('reports total counts in the message', async () => {
    checkAndSendRemindersMock.mockResolvedValueOnce([
      { sent: true }, { sent: false },
    ]);
    dispatchDentalMock.mockResolvedValueOnce([{ sent: true }]);
    dispatchOverdueInvoiceMock.mockResolvedValueOnce([{ sent: true }, { sent: true }]);

    const { GET } = await import('@/app/api/reminders/check/route');
    const request = new NextRequest('http://localhost:3000/api/reminders/check', {
      headers: { authorization: 'Bearer test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    // 2 appointment + 1 dental + 0 vaccination + 2 invoice = 5 processed; 4 sent
    expect(body.message).toContain('5 reminders');
    expect(body.message).toContain('4 sent');
  });

  it('groups results by dispatch kind in the response body', async () => {
    checkAndSendRemindersMock.mockResolvedValueOnce([{ id: 'a1' }]);
    dispatchDentalMock.mockResolvedValueOnce([{ id: 'd1' }]);
    dispatchVaccinationMock.mockResolvedValueOnce([{ id: 'v1' }]);
    dispatchOverdueInvoiceMock.mockResolvedValueOnce([{ id: 'i1' }]);

    const { GET } = await import('@/app/api/reminders/check/route');
    const request = new NextRequest('http://localhost:3000/api/reminders/check', {
      headers: { authorization: 'Bearer test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.appointment).toEqual([{ id: 'a1' }]);
    expect(body.data.dental).toEqual([{ id: 'd1' }]);
    expect(body.data.vaccination).toEqual([{ id: 'v1' }]);
    expect(body.data.invoiceOverdue).toEqual([{ id: 'i1' }]);
  });
});
