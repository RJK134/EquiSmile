import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { staffService } from '@/lib/services/staff.service';
import { staffRepository } from '@/lib/repositories/staff.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { updateStaffSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireActorWithRole(['admin']);
    const { id } = await context.params;
    const staff = await staffRepository.findById(id);
    if (!staff) return errorResponse('Staff not found', 404);
    return successResponse(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateStaffSchema.parse(body);
    const updated = await staffService.update(id, payload);
    await securityAuditService.log({
      action: 'staff.update',
      entityType: 'staff',
      entityId: id,
      actor,
      details: payload,
    });
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await context.params;
    const staff = await staffService.deactivate(id);
    await securityAuditService.log({
      action: 'staff.deactivate',
      entityType: 'staff',
      entityId: id,
      actor,
      details: { active: false },
    });
    return successResponse(staff);
  } catch (error) {
    return handleApiError(error);
  }
}
