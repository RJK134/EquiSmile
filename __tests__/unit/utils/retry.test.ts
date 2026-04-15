/**
 * Phase 7 Tests — Retry wrapper, circuit breaker, and idempotency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  RetryError,
  CircuitBreaker,
  generateIdempotencyKey,
  hasBeenProcessed,
  markAsProcessed,
  clearProcessedKeys,
} from '@/lib/utils/retry';

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      operationName: 'test',
    });

    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw RetryError after all attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        operationName: 'test',
      }),
    ).rejects.toThrow(RetryError);

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should respect non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('auth error'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        isRetryable: () => false,
      }),
    ).rejects.toThrow(RetryError);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should work with circuit breaker', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // First call should fail and record failure
    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1 }, cb),
    ).rejects.toThrow();

    // Second call should also fail
    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1 }, cb),
    ).rejects.toThrow();

    // Circuit should be open now — third call should fail immediately
    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1 }, cb),
    ).rejects.toThrow('Circuit open');
  });
});

describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.currentState).toBe('closed');
    expect(cb.canExecute()).toBe(true);
  });

  it('should open after failure threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    expect(cb.currentState).toBe('closed');
    cb.recordFailure();
    expect(cb.currentState).toBe('open');
    expect(cb.canExecute()).toBe(false);
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.currentState).toBe('closed');
  });

  it('should transition to half-open after reset timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
    cb.recordFailure();
    expect(cb.currentState).toBe('open');

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.currentState).toBe('half-open');
    expect(cb.canExecute()).toBe(true);
  });
});

describe('Idempotency', () => {
  beforeEach(() => {
    clearProcessedKeys();
  });

  it('should generate deterministic keys', () => {
    const key1 = generateIdempotencyKey('confirmation', 'appt-123');
    const key2 = generateIdempotencyKey('confirmation', 'appt-123');
    expect(key1).toBe(key2);
    expect(key1).toBe('confirmation:appt-123');
  });

  it('should track processed keys', () => {
    const key = generateIdempotencyKey('test', 'id-1');
    expect(hasBeenProcessed(key)).toBe(false);
    markAsProcessed(key);
    expect(hasBeenProcessed(key)).toBe(true);
  });

  it('should clear all processed keys', () => {
    markAsProcessed('key1');
    markAsProcessed('key2');
    expect(hasBeenProcessed('key1')).toBe(true);
    clearProcessedKeys();
    expect(hasBeenProcessed('key1')).toBe(false);
    expect(hasBeenProcessed('key2')).toBe(false);
  });
});
