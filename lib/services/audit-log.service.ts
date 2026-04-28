import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { AuthenticatedSubject } from '@/lib/auth/rbac';
import { logger } from '@/lib/utils/logger';
import { redactAuditDetails } from '@/lib/utils/audit-redact';

/**
 * Phase 16 overnight hardening — generic business audit trail.
 *
 * Append-only sibling to `securityAuditService` (security events) and
 * the model-specific `triageAuditLog` / `appointmentStatusHistory`
 * tables. Use this when an operator action mutates a domain entity
 * that does not yet have its own tamper-evident log: enquiry tombstone,
 * yard restore, route-run status flip, bulk operator action.
 *
 * Hard rules:
 *   - `details` is summarised, redacted JSON. Never raw PII, never a
 *     full payload, never tokens or secrets.
 *   - Writes are best-effort. A failed audit write logs a warning and
 *     SWALLOWS the error — observability must never cascade into a
 *     caller-visible failure.
 *   - Append-only — there is no `update` or `delete` API exposed here.
 */

export interface RecordAuditInput {
  action: string;
  entityType: string;
  entityId: string;
  actor: AuthenticatedSubject | { id?: string; actorLabel?: string } | null;
  details?: Prisma.InputJsonValue;
}

function toUserId(actor: RecordAuditInput['actor']): string | null {
  if (!actor) return null;
  if ('id' in actor && typeof actor.id === 'string' && actor.id.length > 0) return actor.id;
  return null;
}

export const auditLogService = {
  async record(input: RecordAuditInput): Promise<void> {
    // The `details` JSON column is operator-supplied. Run it through
    // the audit-specific redactor (`lib/utils/audit-redact.ts`) so a
    // future caller passing a domain object — `{ before: customer }`
    // — cannot leak the customer's name / phone / message text into
    // the per-entity audit history. Safe payloads like
    // `{ reason: 'soft-delete' }` pass through unchanged.
    const safeDetails =
      input.details === undefined
        ? undefined
        : (redactAuditDetails(input.details) as Prisma.InputJsonValue);
    try {
      await prisma.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: toUserId(input.actor),
          details: safeDetails,
        },
      });
    } catch (error) {
      logger.warn('Audit log write failed', {
        service: 'audit-log',
        operation: 'record',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async listForEntity(entityType: string, entityId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  },

  async recent(limit = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  },
};
