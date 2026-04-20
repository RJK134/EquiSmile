import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    idempotencyKey: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { idempotencyService } from '@/lib/services/idempotency.service';
import { prisma } from '@/lib/prisma';

describe('idempotencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasProcessed', () => {
    it('returns false when no row exists', async () => {
      (prisma.idempotencyKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      expect(await idempotencyService.hasProcessed('k')).toBe(false);
    });

    it('returns true when row exists without expiry', async () => {
      (prisma.idempotencyKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'k',
        scope: 's',
        createdAt: new Date(),
        expiresAt: null,
      });
      expect(await idempotencyService.hasProcessed('k')).toBe(true);
    });

    it('returns true when row exists with future expiry', async () => {
      (prisma.idempotencyKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'k',
        scope: 's',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await idempotencyService.hasProcessed('k')).toBe(true);
    });

    it('returns false AND deletes the stale row when expiry is past', async () => {
      (prisma.idempotencyKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'k',
        scope: 's',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 60_000),
      });
      (prisma.idempotencyKey.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
      expect(await idempotencyService.hasProcessed('k')).toBe(false);
      expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({ where: { key: 'k' } });
    });

    it('does not throw when the race-deletion of a stale row fails', async () => {
      (prisma.idempotencyKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'k',
        scope: 's',
        expiresAt: new Date(Date.now() - 60_000),
      });
      (prisma.idempotencyKey.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Record not found'),
      );
      await expect(idempotencyService.hasProcessed('k')).resolves.toBe(false);
    });
  });

  describe('markProcessed', () => {
    it('upserts with an expiry when ttlMs is given', async () => {
      (prisma.idempotencyKey.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
      await idempotencyService.markProcessed('k', 'scope-A', 60_000);
      const call = (prisma.idempotencyKey.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where).toEqual({ key: 'k' });
      expect(call.create.key).toBe('k');
      expect(call.create.scope).toBe('scope-A');
      expect(call.create.expiresAt).toBeInstanceOf(Date);
    });

    it('upserts with null expiresAt when ttlMs is omitted', async () => {
      (prisma.idempotencyKey.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
      await idempotencyService.markProcessed('k', 'scope-B');
      const call = (prisma.idempotencyKey.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.create.expiresAt).toBeNull();
    });
  });

  describe('pruneExpired', () => {
    it('deletes rows with expiresAt before the given cutoff and returns the count', async () => {
      (prisma.idempotencyKey.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });
      const cutoff = new Date('2026-05-01T00:00:00Z');
      const count = await idempotencyService.pruneExpired(cutoff);
      expect(count).toBe(5);
      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: cutoff } },
      });
    });
  });

  describe('clearAll', () => {
    it('deletes every row regardless of expiry and returns the count', async () => {
      (prisma.idempotencyKey.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });
      const count = await idempotencyService.clearAll();
      expect(count).toBe(3);
      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({});
    });
  });
});
