/**
 * POST /api/appointments/[id]/cancel — Cancel appointment
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { cancelAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = cancelAppointmentSchema.parse(body);
    const result = await rescheduleService.cancelAppointment(id, reason);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
