/**
 * POST /api/appointments/[id]/complete — Mark complete with outcome
 */

import { NextRequest } from 'next/server';
import { visitOutcomeService } from '@/lib/services/visit-outcome.service';
import { completeAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = completeAppointmentSchema.parse(body);
    const result = await visitOutcomeService.completeAppointment(id, input);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
