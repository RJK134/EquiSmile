import type { Prisma } from '@prisma/client';

import type { AuthenticatedActor } from '@/lib/auth/api';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';

interface SecurityAuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: Pick<AuthenticatedActor, 'userId' | 'staffId' | 'role'> | null;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILED';
  details?: Prisma.InputJsonValue;
}

export const securityAuditService = {
  async log(input: SecurityAuditInput): Promise<void> {
    try {
      await prisma.securityAuditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          actorUserId: input.actor?.userId ?? null,
          actorStaffId: input.actor?.staffId ?? null,
          actorRole: input.actor?.role ?? null,
          outcome: input.outcome ?? 'SUCCESS',
          details: input.details ?? undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to write security audit log', error, {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
      });
    }
  },
};
