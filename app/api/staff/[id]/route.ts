import { NextRequest } from 'next/server';
import { staffService } from '@/lib/services/staff.service';
import { staffRepository } from '@/lib/repositories/staff.repository';
import { updateStaffSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const staff = await staffRepository.findById(id);
    if (!staff) return errorResponse('Staff not found', 404);
    return successResponse(staff);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateStaffSchema.parse(body);
    const before = await staffRepository.findById(id);
    const updated = await staffService.update(id, payload);
    if (before && payload.role && before.role !== updated.role) {
      await securityAuditService.record({
        event: 'ROLE_CHANGED',
        actor: subject,
        targetType: 'Staff',
        targetId: id,
        detail: `${before.role} \u2192 ${updated.role}`,
      });
    } else {
      await securityAuditService.record({
        event: 'STAFF_UPDATED',
        actor: subject,
        targetType: 'Staff',
        targetId: id,
      });
    }
    return successResponse(updated);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    const staff = await staffService.deactivate(id);
    await securityAuditService.record({
      event: 'STAFF_DEACTIVATED',
      actor: subject,
      targetType: 'Staff',
      targetId: id,
    });
    return successResponse(staff);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
