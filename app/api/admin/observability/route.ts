import { NextResponse } from 'next/server';

import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { deadLetterService } from '@/lib/services/dead-letter.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { opsStatusService } from '@/lib/services/ops-status.service';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability
 *
 * Bundled feed for the admin observability page: ops snapshot (DLQ
 * depth / backup freshness / audit count), most recent 50 DLQ entries,
 * most recent 50 audit entries. Admin-only — audit rows carry actor
 * identifiers and target IDs that a non-admin should not see.
 *
 * One endpoint rather than three separate ones so the client can do a
 * single fetch + re-render on poll.
 */
export async function GET() {
  try {
    await requireRole(ROLES.ADMIN);

    const [ops, deadLetter, audit] = await Promise.all([
      opsStatusService.snapshot(),
      deadLetterService.list({ limit: 50 }),
      securityAuditService.recent({ limit: 50 }),
    ]);

    return NextResponse.json({
      ops,
      deadLetter: deadLetter.map((row) => ({
        id: row.id,
        scope: row.scope,
        status: row.status,
        attempts: row.attempts,
        lastError: row.lastError,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      audit: audit.map((row) => ({
        id: row.id,
        event: row.event,
        actor: row.actor,
        actorRole: row.actorRole,
        targetType: row.targetType,
        targetId: row.targetId,
        detail: row.detail,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
