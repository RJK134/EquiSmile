import { NextRequest } from 'next/server';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { createCustomerSchema, customerQuerySchema } from '@/lib/validations/customer.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

/**
 * Customer records carry PII (full name, phone, email, preferred
 * channel). READONLY is enough to LIST (vets need customer lookup on
 * day-to-day work) but creation is restricted to NURSE+ because a new
 * row represents a data-controller decision.
 */
export async function GET(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.READONLY);
    const query = customerQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    // Soft-deleted PII must stay hidden from non-admin sessions.
    // Silently downgrade the flag rather than 403-ing so an accidental
    // URL paste doesn't leak "this customer was deleted" as a side
    // channel. An admin gets the full tombstoned view.
    if (query.includeDeleted && subject.role !== ROLES.ADMIN) {
      query.includeDeleted = false;
    }
    const result = await customerRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.NURSE);
    const body = await request.json();
    const data = createCustomerSchema.parse(body);
    const customer = await customerRepository.create(data);
    return successResponse(customer, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
