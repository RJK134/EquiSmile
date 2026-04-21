import { NextRequest } from 'next/server';
import { missingInfoService } from '@/lib/services/missing-info.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

/**
 * POST /api/triage-ops/follow-up
 * Send a follow-up message for a visit request with missing info.
 * NURSE+ — sends outbound customer messaging.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.NURSE);
    const { visitRequestId } = await request.json();
    if (!visitRequestId) {
      return errorResponse('visitRequestId is required', 400);
    }

    const result = await missingInfoService.sendFollowUp(visitRequestId);
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

/**
 * GET /api/triage-ops/follow-up
 * Get overdue follow-ups that need reminders or escalation.
 */
export async function GET() {
  try {
    await requireRole(ROLES.READONLY);
    const result = await missingInfoService.findOverdueFollowUps();
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
