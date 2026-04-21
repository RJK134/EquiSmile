/**
 * POST /api/appointments/[id]/reschedule — Initiate reschedule
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { rescheduleAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await params;
    const body = await request.json();
    const { notes } = rescheduleAppointmentSchema.parse(body);
    const result = await rescheduleService.rescheduleAppointment(id, notes);
    await securityAuditService.log({
      action: 'appointment.reschedule',
      entityType: 'appointment',
      entityId: id,
      actor,
      details: { notes: notes ?? null },
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
