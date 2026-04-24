/**
 * POST /api/appointments/[id]/no-show — Mark as no-show
 *
 * VET+ only. No-show is an operational state change with billing and
 * planning implications; readonly sessions must not be able to set it.
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await params;
    await rescheduleService.markNoShow(id, { actor: subject.actorLabel });
    return successResponse({ appointmentId: id, status: 'NO_SHOW' });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
