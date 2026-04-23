import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWebhookErrorSink } from '@/lib/observability/webhook-error-sink';

describe('createWebhookErrorSink', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let nowValue: number;
  const now = () => nowValue;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    nowValue = 1_000_000;
  });

  it('POSTs a JSON payload to the configured URL', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    sink({ message: 'db down', error: new Error('ECONNREFUSED') });

    // Fire-and-forget — flush microtask queue so the post runs.
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://collector.example.com/hook');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      service: 'equismile',
      message: 'db down',
      error: { name: 'Error', message: 'ECONNREFUSED' },
    });
  });

  it('attaches a bearer token when configured', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      token: 'abc123',
      fetchImpl: fetchMock,
      now,
    });

    sink({ message: 'hi' });
    await new Promise((resolve) => setImmediate(resolve));

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['authorization']).toBe(
      'Bearer abc123',
    );
  });

  it('dedupes repeated errors within the 60-second window', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    sink({ message: 'repeat', error: new Error('boom') });
    sink({ message: 'repeat', error: new Error('boom') });
    sink({ message: 'repeat', error: new Error('boom') });

    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends again after the dedupe window elapses', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    sink({ message: 'repeat', error: new Error('boom') });
    await new Promise((resolve) => setImmediate(resolve));

    // Advance clock past the 60 s dedupe window.
    nowValue += 61_000;

    sink({ message: 'repeat', error: new Error('boom') });
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('redacts sensitive keys from context', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    sink({
      message: 'unauth',
      context: {
        authorization: 'Bearer super-secret',
        userId: 'u1',
      },
    });

    await new Promise((resolve) => setImmediate(resolve));
    const body = JSON.parse(
      fetchMock.mock.calls[0][1]!.body as string,
    );
    expect(body.context.authorization).toBe('[redacted]');
    expect(body.context.userId).toBe('u1');
  });

  it('emits VALID JSON and drops context when the payload would exceed the cap', async () => {
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    // 4KB of context — guaranteed to blow past the 2KB cap.
    const fatContext = { blob: 'A'.repeat(4_000) };
    sink({ message: 'big', context: fatContext });

    await new Promise((resolve) => setImmediate(resolve));
    const rawBody = fetchMock.mock.calls[0][1]!.body as string;

    // Must be parseable JSON. The old implementation produced a
    // mid-string slice that Slack/Sentry would reject with a 400.
    const parsed = JSON.parse(rawBody);
    expect(parsed.message).toBe('big');
    expect(parsed.body_truncated).toBe(true);
    expect(parsed.context).toBeUndefined();
    expect(rawBody.length).toBeLessThanOrEqual(2_048);
  });

  it('never throws when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const sink = createWebhookErrorSink({
      url: 'https://collector.example.com/hook',
      fetchImpl: fetchMock,
      now,
    });

    expect(() => sink({ message: 'x' })).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).toHaveBeenCalled();
  });
});
