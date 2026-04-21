/**
 * POST /api/appointments/[id]/confirm — Send/resend confirmation
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { confirmationService } from '@/lib/services/confirmation.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await params;
    const result = await confirmationService.sendConfirmation(id);
    await securityAuditService.log({
      action: 'appointment.confirmation.send',
      entityType: 'appointment',
      entityId: id,
      actor,
      outcome: result.sent ? 'SUCCESS' : 'FAILED',
      details: { channel: result.channel, error: result.error ?? null },
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
