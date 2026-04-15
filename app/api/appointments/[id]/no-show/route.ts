/**
 * POST /api/appointments/[id]/no-show — Mark as no-show
 */

import { NextRequest } from 'next/server';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await rescheduleService.markNoShow(id);
    return successResponse({ appointmentId: id, status: 'NO_SHOW' });
  } catch (error) {
    return handleApiError(error);
  }
}
