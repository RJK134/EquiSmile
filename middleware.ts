import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/auth';
import { routing } from './i18n/routing';
import { safeCallbackUrl } from '@/lib/auth/redirect';
import { applySecurityHeaders } from '@/lib/security/headers';

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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
