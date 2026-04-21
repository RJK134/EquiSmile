import { NextRequest } from 'next/server';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { updateVisitRequestSchema } from '@/lib/validations/visit-request.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const vr = await visitRequestRepository.findById(id);
    if (!vr) return errorResponse('Visit request not found', 404);
    return successResponse(vr);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.NURSE);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateVisitRequestSchema.parse(body);
    const vr = await visitRequestRepository.update(id, data);
    return successResponse(vr);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
