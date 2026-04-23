import { NextRequest } from 'next/server';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { updateCustomerSchema } from '@/lib/validations/customer.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    // Admin-gated restore preview: an operator inspecting a tombstoned
    // row in the list view needs to open its detail before restoring.
    // Non-admin sessions silently drop the flag (see customers/route.ts).
    const includeDeleted =
      request.nextUrl.searchParams.get('includeDeleted') === 'true' &&
      subject.role === ROLES.ADMIN;
    const customer = await customerRepository.findById(id, { includeDeleted });
    if (!customer) return errorResponse('Customer not found', 404);
    return successResponse(customer);
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
    const data = updateCustomerSchema.parse(body);
    const customer = await customerRepository.update(id, data);
    return successResponse(customer);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

/**
 * Customer deletion is ADMIN-only and audited. Phase 15 makes this a
 * SOFT delete: the row (and its owned yards/horses) is tombstoned with
 * `deletedAt` / `deletedById` and list/detail reads filter it out, but
 * the data is retained for audit and recovery. Hard delete is reserved
 * for explicit GDPR/FADP erasure requests handled by an operator path
 * outside the UI.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    await customerRepository.delete(id, subject.id);
    await securityAuditService.record({
      event: 'CUSTOMER_DELETED',
      actor: subject,
      targetType: 'Customer',
      targetId: id,
      detail: 'soft-delete (deletedAt set)',
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
