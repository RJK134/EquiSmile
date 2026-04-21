/**
 * POST /api/appointments/[id]/no-show — Mark as no-show
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { rescheduleService } from '@/lib/services/reschedule.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await params;
    await rescheduleService.markNoShow(id);
    await securityAuditService.log({
      action: 'appointment.no-show',
      entityType: 'appointment',
      entityId: id,
      actor,
    });
    return successResponse({ appointmentId: id, status: 'NO_SHOW' });
  } catch (error) {
    return handleApiError(error);
  }
}
