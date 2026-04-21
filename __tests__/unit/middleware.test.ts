import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => vi.fn());
const intlMiddlewareMock = vi.hoisted(() => vi.fn());
const createMiddlewareMock = vi.hoisted(() => vi.fn(() => intlMiddlewareMock));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next-intl/middleware', () => ({
  default: createMiddlewareMock,
}));

import middleware, { config } from '@/middleware';

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    intlMiddlewareMock.mockImplementation(
      (request: NextRequest) =>
        new Response(null, {
          status: 200,
          headers: {
            'x-intl-path': `${request.nextUrl.pathname}${request.nextUrl.search}`,
          },
        })
    );
  });

  it('keeps /api/webhooks/* public (plural path) — n8n does not need a session', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/api/webhooks/whatsapp'));
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it('keeps /api/n8n/* public — session-less n8n callbacks (API-key enforced in handler)', async () => {
    const response = await middleware(
      new NextRequest('http://localhost:3000/api/n8n/triage-result'),
    );
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('keeps /api/reminders/check public — session-less n8n cron (API-key enforced in handler)', async () => {
    const response = await middleware(
      new NextRequest('http://localhost:3000/api/reminders/check'),
    );
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('does NOT make sibling /api/reminders/* paths public — only the /check route is listed', async () => {
    const response = await middleware(
      new NextRequest('http://localhost:3000/api/reminders/otheraction'),
    );
    expect(response.status).toBe(401);
    expect(authMock).toHaveBeenCalledOnce();
  });

  it('applies security headers on every response', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } });
    const response = await middleware(new NextRequest('http://localhost:3000/en/dashboard'));
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'none'");
  });

  it('applies minimal API CSP on 401 responses', async () => {
    authMock.mockResolvedValue(null);
    const response = await middleware(new NextRequest('http://localhost:3000/api/customers'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('keeps /api/webhooks/email public', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/api/webhooks/email'));
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('passes bare /login (no locale) through the intl middleware so Auth.js error redirects resolve', async () => {
    const response = await middleware(
      new NextRequest('http://localhost:3000/login?error=AccessDenied')
    );
    expect(authMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledOnce();
    expect(response.headers.get('x-intl-path')).toBe('/login?error=AccessDenied');
  });

  it('passes /en/login and /fr/login through the intl middleware unauthenticated', async () => {
    await middleware(new NextRequest('http://localhost:3000/en/login'));
    await middleware(new NextRequest('http://localhost:3000/fr/login'));
    expect(authMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(2);
  });

  it('leaves /api/health public', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/api/health'));
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('returns 401 for protected API paths when unauthenticated', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/api/customers'));
    expect(response.status).toBe(401);
    expect(authMock).toHaveBeenCalledOnce();
  });

  it('redirects unauthenticated UI requests to /{locale}/login with callbackUrl', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/en/dashboard'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/en/login');
    expect(location).toContain('callbackUrl=%2Fen%2Fdashboard');
  });

  it('matcher includes bare /login so Auth.js redirects do not 404', () => {
    expect(config.matcher).toContain('/login');
  });
});
