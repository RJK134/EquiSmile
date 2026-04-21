/**
 * POST /api/appointments/[id]/cancel — Cancel appointment
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { cancelAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await params;
    const body = await request.json();
    const { reason } = cancelAppointmentSchema.parse(body);
    const result = await rescheduleService.cancelAppointment(id, reason);
    await securityAuditService.log({
      action: 'appointment.cancel',
      entityType: 'appointment',
      entityId: id,
      actor,
      details: { reason: reason ?? null },
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
