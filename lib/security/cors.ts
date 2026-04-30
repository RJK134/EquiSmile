import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS allow-list for `/api/*`.
 *
 * Design choices and what they protect against:
 *  - Echo-only origin matching, never `*`. The app uses session cookies,
 *    so `Access-Control-Allow-Credentials: true` is mandatory, and
 *    browsers refuse `*` with credentials. Echoing a single allow-listed
 *    origin (or no header at all when not allowed) keeps cookies
 *    confined to known frontends.
 *  - Default allow-list is `[NEXT_PUBLIC_APP_URL]`. Same-origin requests
 *    (the normal case for the SPA hosted at the same hostname) Just
 *    Work without any explicit operator config.
 *  - Server-to-server endpoints are exempt from CORS entirely (see
 *    `isCorsExempt`). Webhooks, n8n callbacks, and Auth.js have their
 *    own non-cookie auth and must NOT advertise CORS to arbitrary
 *    origins — doing so would invite browser-side replay of token-only
 *    endpoints.
 *  - `Vary: Origin` is set whenever the Origin header influences the
 *    response, so caches and CDNs don't poison one origin's allow with
 *    another origin's response.
 */

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

// Conservative default — request handlers can echo additional headers
// in their own preflight response if they need a custom protocol
// (e.g. an X-Idempotency-Key on a future bulk import endpoint).
const ALLOWED_HEADERS = 'Authorization, Content-Type, X-Requested-With';

const PREFLIGHT_MAX_AGE_SECONDS = 600; // 10 min — long enough to not
// hammer the preflight on a page session, short enough that an
// allow-list change propagates to clients within a session.

const CORS_EXEMPT_PATTERNS = [
  // Auth.js — same-origin only by design; advertising CORS would let a
  // foreign origin drive sign-in / callback ceremony with a stolen
  // CSRF token.
  /^\/api\/auth(\/.*)?$/,
  // Inbound webhooks (WhatsApp, email). Server-to-server, HMAC-signed.
  // No browser ever calls these.
  /^\/api\/webhooks(\/.*)?$/,
  // n8n automation callbacks. Token-auth via N8N_API_KEY, called by
  // the n8n container over the compose network. No browser surface.
  /^\/api\/n8n(\/.*)?$/,
  // n8n cron entry point.
  /^\/api\/reminders\/check$/,
];

export function isCorsExempt(pathname: string): boolean {
  return CORS_EXEMPT_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Parse the comma-separated `APP_ALLOWED_ORIGINS` env var into a
 * normalised allow-list. When unset or empty, fall back to
 * `[NEXT_PUBLIC_APP_URL]` so a same-origin SPA keeps working without
 * any explicit operator config.
 *
 * Each entry is parsed as a URL and reduced to its canonical origin
 * (`scheme://host[:port]`). Operators who paste a full URL by mistake
 * (`https://app.example.com/en`) get the right behaviour instead of a
 * silent allow-list miss. Entries that don't parse as URLs are dropped
 * with a warning so a typo fails loud rather than masking one good
 * entry behind one bad one.
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.APP_ALLOWED_ORIGINS?.trim();
  const fallback = process.env.NEXT_PUBLIC_APP_URL?.trim();

  const source = raw && raw.length > 0 ? raw : fallback;
  if (!source) return [];

  const origins: string[] = [];
  for (const entry of source.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      origins.push(new URL(trimmed).origin);
    } catch {
      console.warn(
        `[cors] Ignoring malformed entry in APP_ALLOWED_ORIGINS / NEXT_PUBLIC_APP_URL: ${trimmed}`,
      );
    }
  }
  return origins;
}

export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  // The browser-supplied Origin header is always an origin (no path)
  // per the Fetch spec, but operators paste URLs of every shape. Run
  // the same canonicalisation as the allow-list so a stray slash or
  // path doesn't cause a false negative.
  let canonical: string;
  try {
    canonical = new URL(origin).origin;
  } catch {
    return false;
  }
  return allowed.includes(canonical);
}

