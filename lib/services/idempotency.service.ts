import { prisma } from '@/lib/prisma';

/**
 * Phase 13 — Postgres-backed idempotency store (replaces the in-memory Set).
 *
 * - Survives app restarts.
 * - Shared across multiple app instances (horizontal scaling).
 * - `markProcessed` is upsert-based, so a concurrent double-mark is safe.
 * - Optional TTL via `expiresAt`; use `pruneExpired()` from a cron to keep
 *   the table bounded.
 */

export const idempotencyService = {
  async hasProcessed(key: string): Promise<boolean> {
    const row = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (!row) return false;
    if (row.expiresAt && row.expiresAt < new Date()) {
      // Expired — treat as fresh and delete the stale row.
      await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
      return false;
    }
    return true;
  },

  async markProcessed(key: string, scope: string, ttlMs?: number): Promise<void> {
    const expiresAt = typeof ttlMs === 'number' ? new Date(Date.now() + ttlMs) : null;
    await prisma.idempotencyKey.upsert({
      where: { key },
      create: { key, scope, expiresAt },
      update: { expiresAt },
    });
  },

  async pruneExpired(now: Date = new Date()): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  },

  async clearAll(): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({});
    return result.count;
  },
};
