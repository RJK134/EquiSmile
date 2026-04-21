import type { NextRequest } from 'next/server';

import { ApiError } from '@/lib/http-errors';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function currentWindow(now: number, windowMs: number): number {
  return now + windowMs;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export function enforceRateLimit(options: RateLimitOptions): void {
  // Tests intentionally bypass throttling so route specs do not become timing-sensitive.
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }
  const bucket = buckets.get(options.key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: currentWindow(now, options.windowMs) });
    return;
  }

  if (bucket.count >= options.limit) {
    throw new ApiError(429, 'Too many requests');
  }

  bucket.count += 1;
}

export function enforceRequestRateLimit(
  request: NextRequest,
  namespace: string,
  limit: number,
  windowMs: number,
): void {
  const ip = getClientIp(request);
  enforceRateLimit({
    key: `${namespace}:${ip}`,
    limit,
    windowMs,
  });
}

export function resetRateLimitState(): void {
  buckets.clear();
}
