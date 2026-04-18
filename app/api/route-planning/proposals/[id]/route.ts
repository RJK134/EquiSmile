import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { routeRunRepository } from '@/lib/repositories/route-run.repository';
import { validateRouteConstraints } from '@/lib/config/route-constraints';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const routeRun = await routeRunRepository.findById(id);

    if (!routeRun) {
      return errorResponse('Route run not found', 404);
    }

    return successResponse(routeRun);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'PROPOSED', 'APPROVED', 'BOOKED', 'COMPLETED']).optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const routeRun = await routeRunRepository.findById(id);

    if (!routeRun) {
      return errorResponse('Route run not found', 404);
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    // Hard constraint check: validate before approving a route
    if (data.status === 'APPROVED') {
      const totalHorses = routeRun.totalHorses ?? 0;
      const totalTravelMinutes = routeRun.totalTravelMinutes ?? 0;
      const totalVisitMinutes = routeRun.totalVisitMinutes ?? 0;
      const stopCount = routeRun.stops?.length ?? 0;

      const violations = validateRouteConstraints({
        totalTravelMinutes,
        stopCount,
        totalHorses,
        totalWorkMinutes: totalTravelMinutes + totalVisitMinutes,
      });

      if (violations.length > 0) {
        return errorResponse(
          `Cannot approve route — constraint violations: ${violations.map((v) => v.message).join('; ')}`,
          422,
        );
      }
    }

    const updated = await routeRunRepository.update(id, data);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
