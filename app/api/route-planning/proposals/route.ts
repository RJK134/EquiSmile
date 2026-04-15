import { NextRequest } from 'next/server';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { routeRunRepository } from '@/lib/repositories/route-run.repository';
import type { RouteRunStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const params = parseSearchParams(request.nextUrl.searchParams);

    const query = {
      status: params.status as RouteRunStatus | undefined,
      page: parseInt(params.page || '1', 10),
      pageSize: parseInt(params.pageSize || '20', 10),
    };

    const result = await routeRunRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
