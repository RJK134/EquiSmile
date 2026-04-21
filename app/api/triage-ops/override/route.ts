import { NextRequest } from 'next/server';
import { overrideService } from '@/lib/services/override.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

/**
 * POST /api/triage-ops/override
 * Perform a manual override action on a visit request.
 *
 * Body: { action, visitRequestId, reason, ...actionParams }
 * `performedBy` is derived from the authenticated RBAC subject, not the
 * request body — protects the audit trail against spoofed actors.
 * Overrides modify triage outcomes, so VET+ only.
 * Actions: overrideUrgency, overrideRequestType, overridePlanningStatus,
 *          forceToPool, forceToUrgentReview, addClinicalNote
 */
export async function POST(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.VET);
    const body = await request.json();
    const { action, visitRequestId, reason } = body;

    if (!action || !visitRequestId || !reason) {
      return errorResponse('action, visitRequestId, and reason are required', 400);
    }

    const performedBy = subject.actorLabel;

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
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
