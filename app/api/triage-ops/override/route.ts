import { NextRequest } from 'next/server';
import { overrideService } from '@/lib/services/override.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { getCurrentUser, performedByFor } from '@/lib/auth/session';

/**
 * POST /api/triage-ops/override
 * Perform a manual override action on a visit request.
 *
 * Body: { action, visitRequestId, reason, ...actionParams }
 * performedBy is taken from the authenticated session, not the request body.
 * Actions: overrideUrgency, overrideRequestType, overridePlanningStatus,
 *          forceToPool, forceToUrgentReview, addClinicalNote
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, visitRequestId, reason } = body;

    if (!action || !visitRequestId || !reason) {
      return errorResponse('action, visitRequestId, and reason are required', 400);
    }

    const user = await getCurrentUser();
    const performedBy = performedByFor(user);

    const base = { visitRequestId, reason, performedBy };

    switch (action) {
      case 'overrideUrgency': {
        if (!body.urgencyLevel) return errorResponse('urgencyLevel is required', 400);
        const result = await overrideService.overrideUrgency({ ...base, urgencyLevel: body.urgencyLevel });
        return successResponse(result);
      }

      case 'overrideRequestType': {
        if (!body.requestType) return errorResponse('requestType is required', 400);
        const result = await overrideService.overrideRequestType({ ...base, requestType: body.requestType });
        return successResponse(result);
      }

      case 'overridePlanningStatus': {
        if (!body.planningStatus) return errorResponse('planningStatus is required', 400);
        const result = await overrideService.overridePlanningStatus({ ...base, planningStatus: body.planningStatus });
        return successResponse(result);
      }

      case 'forceToPool': {
        const result = await overrideService.forceToPool(base);
        return successResponse(result);
      }

      case 'forceToUrgentReview': {
        const result = await overrideService.forceToUrgentReview(base);
        return successResponse(result);
      }

      case 'addClinicalNote': {
        if (!body.note) return errorResponse('note is required', 400);
        const result = await overrideService.addClinicalNote({ ...base, note: body.note });
        return successResponse(result);
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
