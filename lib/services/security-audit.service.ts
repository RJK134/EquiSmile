import { prisma } from '@/lib/prisma';
import type { SecurityAuditEvent } from '@prisma/client';
import type { AuthenticatedSubject } from '@/lib/auth/rbac';

/**
 * Phase 14 PR B — security audit log.
 *
 * Append-only record of security-relevant events. Keep `detail` short,
 * human-readable, and free of secrets (access tokens, API keys, request
 * bodies, or full PII dumps).
 */

export interface RecordAuditEventInput {
  event: SecurityAuditEvent;
  actor: AuthenticatedSubject | { actorLabel: string; role?: string } | null;
  targetType?: string;
  targetId?: string;
  detail?: string;
}

function toActorString(
  actor: RecordAuditEventInput['actor'],
): { actor: string; actorRole: string | null } {
  if (!actor) return { actor: 'system', actorRole: null };
  const actorLabel = 'actorLabel' in actor ? actor.actorLabel : 'system';
  const role = 'role' in actor && typeof actor.role === 'string' ? actor.role : null;
  return { actor: actorLabel, actorRole: role };
}

export const securityAuditService = {
  async record(input: RecordAuditEventInput): Promise<void> {
    const { actor, actorRole } = toActorString(input.actor);
    try {
      await prisma.securityAuditLog.create({
        data: {
          event: input.event,
          actor,
          actorRole,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          detail: input.detail ? truncate(input.detail, 500) : null,
        },
      });
    } catch (error) {
      // Audit logging must NEVER break the primary request — best-effort
      // only, but we do surface the failure to the structured logger so
      // operators can alert on audit-write failure spikes.
      console.warn('[security-audit] failed to record event', {
        event: input.event,
        targetType: input.targetType,
        targetId: input.targetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async recent(options: { limit?: number; event?: SecurityAuditEvent } = {}) {
    const take = Math.min(Math.max(options.limit ?? 100, 1), 1000);
    return prisma.securityAuditLog.findMany({
      where: options.event ? { event: options.event } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
  },
};

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}
