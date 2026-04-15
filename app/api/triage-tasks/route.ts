import { NextRequest } from 'next/server';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { createTriageTaskSchema, triageTaskQuerySchema } from '@/lib/validations/triage-task.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = triageTaskQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await triageTaskRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createTriageTaskSchema.parse(body);
    const task = await triageTaskRepository.create(data);
    return successResponse(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