/**
 * Mutate `response` in place with CORS headers when the request origin
 * is allow-listed. No-ops for exempt paths and for non-`/api/*`
 * pathnames so page responses are not affected.
 *
 * Always sets `Vary: Origin` on `/api/*` non-exempt responses, even
 * when the origin is rejected — an intermediary cache must not serve
 * a no-CORS response to a later allow-listed caller.
 */
export function applyCorsHeaders<T extends NextResponse>(
  response: T,
  request: NextRequest,
  pathname: string,
): T {
  if (!pathname.startsWith('/api/')) return response;
  if (isCorsExempt(pathname)) return response;

  // Append rather than overwrite so we don't clobber a Vary already set
  // by a route handler (e.g. on a content-negotiated endpoint).
  // Comparison is case-insensitive — HTTP header tokens are
  // case-insensitive, so a route that already wrote `Vary: origin`
  // must not produce `Vary: origin, Origin` after we run.
  const existingVary = response.headers.get('Vary');
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const token of (existingVary ?? '').split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    // Preserve the route handler's casing on its own tokens; only
    // canonicalise the one we add ourselves.
    ordered.push(lower === 'origin' ? 'Origin' : trimmed);
  }
  if (!seen.has('origin')) {
    ordered.push('Origin');
  }
  response.headers.set('Vary', ordered.join(', '));

  const origin = request.headers.get('origin');
  if (!isOriginAllowed(origin, getAllowedOrigins())) return response;

  response.headers.set('Access-Control-Allow-Origin', origin!);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

/**
 * Build the response to a CORS preflight (`OPTIONS`) request. Returns
 * `null` when the path is not subject to CORS (so the caller can fall
 * through to the normal middleware chain).
 *
 * On a disallowed origin we return 403 with no allow headers — that's
 * what a strict CORS deployment should look like, and the browser will
 * surface a clean CORS failure to the SPA. Returning 204 with no
 * Allow-Origin is technically equivalent (the browser blocks anyway)
 * but the explicit 403 is easier to debug from a server log.
 *
 * The returned response is a plain `NextResponse` with only the CORS
 * headers set; the caller is expected to layer the defence-in-depth
 * headers (CSP / COOP / CORP / HSTS) on top via `applySecurityHeaders`
 * so OPTIONS responses aren't an exception to the global hardening.
 */
export function buildCorsPreflightResponse(
  request: NextRequest,
  pathname: string,
): NextResponse | null {
  if (request.method !== 'OPTIONS') return null;
  if (!pathname.startsWith('/api/')) return null;
  if (isCorsExempt(pathname)) return null;

  const origin = request.headers.get('origin');
  const allowed = getAllowedOrigins();

  if (!isOriginAllowed(origin, allowed)) {
    return new NextResponse(null, {
      status: 403,
      headers: { Vary: 'Origin' },
    });
  }

  // Echo the requested headers when present so a route that accepts a
  // custom header (e.g. X-CSRF-Token) on the actual request can still
  // pass preflight. Whitelist to the static set above when the
  // browser doesn't advertise a list, OR when it sends a present-but-
  // blank value (some misbehaving clients do; echoing blank produces
  // an invalid Allow-Headers and the preflight fails).
  const requestedHeadersRaw = request.headers.get('access-control-request-headers');
  const requestedHeaders = requestedHeadersRaw?.trim();

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin!,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers':
        requestedHeaders && requestedHeaders.length > 0 ? requestedHeaders : ALLOWED_HEADERS,
      'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
      Vary: 'Origin',
    },
  });
}

export const __internals = {
  CORS_EXEMPT_PATTERNS,
  ALLOWED_METHODS,
  ALLOWED_HEADERS,
  PREFLIGHT_MAX_AGE_SECONDS,
};
