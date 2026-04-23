import { promises as fs } from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/prisma';

/**
 * Phase 16 — operational status service.
 *
 * Aggregates the signals an operator needs to know at a glance:
 *   - Dead-letter queue depth (operations we couldn't replay and gave
 *     up on). Anything > 0 deserves eyes.
 *   - Recent SecurityAuditLog entries (last 24h count + latest
 *     timestamp) so we can tell if the audit trail is actually
 *     filling up.
 *   - Backup freshness: scans the mounted /backups volume and reports
 *     the newest dump's age + size. Compose-native path (the Phase 16
 *     `backup` service writes here); falls back to BACKUP_DIR if the
 *     mount is not present.
 *
 * Reads only. Cheap queries + a directory scan. Intended to be polled
 * by the `/api/status` endpoint every few seconds; no caching because
 * staleness would be misleading.
 */

export interface DeadLetterStats {
  pending: number;
  abandoned: number;
  oldestPendingAt: string | null;
}

export interface AuditStats {
  last24h: number;
  latestAt: string | null;
  signIndeniedLast24h: number;
}

export interface BackupStats {
  present: boolean;
  path: string;
  newestFilename: string | null;
  newestAgeHours: number | null;
  newestSizeBytes: number | null;
  totalCount: number;
  totalSizeBytes: number;
  /** True when no file newer than `stale_after_hours` exists. */
  stale: boolean;
  staleAfterHours: number;
}

export interface OpsStatusSnapshot {
  deadLetter: DeadLetterStats;
  audit: AuditStats;
  backup: BackupStats;
  takenAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_HOURS = 36;

export const opsStatusService = {
  async snapshot(): Promise<OpsStatusSnapshot> {
    const [deadLetter, audit, backup] = await Promise.all([
      this.deadLetterStats(),
      this.auditStats(),
      this.backupStats(),
    ]);
    return { deadLetter, audit, backup, takenAt: new Date().toISOString() };
  },

  async deadLetterStats(): Promise<DeadLetterStats> {
    const [pending, abandoned, oldestPending] = await Promise.all([
      prisma.failedOperation.count({ where: { status: 'PENDING' } }),
      prisma.failedOperation.count({ where: { status: 'ABANDONED' } }),
      prisma.failedOperation.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      pending,
      abandoned,
      oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
    };
  },

  async auditStats(): Promise<AuditStats> {
    const since = new Date(Date.now() - DAY_MS);
    const [last24h, latest, signInDenied] = await Promise.all([
      prisma.securityAuditLog.count({ where: { createdAt: { gte: since } } }),
      prisma.securityAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.securityAuditLog.count({
        where: { event: 'SIGN_IN_DENIED', createdAt: { gte: since } },
      }),
    ]);
    return {
      last24h,
      latestAt: latest?.createdAt.toISOString() ?? null,
      signIndeniedLast24h: signInDenied,
    };
  },

  async backupStats(staleAfterHours = DEFAULT_STALE_HOURS): Promise<BackupStats> {
    const dir = process.env.BACKUP_DIR || '/backups';
    const base: BackupStats = {
      present: false,
      path: dir,
      newestFilename: null,
      newestAgeHours: null,
      newestSizeBytes: null,
      totalCount: 0,
      totalSizeBytes: 0,
      stale: true,
      staleAfterHours,
    };

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      // Directory missing — backup service probably not running yet.
      return base;
    }

    const candidates = entries.filter((name) =>
      /^equismile-.*\.sql\.gz$/.test(name),
    );

    if (candidates.length === 0) {
      return { ...base, present: true };
    }

    let newestMtimeMs = 0;
    let newestName: string | null = null;
    let newestSize = 0;
    let totalSize = 0;

    for (const name of candidates) {
      try {
        const stat = await fs.stat(path.join(dir, name));
        totalSize += stat.size;
        if (stat.mtimeMs > newestMtimeMs) {
          newestMtimeMs = stat.mtimeMs;
          newestName = name;
          newestSize = stat.size;
        }
      } catch {
        // Ignore individual file errors (rare, but a rotated file can
        // disappear between readdir and stat).
      }
    }

    if (!newestName) {
      return { ...base, present: true, totalCount: candidates.length };
    }

    const ageHours = (Date.now() - newestMtimeMs) / (60 * 60 * 1000);

    return {
      present: true,
      path: dir,
      newestFilename: newestName,
      newestAgeHours: round(ageHours, 2),
      newestSizeBytes: newestSize,
      totalCount: candidates.length,
      totalSizeBytes: totalSize,
      stale: ageHours > staleAfterHours,
      staleAfterHours,
    };
  },
};

function round(value: number, digits: number): number {
  const pow = 10 ** digits;
  return Math.round(value * pow) / pow;
}
