import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { yardRepository } from '@/lib/repositories/yard.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { updateYardSchema } from '@/lib/validations/yard.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const { id } = await context.params;
    const yard = await yardRepository.findById(id);
    if (!yard) return errorResponse('Yard not found', 404);
    return successResponse(yard);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateYardSchema.parse(body);
    const yard = await yardRepository.update(id, data);
    await securityAuditService.log({
      action: 'yard.update',
      entityType: 'yard',
      entityId: id,
      actor,
      details: data,
    });
    return successResponse(yard);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await context.params;
    await yardRepository.delete(id);
    await securityAuditService.log({
      action: 'yard.delete',
      entityType: 'yard',
      entityId: id,
      actor,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
