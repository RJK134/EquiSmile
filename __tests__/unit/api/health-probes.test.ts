import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const ORIGINAL_FETCH = globalThis.fetch;

describe('GET /api/health/live', () => {
  it('returns 200 with status: live and a stable, tiny body', async () => {
    const { GET } = await import('@/app/api/health/live/route');
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('live');
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('does NOT touch the database (cheap by design)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import('@/app/api/health/live/route');
    await GET();
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('HEAD /api/health/live', () => {
  it('returns 200 with no body', async () => {
    const { HEAD } = await import('@/app/api/health/live/route');
    const response = await HEAD();
    expect(response.status).toBe(200);
  });
});

describe('GET /api/health/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: n8n configured and reachable. Tests override per-case.
    process.env.N8N_API_KEY = 'present-for-tests';
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    delete process.env.N8N_API_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('returns 200 with status: ready when DB and n8n are up', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    vi.resetModules();

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.dependencies.database.status).toBe('up');
    expect(body.dependencies.n8n.status).toBe('up');
  });

  it('returns 503 with status: not-ready when DB is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    vi.resetModules();

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('not-ready');
    expect(body.dependencies.database.status).toBe('down');
  });

  it('returns 503 when n8n is unreachable AND configured', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.resetModules();

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.dependencies.n8n.status).toBe('down');
  });

  it('reports n8n as skipped (not down) when N8N_API_KEY is unset, and stays ready', async () => {
    // Operators who run without n8n must not see a permanent 503 from
    // their uptime monitor. The probe degrades to "not asserting".
    delete process.env.N8N_API_KEY;
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    globalThis.fetch = vi.fn(); // must NOT be called
    vi.resetModules();

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.dependencies.n8n.status).toBe('skipped');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does NOT echo n8n URL or env-var names (anonymous attack surface)', async () => {
    // Admin-only `/api/status` is allowed to leak this; the public
    // probe must not.
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    vi.resetModules();

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(body).not.toMatch(/N8N_API_KEY|GOOGLE_MAPS_API_KEY|WHATSAPP_/);
    expect(body).not.toMatch(/\/healthz/);
    expect(body).not.toMatch(/localhost|http:\/\/n8n/);
  });
});

describe('HEAD /api/health/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_API_KEY = 'present-for-tests';
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });
  afterEach(() => {
    delete process.env.N8N_API_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('returns 200 / no body when ready', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    vi.resetModules();
    const { HEAD } = await import('@/app/api/health/ready/route');
    const response = await HEAD();
    expect(response.status).toBe(200);
  });

  it('returns 503 / no body when DB down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('boom'));
    vi.resetModules();
    const { HEAD } = await import('@/app/api/health/ready/route');
    const response = await HEAD();
    expect(response.status).toBe(503);
  });
});
