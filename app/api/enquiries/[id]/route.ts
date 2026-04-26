import { NextRequest } from 'next/server';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { updateEnquirySchema } from '@/lib/validations/enquiry.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { auditLogService } from '@/lib/services/audit-log.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) return errorResponse('Enquiry not found', 404);
    return successResponse(enquiry);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.NURSE);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateEnquirySchema.parse(body);
    const enquiry = await enquiryRepository.update(id, data);
    return successResponse(enquiry);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

/**
 * Enquiry deletion is ADMIN-only and audited. The Phase 16 first slice
 * added soft-delete fields (`deletedAt` / `deletedById`) and the
 * repository primitive but no HTTP entry point — admins could delete
 * customers/yards/horses but not misrouted spam enquiries. This handler
 * closes that gap.
 *
 * Soft-delete only. The row is tombstoned and excluded from standard
 * list reads; an admin can still surface it via
 * `GET /api/enquiries?includeDeleted=true`. Hard delete is reserved
 * for explicit GDPR/FADP erasure handled outside the UI.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    await enquiryRepository.delete(id, subject.id);

    // Two audit trails on purpose:
    //   - SecurityAuditLog mirrors the customer/yard/horse deletion
    //     pattern; gives the security review a single table to query.
    //   - AuditLog (generic business trail introduced in PR #51) gives
    //     the operator a per-entity history at /admin/observability.
    await securityAuditService.record({
      event: 'ENQUIRY_DELETED',
      actor: subject,
      targetType: 'Enquiry',
      targetId: id,
      detail: 'soft-delete (deletedAt set)',
    });
    await auditLogService.record({
      action: 'ENQUIRY_DELETED',
      entityType: 'Enquiry',
      entityId: id,
      actor: subject,
      details: { reason: 'soft-delete' },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
