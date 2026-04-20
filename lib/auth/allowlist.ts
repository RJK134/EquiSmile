import { timingSafeEqual } from 'node:crypto';

/**
 * Parse the comma-separated allow-list env var into a normalised list.
 *
 * Normalisation:
 *  - trim whitespace
 *  - lowercase
 *  - drop empty entries
 *
 * The entries are matched against BOTH GitHub login AND email, so the same
 * allow-list works for both auth providers.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export interface AllowlistSubject {
  githubLogin?: string | null;
  email?: string | null;
}

/**
 * Constant-time equality for strings. Uses `crypto.timingSafeEqual` over
 * UTF-8 buffers. Lengths are compared first (which itself leaks only a
 * coarse length signal, acceptable here); if lengths differ the function
 * returns false without calling `timingSafeEqual` (which throws on
 * different-length buffers).
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Is this candidate (GitHub login or email) in the allow-list? Uses
 * constant-time comparison to avoid leaking length/prefix information via
 * a timing side-channel. Matching is case-insensitive because the list is
 * already lowered during parsing and candidates are lowered here.
 *
 * An empty allow-list denies every subject.
 */
export function isAllowed(allowlist: string[], subject: AllowlistSubject): boolean {
  if (allowlist.length === 0) return false;
  const candidates = [subject.githubLogin, subject.email]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase());
  if (candidates.length === 0) return false;

  // Walk the full allow-list for every candidate (no short-circuit) so the
  // work done is independent of where the match sits. `any`-style |= keeps
  // a stable answer without exposing first-match latency.
  let found = false;
  for (const candidate of candidates) {
    for (const entry of allowlist) {
      if (constantTimeEquals(candidate, entry)) {
        found = true;
      }
    }
  }
  return found;
}

export const __internals = { constantTimeEquals };
