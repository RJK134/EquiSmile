import { NextRequest } from 'next/server';
import { overrideService } from '@/lib/services/override.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

/**
 * GET /api/triage-ops/audit?visitRequestId=xxx
 * Get audit history for a visit request. Read-only — READONLY+.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const visitRequestId = request.nextUrl.searchParams.get('visitRequestId');
    if (!visitRequestId) {
      return errorResponse('visitRequestId is required', 400);
    }

    const history = await overrideService.getAuditHistory(visitRequestId);
    return successResponse(history);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
