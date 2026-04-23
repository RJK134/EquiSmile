import { NextRequest } from 'next/server';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { updateHorseSchema } from '@/lib/validations/horse.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    // Admin-gated restore preview: an operator inspecting a tombstoned
    // row in the list view needs to open its detail before restoring.
    // Non-admin sessions silently drop the flag (see horses/route.ts).
    const includeDeleted =
      request.nextUrl.searchParams.get('includeDeleted') === 'true' &&
      subject.role === ROLES.ADMIN;
    const horse = await horseRepository.findById(id, { includeDeleted });
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
 * Horse deletion is a clinical-record mutation — VET-only and audited.
 * Phase 15 makes this a SOFT delete: the horse row is tombstoned with
 * `deletedAt` / `deletedById`; attachments, findings, dental charts and
 * prescriptions are retained (still reachable via the stable FK) so the
 * clinical history is not lost. Hard delete is reserved for explicit
 * GDPR/FADP erasure requests handled by an operator path outside the UI.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await context.params;
    await horseRepository.delete(id, subject.id);
    await securityAuditService.record({
      event: 'HORSE_DELETED',
      actor: subject,
      targetType: 'Horse',
      targetId: id,
      detail: 'soft-delete (deletedAt set)',
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
