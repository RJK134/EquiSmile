import { NextRequest } from 'next/server';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { updateVisitRequestSchema } from '@/lib/validations/visit-request.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const vr = await visitRequestRepository.findById(id);
    if (!vr) return errorResponse('Visit request not found', 404);
    return successResponse(vr);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = updateVisitRequestSchema.parse(body);
    const vr = await visitRequestRepository.update(id, data);
    return successResponse(vr);
  } catch (error) {
    return handleApiError(error);
  }
}
