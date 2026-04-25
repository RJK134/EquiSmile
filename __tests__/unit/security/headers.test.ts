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

  it('CSP blocks form submission off-site in production', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    const csp = __internals.buildCsp();
    expect(csp).toContain("form-action 'self'");
    // form-action does not list any external origin in production.
    expect(csp).not.toContain('http://localhost');
    // upgrade-insecure-requests is the right call on a real HTTPS deploy.
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('CSP relaxes form-action for plaintext localhost in demo mode', () => {
    // Regression: with `form-action 'self'` + `upgrade-insecure-requests`
    // on http://localhost:3000, Chrome blocks every same-origin form
    // POST — including the demo sign-in form. Demo mode keeps the
    // protective directive but adds explicit localhost http origins to
    // the allow-list, and drops upgrade-insecure-requests since there
    // is no TLS to upgrade to.
    vi.stubEnv('DEMO_MODE', 'true');
    const csp = __internals.buildCsp();
    expect(csp).toContain("form-action 'self' http://localhost:3000 http://127.0.0.1:3000");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('CSP allows PWA service worker via blob: in worker-src', () => {
    expect(__internals.buildCsp()).toContain('worker-src');
    expect(__internals.buildCsp()).toContain('blob:');
  });
});
