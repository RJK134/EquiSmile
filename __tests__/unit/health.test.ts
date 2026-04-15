import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing route handler
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

// Mock env module
vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    N8N_PROTOCOL: 'http',
    N8N_HOST: 'localhost',
    N8N_PORT: '5678',
  },
  getMissingRequiredVars: vi.fn().mockReturnValue([]),
  getN8nBaseUrl: vi.fn().mockReturnValue('http://localhost:5678'),
}));

// Mock fetch for n8n health check
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy when all checks pass', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    expect(body.checks.environment.status).toBe('ok');
    expect(body.checks.environment.missing).toEqual([]);
    expect(body.checks.n8n.status).toBe('up');
  });

  it('returns degraded when n8n is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.n8n.status).toBe('unreachable');
  });

  it('returns unhealthy when database is down', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error('Connection refused')
    );
    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('down');
  });

  it('returns unhealthy when required env vars are missing', async () => {
    const { getMissingRequiredVars } = await import('@/lib/env');
    vi.mocked(getMissingRequiredVars).mockReturnValueOnce(['DATABASE_URL']);
    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.environment.status).toBe('missing');
    expect(body.checks.environment.missing).toContain('DATABASE_URL');
  });

  it('includes ISO timestamp in response', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    // Verify ISO 8601 format
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
