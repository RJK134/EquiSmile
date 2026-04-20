import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { applySecurityHeaders, __internals } from '@/lib/security/headers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('applySecurityHeaders', () => {
  it('sets base hardening headers on HTML responses', () => {
    const response = applySecurityHeaders(NextResponse.next(), { pathname: '/en/dashboard' });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('emits a content-specific CSP for HTML pages', () => {
    const response = applySecurityHeaders(NextResponse.next(), { pathname: '/en/dashboard' });
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://maps.googleapis.com');
    expect(csp).toContain('https://api.anthropic.com');
    expect(csp).toContain("base-uri 'self'");
  });

  it('emits a minimal CSP for API responses', () => {
    const response = applySecurityHeaders(NextResponse.json({ ok: true }), { pathname: '/api/customers' });
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it('emits HSTS only in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_MODE', 'false');
    const prod = applySecurityHeaders(NextResponse.next(), { pathname: '/en' });
    expect(prod.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('does not emit HSTS in demo mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_MODE', 'true');
    const response = applySecurityHeaders(NextResponse.next(), { pathname: '/en' });
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('does not emit HSTS in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const dev = applySecurityHeaders(NextResponse.next(), { pathname: '/en' });
    expect(dev.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('includes upgrade-insecure-requests in production CSP', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_MODE', 'false');
    expect(__internals.buildCsp()).toContain('upgrade-insecure-requests');
  });

  it('omits upgrade-insecure-requests in development CSP', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(__internals.buildCsp()).not.toContain('upgrade-insecure-requests');
  });

  it('CSP blocks form submission off-site', () => {
    expect(__internals.buildCsp()).toContain("form-action 'self'");
  });

  it('CSP allows PWA service worker via blob: in worker-src', () => {
    expect(__internals.buildCsp()).toContain('worker-src');
    expect(__internals.buildCsp()).toContain('blob:');
  });
});
