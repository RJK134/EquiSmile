import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActorWithRole } from '@/lib/auth/api';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  cancelledReason: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await context.params;
    const body = await request.json();
    const payload = patchSchema.parse(body);
    const updated = await clinicalRecordService.updatePrescriptionStatus(
      id,
      payload.status,
      payload.cancelledReason,
    );
    await securityAuditService.log({
      action: 'clinical.prescription.update-status',
      entityType: 'prescription',
      entityId: id,
      actor,
      details: { status: payload.status },
    });
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
