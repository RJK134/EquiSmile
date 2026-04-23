import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/auth';
import { routing } from './i18n/routing';
import { safeCallbackUrl } from '@/lib/auth/redirect';
import { applySecurityHeaders } from '@/lib/security/headers';
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
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/n8n(\/.*)?$/,
  /^\/api\/reminders\/check$/,
  /^\/api\/health(\/.*)?$/,
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

  // Rate-limit the Auth.js callback/verify/signin/session routes before
  // any further processing, so a burst cannot cheaply burn DB work.
  // `/api/auth/session` is polled by the client; keep the cap high
  // enough not to interfere with a normal tab.
  if (AUTH_CALLBACK_PATTERN.test(pathname)) {
    const decision = authCallbackLimiter.check(clientKeyFromRequest(request, 'auth'));
    if (!decision.allowed) {
      return applySecurityHeaders(rateLimitedResponse(decision), { pathname });
    }
  }

  if (isPublicPath(pathname)) {
    const response = isApiPath(pathname) ? NextResponse.next() : intlMiddleware(request);
    return applySecurityHeaders(response, { pathname });
  }

  const session = await auth();

  if (!session?.user) {
    if (isApiPath(pathname)) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        { pathname },
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
    return applySecurityHeaders(NextResponse.redirect(loginUrl), { pathname });
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
        return applySecurityHeaders(rateLimitedResponse(decision), { pathname });
      }
    }
    return applySecurityHeaders(NextResponse.next(), { pathname });
  }

  return applySecurityHeaders(intlMiddleware(request), { pathname });
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/(en|fr)/:path*',
    '/api/:path*',
  ],
};
