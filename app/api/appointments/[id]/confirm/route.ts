/**
 * POST /api/appointments/[id]/confirm — Send/resend confirmation
 */

import { NextRequest } from 'next/server';
import { confirmationService } from '@/lib/services/confirmation.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await confirmationService.sendConfirmation(id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
