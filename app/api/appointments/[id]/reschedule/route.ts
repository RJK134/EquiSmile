/**
 * POST /api/appointments/[id]/reschedule — Initiate reschedule
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { rescheduleAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { notes } = rescheduleAppointmentSchema.parse(body);
    const result = await rescheduleService.rescheduleAppointment(id, notes);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
