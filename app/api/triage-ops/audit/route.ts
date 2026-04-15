import { NextRequest } from 'next/server';
import { overrideService } from '@/lib/services/override.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/triage-ops/audit?visitRequestId=xxx
 * Get audit history for a visit request.
 */
export async function GET(request: NextRequest) {
  try {
    const visitRequestId = request.nextUrl.searchParams.get('visitRequestId');
    if (!visitRequestId) {
      return errorResponse('visitRequestId is required', 400);
    }

    const history = await overrideService.getAuditHistory(visitRequestId);
    return successResponse(history);
  } catch (error) {
    return handleApiError(error);
  }
}
