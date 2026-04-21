import { NextRequest } from 'next/server';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { createTriageTaskSchema, triageTaskQuerySchema } from '@/lib/validations/triage-task.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const query = triageTaskQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await triageTaskRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.NURSE);
    const body = await request.json();
    const data = createTriageTaskSchema.parse(body);
    const task = await triageTaskRepository.create(data);
    return successResponse(task, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
