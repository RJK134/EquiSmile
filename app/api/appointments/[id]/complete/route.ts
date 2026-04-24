/**
 * POST /api/appointments/[id]/complete — Mark complete with outcome
 *
 * VET+ only. Completion is a clinical outcome record — it persists the
 * visit result, may create follow-up visit requests, and updates horse
 * dental due dates. Readonly sessions must not be able to trigger it.
 */

import { NextRequest } from 'next/server';
import { visitOutcomeService } from '@/lib/services/visit-outcome.service';
import { completeAppointmentSchema } from '@/lib/validations/appointment.schema';
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
    const input = completeAppointmentSchema.parse(body);
    const result = await visitOutcomeService.completeAppointment(id, input, {
      actor: subject.actorLabel,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
