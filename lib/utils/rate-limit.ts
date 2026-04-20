/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Scope: single Node.js process. If you scale the app horizontally the
 * per-instance counters drift — move to Redis/Postgres at that point
 * (see `lib/services/idempotency.service.ts` for the Postgres pattern).
 *
 * Design goals:
 *  - Zero external dependencies.
 *  - Per-route limiters with distinct windows/limits.
 *  - Deterministic results for unit tests (inject `now`).
 *
 * Typical usage from a route handler:
 *
 *   const limiter = rateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(`analyse:${userId}`);
 *   if (!result.allowed) return rateLimitedResponse(result);
 *   // ... do work ...
 */

import { NextResponse } from 'next/server';

export interface RateLimiterOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests per window per key. */
  max: number;
  /** Injected clock for tests. */
  now?: () => number;
  /** Maximum number of tracked keys (LRU-style eviction). Default 10_000. */
  maxKeys?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Remaining requests in the current window. 0 if blocked. */
  remaining: number;
  /** Epoch millis when the window resets for this key. */
  resetAt: number;
  /** Retry-After in whole seconds; present when `!allowed`. */
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  /** Reset all state — for tests. */
  reset(): void;
  /** Number of keys currently tracked — for tests. */
  size(): number;
}

interface Bucket {
  /** Array of request timestamps within the window. */
  hits: number[];
}

export function rateLimiter(options: RateLimiterOptions): RateLimiter {
  const windowMs = options.windowMs;
  const max = options.max;
  const maxKeys = options.maxKeys ?? 10_000;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function prune(bucket: Bucket, current: number) {
    const cutoff = current - windowMs;
    while (bucket.hits.length > 0 && bucket.hits[0] < cutoff) {
      bucket.hits.shift();
    }
  }

  return {
    check(key: string): RateLimitDecision {
      const current = now();

      // LRU-ish eviction: drop the oldest key when we exceed the cap.
      if (!buckets.has(key) && buckets.size >= maxKeys) {
        const firstKey = buckets.keys().next().value as string | undefined;
        if (firstKey) buckets.delete(firstKey);
      }

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { hits: [] };
        buckets.set(key, bucket);
      }

      prune(bucket, current);

      if (bucket.hits.length >= max) {
        const oldest = bucket.hits[0];
        const resetAt = oldest + windowMs;
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfterSeconds: Math.max(1, Math.ceil((resetAt - current) / 1000)),
        };
      }

      bucket.hits.push(current);

      return {
        allowed: true,
        remaining: max - bucket.hits.length,
        resetAt: current + windowMs,
      };
    },
    reset(): void {
      buckets.clear();
    },
    size(): number {
      return buckets.size;
    },
  };
}

/**
 * Standard 429 response with `Retry-After` + rate-limit headers.
 */
export function rateLimitedResponse(decision: RateLimitDecision): NextResponse {
  const response = NextResponse.json(
    { error: 'Too Many Requests' },
    { status: 429 },
  );
  response.headers.set('Retry-After', String(decision.retryAfterSeconds ?? 60));
  response.headers.set('X-RateLimit-Remaining', '0');
  response.headers.set('X-RateLimit-Reset', String(Math.floor(decision.resetAt / 1000)));
  return response;
}

/**
 * Best-effort client identifier from the request. Prefers
 * `X-Forwarded-For` (Caddy/nginx in front of the app) then
 * `X-Real-IP`, then falls back to a constant string so the limit still
 * applies (as a coarse global guard) when headers are absent.
 */
export function clientKeyFromRequest(request: Request, prefix = 'ip'): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return `${prefix}:${first}`;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return `${prefix}:${real.trim()}`;
  return `${prefix}:unknown`;
}
