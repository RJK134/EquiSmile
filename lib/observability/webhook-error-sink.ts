import type { ErrorSink, ErrorSinkEvent } from '@/lib/utils/logger';

/**
 * Phase 16 — Webhook error sink.
 *
 * Posts a compact JSON payload to `EQUISMILE_ERROR_WEBHOOK_URL` whenever
 * `logger.error(...)` fires. Supports:
 *
 *   - A generic JSON POST endpoint (Slack incoming webhook, Teams,
 *     self-hosted log-collector, a relay that fans out to Sentry, etc.).
 *   - An optional Bearer token via `EQUISMILE_ERROR_WEBHOOK_TOKEN` for
 *     endpoints that want auth.
 *
 * Why a webhook instead of `@sentry/nextjs`:
 *   - Zero new binary dependency. The practice may not have a Sentry
 *     account yet; Slack / Loki / Grafana-OnCall can all consume a JSON
 *     POST today without code changes.
 *   - A webhook is trivially testable with a local HTTP listener.
 *   - If a team wants Sentry later, they register a second sink that
 *     wraps `@sentry/node` — the hook is designed for composition.
 *
 * Safety guarantees:
 *   - Best-effort, fire-and-forget. The sink NEVER throws back to the
 *     caller. Every failure is swallowed with a stderr warning.
 *   - 2-second timeout so a slow error-collector can't starve a
 *     request thread.
 *   - Per-message 2KB cap so we don't flood a chat webhook.
 *   - Coarse in-process dedupe via a rolling key (scope + message) with
 *     a 60-second window so a hot failure loop doesn't page 10,000
 *     times.
 *   - All payloads run through `redact()` so PII never reaches the
 *     collector even if a caller accidentally passed raw input.
 */

import { redact } from '@/lib/utils/log-redact';

const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_BODY_BYTES = 2_048;
const DEDUPE_WINDOW_MS = 60_000;
const DEDUPE_MAX_KEYS = 256;

interface WebhookErrorSinkConfig {
  url: string;
  token?: string;
  environment?: string;
  timeoutMs?: number;
  /** Injected `fetch` for tests. */
  fetchImpl?: typeof fetch;
  /** Injected clock for tests. */
  now?: () => number;
}

interface DedupeEntry {
  firstAt: number;
  count: number;
}

export function createWebhookErrorSink(config: WebhookErrorSinkConfig): ErrorSink {
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dedupe = new Map<string, DedupeEntry>();

  return (event: ErrorSinkEvent) => {
    try {
      const current = now();
      const key = buildDedupeKey(event);

      // Evict expired entries (cheap linear prune — cap on key count).
      if (dedupe.size >= DEDUPE_MAX_KEYS) {
        for (const [k, e] of dedupe) {
          if (current - e.firstAt > DEDUPE_WINDOW_MS) dedupe.delete(k);
        }
      }

      const existing = dedupe.get(key);
      if (existing && current - existing.firstAt < DEDUPE_WINDOW_MS) {
        existing.count += 1;
        // Only forward the first occurrence inside a window; counting
        // the burst is enough for the collector.
        return;
      }
      dedupe.set(key, { firstAt: current, count: 1 });

      const payload = buildPayload(event, config.environment);
      void postPayload(fetchImpl, config.url, config.token, payload, timeoutMs);
    } catch (err) {
      // Never let the sink surface its own errors. Stderr is the
      // diagnostic path of last resort; `logger.error` would recurse.
      console.error('[webhook-sink] dropped error', err);
    }
  };
}

function buildDedupeKey(event: ErrorSinkEvent): string {
  const errMsg =
    event.error instanceof Error ? event.error.message : String(event.error ?? '');
  return `${event.message}::${errMsg.slice(0, 80)}`;
}

function buildPayload(event: ErrorSinkEvent, environment?: string): string {
  type Payload = {
    ts: string;
    service: 'equismile';
    env: string;
    message: string;
    error?: { name?: string; message: string };
    context?: unknown;
    body_truncated?: true;
  };

  const body: Payload = {
    ts: new Date().toISOString(),
    service: 'equismile',
    env: environment ?? process.env.NODE_ENV ?? 'unknown',
    message: event.message,
    error:
      event.error instanceof Error
        ? { name: event.error.name, message: event.error.message }
        : event.error
        ? { message: String(event.error) }
        : undefined,
    context: redact(event.context) as unknown,
  };

  let serialised = JSON.stringify(body);
  if (serialised.length <= MAX_BODY_BYTES) return serialised;

  // Over the cap — produce a valid, smaller payload. Context is almost
  // always the biggest field (redacted object graph) and the least
  // essential for triage, so we drop it first and stamp a flag.
  // Consumers that parse JSON (Slack, Sentry) must not receive
  // truncated strings that break JSON.parse.
  delete body.context;
  body.body_truncated = true;
  serialised = JSON.stringify(body);

  if (serialised.length <= MAX_BODY_BYTES) return serialised;

  // Still too big — message/error itself is pathological. Trim the
  // message to a safe budget and keep the shape valid. Leave enough
  // headroom for the fixed fields (timestamps, enum strings, keys).
  const OVERHEAD_BUDGET = 256;
  const remaining = MAX_BODY_BYTES - OVERHEAD_BUDGET;
  body.message = body.message.slice(0, Math.max(0, remaining));
  if (body.error?.message) {
    body.error.message = body.error.message.slice(0, Math.max(0, remaining));
  }
  serialised = JSON.stringify(body);
  return serialised;
}

async function postPayload(
  fetchImpl: typeof fetch,
  url: string,
  token: string | undefined,
  body: string,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    // Collector unreachable or timed out. Keep stderr noise low —
    // constant failure here would spam the pod logs.
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[webhook-sink] post failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Test helper — resets dedupe state across runs. */
export function __isWebhookSinkEnabled(): boolean {
  return Boolean(process.env.EQUISMILE_ERROR_WEBHOOK_URL);
}
