/**
 * POST /api/appointments/[id]/confirm — Send/resend confirmation
 *
 * VET+ only. Dispatching customer-facing confirmations is a clinical
 * operational action; readonly sessions must not be able to trigger it
 * (each send hits Meta/SMTP and may flip the appointment to CONFIRMED).
 */

import { NextRequest } from 'next/server';
import { confirmationService } from '@/lib/services/confirmation.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await params;
    const result = await confirmationService.sendConfirmation(id, {
      actor: subject.actorLabel,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
