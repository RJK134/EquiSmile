import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { updateCustomerSchema } from '@/lib/validations/customer.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const { id } = await context.params;
    const customer = await customerRepository.findById(id);
    if (!customer) return errorResponse('Customer not found', 404);
    return successResponse(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateCustomerSchema.parse(body);
    const customer = await customerRepository.update(id, data);
    await securityAuditService.log({
      action: 'customer.update',
      entityType: 'customer',
      entityId: id,
      actor,
      details: data,
    });
    return successResponse(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const { id } = await context.params;
    await customerRepository.delete(id);
    await securityAuditService.log({
      action: 'customer.delete',
      entityType: 'customer',
      entityId: id,
      actor,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
