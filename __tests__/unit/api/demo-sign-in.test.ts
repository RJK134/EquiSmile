import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — keep tight: the route is the unit under test, prisma is stubbed.
// ---------------------------------------------------------------------------

const upsertMock = vi.fn();
const sessionCreateMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: (...args: unknown[]) => upsertMock(...args) },
    session: { create: (...args: unknown[]) => sessionCreateMock(...args) },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    get DEMO_MODE() {
      return process.env.DEMO_MODE;
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(formEntries: Array<[string, string]> = []) {
  // Minimal NextRequest-shape for the route. The handler only calls
  // request.formData() and reads request.url.
  const formData = new FormData();
  for (const [k, v] of formEntries) formData.append(k, v);
  return {
    formData: async () => formData,
    url: 'http://localhost:3000/api/demo/sign-in',
  } as unknown as import('next/server').NextRequest;
}

const ORIGINAL_DEMO_MODE = process.env.DEMO_MODE;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/demo/sign-in', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    sessionCreateMock.mockReset();
    upsertMock.mockResolvedValue({ id: 'demo-user-id' });
    sessionCreateMock.mockResolvedValue({});
  });

  afterEach(() => {
    if (ORIGINAL_DEMO_MODE === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = ORIGINAL_DEMO_MODE;
  });

  it('returns 404 when DEMO_MODE is not "true" (production hard-block)', async () => {
    delete process.env.DEMO_MODE;
    const { POST } = await import('@/app/api/demo/sign-in/route');
    const res = await POST(buildRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/DEMO_MODE/);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(sessionCreateMock).not.toHaveBeenCalled();
  });

  it('returns 200 + JSON {ok, redirectTo} on success — no 3xx redirect', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    const res = await POST(buildRequest([['locale', 'en']]));

    // Critical: contract change from 303 redirect to 200 JSON. Browser-
    // automation tools that misreport 3xx responses (Perplexity reported
    // the 303 as 503 in round-1 + round-2 UAT) cannot generate a false
    // "sign-in failed" perception once the response is a clean 200.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe('/en/dashboard');
  });

  it('respects locale from form payload', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    const res = await POST(buildRequest([['locale', 'fr']]));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectTo).toBe('/fr/dashboard');
  });

  it('falls back to default locale for an unknown locale value', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    const res = await POST(buildRequest([['locale', 'de']]));
    expect(res.status).toBe(200);
    const body = await res.json();
    // routing.defaultLocale is 'en' per i18n/routing.ts.
    expect(body.redirectTo).toBe('/en/dashboard');
  });

  it('sets the authjs.session-token cookie on the response', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    const res = await POST(buildRequest([['locale', 'en']]));

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('authjs.session-token=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
  });

  it('marks the session cookie Secure when NODE_ENV=production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    env.DEMO_MODE = 'true';
    env.NODE_ENV = 'production';
    try {
      vi.resetModules();
      const { POST } = await import('@/app/api/demo/sign-in/route');
      const res = await POST(buildRequest([['locale', 'en']]));
      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie.toLowerCase()).toContain('secure');
    } finally {
      env.NODE_ENV = originalNodeEnv;
      vi.resetModules();
    }
  });

  it('does NOT mark the session cookie Secure when NODE_ENV=development', async () => {
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    env.DEMO_MODE = 'true';
    env.NODE_ENV = 'development';
    try {
      vi.resetModules();
      const { POST } = await import('@/app/api/demo/sign-in/route');
      const res = await POST(buildRequest([['locale', 'en']]));
      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('authjs.session-token=');
      expect(setCookie.toLowerCase()).not.toContain('secure');
    } finally {
      env.NODE_ENV = originalNodeEnv;
      vi.resetModules();
    }
  });

  it('upserts the default admin persona when no persona field is submitted', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    await POST(buildRequest([['locale', 'en']]));

    expect(upsertMock).toHaveBeenCalledOnce();
    const arg = upsertMock.mock.calls[0]![0];
    // Default persona is Dr. Kathelijne Deberdt (admin)
    expect(arg.where.email).toBe('kathelijne@equismile.demo');
    expect(arg.create.role).toBe('admin');
    expect(arg.create.githubLogin).toBe('kathelijne-deberdt');
  });

  it('upserts the selected persona when a valid persona email is submitted', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    await POST(buildRequest([['locale', 'en'], ['persona', 'alex@equismile.demo']]));

    expect(upsertMock).toHaveBeenCalledOnce();
    const arg = upsertMock.mock.calls[0]![0];
    expect(arg.where.email).toBe('alex@equismile.demo');
    expect(arg.create.role).toBe('vet');
    expect(arg.create.githubLogin).toBe('alex-moreau');
  });

  it('falls back to admin persona for an unknown persona email', async () => {
    process.env.DEMO_MODE = 'true';
    const { POST } = await import('@/app/api/demo/sign-in/route');
    await POST(buildRequest([['locale', 'en'], ['persona', 'attacker@evil.com']]));

    expect(upsertMock).toHaveBeenCalledOnce();
    const arg = upsertMock.mock.calls[0]![0];
    expect(arg.where.email).toBe('kathelijne@equismile.demo');
  });
});
