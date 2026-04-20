import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    securityAuditLog: {
      create: createMock,
      findMany: findManyMock,
    },
  },
}));

import { securityAuditService } from '@/lib/services/security-audit.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('securityAuditService.record', () => {
  it('records an event with a subject actor', async () => {
    createMock.mockResolvedValue({ id: 'a1' });
    await securityAuditService.record({
      event: 'EXPORT_DATASET',
      actor: { id: 'u1', email: 'r@example.com', githubLogin: 'rjk134', role: 'admin', actorLabel: 'rjk134' },
      targetType: 'vetup-export',
      targetId: 'patient',
      detail: 'profile=patient; size=1024 bytes',
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        event: 'EXPORT_DATASET',
        actor: 'rjk134',
        actorRole: 'admin',
        targetType: 'vetup-export',
        targetId: 'patient',
        detail: 'profile=patient; size=1024 bytes',
      },
    });
  });

  it('records "system" when the actor is null', async () => {
    createMock.mockResolvedValue({ id: 'a2' });
    await securityAuditService.record({ event: 'OTHER', actor: null });
    const call = createMock.mock.calls[0][0];
    expect(call.data.actor).toBe('system');
    expect(call.data.actorRole).toBeNull();
  });

  it('truncates detail longer than 500 characters', async () => {
    createMock.mockResolvedValue({ id: 'a3' });
    const big = 'x'.repeat(700);
    await securityAuditService.record({ event: 'OTHER', actor: null, detail: big });
    const call = createMock.mock.calls[0][0];
    expect(call.data.detail.length).toBe(500);
    expect(call.data.detail.endsWith('…')).toBe(true);
  });

  it('does not throw when Prisma create fails (best-effort)', async () => {
    createMock.mockRejectedValue(new Error('db down'));
    await expect(
      securityAuditService.record({ event: 'OTHER', actor: null }),
    ).resolves.toBeUndefined();
  });

  it('accepts a minimal {actorLabel, role} actor for low-level callers', async () => {
    createMock.mockResolvedValue({ id: 'a4' });
    await securityAuditService.record({
      event: 'SIGN_IN_DENIED',
      actor: { actorLabel: 'denied-via:github' },
    });
    const call = createMock.mock.calls[0][0];
    expect(call.data.actor).toBe('denied-via:github');
    expect(call.data.actorRole).toBeNull();
  });
});

describe('securityAuditService.recent', () => {
  it('limits the query between 1 and 1000 entries', async () => {
    findManyMock.mockResolvedValue([]);
    await securityAuditService.recent({ limit: 0 });
    expect(findManyMock.mock.calls[0][0].take).toBe(1);

    await securityAuditService.recent({ limit: 5000 });
    expect(findManyMock.mock.calls[1][0].take).toBe(1000);

    await securityAuditService.recent();
    expect(findManyMock.mock.calls[2][0].take).toBe(100);
  });

  it('filters by event when provided', async () => {
    findManyMock.mockResolvedValue([]);
    await securityAuditService.recent({ event: 'EXPORT_DATASET' });
    expect(findManyMock.mock.calls[0][0].where).toEqual({ event: 'EXPORT_DATASET' });
  });
});
