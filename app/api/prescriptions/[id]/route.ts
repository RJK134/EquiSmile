import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  cancelledReason: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await context.params;
    const body = await request.json();
    const payload = patchSchema.parse(body);
    const updated = await clinicalRecordService.updatePrescriptionStatus(
      id,
      payload.status,
      payload.cancelledReason,
    );
    await securityAuditService.record({
      event: 'PRESCRIPTION_STATUS_CHANGED',
      actor: subject,
      targetType: 'Prescription',
      targetId: id,
      detail: `status=${payload.status}`,
    });
    return successResponse(updated);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
