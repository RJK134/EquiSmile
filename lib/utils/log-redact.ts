/**
 * Safe structured-log helpers.
 *
 * Never let a secret escape via `console.log`. This utility walks an
 * arbitrary object, produces a new plain object (original untouched),
 * and replaces the value of any key that matches the redaction list
 * with `[redacted]`.
 *
 * The match is case-insensitive and substring-based so the list catches:
 *  - `authorization`, `Authorization`
 *  - `access_token`, `access-token`, `AccessToken`
 *  - `api_key`, `apiKey`, `x-api-key`
 *  - `x-hub-signature-256`
 *  - `password`, `secret`, `session`, `cookie`, `credential`
 *
 * For values we also redact anything that structurally looks like a
 * bearer token (`Bearer …`) regardless of key.
 */

const REDACT_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'api_key',
  'apikey',
  'api-key',
  'x-api-key',
  'access_token',
  'accesstoken',
  'access-token',
  'refresh_token',
  'refreshtoken',
  'refresh-token',
  'password',
  'passphrase',
  'secret',
  'session',
  'credential',
  'token',
  'signature',
  'x-hub-signature-256',
  'x-hub-signature',
];

const SENTINEL = '[redacted]';

function looksLikeBearer(value: string): boolean {
  return /^Bearer\s+\S+/i.test(value) || /^sk-[a-zA-Z0-9-]{10,}/.test(value);
}

function shouldRedactKey(key: string): boolean {
  const lc = key.toLowerCase();
  return REDACT_KEYS.some((k) => lc.includes(k));
}

function redactValue(key: string, value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (shouldRedactKey(key)) return SENTINEL;
    if (looksLikeBearer(value)) return SENTINEL;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => redactValue(`${key}[${i}]`, item, seen));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return '[circular]';
    seen.add(obj);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (shouldRedactKey(k) && typeof v === 'string') {
        result[k] = SENTINEL;
      } else {
        result[k] = redactValue(k, v, seen);
      }
    }
    return result;
  }
  return value;
}

export function redact<T>(value: T): unknown {
  return redactValue('', value as unknown, new WeakSet());
}

export const __internals = { shouldRedactKey, looksLikeBearer, REDACT_KEYS };
