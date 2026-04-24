/**
 * POST /api/appointments/[id]/reschedule — Initiate reschedule
 *
 * VET+ only. Same mutation surface as cancel (returns visit request to
 * pool) plus a rescheduling note and a customer acknowledgement.
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { rescheduleAppointmentSchema } from '@/lib/validations/appointment.schema';
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
    const { notes } = rescheduleAppointmentSchema.parse(body);
    const result = await rescheduleService.rescheduleAppointment(id, notes, {
      actor: subject.actorLabel,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
