import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  cancelledReason: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = patchSchema.parse(body);
    const updated = await clinicalRecordService.updatePrescriptionStatus(
      id,
      payload.status,
      payload.cancelledReason,
    );
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
