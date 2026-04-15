import { NextRequest } from 'next/server';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { createVisitRequestSchema, visitRequestQuerySchema } from '@/lib/validations/visit-request.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = visitRequestQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await visitRequestRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createVisitRequestSchema.parse(body);
    const visitRequest = await visitRequestRepository.create(data);
    return successResponse(visitRequest, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
