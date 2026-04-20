import { describe, it, expect } from 'vitest';
import { rateLimiter, clientKeyFromRequest } from '@/lib/utils/rate-limit';

describe('rateLimiter', () => {
  it('allows requests up to max and blocks beyond', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 3, now: () => now });

    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    const blocked = limiter.check('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('sliding window — oldest hits age out', () => {
    let now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 2, now: () => now });

    limiter.check('k');
    now += 400;
    limiter.check('k');
    now += 200;
    expect(limiter.check('k').allowed).toBe(false); // within window

    now += 500; // first hit now ~1100ms old → expired
    expect(limiter.check('k').allowed).toBe(true);
  });

  it('keys are independent', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 1, now: () => now });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('remaining count decreases correctly', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 3, now: () => now });

    expect(limiter.check('k').remaining).toBe(2);
    expect(limiter.check('k').remaining).toBe(1);
    expect(limiter.check('k').remaining).toBe(0);
  });

  it('LRU-evicts the oldest key when maxKeys is hit', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 1, maxKeys: 2, now: () => now });
    limiter.check('a');
    limiter.check('b');
    expect(limiter.size()).toBe(2);
    limiter.check('c');
    expect(limiter.size()).toBe(2);
  });

  it('reset clears all buckets', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 1000, max: 1, now: () => now });
    limiter.check('a');
    expect(limiter.check('a').allowed).toBe(false);
    limiter.reset();
    expect(limiter.check('a').allowed).toBe(true);
  });

  it('retryAfterSeconds is at least 1', () => {
    const now = 1_000_000;
    const limiter = rateLimiter({ windowMs: 500, max: 1, now: () => now });
    limiter.check('k');
    const blocked = limiter.check('k');
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe('clientKeyFromRequest', () => {
  function req(headers: Record<string, string>): Request {
    return new Request('http://localhost/x', { headers });
  }

  it('prefers X-Forwarded-For (first entry)', () => {
    const key = clientKeyFromRequest(req({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }));
    expect(key).toBe('ip:203.0.113.5');
  });

  it('falls back to X-Real-IP when XFF absent', () => {
    const key = clientKeyFromRequest(req({ 'x-real-ip': '203.0.113.9' }));
    expect(key).toBe('ip:203.0.113.9');
  });

  it('falls back to ip:unknown when no trust proxy headers', () => {
    const key = clientKeyFromRequest(req({}));
    expect(key).toBe('ip:unknown');
  });

  it('prefix is configurable', () => {
    const key = clientKeyFromRequest(req({ 'x-forwarded-for': '10.0.0.1' }), 'wa-wh');
    expect(key).toBe('wa-wh:10.0.0.1');
  });
});
