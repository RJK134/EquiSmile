/**
 * POST /api/appointments/[id]/cancel — Cancel appointment
 *
 * VET+ only. Readonly sessions cannot cancel, because cancellation
 * mutates appointment status, returns the visit-request to the
 * planning pool, and fires a customer-facing acknowledgement.
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { cancelAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await params;
    const body = await request.json();
    const { reason } = cancelAppointmentSchema.parse(body);
    const result = await rescheduleService.cancelAppointment(id, reason, {
      actor: subject.actorLabel,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
