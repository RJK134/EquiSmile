/**
 * POST /api/appointments/[id]/complete — Mark complete with outcome
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { visitOutcomeService } from '@/lib/services/visit-outcome.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { completeAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await params;
    const body = await request.json();
    const input = completeAppointmentSchema.parse(body);
    const result = await visitOutcomeService.completeAppointment(id, input);
    await securityAuditService.log({
      action: 'appointment.complete',
      entityType: 'appointment',
      entityId: id,
      actor,
      details: input,
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
