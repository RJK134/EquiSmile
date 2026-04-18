import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { routeRunRepository } from '@/lib/repositories/route-run.repository';
import { validateRouteConstraints } from '@/lib/config/route-constraints';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };
type RouteRunForApproval = NonNullable<Awaited<ReturnType<typeof routeRunRepository.findById>>>;

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

function sumIfComplete(values: Array<number | null | undefined>) {
  const completeValues = values.filter((value): value is number => value != null);

  if (completeValues.length !== values.length) {
    return null;
  }

  return completeValues.reduce((sum, value) => sum + value, 0);
}

function getRouteApprovalTotals(routeRun: RouteRunForApproval) {
  const totalTravelMinutes =
    routeRun.totalTravelMinutes ??
    (routeRun.stops.length === 0 ? 0 : sumIfComplete(routeRun.stops.map((stop) => stop.travelFromPrevMinutes)));
  const totalVisitMinutes =
    routeRun.totalVisitMinutes ??
    (routeRun.stops.length === 0 ? 0 : sumIfComplete(routeRun.stops.map((stop) => stop.serviceMinutes)));
  const totalHorses =
    routeRun.totalHorses ??
    (routeRun.stops.length === 0
      ? 0
      : sumIfComplete(routeRun.stops.map((stop) => stop.visitRequest?.horseCount)));

  if (totalTravelMinutes == null || totalVisitMinutes == null || totalHorses == null) {
    return null;
  }

  return { totalTravelMinutes, totalVisitMinutes, totalHorses };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const routeRun = await routeRunRepository.findById(id);

    if (!routeRun) {
      return errorResponse('Route run not found', 404);
    }

    const body = await request.json();
    const data = updateSchema.parse(body);
    let updateData: typeof data | (typeof data & {
      totalHorses: number;
      totalTravelMinutes: number;
      totalVisitMinutes: number;
    }) = data;

    // Hard constraint check: validate before approving a route
    if (data.status === 'APPROVED') {
      const approvalTotals = getRouteApprovalTotals(routeRun);

      if (!approvalTotals) {
        return errorResponse(
          'Cannot approve route — route totals are incomplete and must be calculated before approval',
          422,
        );
      }

      const { totalHorses, totalTravelMinutes, totalVisitMinutes } = approvalTotals;
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

      updateData = {
        ...data,
        totalHorses,
        totalTravelMinutes,
        totalVisitMinutes,
      };
    }

    const updated = await routeRunRepository.update(id, updateData);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
