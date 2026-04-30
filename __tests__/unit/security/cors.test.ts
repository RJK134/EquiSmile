import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

import {
  applyCorsHeaders,
  buildCorsPreflightResponse,
  getAllowedOrigins,
  isCorsExempt,
  isOriginAllowed,
  __internals,
} from '@/lib/security/cors';

const originalEnv = { ...process.env };

// Use Next's own RequestInit (includes optional `geo`/`ip`); a plain
// DOM `RequestInit` triggers a type mismatch on `signal` nullability.
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(url: string, init: NextRequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://app.example'), init);
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.APP_ALLOWED_ORIGINS;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('isCorsExempt', () => {
  it.each([
    ['/api/auth/signin', true],
    ['/api/auth/callback/github', true],
    ['/api/webhooks/whatsapp', true],
    ['/api/webhooks/email', true],
    ['/api/n8n/triage-result', true],
    ['/api/n8n/trigger/send-whatsapp', true],
    ['/api/reminders/check', true],
    ['/api/customers', false],
    ['/api/horses/abc', false],
    ['/api/health', false],
    ['/api/health/ready', false],
    ['/api/status', false],
    ['/dashboard', false],
  ])('%s -> %s', (path, expected) => {
    expect(isCorsExempt(path)).toBe(expected);
  });
});

describe('getAllowedOrigins', () => {
  it('uses APP_ALLOWED_ORIGINS when set', () => {
    process.env.APP_ALLOWED_ORIGINS = 'https://admin.example,https://pwa.example';
    expect(getAllowedOrigins()).toEqual([
      'https://admin.example',
      'https://pwa.example',
    ]);
  });

  it('falls back to NEXT_PUBLIC_APP_URL when APP_ALLOWED_ORIGINS unset', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    expect(getAllowedOrigins()).toEqual(['https://app.example']);
  });

  it('falls back to NEXT_PUBLIC_APP_URL when APP_ALLOWED_ORIGINS is blank', () => {
    process.env.APP_ALLOWED_ORIGINS = '   ';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    expect(getAllowedOrigins()).toEqual(['https://app.example']);
  });

  it('returns empty list when nothing is configured', () => {
    expect(getAllowedOrigins()).toEqual([]);
  });

  it('strips trailing slashes and whitespace', () => {
    process.env.APP_ALLOWED_ORIGINS = ' https://admin.example/ , https://pwa.example// ';
    expect(getAllowedOrigins()).toEqual([
      'https://admin.example',
      'https://pwa.example',
    ]);
  });

  it('drops empty entries from a stray comma', () => {
    process.env.APP_ALLOWED_ORIGINS = 'https://a.example,,https://b.example,';
    expect(getAllowedOrigins()).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('canonicalises an entry that includes a path to its origin', () => {
    // Operators paste full URLs by mistake. URL.origin strips path/query/hash.
    process.env.APP_ALLOWED_ORIGINS = 'https://app.example.com/en/dashboard?x=1';
    expect(getAllowedOrigins()).toEqual(['https://app.example.com']);
  });

  it('preserves explicit non-default port via URL.origin', () => {
    process.env.APP_ALLOWED_ORIGINS = 'https://app.example.com:8443/';
    expect(getAllowedOrigins()).toEqual(['https://app.example.com:8443']);
  });

  it('drops malformed entries with a warning instead of poisoning the list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.APP_ALLOWED_ORIGINS = 'https://good.example,not a url,https://also-good.example';
    expect(getAllowedOrigins()).toEqual([
      'https://good.example',
      'https://also-good.example',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('not a url');
    warn.mockRestore();
  });
});

describe('isOriginAllowed', () => {
  const allowed = ['https://admin.example', 'https://pwa.example'];

  it('matches exact origin', () => {
    expect(isOriginAllowed('https://admin.example', allowed)).toBe(true);
  });

  it('matches origin with trailing slash variant', () => {
    expect(isOriginAllowed('https://admin.example/', allowed)).toBe(true);
  });

  it('rejects unknown origin', () => {
    expect(isOriginAllowed('https://attacker.example', allowed)).toBe(false);
  });

  it('rejects null origin (server-to-server / curl)', () => {
    expect(isOriginAllowed(null, allowed)).toBe(false);
  });

  it('rejects empty string origin', () => {
    expect(isOriginAllowed('', allowed)).toBe(false);
  });

  it('canonicalises a mixed-case origin (RFC 6454 origins are case-insensitive on scheme/host)', () => {
    // The URL parser lowercases scheme and host; browsers already do
    // this, so this just guards against operator-typed allow-list
    // entries that happen to differ in case.
    expect(isOriginAllowed('HTTPS://ADMIN.EXAMPLE', allowed)).toBe(true);
  });

  it('rejects a malformed origin string', () => {
    expect(isOriginAllowed('not a url', allowed)).toBe(false);
  });
});

describe('applyCorsHeaders', () => {
  beforeEach(() => {
    process.env.APP_ALLOWED_ORIGINS = 'https://admin.example';
  });

  it('echoes allowed origin and sets credentials true', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://admin.example' },
    });
    const response = applyCorsHeaders(NextResponse.json({ ok: true }), request, '/api/customers');

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('omits allow-origin for disallowed origin but still sets Vary', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://attacker.example' },
    });
    const response = applyCorsHeaders(NextResponse.json({ ok: true }), request, '/api/customers');

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('omits allow-origin for missing Origin header (same-origin or curl)', () => {
    const request = makeRequest('http://app.example/api/customers');
    const response = applyCorsHeaders(NextResponse.json({ ok: true }), request, '/api/customers');

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('skips entirely for exempt paths (no headers added at all)', () => {
    const request = makeRequest('http://app.example/api/webhooks/whatsapp', {
      headers: { origin: 'https://admin.example' },
    });
    const response = applyCorsHeaders(
      NextResponse.json({ ok: true }),
      request,
      '/api/webhooks/whatsapp',
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBeNull();
  });

  it('skips entirely for non-/api paths', () => {
    const request = makeRequest('http://app.example/en/dashboard', {
      headers: { origin: 'https://admin.example' },
    });
    const response = applyCorsHeaders(NextResponse.next(), request, '/en/dashboard');

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBeNull();
  });

  it('appends Origin to a pre-existing Vary value (does not clobber)', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://admin.example' },
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Vary', 'Accept-Language');
    applyCorsHeaders(response, request, '/api/customers');

    const vary = response.headers.get('Vary')!;
    expect(vary.split(',').map((s) => s.trim()).sort()).toEqual(['Accept-Language', 'Origin']);
  });

  it('does not duplicate Origin when Vary already contains it', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://admin.example' },
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Vary', 'Origin');
    applyCorsHeaders(response, request, '/api/customers');

    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('deduplicates Vary case-insensitively (HTTP tokens are case-insensitive)', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://admin.example' },
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Vary', 'origin'); // lowercase from upstream
    applyCorsHeaders(response, request, '/api/customers');

    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('preserves casing of unrelated Vary tokens but canonicalises Origin', () => {
    const request = makeRequest('http://app.example/api/customers', {
      headers: { origin: 'https://admin.example' },
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Vary', 'Accept-Language, ORIGIN');
    applyCorsHeaders(response, request, '/api/customers');

    // ORIGIN dedups against Origin → kept as the canonical Origin we
    // emit; Accept-Language preserved verbatim.
    expect(response.headers.get('Vary')).toBe('Accept-Language, Origin');
  });
});

describe('buildCorsPreflightResponse', () => {
  beforeEach(() => {
    process.env.APP_ALLOWED_ORIGINS = 'https://admin.example';
  });

  it('returns null for non-OPTIONS methods (lets normal flow handle it)', () => {
    const request = makeRequest('http://app.example/api/customers', {
      method: 'GET',
      headers: { origin: 'https://admin.example' },
    });
    expect(buildCorsPreflightResponse(request, '/api/customers')).toBeNull();
  });

  it('returns null for non-/api OPTIONS', () => {
    const request = makeRequest('http://app.example/en/dashboard', {
      method: 'OPTIONS',
      headers: { origin: 'https://admin.example' },
    });
    expect(buildCorsPreflightResponse(request, '/en/dashboard')).toBeNull();
  });

  it('returns null for OPTIONS on exempt paths', () => {
    const request = makeRequest('http://app.example/api/webhooks/whatsapp', {
      method: 'OPTIONS',
      headers: { origin: 'https://admin.example' },
    });
    expect(buildCorsPreflightResponse(request, '/api/webhooks/whatsapp')).toBeNull();
  });

  it('returns 204 with full CORS headers on allowed origin', () => {
    const request = makeRequest('http://app.example/api/customers', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://admin.example',
        'access-control-request-method': 'POST',
      },
    });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(__internals.ALLOWED_METHODS);
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(__internals.ALLOWED_HEADERS);
    expect(response.headers.get('Access-Control-Max-Age')).toBe(
      String(__internals.PREFLIGHT_MAX_AGE_SECONDS),
    );
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('echoes browser-requested headers in Allow-Headers when present', () => {
    const request = makeRequest('http://app.example/api/customers', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://admin.example',
        'access-control-request-headers': 'authorization, content-type, x-csrf-token',
      },
    });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, content-type, x-csrf-token',
    );
  });

  it('falls back to static Allow-Headers when access-control-request-headers is blank', () => {
    // Some misbehaving clients send the header present-but-empty.
    // Echoing blank produces an invalid Allow-Headers value and the
    // preflight fails — fall back to the static set instead.
    const request = makeRequest('http://app.example/api/customers', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://admin.example',
        'access-control-request-headers': '',
      },
    });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(__internals.ALLOWED_HEADERS);
  });

  it('falls back to static Allow-Headers when access-control-request-headers is whitespace-only', () => {
    const request = makeRequest('http://app.example/api/customers', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://admin.example',
        'access-control-request-headers': '   ',
      },
    });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(__internals.ALLOWED_HEADERS);
  });

  it('returns 403 with Vary on disallowed origin (no allow headers leaked)', () => {
    const request = makeRequest('http://app.example/api/customers', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('returns 403 on OPTIONS with no Origin header', () => {
    const request = makeRequest('http://app.example/api/customers', { method: 'OPTIONS' });
    const response = buildCorsPreflightResponse(request, '/api/customers')!;

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
