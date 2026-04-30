import type { NextRequest, NextResponse } from 'next/server';

import { applyCorsHeaders } from '@/lib/security/cors';

/**
 * Apply defence-in-depth security headers to every response.
 *
 * Design:
 *  - Headers are added via the middleware (this file) so they apply to
 *    every response, including API error responses.
 *  - CSP is deliberately pragmatic. Next.js 15/16 emits inline scripts
 *    for hydration, so a strict `script-src 'self'` breaks the app.
 *    We allow `'self' 'unsafe-inline'` for scripts/styles, but lock down
 *    `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'`
 *    — the highest-impact vectors for XSS payload delivery.
 *  - Google Maps needs `maps.googleapis.com` in `script-src`,
 *    `fonts.googleapis.com` in `style-src`, and `*.gstatic.com` in
 *    `img-src`/`connect-src`.
 *  - API responses and webhook paths skip CSP (it's irrelevant to JSON)
 *    but still get the other hardening headers.
 *
 * HSTS (Strict-Transport-Security) is only emitted in production: it's
 * a long-lived promise and we don't want it set over plaintext dev.
 */

export interface SecurityHeaderContext {
  pathname: string;
  /**
   * Optional — when supplied for an `/api/*` response, CORS allow-list
   * headers are layered on top of the defence-in-depth headers. Page
   * responses don't need this; CORS is fetch/XHR-only.
   */
  request?: NextRequest;
}

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Production-only.
const HSTS_HEADER = 'Strict-Transport-Security';
const HSTS_VALUE = 'max-age=63072000; includeSubDomains; preload';

// Pragmatic CSP for the vet operations UI. Expressed without a nonce
// (Next.js RSC + serwist need inline scripts for hydration/SW bootstrap).
// frame-ancestors 'none' is the equivalent of X-Frame-Options: DENY in
// CSP2/3 — we set both so old browsers still get the X-Frame-Options.
function buildCsp(): string {
  // Demo mode runs over plaintext http://localhost. Two production CSP
  // directives misbehave there:
  //   - `upgrade-insecure-requests` rewrites form POSTs to https://
  //     which never resolves on localhost.
  //   - `form-action 'self'` enforcement on Chrome with mixed http/https
  //     navigation rejects same-origin POSTs across the redirect chain.
  // Both are correct in production (HTTPS, real domain), so we keep
  // them for live deployments and only loosen in demo.
  const isDemo = process.env.DEMO_MODE === 'true';

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    // Next.js + PWA service worker require inline scripts/styles.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: ",
    "font-src 'self' data: https://fonts.gstatic.com",
    // XHR/fetch targets: the app itself, Google Maps, and Anthropic for
    // the vision pipeline. n8n is reached server-side and does not need
    // to be in connect-src.
    "connect-src 'self' https://maps.googleapis.com https://api.anthropic.com https://*.gstatic.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // form-action 'self' in production; demo loosens to also allow
    // explicit localhost http origins so the demo sign-in form POST
    // is not blocked over plaintext.
    isDemo
      ? "form-action 'self' http://localhost:3000 http://127.0.0.1:3000"
      : "form-action 'self'",
  ];

  // upgrade-insecure-requests rewrites every http URL to https. That's
  // correct on a real HTTPS deployment but actively breaks the demo
  // environment (no TLS on localhost).
  if (!isDemo) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export function applySecurityHeaders<T extends NextResponse>(
  response: T,
  ctx: SecurityHeaderContext,
): T {
  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    response.headers.set(key, value);
  }

  // Only emit HSTS on explicitly-HTTPS production deploys.
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    response.headers.set(HSTS_HEADER, HSTS_VALUE);
  }

  // CSP is for the HTML surface. JSON APIs and webhook endpoints get a
  // trivial `default-src 'none'` which is correct for non-browseable
  // responses but trivially enforced since browsers rarely render JSON.
  if (ctx.pathname.startsWith('/api/')) {
    response.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  } else {
    response.headers.set('Content-Security-Policy', buildCsp());
  }

  // CORS allow-list — only meaningful for `/api/*` responses driven by
  // a browser fetch. Skipped for page responses and for exempt paths
  // (webhooks, n8n, Auth.js) inside `applyCorsHeaders` itself.
  if (ctx.request) {
    applyCorsHeaders(response, ctx.request, ctx.pathname);
  }

  return response;
}

export const __internals = { buildCsp, BASE_HEADERS };
