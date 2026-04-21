import { describe, it, expect, vi, beforeEach } from 'vitest';

const dispatchCreate = vi.hoisted(() => vi.fn());
const responseCreate = vi.hoisted(() => vi.fn());
const statusHistoryCreate = vi.hoisted(() => vi.fn());
const dispatchFindMany = vi.hoisted(() => vi.fn());
const responseFindMany = vi.hoisted(() => vi.fn());
const statusHistoryFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    confirmationDispatch: { create: dispatchCreate, findMany: dispatchFindMany },
    appointmentResponse: { create: responseCreate, findMany: responseFindMany },
    appointmentStatusHistory: { create: statusHistoryCreate, findMany: statusHistoryFindMany },
  },
}));

import { appointmentAuditService } from '@/lib/services/appointment-audit.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logConfirmationDispatch', () => {
  it('writes a dispatch row with channel + success + optional error', async () => {
    dispatchCreate.mockResolvedValue({ id: 'd1' });
    await appointmentAuditService.logConfirmationDispatch({
      appointmentId: 'a1',
      channel: 'EMAIL',
      success: false,
      errorMessage: 'SMTP rejected',
    });
    expect(dispatchCreate).toHaveBeenCalledWith({
      data: {
        appointmentId: 'a1',
        channel: 'EMAIL',
        success: false,
        externalMessageId: null,
        errorMessage: 'SMTP rejected',
      },
    });
  });

  it('does not throw when the DB write fails (best-effort)', async () => {
    dispatchCreate.mockRejectedValue(new Error('db down'));
    await expect(
      appointmentAuditService.logConfirmationDispatch({
        appointmentId: 'a1',
        channel: 'WHATSAPP',
        success: true,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('logResponse', () => {
  it('records inbound customer reply with kind + channel', async () => {
    responseCreate.mockResolvedValue({ id: 'r1' });
    await appointmentAuditService.logResponse({
      appointmentId: 'a1',
      kind: 'CONFIRMED',
      channel: 'WHATSAPP',
      rawText: 'yes',
      enquiryMessageId: 'em1',
    });
    expect(responseCreate).toHaveBeenCalledWith({
      data: {
        appointmentId: 'a1',
        kind: 'CONFIRMED',
        channel: 'WHATSAPP',
        rawText: 'yes',
        enquiryMessageId: 'em1',
      },
    });
  });
});

describe('logStatusChange', () => {
  it('skips no-op transitions (same from/to)', async () => {
    await appointmentAuditService.logStatusChange({
      appointmentId: 'a1',
      fromStatus: 'PROPOSED',
      toStatus: 'PROPOSED',
      changedBy: 'vet1',
    });
    expect(statusHistoryCreate).not.toHaveBeenCalled();
  });

  it('records a real transition with actor + optional reason', async () => {
    statusHistoryCreate.mockResolvedValue({ id: 'h1' });
    await appointmentAuditService.logStatusChange({
      appointmentId: 'a1',
      fromStatus: 'PROPOSED',
      toStatus: 'CANCELLED',
      changedBy: 'rjk134',
      reason: 'customer phoned to cancel',
    });
    expect(statusHistoryCreate).toHaveBeenCalledWith({
      data: {
        appointmentId: 'a1',
        fromStatus: 'PROPOSED',
        toStatus: 'CANCELLED',
        changedBy: 'rjk134',
        reason: 'customer phoned to cancel',
      },
    });
  });

  it('records an initial null → status transition', async () => {
    statusHistoryCreate.mockResolvedValue({ id: 'h2' });
    await appointmentAuditService.logStatusChange({
      appointmentId: 'a1',
      fromStatus: null,
      toStatus: 'PROPOSED',
      changedBy: 'system',
    });
    expect(statusHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: null, toStatus: 'PROPOSED' }),
      }),
    );
  });
});
