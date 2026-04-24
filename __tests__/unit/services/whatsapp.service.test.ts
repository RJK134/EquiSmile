import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the deterministic-operationKey idempotency contract introduced
// in the hardening pass. The previous implementation mixed `Date.now()`
// into the key, which meant a retrying cron re-minted a "fresh" key
// every call and duplicate customer sends could go out. These tests
// lock in the new guarantee:
//  - no key  → every call attempts a send (caller accepted the risk)
//  - same key → a second call short-circuits with success:true

vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_ACCESS_TOKEN: 'access-token',
    WHATSAPP_API_TOKEN: '',
  },
}));

const hasBeenProcessedMock = vi.hoisted(() => vi.fn());
const markAsProcessedMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/utils/retry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/retry')>('@/lib/utils/retry');
  return {
    ...actual,
    // Let withRetry invoke the inner function and return its data once —
    // no backoff, no circuit-breaker side effects — so the test can
    // control the fetch.
    withRetry: async (fn: (signal?: AbortSignal) => Promise<unknown>) => {
      const data = await fn();
      return { data, attempts: 1 };
    },
    hasBeenProcessed: hasBeenProcessedMock,
    markAsProcessed: markAsProcessedMock,
  };
});

const logMessageMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: { logMessage: logMessageMock },
}));

const enqueueDeadLetterMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/dead-letter.service', () => ({
  deadLetterService: { enqueue: enqueueDeadLetterMock },
}));

import { whatsappService } from '@/lib/services/whatsapp.service';

function mockSuccessfulFetch(messageId = 'wamid-1') {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ messages: [{ id: messageId }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  hasBeenProcessedMock.mockResolvedValue(false);
  markAsProcessedMock.mockResolvedValue(undefined);
});

describe('whatsappService.sendTextMessage — idempotency', () => {
  it('performs a real send when no operationKey is supplied (no dedup lookup)', async () => {
    mockSuccessfulFetch();
    const result = await whatsappService.sendTextMessage('+44700', 'hi', 'enq-1', 'en');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid-1');
    expect(hasBeenProcessedMock).not.toHaveBeenCalled();
    expect(markAsProcessedMock).not.toHaveBeenCalled();
  });

  it('short-circuits with success when the operationKey is already marked processed', async () => {
    hasBeenProcessedMock.mockResolvedValue(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await whatsappService.sendTextMessage(
      '+44700', 'hi', 'enq-1', 'en', { operationKey: 'wa-confirmation:appt-1' },
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(markAsProcessedMock).not.toHaveBeenCalled();
    expect(hasBeenProcessedMock).toHaveBeenCalledWith('wa-text:wa-confirmation:appt-1');
  });

  it('records the operationKey as processed after a successful send', async () => {
    mockSuccessfulFetch('wamid-2');
    const result = await whatsappService.sendTextMessage(
      '+44700', 'reminder', 'enq-9', 'en', { operationKey: 'wa-reminder-24h:appt-9' },
    );
    expect(result.success).toBe(true);
    expect(markAsProcessedMock).toHaveBeenCalledWith('wa-text:wa-reminder-24h:appt-9', 'wa-text');
    expect(logMessageMock).toHaveBeenCalled();
  });

  it('does not treat two different operationKeys as duplicates (Date.now regression)', async () => {
    // Simulate two logically-distinct sends (same phone + enquiry but
    // different operations — e.g. 24h reminder then 2h reminder). Both
    // must go out; neither dedup lookup should return true.
    mockSuccessfulFetch('wamid-a');
    await whatsappService.sendTextMessage(
      '+44700', 'hello', 'enq-1', 'en', { operationKey: 'wa-reminder-24h:appt-1' },
    );
    mockSuccessfulFetch('wamid-b');
    await whatsappService.sendTextMessage(
      '+44700', 'hello', 'enq-1', 'en', { operationKey: 'wa-reminder-2h:appt-1' },
    );

    const calledKeys = hasBeenProcessedMock.mock.calls.map((c) => c[0]);
    expect(calledKeys).toEqual([
      'wa-text:wa-reminder-24h:appt-1',
      'wa-text:wa-reminder-2h:appt-1',
    ]);
    // Both calls proceeded to mark processed — i.e. both sends happened.
    expect(markAsProcessedMock).toHaveBeenCalledTimes(2);
  });
});
