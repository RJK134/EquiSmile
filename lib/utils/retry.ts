/**
 * Phase 7.1 — Retry wrapper with exponential backoff and circuit breaker.
 *
 * Provides configurable retry logic for external integrations:
 * - Google Geocoding / Route Optimization API
 * - WhatsApp outbound messages
 * - Email outbound (SMTP)
 * - n8n webhook triggers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Timeout per attempt in ms (default: 15000) */
  timeoutMs?: number;
  /** Predicate — return true if the error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Operation label for logging */
  operationName?: string;
}

export interface RetryResult<T> {
  data: T;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export interface CircuitBreakerOptions {
  /** Failures before the circuit opens (default: 5) */
  failureThreshold?: number;
  /** Time in ms the circuit stays open before half-open probe (default: 60000) */
  resetTimeoutMs?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60_000;
  }

  get currentState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  canExecute(): boolean {
    const s = this.currentState;
    return s === 'closed' || s === 'half-open';
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

// ---------------------------------------------------------------------------
// Default retryable check
// ---------------------------------------------------------------------------

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors, timeouts, 5xx-like messages
    if (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('timeout') ||
      msg.includes('socket hang up') ||
      msg.includes('429') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504')
    ) {
      return true;
    }
  }
  return true; // default: retry on any error
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Execute `fn` with exponential backoff + jitter retries.
 * Optionally pass a CircuitBreaker for repeated-failure protection.
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
  circuitBreaker?: CircuitBreaker,
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1_000,
    backoffMultiplier = 2,
    maxDelayMs = 30_000,
    timeoutMs = 15_000,
    isRetryable = defaultIsRetryable,
    operationName = 'operation',
  } = options;

  // Circuit breaker check
  if (circuitBreaker && !circuitBreaker.canExecute()) {
    throw new RetryError(
      `[retry] Circuit open for ${operationName} — skipping execution`,
      0,
      null,
    );
  }

  let lastError: unknown;
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const data = await fn(controller.signal);
        clearTimeout(timer);
        circuitBreaker?.recordSuccess();
        return { data, attempts: attempt };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;

      // Check if the AbortController fired (timeout)
      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError';

      const retryable = isTimeout || isRetryable(error);

      if (!retryable || attempt === totalAttempts) {
        circuitBreaker?.recordFailure();
        break;
      }

      // Exponential backoff with jitter
      const expDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(expDelay + jitter, maxDelayMs);

      await sleep(delay);
    }
  }

  circuitBreaker?.recordFailure();
  throw new RetryError(
    `[retry] ${operationName} failed after ${totalAttempts} attempts`,
    totalAttempts,
    lastError,
  );
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic idempotency key for outbound messages.
 * Combines a scope (e.g. "confirmation") with a unique ID to prevent
 * duplicate sends on retry.
 */
export function generateIdempotencyKey(scope: string, uniqueId: string): string {
  return `${scope}:${uniqueId}`;
}

/**
 * In-memory idempotency check set.
 * For production, this should be backed by Redis or the database.
 */
const processedKeys = new Set<string>();

export function hasBeenProcessed(key: string): boolean {
  return processedKeys.has(key);
}

export function markAsProcessed(key: string): void {
  processedKeys.add(key);
}

export function clearProcessedKeys(): void {
  processedKeys.clear();
}

// ---------------------------------------------------------------------------
// Pre-built circuit breakers for external services
// ---------------------------------------------------------------------------

export const circuitBreakers = {
  whatsapp: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60_000 }),
  email: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60_000 }),
  geocoding: new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 120_000 }),
  routeOptimization: new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 120_000 }),
  n8n: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
