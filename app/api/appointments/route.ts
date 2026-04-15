/**
 * GET /api/appointments — List appointments with filters
 */

import { NextRequest } from 'next/server';
import { appointmentRepository } from '@/lib/repositories/appointment.repository';
import { appointmentQuerySchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const query = appointmentQuerySchema.parse(
      parseSearchParams(request.nextUrl.searchParams)
    );
    const result = await appointmentRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
