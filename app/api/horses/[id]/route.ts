import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { updateHorseSchema } from '@/lib/validations/horse.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const { id } = await context.params;
    const horse = await horseRepository.findById(id);
    if (!horse) return errorResponse('Horse not found', 404);
    return successResponse(horse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateHorseSchema.parse(body);
    const horse = await horseRepository.update(id, data);
    await securityAuditService.log({
      action: 'horse.update',
      entityType: 'horse',
      entityId: id,
      actor,
      details: data,
    });
    return successResponse(horse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await context.params;
    await horseRepository.delete(id);
    await securityAuditService.log({
      action: 'horse.delete',
      entityType: 'horse',
      entityId: id,
      actor,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
