import { NextRequest } from 'next/server';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { updateCustomerSchema } from '@/lib/validations/customer.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const customer = await customerRepository.findById(id);
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
 * Customer deletion is ADMIN-only and audited — a customer row owns
 * yards, horses, enquiries, and visit requests; removing it destroys a
 * lot of downstream data.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const { id } = await context.params;
    await customerRepository.delete(id);
    await securityAuditService.record({
      event: 'CUSTOMER_DELETED',
      actor: subject,
      targetType: 'Customer',
      targetId: id,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
