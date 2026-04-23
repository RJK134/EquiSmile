import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    failedOperation: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    securityAuditLog: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { opsStatusService } from '@/lib/services/ops-status.service';

describe('opsStatusService.deadLetterStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns pending + abandoned counts and oldest-pending timestamp', async () => {
    const oldest = new Date('2026-04-01T00:00:00Z');
    mockPrisma.failedOperation.count
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(1); // abandoned
    mockPrisma.failedOperation.findFirst.mockResolvedValue({ createdAt: oldest });

    const stats = await opsStatusService.deadLetterStats();
    expect(stats).toEqual({
      pending: 3,
      abandoned: 1,
      oldestPendingAt: oldest.toISOString(),
    });
  });

  it('returns null oldestPendingAt when queue is empty', async () => {
    mockPrisma.failedOperation.count.mockResolvedValue(0);
    mockPrisma.failedOperation.findFirst.mockResolvedValue(null);

    const stats = await opsStatusService.deadLetterStats();
    expect(stats.oldestPendingAt).toBeNull();
  });
});

describe('opsStatusService.auditStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports last-24h count, latest timestamp, and sign-in-denied count', async () => {
    const latest = new Date('2026-04-23T10:00:00Z');
    mockPrisma.securityAuditLog.count
      .mockResolvedValueOnce(42) // last24h
      .mockResolvedValueOnce(2); // sign-in-denied
    mockPrisma.securityAuditLog.findFirst.mockResolvedValue({ createdAt: latest });

    const stats = await opsStatusService.auditStats();
    expect(stats).toEqual({
      last24h: 42,
      latestAt: latest.toISOString(),
      signIndeniedLast24h: 2,
    });
  });
});

describe('opsStatusService.backupStats', () => {
  let tmpDir: string;
  const originalBackupDir = process.env.BACKUP_DIR;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'equismile-backup-'));
    process.env.BACKUP_DIR = tmpDir;
  });

  afterEach(async () => {
    if (originalBackupDir === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = originalBackupDir;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns `present: false` when the directory is missing', async () => {
    process.env.BACKUP_DIR = path.join(tmpDir, 'does-not-exist');
    const stats = await opsStatusService.backupStats();
    expect(stats.present).toBe(false);
    expect(stats.newestFilename).toBeNull();
    expect(stats.stale).toBe(true);
  });

  it('returns `present: true, totalCount: 0, stale: true` when the dir is empty', async () => {
    const stats = await opsStatusService.backupStats();
    expect(stats.present).toBe(true);
    expect(stats.totalCount).toBe(0);
    expect(stats.stale).toBe(true);
  });

  it('identifies the newest backup and computes age/size', async () => {
    const older = path.join(tmpDir, 'equismile-20260420T020000Z.sql.gz');
    const newer = path.join(tmpDir, 'equismile-20260422T020000Z.sql.gz');
    await fs.writeFile(older, 'x'.repeat(100));
    await fs.writeFile(newer, 'y'.repeat(250));

    const now = Date.now();
    // Force mtimes for determinism.
    await fs.utimes(older, new Date(now - 72 * 3600_000), new Date(now - 72 * 3600_000));
    await fs.utimes(newer, new Date(now - 5 * 3600_000), new Date(now - 5 * 3600_000));

    const stats = await opsStatusService.backupStats(36);
    expect(stats.newestFilename).toBe('equismile-20260422T020000Z.sql.gz');
    expect(stats.newestSizeBytes).toBe(250);
    expect(stats.totalCount).toBe(2);
    expect(stats.totalSizeBytes).toBe(350);
    expect(stats.stale).toBe(false);
    expect(stats.newestAgeHours).toBeGreaterThanOrEqual(4);
    expect(stats.newestAgeHours).toBeLessThanOrEqual(6);
  });

  it('flags stale when the newest backup is older than the threshold', async () => {
    const old = path.join(tmpDir, 'equismile-20260101T000000Z.sql.gz');
    await fs.writeFile(old, 'zz');
    const now = Date.now();
    await fs.utimes(old, new Date(now - 100 * 3600_000), new Date(now - 100 * 3600_000));

    const stats = await opsStatusService.backupStats(36);
    expect(stats.stale).toBe(true);
    expect(stats.staleAfterHours).toBe(36);
  });

  it('ignores non-equismile files', async () => {
    await fs.writeFile(path.join(tmpDir, 'README.md'), 'x');
    await fs.writeFile(path.join(tmpDir, 'note.txt'), 'x');
    const stats = await opsStatusService.backupStats();
    expect(stats.present).toBe(true);
    expect(stats.totalCount).toBe(0);
    expect(stats.newestFilename).toBeNull();
  });
});
