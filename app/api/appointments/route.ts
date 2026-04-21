/**
 * GET /api/appointments — List appointments with filters
 */

import { NextRequest } from 'next/server';
import { appointmentRepository } from '@/lib/repositories/appointment.repository';
import { appointmentQuerySchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const query = appointmentQuerySchema.parse(
      parseSearchParams(request.nextUrl.searchParams)
    );
    const result = await appointmentRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
