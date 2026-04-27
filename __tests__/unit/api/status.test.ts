import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression for Bugbot #3 (Low): the n8n liveness probe in
 * /api/status used to gate `'unconfigured'` on `!env.N8N_HOST`, but
 * `lib/env.ts` defaults `N8N_HOST` to `'localhost'`. The branch was
 * dead code: when n8n is not deployed the probe burned a 3-second
 * timeout and reported `'unreachable'` instead of `'unconfigured'`.
 *
 * The fix keys the unconfigured branch on `N8N_API_KEY` — the
 * credential every n8n callback already fail-closes on. This test
 * locks the new behaviour in.
 */

const requireRoleMock = vi.hoisted(() => vi.fn());
const opsSnapshotMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }));

vi.mock('@/lib/auth/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/rbac')>('@/lib/auth/rbac');
  return { ...actual, requireRole: requireRoleMock };
});

vi.mock('@/lib/services/ops-status.service', () => ({
  opsStatusService: { snapshot: opsSnapshotMock },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));

vi.mock('@/lib/integrations/google-maps.client', () => ({
  googleMapsClient: { getMode: () => 'demo' },
}));
vi.mock('@/lib/integrations/whatsapp.client', () => ({
  whatsappClient: { getMode: () => 'demo' },
}));
vi.mock('@/lib/integrations/smtp.client', () => ({
  smtpClient: { getMode: () => 'demo' },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Restore env between tests so each one gets a clean slate; the
  // status route reads `env.N8N_API_KEY` from the validated module-
  // level object, so we have to re-import after every env change.
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  requireRoleMock.mockResolvedValue({
    id: 'u-admin',
    email: 'admin@example.com',
    githubLogin: 'admin',
    role: 'admin',
    actorLabel: 'admin',
  });
  opsSnapshotMock.mockResolvedValue({
    deadLetter: { pending: 0, abandoned: 0, oldestPendingAt: null },
    audit: { last24h: 0, latestAt: null, signInDeniedLast24h: 0 },
    backup: {
      present: false,
      path: '/backups',
      newestFilename: null,
      newestAgeHours: null,
      newestSizeBytes: null,
      totalCount: 0,
      totalSizeBytes: 0,
      stale: true,
      staleAfterHours: 36,
    },
    takenAt: '2026-04-25T22:00:00Z',
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/status — n8n probe', () => {
  it("reports 'unconfigured' when N8N_API_KEY is unset, never burns the 3s timeout", async () => {
    process.env.N8N_API_KEY = '';
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost/placeholder';

    const start = Date.now();
    const { GET } = await import('@/app/api/status/route');
    const response = await GET();
    const elapsed = Date.now() - start;
    const body = await response.json();

    expect(body.probes.n8n.status).toBe('unconfigured');
    expect(body.probes.n8n.latencyMs).toBe(0);
    // Sanity: the unconfigured branch must short-circuit before any
    // network call. fetch must not have been invoked.
    expect(fetchMock).not.toHaveBeenCalled();
    // 3s timeout would push elapsed >2900; assert we are well under.
    expect(elapsed).toBeLessThan(1500);
  });

  it("reports 'up' when N8N_API_KEY is set and the probe responds 200", async () => {
    process.env.N8N_API_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost/placeholder';
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const { GET } = await import('@/app/api/status/route');
    const response = await GET();
    const body = await response.json();

    expect(body.probes.n8n.status).toBe('up');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports 'unreachable' when N8N_API_KEY is set but the probe throws", async () => {
    process.env.N8N_API_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost/placeholder';
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const { GET } = await import('@/app/api/status/route');
    const response = await GET();
    const body = await response.json();

    expect(body.probes.n8n.status).toBe('unreachable');
  });
});
