/**
 * Phase 16 — typed PII redaction for AuditLog details.
 *
 * The generic `AuditLog.details` JSON column holds operator-supplied
 * context: action reason, summary diffs, ID lists, channel tags, etc.
 * Today the redaction is "the caller takes responsibility" — fine for
 * the existing call sites which only pass `{ reason: 'soft-delete' }`,
 * but a future contributor wiring up a route-run-status-change audit
 * could easily pass `{ before: customer }` and put the customer's
 * full name and phone into a per-entity audit row that operators
 * surface on `/admin/observability`.
 *
 * `redactAuditDetails(value)` is the single chokepoint. It runs the
 * payload through:
 *
 *   1. **`lib/utils/log-redact.redact()`** — strips secrets, tokens,
 *      bearer values, and known auth header names (Authorization,
 *      Cookie, x-api-key, x-hub-signature-256, …).
 *   2. **PII scrub** — replaces values that look like phone numbers,
 *      email addresses, or long free-text with stable sentinels;
 *      replaces *values of PII-named keys* (mobilePhone, email,
 *      fullName, rawText, message, …) with `[pii-redacted]` even when
 *      the value itself wouldn't trip the pattern detectors.
 *
 * The output is JSON-compatible (no non-serialisable values) so it
 * casts cleanly back to `Prisma.InputJsonValue` for the audit-log
 * insert.
 */

import { redact as redactSecrets } from '@/lib/utils/log-redact';

const PII_SENTINEL = '[pii-redacted]';
const PHONE_SENTINEL = '[phone]';
const EMAIL_SENTINEL = '[email]';
const FREE_TEXT_SENTINEL = '[free-text]';
const FREE_TEXT_THRESHOLD = 80;

/**
 * Substring matches against lower-cased keys. Anything containing any
 * of these tokens has its STRING value replaced wholesale — even an
 * apparently-safe value (initials, a domain) gets the sentinel,
 * because we can't tell whether the operator put real PII in the
 * field. Stricter than the value-pattern check below.
 */
const PII_KEY_SUBSTRINGS = [
  'phone',
  'mobile',
  'email',
  'address',
  'fullname',
  'firstname',
  'lastname',
  'horsename',
  'customername',
  'yardname',
  'rawtext',
  'message',
  'subject',
  'notes',
  'description',
  'comment',
];

function isPIIKey(key: string): boolean {
  const lc = key.toLowerCase();
  return PII_KEY_SUBSTRINGS.some((s) => lc.includes(s));
}

/**
 * Phone-shaped: 6+ digits, with optional `+`, spaces, parens, dashes.
 * Tightened with anchors so a free-text value that happens to contain
 * digits doesn't match.
 */
function looksLikePhone(value: string): boolean {
  return /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;
}

/** Email-shaped: local@domain.tld with non-trivial parts. */
function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/**
 * Long free-text — likely a customer message body or a notes paste.
 * 80 chars is comfortably above any operator-friendly identifier,
 * status code, or canonical reason string and well below typical
 * inbound message length.
 */
function looksLikeFreeText(value: string): boolean {
  return value.length > FREE_TEXT_THRESHOLD;
}

function maskScalar(value: string): string {
  if (looksLikeEmail(value)) return EMAIL_SENTINEL;
  if (looksLikePhone(value)) return PHONE_SENTINEL;
  if (looksLikeFreeText(value)) return FREE_TEXT_SENTINEL;
  return value;
}

function scrubPII(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskScalar(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubPII(item, seen));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return '[circular]';
    seen.add(obj);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isPIIKey(k) && typeof v === 'string') {
        result[k] = PII_SENTINEL;
      } else {
        result[k] = scrubPII(v, seen);
      }
    }
    return result;
  }
  return value;
}

/**
 * The single chokepoint for AuditLog.details. Always run caller input
 * through this before persisting — never write `details` directly.
 *
 * Two-pass: the secret-redaction layer (log-redact) handles tokens
 * and auth headers; the PII layer handles customer data. The output
 * is a fresh object — original input is untouched.
 */
export function redactAuditDetails(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const tokenScrubbed = redactSecrets(value);
  return scrubPII(tokenScrubbed, new WeakSet());
}

export const __internals = {
  isPIIKey,
  looksLikePhone,
  looksLikeEmail,
  looksLikeFreeText,
  maskScalar,
  PII_SENTINEL,
  PHONE_SENTINEL,
  EMAIL_SENTINEL,
  FREE_TEXT_SENTINEL,
};
