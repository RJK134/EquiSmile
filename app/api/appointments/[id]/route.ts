/**
 * GET /api/appointments/[id] — Get appointment detail
 */

import { NextRequest } from 'next/server';
import { appointmentRepository } from '@/lib/repositories/appointment.repository';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const appointment = await appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    return successResponse(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}
