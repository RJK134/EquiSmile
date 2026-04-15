import { NextRequest } from 'next/server';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { updateHorseSchema } from '@/lib/validations/horse.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
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
    const { id } = await context.params;
    const body = await request.json();
    const data = updateHorseSchema.parse(body);
    const horse = await horseRepository.update(id, data);
    return successResponse(horse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await horseRepository.delete(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
