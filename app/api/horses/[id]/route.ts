import { NextRequest } from 'next/server';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { updateHorseSchema } from '@/lib/validations/horse.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const horse = await horseRepository.findById(id);
    if (!horse) return errorResponse('Horse not found', 404);
    return successResponse(horse);
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
    const data = updateHorseSchema.parse(body);
    const horse = await horseRepository.update(id, data);
    return successResponse(horse);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

/**
 * Deleting a horse cascades attachments/findings/charts/prescriptions,
 * so it's treated as a clinical-record mutation — VET-only plus an audit
 * entry for traceability.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await context.params;
    await horseRepository.delete(id);
    await securityAuditService.record({
      event: 'HORSE_DELETED',
      actor: subject,
      targetType: 'Horse',
      targetId: id,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
