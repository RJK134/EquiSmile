import { NextRequest } from 'next/server';
import { missingInfoService } from '@/lib/services/missing-info.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/triage-ops/follow-up
 * Send a follow-up message for a visit request with missing info.
 */
export async function POST(request: NextRequest) {
  try {
    const { visitRequestId } = await request.json();
    if (!visitRequestId) {
      return errorResponse('visitRequestId is required', 400);
    }

    const result = await missingInfoService.sendFollowUp(visitRequestId);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/triage-ops/follow-up
 * Get overdue follow-ups that need reminders or escalation.
 */
export async function GET() {
  try {
    const result = await missingInfoService.findOverdueFollowUps();
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
