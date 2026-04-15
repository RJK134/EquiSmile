import { NextRequest } from 'next/server';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { updateTriageTaskSchema } from '@/lib/validations/triage-task.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const task = await triageTaskRepository.findById(id);
    if (!task) return errorResponse('Triage task not found', 404);
    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = updateTriageTaskSchema.parse(body);
    const task = await triageTaskRepository.update(id, data);
    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}
