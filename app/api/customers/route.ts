import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { createCustomerSchema, customerQuerySchema } from '@/lib/validations/customer.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const query = customerQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await customerRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const body = await request.json();
    const data = createCustomerSchema.parse(body);
    const customer = await customerRepository.create(data);
    await securityAuditService.log({
      action: 'customer.create',
      entityType: 'customer',
      entityId: customer.id,
      actor,
      details: { preferredChannel: customer.preferredChannel },
    });
    return successResponse(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
