import { NextRequest } from 'next/server';
import { yardRepository } from '@/lib/repositories/yard.repository';
import { updateYardSchema } from '@/lib/validations/yard.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const yard = await yardRepository.findById(id);
    if (!yard) return errorResponse('Yard not found', 404);
    return successResponse(yard);
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
    const data = updateYardSchema.parse(body);
    const yard = await yardRepository.update(id, data);
    return successResponse(yard);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

/**
 * Soft delete (Phase 15). Also cascades tombstones to horses whose
 * primary yard was this one, so list views stop showing rows pinned to
 * an invisible yard.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    await yardRepository.delete(id, subject.id);
    await securityAuditService.record({
      event: 'YARD_DELETED',
      actor: subject,
      targetType: 'Yard',
      targetId: id,
      detail: 'soft-delete (deletedAt set)',
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
