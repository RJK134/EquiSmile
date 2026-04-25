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
 * Constant-time equality for strings. Uses byte-wise XOR over UTF-8
 * encoded data so it works in both Node and the Edge runtime (where
 * `node:crypto` and `Buffer` are unavailable to middleware/auth code).
 *
 * Lengths are compared first (which itself leaks only a coarse length
 * signal, acceptable here); if lengths differ the function returns false.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ba = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ba.length !== bb.length) return false;

  let diff = 0;
  for (let byteIndex = 0; byteIndex < ba.length; byteIndex += 1) {
    diff |= ba[byteIndex] ^ bb[byteIndex];
  }
  return diff === 0;
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
