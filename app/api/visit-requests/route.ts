import { NextRequest } from 'next/server';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { createVisitRequestSchema, visitRequestQuerySchema } from '@/lib/validations/visit-request.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const query = visitRequestQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await visitRequestRepository.findMany(query);
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
    const data = createVisitRequestSchema.parse(body);
    const visitRequest = await visitRequestRepository.create(data);
    return successResponse(visitRequest, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
