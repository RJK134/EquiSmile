import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/auth';
import { routing } from './i18n/routing';
import { safeCallbackUrl } from '@/lib/auth/redirect';
import { applySecurityHeaders } from '@/lib/security/headers';
import { buildCorsPreflightResponse } from '@/lib/security/cors';
import {
  clientKeyFromRequest,
  rateLimitedResponse,
  rateLimiter,
} from '@/lib/utils/rate-limit';

const intlMiddleware = createMiddleware(routing);

/**
 * Session-less public paths.
 *
 *  - `/login` and `/:locale/login` — unauthenticated sign-in UI.
 *  - `/api/auth/*` — Auth.js internal endpoints (sign-in, callback, csrf,
 *    session polling). Auth.js enforces its own CSRF/PKCE/state.
 *  - `/api/webhooks/*` — inbound WhatsApp + email, server-to-server; each
 *    route enforces its own HMAC/API-key check in the handler.
 *  - `/api/n8n/*` — n8n automation callbacks (triage-result, geocode-result,
 *    route-proposal, trigger/*). n8n has no browser session; each route
 *    calls `requireN8nApiKey` which FAIL-CLOSES in production when
 *    `N8N_API_KEY` is unset.
 *  - `/api/reminders/check` — n8n-scheduled cron. Same story as above.
 *  - `/api/health` — for uptime monitoring.
 *
 * Every other API route goes through the session check below.
 */
const PUBLIC_PATH_PATTERNS = [
  /^\/login(\/.*)?$/,
  /^\/[a-z]{2}\/login(\/.*)?$/,
  // Privacy / terms pages must stay reachable without a session so we
  // can satisfy Meta's WhatsApp Business requirement and give data
  // subjects a public landing page for their rights enquiries.
  /^\/[a-z]{2}\/privacy(\/.*)?$/,
  /^\/[a-z]{2}\/terms(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/n8n(\/.*)?$/,
  /^\/api\/reminders\/check$/,
  /^\/api\/health(\/.*)?$/,
  // Demo-only sign-in endpoint. The handler hard-blocks itself
  // outside DEMO_MODE, so exempting it here is safe — and required,
  // because it has to be reachable while the caller has no session.
  /^\/api\/demo\/sign-in$/,
];

/**
 * Rate limiter for Auth.js callback paths (magic-link verify, OAuth code
 * exchange). Brute-forcing a magic-link token would need ~2^128 guesses,
 * but there is no reason to allow anyone more than a handful of callback
 * hits per minute per IP — each one does DB work and email-provider
 * lookups. Set a generous but bounded cap.
 *
 * NB: `rateLimiter` state is in-process. Behind a single-instance deploy
 * this is fine; at scale, upgrade to Redis alongside the existing
 * idempotency service.
 */
const authCallbackLimiter = rateLimiter({ windowMs: 60_000, max: 30 });

const AUTH_CALLBACK_PATTERN = /^\/api\/auth\/(callback|signin|verify-request|session)(\/.*)?$/;

/**
 * Baseline per-IP rate limit for authenticated API writes
 * (POST/PATCH/PUT/DELETE) that are not already rate-limited by their
 * route handler. Intentionally generous — a legitimate operator rarely
 * mutates more than a handful of rows per second — but bounded enough
 * to stop an accidental script / runaway tab / stolen-cookie burst
 * from hammering the DB.
 *
 * Each route that needs a tighter limit (export, vision analyse, etc.)
 * still wraps its own limiter on top; this is only a floor.
 */
const apiWriteLimiter = rateLimiter({ windowMs: 60_000, max: 120 });
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS preflight — must be answered BEFORE the auth gate. Browsers
  // send `OPTIONS` without cookies, so an authenticated check would
  // reject every preflight and the actual request never gets dispatched.
  // `buildCorsPreflightResponse` returns null for non-CORS paths so the
  // request falls through to the normal chain.
  // We still funnel the response through `applySecurityHeaders` so the
  // OPTIONS / 403 path picks up COOP / CORP / nosniff / CSP / HSTS like
  // every other response — preflights aren't an exception to the
  // global hardening.
  const preflight = buildCorsPreflightResponse(request, pathname);
  if (preflight) {
    return applySecurityHeaders(preflight, { pathname, request });
  }

  // Rate-limit the Auth.js callback/verify/signin/session routes before
  // any further processing, so a burst cannot cheaply burn DB work.
  // `/api/auth/session` is polled by the client; keep the cap high
  // enough not to interfere with a normal tab.
  if (AUTH_CALLBACK_PATTERN.test(pathname)) {
    const decision = authCallbackLimiter.check(clientKeyFromRequest(request, 'auth'));
    if (!decision.allowed) {
      return applySecurityHeaders(rateLimitedResponse(decision), { pathname, request });
    }
  }

  if (isPublicPath(pathname)) {
    const response = isApiPath(pathname) ? NextResponse.next() : intlMiddleware(request);
    return applySecurityHeaders(response, { pathname, request });
  }

  const session = await auth();

  if (!session?.user) {
    if (isApiPath(pathname)) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        { pathname, request },
      );
    }
    const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (pathname !== '/') {
      // Only attach safe same-origin paths; guards against open-redirect
      // via crafted /?callbackUrl=... on the sign-out page.
      loginUrl.searchParams.set('callbackUrl', safeCallbackUrl(pathname, '/'));
    }
    return applySecurityHeaders(NextResponse.redirect(loginUrl), { pathname, request });
  }

  if (isApiPath(pathname)) {
    // Baseline write-traffic rate limit for authenticated API routes.
    // Keyed on session user id so a shared NAT gateway doesn't punish
    // innocent operators for a noisy colleague; falls back to IP.
    if (WRITE_METHODS.has(request.method)) {
      const key = session.user.id
        ? `user:${session.user.id}`
        : clientKeyFromRequest(request, 'api');
      const decision = apiWriteLimiter.check(key);
      if (!decision.allowed) {
        return applySecurityHeaders(rateLimitedResponse(decision), { pathname, request });
      }
    }
    return applySecurityHeaders(NextResponse.next(), { pathname, request });
  }

  return applySecurityHeaders(intlMiddleware(request), { pathname, request });
}

export const config = {
  // Run middleware in the Node.js runtime, not the Edge runtime.
  //
  // The middleware imports `auth` from `@/auth`, which statically
  // imports `next-auth/providers/nodemailer`. Nodemailer transitively
  // pulls in Node-only modules (`stream`, `net`, `tls`, `fs`) at
  // module-eval time, which the Edge runtime cannot load — every
  // request 500s with:
  //   "The edge runtime does not support Node.js 'stream' module"
  //
  // We deploy on a single self-hosted Docker box (not Vercel Edge),
  // so Node middleware is the right trade-off here: full Node API,
  // no per-request cold-start penalty, and the server already has a
  // long-running process. If we later split auth into an edge-safe
  // shell (`auth.config.ts`) + a full server config (`auth.ts`) per
  // the next-auth v5 docs, this can be reverted to `edge` for
  // slightly cheaper per-request middleware.
  runtime: 'nodejs',
  matcher: [
    '/',
    '/login',
    '/(en|fr)/:path*',
    '/api/:path*',
  ],
};
