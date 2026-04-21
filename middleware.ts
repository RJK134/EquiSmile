import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/auth';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATH_PATTERNS = [
  /^\/login(\/.*)?$/,
  /^\/[a-z]{2}\/login(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/health(\/.*)?$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function applySecurityHeaders(response: NextResponse | Response): NextResponse | Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https:",
      'upgrade-insecure-requests',
    ].join('; '),
  );
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const response = isApiPath(pathname) ? NextResponse.next() : intlMiddleware(request);
    return applySecurityHeaders(response);
  }

  const session = await auth();

  if (!session?.user) {
    if (isApiPath(pathname)) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    }
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isApiPath(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  return applySecurityHeaders(intlMiddleware(request));
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/(en|fr)/:path*',
    '/api/:path*',
  ],
};
