import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { deadLetterService } from '@/lib/services/dead-letter.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(['REPLAYED', 'ABANDONED', 'PENDING']),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/observability/failed-operations/[id]
 *
 * Admin-only DLQ status transition. Used by the observability page to
 * let operators mark a failed operation as replayed (external fix
 * applied, clearing the queue) or abandoned (known won't-recover —
 * keep the row for history but stop counting it against the ops
 * snapshot).
 *
 * This endpoint does NOT re-run the failed operation itself — actual
 * replay is handled by the owning service (whatsappService, etc.) or
 * manually by the operator. The endpoint only manages the queue row's
 * bookkeeping.
 *
 * Every status change is audit-logged via SecurityAuditLog.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    const body = await request.json();
    const { status } = bodySchema.parse(body);

    const updated = await deadLetterService.markStatus(id, status);

    await securityAuditService.record({
      event: 'OTHER',
      actor: subject,
      targetType: 'FailedOperation',
      targetId: id,
      detail: `DLQ status → ${status}`,
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
