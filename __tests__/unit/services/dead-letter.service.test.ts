import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    failedOperation: {
      create: createMock,
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

import { deadLetterService } from '@/lib/services/dead-letter.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deadLetterService.enqueue', () => {
  it('serialises payload through redact before storing', async () => {
    createMock.mockResolvedValue({ id: 'f1' });
    await deadLetterService.enqueue({
      scope: 'whatsapp-send-text',
      payload: { to: '+41799', authorization: 'Bearer sk-xxx', enquiryId: 'e1' },
      lastError: new Error('upstream 503'),
      operationKey: 'wa-text:e1',
    });
    const call = createMock.mock.calls[0][0];
    expect(call.data.scope).toBe('whatsapp-send-text');
    expect(call.data.lastError).toBe('upstream 503');
    expect(call.data.operationKey).toBe('wa-text:e1');
    // Sensitive fields scrubbed by redact().
    expect(call.data.payload).toContain('[redacted]');
    expect(call.data.payload).not.toContain('sk-xxx');
  });

  it('caps payload and error lengths', async () => {
    createMock.mockResolvedValue({ id: 'f2' });
    const bigPayload = { junk: 'x'.repeat(20_000) };
    await deadLetterService.enqueue({
      scope: 's',
      payload: bigPayload,
      lastError: 'y'.repeat(5_000),
    });
    const call = createMock.mock.calls[0][0];
    expect(call.data.payload.length).toBeLessThanOrEqual(8_000);
    expect(call.data.lastError.length).toBeLessThanOrEqual(2_000);
  });

  it('does not throw when the DB write fails (best-effort)', async () => {
    createMock.mockRejectedValue(new Error('db down'));
    await expect(
      deadLetterService.enqueue({ scope: 's', payload: {}, lastError: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('accepts a non-Error lastError and stringifies it', async () => {
    createMock.mockResolvedValue({ id: 'f3' });
    await deadLetterService.enqueue({ scope: 's', payload: {}, lastError: 'plain string' });
    expect(createMock.mock.calls[0][0].data.lastError).toBe('plain string');
  });
});

describe('deadLetterService.list', () => {
  it('clamps limit between 1 and 500', async () => {
    findManyMock.mockResolvedValue([]);
    await deadLetterService.list({ limit: 0 });
    expect(findManyMock.mock.calls[0][0].take).toBe(1);
    await deadLetterService.list({ limit: 9999 });
    expect(findManyMock.mock.calls[1][0].take).toBe(500);
    await deadLetterService.list();
    expect(findManyMock.mock.calls[2][0].take).toBe(50);
  });

  it('filters by status + scope when provided', async () => {
    findManyMock.mockResolvedValue([]);
    await deadLetterService.list({ status: 'PENDING', scope: 'email-send' });
    expect(findManyMock.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      scope: 'email-send',
    });
  });
});

describe('deadLetterService.markStatus', () => {
  it('updates the row status', async () => {
    updateMock.mockResolvedValue({ id: 'f1', status: 'REPLAYED' });
    await deadLetterService.markStatus('f1', 'REPLAYED');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { status: 'REPLAYED' },
    });
  });
});
